// Proxies routing requests to the public FOSSGIS OSRM servers
// (routing.openstreetmap.de). Proxying lets us send an identifying
// User-Agent as their usage policy asks, validate input, and cache results.
// The service is free, keyless and best-effort, so callers must fall back to
// straight lines when this returns an error.

const PROFILES = { foot: "routed-foot", car: "routed-car" };
const MAX_POINTS = 25;
const TIMEOUT_MS = 8000;
const CACHE_LIMIT = 200;
const cache = new Map();

function isValidPoint(point) {
  return (
    Array.isArray(point) &&
    point.length === 2 &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    Math.abs(point[0]) <= 180 &&
    Math.abs(point[1]) <= 90
  );
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { coordinates, profile = "foot" } = body || {};
  if (!PROFILES[profile]) {
    return Response.json({ error: "Unknown routing profile." }, { status: 400 });
  }
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    coordinates.length > MAX_POINTS ||
    !coordinates.every(isValidPoint)
  ) {
    return Response.json(
      { error: `Provide 2–${MAX_POINTS} [longitude, latitude] points.` },
      { status: 400 }
    );
  }

  const path = coordinates.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
  const key = `${profile}:${path}`;
  if (cache.has(key)) return Response.json(cache.get(key));

  try {
    const response = await fetch(
      `https://routing.openstreetmap.de/${PROFILES[profile]}/route/v1/driving/${path}?overview=full&geometries=geojson`,
      {
        headers: { "User-Agent": "Roam trip planner (itinerary route preview)" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    const data = await response.json();
    const route = data?.routes?.[0];
    if (!response.ok || data.code !== "Ok" || !route) {
      return Response.json({ error: "No route found." }, { status: 502 });
    }

    const result = {
      profile,
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
    };
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return Response.json(result);
  } catch (err) {
    console.error("Directions error:", err?.name, err?.message);
    return Response.json({ error: "Routing service unavailable." }, { status: 502 });
  }
}
