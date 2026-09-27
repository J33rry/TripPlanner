import { z } from "zod";
import { distanceKm } from "./geo";

const ACTIVITY_TYPES = ["food", "sightseeing", "transport", "accommodation", "activity"];

const coordinate = (limit) =>
  z
    .preprocess(
      (value) => (value === "" || value == null ? null : Number(value)),
      z.number().min(-limit).max(limit).nullable()
    )
    .catch(null);

const activitySchema = z.object({
  time: z.string().default(""),
  title: z.string().min(1, "Activity title is required"),
  description: z.string().default(""),
  type: z.enum(ACTIVITY_TYPES).catch("activity"),
  cost: z.string().default(""),
  duration: z.string().default(""),
  location: z.string().default(""),
  latitude: coordinate(90),
  longitude: coordinate(180),
});

const daySchema = z.object({
  day: z.number().int().positive(),
  date: z.string().default(""),
  theme: z.string().default(""),
  activities: z.array(activitySchema).min(1, "At least one activity per day"),
});

const destinationSchema = z
  .object({
    name: z.string().default(""),
    country: z.string().default(""),
    landmark: z.string().default(""),
    latitude: coordinate(90),
    longitude: coordinate(180),
  })
  .nullable()
  .catch(null);

export const tripSchema = z.object({
  tripTitle: z.string().min(1, "Trip title is required"),
  summary: z.string().default(""),
  totalBudgetEstimate: z.string().default(""),
  destination: destinationSchema.default(null),
  stops: z.array(daySchema).min(1, "At least one day is required"),
  packingList: z.array(z.string()).default([]),
  tips: z.array(z.string()).default([]),
});

const MAX_STOP_DISTANCE_KM = 3000;

function hasCoords(point) {
  if (point?.latitude == null || point?.longitude == null) return false;
  return !(point.latitude === 0 && point.longitude === 0);
}

export function validateTrip(data) {
  const result = tripSchema.safeParse(data);

  if (result.success) {
    const trip = result.data;
    const center = hasCoords(trip.destination) ? trip.destination : null;
    if (trip.destination && !center) {
      trip.destination = { ...trip.destination, latitude: null, longitude: null };
    }

    let idCounter = 0;
    trip.stops = trip.stops.map((stop) => ({
      ...stop,
      id: `day-${stop.day}`,
      activities: stop.activities.map((act) => {
        const plausible = hasCoords(act) && (!center || distanceKm(center, act) <= MAX_STOP_DISTANCE_KM);
        return {
          ...act,
          latitude: plausible ? act.latitude : null,
          longitude: plausible ? act.longitude : null,
          id: `act-${idCounter++}`,
          completed: false,
        };
      }),
    }));
    return { success: true, data: trip };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
  return { success: false, errors };
}
