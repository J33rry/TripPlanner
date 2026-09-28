// Camera math for the Google trip map: Web Mercator projection, fitting a set
// of points inside padded bounds, and a smooth "fly" between two cameras.
// Google Maps has no animated fitBounds, so the map is driven frame by frame
// with moveCamera(), using the same zoom-out-and-in curve as Google Earth
// (van Wijk & Nuij, "Smooth and efficient zooming and panning").

const TILE_SIZE = 256;
const MAX_LAT = 85.0511;

export const worldSize = (zoom) => TILE_SIZE * 2 ** zoom;

/** { lat, lng } → unit world coordinates, x and y in 0..1 (y grows southward). */
export function project({ lat, lng }) {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return {
    x: (lng + 180) / 360,
    y: (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2,
  };
}

export function unproject({ x, y }) {
  const lng = x * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return { lat, lng: ((((lng + 180) % 360) + 360) % 360) - 180 };
}

/** Zoom at which a Mercator map matches the scale of an orthographic globe of `radius` px at `lat`. */
export function zoomForGlobeRadius(radius, lat) {
  return Math.log2((radius * 2 * Math.PI * Math.cos((lat * Math.PI) / 180)) / TILE_SIZE);
}

/**
 * The map centre that puts `point` at the middle of the padded area of a
 * `size` viewport at `zoom`.
 */
export function centerWithPadding(point, zoom, padding) {
  const p = project(point);
  const scale = worldSize(zoom);
  return unproject({
    x: p.x - (padding.left - padding.right) / 2 / scale,
    y: p.y - (padding.top - padding.bottom) / 2 / scale,
  });
}

/** Camera ({ center, zoom }) that fits all `points` ([lng, lat] pairs) inside the padded viewport. */
export function cameraForPoints(points, { size, padding, maxZoom }) {
  const projected = points.map(([lng, lat]) => project({ lat, lng }));
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const roomX = Math.max(1, size.width - padding.left - padding.right);
  const roomY = Math.max(1, size.height - padding.top - padding.bottom);
  const zoomX = maxX > minX ? Math.log2(roomX / ((maxX - minX) * TILE_SIZE)) : maxZoom;
  const zoomY = maxY > minY ? Math.log2(roomY / ((maxY - minY) * TILE_SIZE)) : maxZoom;
  const zoom = Math.min(maxZoom, zoomX, zoomY);
  const middle = unproject({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
  return { center: centerWithPadding(middle, zoom, padding), zoom };
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Returns frame(t) → { center, zoom } for t in 0..1, flying from camera `from`
 * to camera `to` in a `size` viewport. Long hops zoom out mid-flight.
 */
export function flightPath(from, to, size, { curve = 1.42, easing = easeInOutCubic } = {}) {
  const start = project(from.center);
  const end = project(to.center);
  const startScale = worldSize(from.zoom);
  const w0 = Math.max(size.width, size.height);
  const w1 = w0 / 2 ** (to.zoom - from.zoom);
  const u1 = Math.hypot(end.x - start.x, end.y - start.y) * startScale;
  const rho = curve;
  const rho2 = rho * rho;

  let widthAt;
  let travelled;
  let length;
  const r = (i) => {
    const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
    return Math.log(Math.sqrt(b * b + 1) - b);
  };

  if (u1 < 1e-6 || !Number.isFinite(r(0)) || !Number.isFinite(r(1))) {
    // Same place: a pure zoom.
    const direction = w1 < w0 ? -1 : 1;
    length = Math.abs(Math.log(w1 / w0)) / rho;
    widthAt = (s) => Math.exp(direction * rho * s);
    travelled = () => 1;
  } else {
    const r0 = r(0);
    length = (r(1) - r0) / rho;
    widthAt = (s) => Math.cosh(r0) / Math.cosh(r0 + rho * s);
    travelled = (s) => (w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2)) / u1;
  }

  return (t) => {
    if (t >= 1) return { center: to.center, zoom: to.zoom };
    const s = easing(Math.max(0, t)) * length;
    const k = length ? travelled(s) : 1;
    return {
      zoom: from.zoom + Math.log2(1 / widthAt(s)),
      center: unproject({ x: start.x + (end.x - start.x) * k, y: start.y + (end.y - start.y) * k }),
    };
  };
}
