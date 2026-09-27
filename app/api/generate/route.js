import Groq from "groq-sdk";
import { validateTrip } from "@/lib/schema";
import { parseAIResponse } from "@/lib/parseResponse";
import { buildPrompt, buildRefinePrompt } from "@/lib/prompt";
import { DEFAULT_GROQ_MODEL } from "@/lib/constants";
import { TRIP_JSON_SCHEMA } from "@/lib/tripJsonSchema";
import { classifyRequest, GuardrailError, MAX_EXISTING_TRIP_CHARS, precheck, rejection } from "@/lib/guardrails";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return Response.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userInput, existingTrip, refinement } = body;
    const mode = refinement != null ? "refine" : "create";

    const text = precheck(mode === "refine" ? refinement : userInput, mode);
    if (mode === "refine" && (!existingTrip || JSON.stringify(existingTrip).length > MAX_EXISTING_TRIP_CHARS)) {
      return Response.json({ error: "That itinerary can’t be refined. Please start a new trip." }, { status: 400 });
    }

    const prompt = mode === "refine" ? buildRefinePrompt(existingTrip, text) : buildPrompt(text);

    const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    const isGptOss = model.startsWith("openai/gpt-oss");
    const completionRequest = {
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      model,
      temperature: 0.7,
      max_completion_tokens: 8192,
      ...(isGptOss
        ? {
            reasoning_effort: "low",
            response_format: {
              type: "json_schema",
              json_schema: { name: "trip_itinerary", schema: TRIP_JSON_SCHEMA, strict: true },
            },
          }
        : { response_format: { type: "json_object" } }),
    };

    const generation = new AbortController();
    const signal = AbortSignal.any([request.signal, generation.signal]);
    const completionPromise = (async () => {
      try {
        return await groq.chat.completions.create(completionRequest, { signal });
      } catch (err) {
        if (err?.error?.error?.code !== "json_validate_failed") throw err;
        return groq.chat.completions.create(completionRequest, { signal });
      }
    })();
    completionPromise.catch(() => {}); // settled below, or deliberately aborted

    let verdict;
    try {
      verdict = await classifyRequest(groq, { text, mode }, { signal: request.signal });
    } catch (err) {
      generation.abort();
      if (err?.status === 429) throw err;
      console.error("Guardrail check failed:", err?.status ?? "", String(err?.message ?? err).slice(0, 200));
      return Response.json(
        { error: "Roam couldn’t check your request just now. Please try again.", retryable: true },
        { status: 503 }
      );
    }
    if (!verdict.allowed) {
      generation.abort();
      console.info(`Guardrail rejected (${mode}, ${verdict.category}): ${verdict.rationale.slice(0, 160)}`);
      throw rejection(verdict.category, mode);
    }

    const chatCompletion = await completionPromise;

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
    if (err instanceof GuardrailError) {
      return Response.json(
        { error: err.message, code: "guardrail", category: err.category, retryable: false },
        { status: err.status }
      );
    }

    console.error("API route error:", err?.status ?? "", String(err?.message ?? err).slice(0, 300));

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
