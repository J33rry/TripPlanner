import { cross, normalize } from "./globeGeometry";

// Dot kinds, drawn in this order (later kinds sit on top).
export const PIT = 0; // dark stipple over the whole surface
export const RING = 1; // concentric dots inside a crater
export const SPECK = 2; // pale highlights between the pits
export const RIM = 3; // raised, sunlit crater rims
export const KINDS = 4;

const SURFACE_DOTS = 26000;
const CRATER_COUNT = 34;
const RING_SPACING = 0.028; // radians between a crater's dot rings

function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function randomUnit(rand) {
  const z = 2 * rand() - 1;
  const r = Math.sqrt(1 - z * z);
  const t = rand() * Math.PI * 2;
  return [r * Math.cos(t), r * Math.sin(t), z];
}

const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

/** The point `d` radians from `c`, heading `a` around it. */
function offsetPoint(c, e1, e2, d, a) {
  const cd = Math.cos(d);
  const sd = Math.sin(d);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return [c[0] * cd + (e1[0] * ca + e2[0] * sa) * sd, c[1] * cd + (e1[1] * ca + e2[1] * sa) * sd, c[2] * cd + (e1[2] * ca + e2[2] * sa) * sd];
}

/**
 * A stippled moon: random pits everywhere, plus craters made of concentric dot
 * rings with a bright rim and a scatter of ejecta. Sizes are in sphere radii.
 * Seeded, so every visit (and every render) gets the same moon.
 */
export function buildMoonSurface(seed = 11) {
  const rand = seeded(seed);
  const craters = [];
  for (let tries = 0; craters.length < CRATER_COUNT && tries < 4000; tries++) {
    const rho = 0.06 + Math.pow(rand(), 1.7) * 0.22;
    const c = randomUnit(rand);
    if (craters.some((o) => angleBetween(o.c, c) < (o.rho + rho) * 1.05)) continue;
    const up = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = normalize(cross(up, c));
    craters.push({ c, rho, e1, e2: cross(c, e1) });
  }

  const points = [];
  const push = (p, size, kind) => points.push([p[0], p[1], p[2], size, kind]);

  for (const { c, rho, e1, e2 } of craters) {
    const rings = Math.max(3, Math.round(rho / RING_SPACING));
    for (let k = 1; k <= rings; k++) {
      const d = (rho * 0.94 * k) / rings;
      const count = Math.max(5, Math.round((2 * Math.PI * Math.sin(d)) / (RING_SPACING * 0.85)));
      const twist = rand() * Math.PI * 2;
      // Dots shrink toward the crater's centre, like the floor of a bowl.
      const size = 0.0036 + 0.005 * (k / rings);
      for (let j = 0; j < count; j++) push(offsetPoint(c, e1, e2, d, twist + (j / count) * Math.PI * 2), size, RING);
    }
    const rimCount = Math.round((2 * Math.PI * Math.sin(rho)) / (RING_SPACING * 0.7));
    for (let j = 0; j < rimCount; j++) {
      const a = (j / rimCount) * Math.PI * 2;
      push(offsetPoint(c, e1, e2, rho * (1.02 + rand() * 0.06), a), 0.005 + rand() * 0.004, RIM);
    }
    const ejecta = Math.round(rimCount * 1.4);
    for (let j = 0; j < ejecta; j++) {
      const d = rho * (1.12 + Math.pow(rand(), 1.6) * 0.5);
      push(offsetPoint(c, e1, e2, d, rand() * Math.PI * 2), 0.005 + rand() * 0.005, PIT);
    }
  }

  for (let i = 0; i < SURFACE_DOTS; i++) {
    const p = randomUnit(rand);
    // Keep crater floors clean so their ring pattern reads.
    if (craters.some((o) => angleBetween(o.c, p) < o.rho * 0.98)) continue;
    const speck = rand() < 0.24;
    push(p, speck ? 0.003 + rand() * 0.003 : 0.003 + Math.pow(rand(), 3) * 0.0065, speck ? SPECK : PIT);
  }

  const count = points.length;
  const dots = { count, x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count), size: new Float32Array(count), kind: new Uint8Array(count) };
  points.forEach(([x, y, z, size, kind], i) => {
    dots.x[i] = x;
    dots.y[i] = y;
    dots.z[i] = z;
    dots.size[i] = size;
    dots.kind[i] = kind;
  });
  return { dots, craters: craters.map(({ c, rho }) => ({ c, rho })) };
}
