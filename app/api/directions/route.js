// Routes each map leg along real streets: Google Routes API first (when a server
// key is set), the community OSRM server as a fallback.
const PROFILES = {
  foot: { google: "WALK", osm: "routed-foot" },
  bike: { google: "BICYCLE", osm: "routed-bike" },
  car: { google: "DRIVE", osm: "routed-car" },
};
const MAX_POINTS = 25;
const TIMEOUT_MS = 8000;
const CACHE_LIMIT = 200;
const RETRY_DELAY_MS = 800;
const cache = new Map();

const GOOGLE_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
// Up to 10 intermediate stops bills as Compute Routes Essentials; longer legs are split.
const GOOGLE_CHUNK_POINTS = 12;
// A key/permission problem won't fix itself mid-session, so stop asking for a while.
const GOOGLE_BACKOFF_MS = 10 * 60 * 1000;
let googleBlockedUntil = 0;

const pause = () => new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

function googleKey() {
  return process.env.GOOGLE_ROUTING === "off" ? null : process.env.GOOGLE_MAPS_API_KEY || null;
}

async function googleChunk(points, travelMode, key) {
  const waypoint = ([lng, lat]) => ({ location: { latLng: { latitude: lat, longitude: lng } } });
  const response = await fetch(GOOGLE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring",
    },
    body: JSON.stringify({
      origin: waypoint(points[0]),
      destination: waypoint(points[points.length - 1]),
      intermediates: points.slice(1, -1).map(waypoint),
      travelMode,
      polylineEncoding: "GEO_JSON_LINESTRING",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    googleBlockedUntil = Date.now() + GOOGLE_BACKOFF_MS;
    console.warn(
      `Directions: Google Routes API refused the key (${data?.error?.status || response.status}) — using OpenStreetMap for 10 min. ` +
        "Enable the Routes API for GOOGLE_MAPS_API_KEY in Google Cloud."
    );
    return null;
  }
  const route = data?.routes?.[0];
  if (!response.ok || !route?.polyline?.geoJsonLinestring) return null;
  return {
    distance: route.distanceMeters ?? 0,
    duration: parseFloat(route.duration) || 0,
    coordinates: route.polyline.geoJsonLinestring.coordinates,
  };
}

async function googleRoute(coordinates, profile) {
  const key = googleKey();
  if (!key || Date.now() < googleBlockedUntil) return null;
  const chunks = [];
  for (let i = 0; i < coordinates.length - 1; i += GOOGLE_CHUNK_POINTS - 1) {
    chunks.push(coordinates.slice(i, i + GOOGLE_CHUNK_POINTS));
  }
  const parts = await Promise.all(chunks.map((points) => googleChunk(points, PROFILES[profile].google, key)));
  if (parts.some((part) => !part)) return null;
  return {
    distance: parts.reduce((sum, part) => sum + part.distance, 0),
    duration: parts.reduce((sum, part) => sum + part.duration, 0),
    // Each chunk starts where the last ended; drop the repeated point.
    geometry: { type: "LineString", coordinates: parts.flatMap((part, i) => (i ? part.coordinates.slice(1) : part.coordinates)) },
    source: "google",
  };
}

const osmAttempt = (url) =>
  fetch(url, {
    headers: { "User-Agent": "Roam trip planner (itinerary route preview)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

async function osmRequest(url) {
  let response;
  try {
    response = await osmAttempt(url);
  } catch (err) {
    // Dropped connections ("fetch failed") are usually momentary; timeouts aren't worth repeating.
    if (err?.name === "TimeoutError") throw err;
    await pause();
    return osmAttempt(url);
  }
  if (response.status !== 429) return response;
  // The community server rate-limits bursts; one polite retry usually succeeds.
  await pause();
  return osmAttempt(url);
}

async function osmRoute(path, profile) {
  const response = await osmRequest(
    `https://routing.openstreetmap.de/${PROFILES[profile].osm}/route/v1/driving/${path}?overview=full&geometries=geojson`
  );
  const data = await response.json().catch(() => null);
  const route = data?.routes?.[0];
  if (!response.ok || data?.code !== "Ok" || !route) {
    console.warn(`Directions: no ${profile} route (${response.status}${data?.code ? ` ${data.code}` : ""})`);
    return null;
  }
  return { distance: route.distance, duration: route.duration, geometry: route.geometry, source: "osm" };
}

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

  let route = null;
  try {
    route = await googleRoute(coordinates, profile);
  } catch (err) {
    console.warn("Directions: Google Routes failed —", err?.name, err?.message);
  }
  try {
    route ??= await osmRoute(path, profile);
  } catch (err) {
    console.error("Directions error:", err?.name, err?.message, err?.cause?.code || err?.cause?.message || "");
    return Response.json({ error: "Routing service unavailable." }, { status: 502 });
  }
  if (!route) return Response.json({ error: "No route found." }, { status: 502 });

  const result = { profile, ...route };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return Response.json(result);
}
