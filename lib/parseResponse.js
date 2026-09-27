export function parseAIResponse(raw) {
  if (!raw || typeof raw !== "string") {
    return {
      success: false,
      error: "Empty or invalid response from AI",
      raw: raw ?? "",
    };
  }

  let cleaned = raw.trim();

  try {
    return { success: true, data: JSON.parse(cleaned) };
  } catch (e) {
  }

  const fenceRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const fenceMatch = cleaned.match(fenceRegex);
  if (fenceMatch) {
    try {
      return { success: true, data: JSON.parse(fenceMatch[1].trim()) };
    } catch (e) {
      cleaned = fenceMatch[1].trim();
    }
  }

  const jsonObjectRegex = /\{[\s\S]*\}/;
  const objectMatch = cleaned.match(jsonObjectRegex);
  if (objectMatch) {
    try {
      return { success: true, data: JSON.parse(objectMatch[0]) };
    } catch (e) {
      cleaned = objectMatch[0];
    }
  }

  let repaired = cleaned.replace(/,\s*([}\]])/g, "$1");
  try {
    return { success: true, data: JSON.parse(repaired) };
  } catch (e) {
  }

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

  bracketFixed = bracketFixed.replace(/,\s*([}\]])/g, "$1");

  try {
    return { success: true, data: JSON.parse(bracketFixed) };
  } catch (e) {
  }

  return {
    success: false,
    error: "Failed to parse AI response as JSON after repair attempts",
    raw: raw.substring(0, 500),
  };
}
