// Shortens each day's route by reordering its stops. The model is asked for a
// sensible order but still sometimes zig-zags across a city; this pass fixes
// the order without changing which places are visited.
//
// What stays put:
// - accommodation and transport steps, and stops without coordinates — they
//   split the day into runs, and only stops inside a run move;
// - meals keep their order among themselves, breakfast and dinner don't move,
//   a meal that opens or closes a run doesn't move, other meals shift by at
//   most one place, and two meals only sit side by side if they already did.

import { distanceKm } from "./geo";

const MAX_EXACT = 8; // runs up to this long are solved exactly (8! orders)
const MEAL_SLACK = 1;
const MIN_SAVING_KM = 0.3; // ignore reorders that barely shorten the day…
const MIN_SAVING_RATIO = 0.05; // …or save less than 5%: the model's order may have its own logic
const WALK_KM = 2;

const hasCoords = (activity) => activity?.latitude != null && activity?.longitude != null;
const isAnchor = (activity) => activity.type === "accommodation" || activity.type === "transport" || !hasCoords(activity);
const FIXED_MEAL = /\b(breakfast|brunch|dinner|supper)\b/i;

/** Straight-line length of a day's route through its mapped stops, in km. */
export function routeKm(activities) {
  const points = activities.filter(hasCoords);
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
  return total;
}

// Length of a run's path, including the hops from and to the anchors around it.
function pathKm(order, before, after) {
  const points = [before, ...order, after].filter(Boolean);
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
  return total;
}

/** Placement rules for one run: returns a function telling whether an order is allowed. */
function rulesFor(run) {
  const last = run.length - 1;
  const meals = run.map((activity, index) => ({ activity, index })).filter(({ activity }) => activity.type === "food");
  const fixed = new Map();
  const slack = new Map();
  for (const { activity, index } of meals) {
    if (index === 0 || index === last || FIXED_MEAL.test(activity.title || "")) fixed.set(activity, index);
    else slack.set(activity, index);
  }
  const mealOrder = meals.map(({ activity }) => activity);
  const isMeal = (activity) => activity?.type === "food";
  const pairedMeals = new Set(run.slice(1).filter((activity, i) => isMeal(activity) && isMeal(run[i])));
  return (order) => {
    let nextMeal = 0;
    for (let i = 0; i < order.length; i++) {
      const activity = order[i];
      if (fixed.has(activity) && fixed.get(activity) !== i) return false;
      if (slack.has(activity) && Math.abs(slack.get(activity) - i) > MEAL_SLACK) return false;
      if (!isMeal(activity)) continue;
      if (mealOrder[nextMeal++] !== activity) return false;
      if (i > 0 && isMeal(order[i - 1]) && !pairedMeals.has(activity)) return false;
    }
    return true;
  };
}

function* permutations(items) {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) yield [items[i], ...tail];
  }
}

// Every allowed order; a run's stops are few enough to try them all.
function bestExact(run, before, after, allowed) {
  let best = run;
  let bestKm = pathKm(run, before, after);
  for (const order of permutations(run)) {
    if (!allowed(order)) continue;
    const km = pathKm(order, before, after);
    if (km < bestKm - 1e-9) {
      best = order;
      bestKm = km;
    }
  }
  return best;
}

// Longer runs: 2-opt, reversing a stretch whenever that shortens the path and keeps the rules.
function bestTwoOpt(run, before, after, allowed) {
  let best = run;
  let bestKm = pathKm(run, before, after);
  for (let improved = true; improved; ) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const order = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const km = pathKm(order, before, after);
        if (km < bestKm - 1e-9 && allowed(order)) {
          best = order;
          bestKm = km;
          improved = true;
        }
      }
    }
  }
  return best;
}

// A moved stop's "travelMode" described the hop from its old predecessor; keep
// it only while it still fits the new hop.
function retravel(activity, previous, transitDay) {
  if (!previous || !hasCoords(previous)) return activity;
  const km = distanceKm(previous, activity);
  if (km <= WALK_KM) return activity.travelMode === "walk" ? activity : { ...activity, travelMode: "walk" };
  if (activity.travelMode === "walk" || activity.travelMode === "bike" || !activity.travelMode) {
    return { ...activity, travelMode: transitDay ? "transit" : "drive" };
  }
  return activity;
}

/** The day's activities in a shorter order, or the same array when no worthwhile change exists. */
export function reorderDay(activities) {
  const result = [];
  let run = [];
  const flush = (after) => {
    if (run.length > 1) {
      const before = result.length ? result[result.length - 1] : null;
      const allowed = rulesFor(run);
      const best = (run.length <= MAX_EXACT ? bestExact : bestTwoOpt)(run, hasCoords(before) ? before : null, after, allowed);
      result.push(...best);
    } else {
      result.push(...run);
    }
    run = [];
  };
  for (const activity of activities) {
    if (isAnchor(activity)) {
      flush(hasCoords(activity) ? activity : null);
      result.push(activity);
    } else {
      run.push(activity);
    }
  }
  flush(null);

  const beforeKm = routeKm(activities);
  const afterKm = routeKm(result);
  const saving = beforeKm - afterKm;
  if (saving < MIN_SAVING_KM || saving < beforeKm * MIN_SAVING_RATIO) return activities;

  const transitDay = activities.some((activity) => activity.travelMode === "transit");
  const previousOf = new Map(activities.map((activity, i) => [activity, activities[i - 1]]));
  return result.map((activity, i) =>
    previousOf.get(activity) === result[i - 1] ? activity : retravel(activity, result[i - 1], transitDay)
  );
}

const sameDay = (a, b) =>
  a.activities.length === b.activities.length &&
  a.activities.every((activity, i) => activity.title === b.activities[i]?.title && activity.location === b.activities[i]?.location);

/**
 * Reorders every day of a trip in place. With `previous` (the trip a refinement
 * started from), days the refinement left unchanged keep their order, so a
 * traveller's own reordering survives. Returns one { day, beforeKm, afterKm } per day.
 */
export function reorderTrip(trip, { previous } = {}) {
  const untouched = (day) => previous?.stops?.some((old) => sameDay(old, day));
  return (trip?.stops || []).map((day) => {
    const beforeKm = routeKm(day.activities);
    if (!untouched(day)) day.activities = reorderDay(day.activities);
    return { day: day.day, beforeKm, afterKm: routeKm(day.activities) };
  });
}
