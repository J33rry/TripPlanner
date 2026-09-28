import { TRAVEL_MODES } from "./travelModes";

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
  placeId: { type: ["string", "null"] },
  travelMode: { type: "string", enum: TRAVEL_MODES },
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
