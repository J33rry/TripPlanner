import { z } from "zod";

const activitySchema = z.object({
  time: z.string().default(""),
  title: z.string().min(1, "Activity title is required"),
  description: z.string().default(""),
  type: z
    .enum(["food", "sightseeing", "transport", "accommodation", "activity"])
    .default("activity"),
  cost: z.string().default(""),
  duration: z.string().default(""),
});

const daySchema = z.object({
  day: z.number().int().positive(),
  date: z.string().default(""),
  theme: z.string().default(""),
  activities: z.array(activitySchema).min(1, "At least one activity per day"),
});

export const tripSchema = z.object({
  tripTitle: z.string().min(1, "Trip title is required"),
  summary: z.string().default(""),
  totalBudgetEstimate: z.string().default(""),
  stops: z.array(daySchema).min(1, "At least one day is required"),
  packingList: z.array(z.string()).default([]),
  tips: z.array(z.string()).default([]),
});

/**
 * Validate parsed JSON against the trip schema.
 * Returns { success: true, data } or { success: false, errors }.
 */
export function validateTrip(data) {
  const result = tripSchema.safeParse(data);

  if (result.success) {
    // Attach client-side IDs to activities for keying
    const trip = result.data;
    let idCounter = 0;
    trip.stops = trip.stops.map((stop) => ({
      ...stop,
      id: `day-${stop.day}`,
      activities: stop.activities.map((act) => ({
        ...act,
        id: `act-${idCounter++}`,
        completed: false,
      })),
    }));
    return { success: true, data: trip };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
  return { success: false, errors };
}
