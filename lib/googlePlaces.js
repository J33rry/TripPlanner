// Server-side access to Google Places API (New): Text Search to locate a named
// town or city, and Nearby Search for popular places around it.
// The field mask sets the billing tier: only Pro-tier fields are requested
// (no ratings, photos or reviews), which keeps calls inside the Pro SKUs'
// free monthly allowances.

const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = "places.id,places.displayName,places.location,places.types,places.primaryType";
const FIND_FIELD_MASK = "places.displayName,places.location,places.viewport";
const MAX_RESULTS = 20;
const MAX_RADIUS_M = 50000;
const CACHE_LIMIT = 100;
const cache = new Map();

export const hasPlacesKey = () => Boolean(process.env.GOOGLE_MAPS_API_KEY);

function remember(key, value) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

async function post(url, fieldMask, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const reason = detail?.error?.message ? `: ${String(detail.error.message).slice(0, 160)}` : "";
    throw new Error(`Places API responded ${response.status}${reason}`);
  }
  const { places = [] } = await response.json();
  return places;
}

const EARTH_KM_PER_DEG = 111.32;

/**
 * Finds a named place (e.g. "Vrindavan, India") and returns
 * { name, latitude, longitude, radiusKm } — radiusKm is half its map viewport's
 * diagonal, a rough measure of the town or city's size — or null.
 */
export async function findPlace(query, { signal } = {}) {
  const body = { textQuery: query, pageSize: 1, languageCode: "en" };
  const key = `find:${JSON.stringify(body)}`;
  if (cache.has(key)) return cache.get(key);

  const [place] = await post(TEXT_SEARCH_URL, FIND_FIELD_MASK, body, signal);
  const latitude = place?.location?.latitude;
  const longitude = place?.location?.longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return remember(key, null);
  const { low, high } = place.viewport || {};
  const radiusKm = low && high
    ? Math.hypot(
        (high.latitude - low.latitude) * EARTH_KM_PER_DEG,
        (high.longitude - low.longitude) * EARTH_KM_PER_DEG * Math.cos((latitude * Math.PI) / 180)
      ) / 2
    : null;
  return remember(key, { name: place.displayName?.text || query, latitude, longitude, radiusKm });
}

/**
 * Popular places of the given types within radiusKm of center ({ latitude, longitude }).
 * Returns [{ id, name, latitude, longitude, types, primaryType }], most popular first.
 */
export async function nearbyPlaces(center, radiusKm, includedTypes, { signal } = {}) {
  const body = {
    includedTypes,
    maxResultCount: MAX_RESULTS,
    rankPreference: "POPULARITY",
    languageCode: "en",
    locationRestriction: {
      circle: {
        center: { latitude: center.latitude, longitude: center.longitude },
        radius: Math.min(MAX_RADIUS_M, Math.round(radiusKm * 1000)),
      },
    },
  };
  const key = `nearby:${JSON.stringify(body)}`;
  if (cache.has(key)) return cache.get(key);

  const places = await post(NEARBY_URL, FIELD_MASK, body, signal);
  const results = places
    .map((place) => ({
      id: place.id,
      name: place.displayName?.text || "",
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      types: place.types || [],
      primaryType: place.primaryType || "",
    }))
    .filter((place) => place.id && place.name && Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  return remember(key, results);
}
