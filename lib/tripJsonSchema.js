// JSON Schema for Groq structured outputs in strict mode (constrained
// decoding), which guarantees syntactically valid, schema-shaped JSON.
// Strict mode rules: every property is required, objects are closed, and
// "optional" values are expressed as nullable unions. lib/schema.js still
// validates and normalises the result.

const string = { type: "string" };
const nullableNumber = { type: ["number", "null"] };

const closed = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const activity = closed({
  time: string,
  title: string,
  description: string,
  type: { type: "string", enum: ["food", "sightseeing", "transport", "accommodation", "activity"] },
  cost: string,
  duration: string,
  location: string,
  latitude: nullableNumber,
  longitude: nullableNumber,
});

export const TRIP_JSON_SCHEMA = closed({
  tripTitle: string,
  summary: string,
  totalBudgetEstimate: string,
  destination: closed({
    name: string,
    country: string,
    landmark: string,
    latitude: nullableNumber,
    longitude: nullableNumber,
  }),
  stops: {
    type: "array",
    items: closed({
      day: { type: "integer" },
      date: string,
      theme: string,
      activities: { type: "array", items: activity },
    }),
  },
  packingList: { type: "array", items: string },
  tips: { type: "array", items: string },
});
