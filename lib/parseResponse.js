/**
 * Attempt to parse a string as JSON, with multiple repair strategies
 * for common LLM output issues.
 */
export function parseAIResponse(raw) {
  if (!raw || typeof raw !== "string") {
    return {
      success: false,
      error: "Empty or invalid response from AI",
      raw: raw ?? "",
    };
  }

  let cleaned = raw.trim();

  // Strategy 1: Direct parse
  try {
    return { success: true, data: JSON.parse(cleaned) };
  } catch (e) {
    // Continue to repair strategies
  }

  // Strategy 2: Strip markdown code fences
  // Handles ```json ... ``` or ``` ... ```
  const fenceRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const fenceMatch = cleaned.match(fenceRegex);
  if (fenceMatch) {
    try {
      return { success: true, data: JSON.parse(fenceMatch[1].trim()) };
    } catch (e) {
      cleaned = fenceMatch[1].trim();
    }
  }

  // Strategy 3: Extract JSON object from surrounding text
  const jsonObjectRegex = /\{[\s\S]*\}/;
  const objectMatch = cleaned.match(jsonObjectRegex);
  if (objectMatch) {
    try {
      return { success: true, data: JSON.parse(objectMatch[0]) };
    } catch (e) {
      cleaned = objectMatch[0];
    }
  }

  // Strategy 4: Remove trailing commas before } or ]
  let repaired = cleaned.replace(/,\s*([}\]])/g, "$1");
  try {
    return { success: true, data: JSON.parse(repaired) };
  } catch (e) {
    // Continue
  }

  // Strategy 5: Fix truncated JSON — try closing brackets
  let bracketFixed = repaired;
  const openBraces = (bracketFixed.match(/\{/g) || []).length;
  const closeBraces = (bracketFixed.match(/\}/g) || []).length;
  const openBrackets = (bracketFixed.match(/\[/g) || []).length;
  const closeBrackets = (bracketFixed.match(/\]/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    bracketFixed += "]";
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    bracketFixed += "}";
  }

  // Also remove any trailing commas again after bracket fix
  bracketFixed = bracketFixed.replace(/,\s*([}\]])/g, "$1");

  try {
    return { success: true, data: JSON.parse(bracketFixed) };
  } catch (e) {
    // All strategies failed
  }

  return {
    success: false,
    error: "Failed to parse AI response as JSON after repair attempts",
    raw: raw.substring(0, 500),
  };
}
