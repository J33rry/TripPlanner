import Groq from "groq-sdk";
import { validateTrip } from "@/lib/schema";
import { parseAIResponse } from "@/lib/parseResponse";
import { buildPrompt, buildRefinePrompt } from "@/lib/prompt";
import { DEFAULT_GROQ_MODEL } from "@/lib/constants";
import { TRIP_JSON_SCHEMA } from "@/lib/tripJsonSchema";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request) {
  try {
    // Validate API key exists
    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userInput, existingTrip, refinement } = body;

    if (!userInput && !refinement) {
      return Response.json(
        { error: "Please provide a trip description." },
        { status: 400 }
      );
    }

    // Build the prompt (initial or refinement)
    let prompt;
    if (refinement && existingTrip) {
      prompt = buildRefinePrompt(existingTrip, refinement);
    } else {
      prompt = buildPrompt(userInput);
    }

    // Call Groq API
    const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    const isGptOss = model.startsWith("openai/gpt-oss");
    const completionRequest = {
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      model,
      temperature: 0.7,
      // Reasoning tokens count toward this limit on gpt-oss models, and the
      // itinerary now carries coordinates, so leave generous headroom.
      max_completion_tokens: 8192,
      ...(isGptOss
        ? {
            // Keep hidden reasoning short so the plan arrives quickly, and use
            // strict structured outputs so the JSON can't come back malformed.
            reasoning_effort: "low",
            response_format: {
              type: "json_schema",
              json_schema: { name: "trip_itinerary", schema: TRIP_JSON_SCHEMA, strict: true },
            },
          }
        : // Other models may not support strict schemas or reasoning_effort.
          { response_format: { type: "json_object" } }),
    };

    let chatCompletion;
    try {
      chatCompletion = await groq.chat.completions.create(completionRequest);
    } catch (err) {
      // Groq rejects generations that fail its JSON check; one retry usually succeeds.
      if (err?.error?.error?.code !== "json_validate_failed") throw err;
      chatCompletion = await groq.chat.completions.create(completionRequest);
    }

    const rawContent = chatCompletion.choices?.[0]?.message?.content;

    if (!rawContent) {
      return Response.json(
        {
          error: "The AI returned an empty response. Please try again.",
          retryable: true,
        },
        { status: 502 }
      );
    }

    // Parse the response (with repair strategies)
    const parsed = parseAIResponse(rawContent);

    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error,
          raw: parsed.raw,
          retryable: true,
        },
        { status: 422 }
      );
    }

    // Validate against schema
    const validated = validateTrip(parsed.data);

    if (!validated.success) {
      return Response.json(
        {
          error: "The AI response didn't match the expected format.",
          details: validated.errors,
          raw: JSON.stringify(parsed.data).substring(0, 500),
          retryable: true,
        },
        { status: 422 }
      );
    }

    return Response.json({ success: true, data: validated.data });
  } catch (err) {
    // Keep logs readable: Groq errors can embed the model's whole output.
    console.error("API route error:", err?.status ?? "", String(err?.message ?? err).slice(0, 300));

    // Handle Groq-specific errors
    if (err?.status === 429) {
      return Response.json(
        {
          error: "Rate limit exceeded. Please wait a moment and try again.",
          retryable: true,
        },
        { status: 429 }
      );
    }

    if (err?.error?.error?.code === "json_validate_failed") {
      return Response.json(
        { error: "The AI's answer came back garbled. Please try again.", retryable: true },
        { status: 502 }
      );
    }

    if (err?.status === 401) {
      return Response.json(
        { error: "Invalid API key. Please check your GROQ_API_KEY." },
        { status: 401 }
      );
    }

    return Response.json(
      {
        error: "Something went wrong while generating your trip. Please try again.",
        retryable: true,
      },
      { status: 500 }
    );
  }
}
