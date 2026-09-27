// Small formatting helpers shared by the home, trips and trip views.

/** Wikipedia title used to illustrate a trip (its landmark, else its place). */
export const placeTitle = (trip) => trip?.destination?.landmark || trip?.destination?.name || "";

/** "Paris, France" — or the trip title when the AI gave no destination. */
export function destinationLabel(trip) {
  const { name, country } = trip?.destination || {};
  if (!name) return trip?.tripTitle || "";
  return country && country !== name ? `${name}, ${country}` : name;
}

export const dayCount = (trip) => {
  const days = trip?.stops?.length || 0;
  return `${days} ${days === 1 ? "day" : "days"}`;
};

/** "May 2026 · 3 days" for the compact recent-trips list. */
export function savedMeta(saved) {
  const date = new Date(saved.savedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return `${date} · ${dayCount(saved.data)}`;
}
