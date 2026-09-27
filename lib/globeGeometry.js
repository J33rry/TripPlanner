import { GRID_STEP, LAND_MASK } from "./landMask";

export const DEG = Math.PI / 180;

/**
 * Radius (CSS px) the home globe zooms to before handing over to the map.
 * Large enough that the sphere covers the whole stage, so the crossfade to
 * map tiles never reveals an edge.
 */
export function arrivalRadius(width, height) {
  return Math.hypot(width, height) * 0.6;
}

/**
 * MapLibre zoom at which its globe projection draws the Earth with the given
 * pixel radius (MapLibre: radius = 512·2^zoom / 2π / cos(latitude)).
 */
export function zoomForGlobeRadius(radius, latitude) {
  return Math.log2((radius * 2 * Math.PI * Math.cos(latitude * DEG)) / 512);
}

function decodeBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Earth-fixed unit vector for a latitude/longitude in degrees:
 * x toward (0°, 0°), y toward (0°, 90°E), z toward the north pole.
 */
export function worldVector(lat, lon) {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

/**
 * Rotate an Earth-fixed vector into view space for a globe whose visible
 * centre is `view` ({ sinLat, cosLat, sinLon, cosLon } of the centre point).
 * Result: x right, y up (north-up), z toward the viewer. Length is preserved.
 */
export function toView(wx, wy, wz, view) {
  const a = wx * view.cosLon + wy * view.sinLon;
  const x = wy * view.cosLon - wx * view.sinLon;
  const y = view.cosLat * wz - view.sinLat * a;
  const z = view.sinLat * wz + view.cosLat * a;
  return [x, y, z];
}

export function viewFor(lat, lon) {
  return { sinLat: Math.sin(lat * DEG), cosLat: Math.cos(lat * DEG), sinLon: Math.sin(lon * DEG), cosLon: Math.cos(lon * DEG) };
}

function toDots(vectors) {
  const count = vectors.length;
  const dots = {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    family: new Uint8Array(count), // which orb swirl axis the dot follows
    phase: new Float32Array(count), // per-dot shimmer offset
  };
  vectors.forEach(([x, y, z], i) => {
    dots.x[i] = x;
    dots.y[i] = y;
    dots.z[i] = z;
    // Cheap deterministic hash so families interleave instead of banding.
    const h = Math.sin(i * 12.9898) * 43758.5453;
    const r = h - Math.floor(h);
    dots.family[i] = Math.floor(r * 3) % 3;
    dots.phase[i] = r * Math.PI * 2;
  });
  return dots;
}

/** Dots on land, decoded from the grid bitmask built by scripts/generate-land-mask.mjs. */
export function buildLandDots() {
  const bytes = decodeBase64(LAND_MASK);
  const vectors = [];
  const rows = Math.round(180 / GRID_STEP);
  let index = 0;
  for (let i = 0; i < rows; i++) {
    const lat = 90 - GRID_STEP * (i + 0.5);
    const count = Math.max(1, Math.round((360 * Math.cos(lat * DEG)) / GRID_STEP));
    for (let j = 0; j < count; j++, index++) {
      if (bytes[index >> 3] & (1 << (index & 7))) {
        vectors.push(worldVector(lat, -180 + ((j + 0.5) * 360) / count));
      }
    }
  }
  return toDots(vectors);
}

/** Evenly spread dots over the whole sphere (used to fill out the AI orb). */
export function buildSphereDots(count) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const vectors = [];
  for (let i = 0; i < count; i++) {
    const z = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - z * z);
    const theta = golden * i;
    vectors.push([r * Math.cos(theta), r * Math.sin(theta), z]);
  }
  return toDots(vectors);
}

/** Points along a great-circle arc from a to b, lifted off the surface. */
export function buildArc(from, to, segments = 64) {
  const a = worldVector(from.lat, from.lon);
  const b = worldVector(to.lat, to.lon);
  const angle = Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const lift = 0.1 + 0.18 * Math.min(1, angle / 1.4);
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    const wa = Math.sin((1 - s) * angle) / Math.sin(angle);
    const wb = Math.sin(s * angle) / Math.sin(angle);
    const altitude = 1 + lift * Math.sin(Math.PI * s);
    points.push([(wa * a[0] + wb * b[0]) * altitude, (wa * a[1] + wb * b[1]) * altitude, (wa * a[2] + wb * b[2]) * altitude]);
  }
  return points;
}

export function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Shortest signed angular difference from `from` to `to`, in degrees. */
export function shortestDelta(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180;
}
