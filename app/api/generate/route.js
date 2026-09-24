import Groq from "groq-sdk";
import { validateTrip } from "@/lib/schema";
import { parseAIResponse } from "@/lib/parseResponse";
import { buildPrompt, buildRefinePrompt } from "@/lib/prompt";

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
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      model: "openai/gpt-oss-120b",
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });

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
    console.error("API route error:", err);

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
