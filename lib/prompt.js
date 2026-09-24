const SYSTEM_PROMPT = `You are a travel planning assistant. Given a trip description, generate a detailed day-by-day itinerary.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no extra text.

The JSON must follow this exact structure:
{
  "tripTitle": "string - a catchy title for the trip",
  "summary": "string - 2-3 sentence overview of the trip",
  "totalBudgetEstimate": "string - estimated total budget (e.g. '$2,500')",
  "stops": [
    {
      "day": 1,
      "date": "Day 1",
      "theme": "string - theme for the day (e.g. 'Arrival & Exploration')",
      "activities": [
        {
          "time": "10:00 AM",
          "title": "string - activity name",
          "description": "string - 1-2 sentence description",
          "type": "food|sightseeing|transport|accommodation|activity",
          "cost": "$30",
          "duration": "2 hours"
        }
      ]
    }
  ],
  "packingList": ["item1", "item2"],
  "tips": ["tip1", "tip2"]
}

Rules:
- Each day should have 3-6 activities
- Activity types must be one of: food, sightseeing, transport, accommodation, activity
- Include realistic time estimates and costs
- Make the itinerary practical and enjoyable
- Return ONLY the JSON object, nothing else`;

export function buildPrompt(userInput) {
  return {
    system: SYSTEM_PROMPT,
    user: userInput.trim(),
  };
}

const REFINE_SYSTEM_PROMPT = `You are a travel planning assistant. You previously generated an itinerary that the user wants to modify.

You will receive the current itinerary JSON and a modification request. Apply the requested changes while keeping the rest of the itinerary intact.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no extra text.
The JSON must follow the exact same structure as the original itinerary.

Rules:
- Only modify what the user asks to change
- Keep all unchanged days and activities intact
- Maintain realistic time estimates and costs
- Activity types must be one of: food, sightseeing, transport, accommodation, activity
- Return ONLY the JSON object, nothing else`;

export function buildRefinePrompt(existingTrip, refinement) {
  return {
    system: REFINE_SYSTEM_PROMPT,
    user: `Current itinerary:\n${JSON.stringify(existingTrip, null, 2)}\n\nModification request: ${refinement.trim()}`,
  };
}
