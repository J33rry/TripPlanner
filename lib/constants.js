// Default Groq model for itinerary generation. Override per-environment with
// the server-only GROQ_MODEL env var (see app/api/generate/route.js).
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

export const ACTIVITY_CONFIG = {
  food: {
    icon: "🍜",
    label: "Food",
    color: "amber",
  },
  sightseeing: {
    icon: "🏛️",
    label: "Sightseeing",
    color: "primary",
  },
  transport: {
    icon: "🚗",
    label: "Transport",
    color: "sky",
  },
  accommodation: {
    icon: "🏨",
    label: "Stay",
    color: "violet",
  },
  activity: {
    icon: "🎯",
    label: "Activity",
    color: "green",
  },
};

export const EXAMPLE_PROMPTS = [
  "5-day trip to Tokyo on a $3000 budget focusing on food and culture",
  "Weekend getaway to Paris for a couple, romantic and budget-friendly",
  "10-day backpacking trip through Southeast Asia",
  "Family vacation to Orlando with two kids under 10",
  "Solo adventure in Iceland for a week, hiking and northern lights",
];
