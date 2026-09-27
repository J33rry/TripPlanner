export const placeTitle = (trip) => trip?.destination?.landmark || trip?.destination?.name || "";

export function destinationLabel(trip) {
  const { name, country } = trip?.destination || {};
  if (!name) return trip?.tripTitle || "";
  return country && country !== name ? `${name}, ${country}` : name;
}

export const dayCount = (trip) => {
  const days = trip?.stops?.length || 0;
  return `${days} ${days === 1 ? "day" : "days"}`;
};

export function savedMeta(saved) {
  const date = new Date(saved.savedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return `${date} · ${dayCount(saved.data)}`;
}
