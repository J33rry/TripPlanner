import Groq from "groq-sdk";
import { validateTrip } from "@/lib/schema";
import { parseAIResponse } from "@/lib/parseResponse";
import { buildPrompt, buildRefinePrompt } from "@/lib/prompt";
import { DEFAULT_GROQ_MODEL } from "@/lib/constants";
import { TRIP_JSON_SCHEMA } from "@/lib/tripJsonSchema";
import { applyCandidates, areasForTrip, extractPlaces, fitCandidates, gatherCandidates, groundingEnabled } from "@/lib/placeCandidates";
import { classifyRequest, GuardrailError, MAX_EXISTING_TRIP_CHARS, precheck, rejection } from "@/lib/guardrails";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Groq's free tier counts each request as its prompt plus ~5,000 tokens reserved
// for the reply, against an 8,000 tokens-per-minute limit, so prompts must stay
// under ~3,000 tokens. Estimates are deliberately conservative.
const MAX_PROMPT_TOKENS = 2800;
const CANDIDATE_BLOCK_TOKENS = 180;
const estimateTokens = (prompt) => Math.ceil((prompt.system.length + prompt.user.length) / 3.4);

// Best-effort: any failure or timeout means planning without candidates.
async function findCandidates(areas, signal) {
  if (!areas?.length) return [];
  const started = Date.now();
  try {
    const { areas: searched, candidates } = await gatherCandidates(areas, { signal });
    const names = searched.map((area) => `${area.name} (${Math.round(area.radiusKm)} km)`).join(", ") || "no searchable area";
    console.info(`Grounding: ${names} → ${candidates.length} candidates in ${Date.now() - started} ms`);
    return candidates;
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn(`Grounding skipped after ${Date.now() - started} ms:`, String(err?.message ?? err).slice(0, 200));
    return [];
  }
}

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

    const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    const isGptOss = model.startsWith("openai/gpt-oss");
    const generation = new AbortController();
    const signal = AbortSignal.any([request.signal, generation.signal]);
    const buildFor = (candidates) =>
      mode === "refine" ? buildRefinePrompt(existingTrip, text, candidates) : buildPrompt(text, candidates);
    const generate = (candidates) => {
      const prompt = buildFor(candidates);
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
      const completion = (async () => {
        try {
          return await groq.chat.completions.create(completionRequest, { signal });
        } catch (err) {
          if (err?.error?.error?.code !== "json_validate_failed") throw err;
          return groq.chat.completions.create(completionRequest, { signal });
        }
      })();
      completion.catch(() => {}); // settled below, or deliberately aborted
      return completion;
    };

    // Without grounding, generation starts alongside the guardrail check. With it,
    // the guardrail runs alongside place extraction, and places are only looked up
    // (and generation started) once the request is known to be about travel.
    const grounded = groundingEnabled();
    const extraction =
      grounded && mode === "create"
        ? extractPlaces(groq, text, { signal }).catch((err) => {
            if (!signal.aborted) console.warn("Place extraction failed:", String(err?.message ?? err).slice(0, 200));
            return [];
          })
        : null;
    let completionPromise = grounded ? null : generate([]);

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

    let candidates = [];
    if (grounded) {
      const areas = mode === "refine" ? areasForTrip(existingTrip) : await extraction;
      const found = await findCandidates(areas, request.signal);
      const room = MAX_PROMPT_TOKENS - estimateTokens(buildFor([])) - CANDIDATE_BLOCK_TOKENS;
      candidates = fitCandidates(found, Math.max(0, room));
      if (candidates.length < found.length) {
        console.info(`Grounding: kept ${candidates.length}/${found.length} candidates to fit the prompt budget`);
      }
      completionPromise = generate(candidates);
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

    const grounding = { candidates: candidates.length, ...applyCandidates(parsed.data, candidates) };
    if (candidates.length) {
      console.info(`Grounding: ${grounding.matched}/${grounding.total} activities matched to candidates`);
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

    return Response.json({ success: true, data: validated.data, grounding });
  } catch (err) {
    if (err instanceof GuardrailError) {
      return Response.json(
        { error: err.message, code: "guardrail", category: err.category, retryable: false },
        { status: err.status }
      );
    }

    console.error("API route error:", err?.status ?? "", String(err?.message ?? err).slice(0, 300));

    if (err?.status === 413) {
      return Response.json(
        { error: "This request is too large for the AI’s current limits. Try a shorter trip or a smaller change." },
        { status: 413 }
      );
    }

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
