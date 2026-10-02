// How travellers get between stops. Shared by the itinerary schema (the model
// picks a mode per activity), route planning and the map's lines and legend.

export const TRAVEL_MODES = ["walk", "bike", "transit", "bus", "drive", "train", "ferry", "flight"];

// `routing` is the profile /api/directions uses to draw the leg along real roads and paths;
// modes without one are drawn as straight lines (or a great-circle arc for flights).
export const MODE_STYLES = {
  walk: { label: "Walking", color: "#7a4fd4", pattern: "dots", routing: "foot" },
  bike: { label: "Cycling", color: "#b04fc4", pattern: "dash", routing: "bike" },
  transit: { label: "Metro & tram", color: "#0e8f8a", pattern: "solid", routing: null },
  bus: { label: "Bus", color: "#c46a1a", pattern: "longdash", routing: "car" },
  drive: { label: "Driving", color: "#4b3fb8", pattern: "solid", routing: "car" },
  train: { label: "Train", color: "#1f6f6b", pattern: "rail", routing: null },
  ferry: { label: "Ferry", color: "#2a86c9", pattern: "dash", routing: null },
  flight: { label: "Flight", color: "#d2497a", pattern: "arc", routing: null },
};

// Legacy trips have no mode: read it from a transport step's wording
// ("Train to Jaipur"), then fall back to distance.
const KEYWORDS = [
  ["flight", /\b(flight|fly|flying|plane)\b/i],
  ["train", /\b(train|rail|railway)\b/i],
  ["ferry", /\b(ferry|boat|cruise)\b/i],
  ["bus", /\b(bus|coach)\b/i],
  ["transit", /\b(metro|subway|tram|tube|underground)\b/i],
  ["bike", /\b(bike|cycle|cycling|bicycle)\b/i],
  ["drive", /\b(taxi|cab|uber|drive|car|rickshaw|transfer)\b/i],
  ["walk", /\b(walk|stroll)\b/i],
];

function modeFromWords(activity) {
  if (activity?.type !== "transport") return null;
  return KEYWORDS.find(([, pattern]) => pattern.test(activity.title || ""))?.[0] || null;
}

const byDistance = (km) => (km <= 2 ? "walk" : km <= 700 ? "drive" : "flight");

// Guards against implausible picks, e.g. a 30 km "walk" or a 200 m "flight".
function plausible(mode, km) {
  if (mode === "walk" && km > 6) return "drive";
  if (mode === "bike" && km > 30) return "drive";
  if ((mode === "drive" || mode === "bus") && km > 1500) return "flight";
  if (mode === "flight" && km < 80) return byDistance(km);
  if ((mode === "train" || mode === "ferry") && km < 1) return "walk";
  return mode;
}

const knownMode = (mode) => (TRAVEL_MODES.includes(mode) ? mode : null);

/**
 * The travel mode of each leg of a day: legs[i] joins stops[i] → stops[i + 1]
 * and is kms[i] long. An ordinary activity's mode is how you reach it. A
 * transport step ("Flight to Naha") describes a journey, but the model places
 * it at either end of that journey, so its mode goes to whichever neighbouring
 * leg is longer — the other one is just getting to or from the station.
 */
export function legModes(stops, kms) {
  const claims = kms.map(() => null);
  stops.forEach((stop, i) => {
    if (stop.type !== "transport") return;
    const mode = knownMode(stop.travelMode) || modeFromWords(stop);
    if (!mode) return;
    const before = i > 0 ? i - 1 : null;
    const after = i < kms.length ? i : null;
    const compared = before != null && after != null;
    const leg = compared ? (kms[before] >= kms[after] ? before : after) : before ?? after;
    if (leg == null) return;
    // A choice made by comparing both legs beats a step that only had one leg.
    if (!claims[leg] || (compared && !claims[leg].compared)) claims[leg] = { mode, compared };
  });
  return kms.map((km, i) => {
    const target = stops[i + 1];
    const chosen = claims[i]?.mode || (target.type !== "transport" ? knownMode(target.travelMode) : null);
    return plausible(chosen || byDistance(km), km);
  });
}
