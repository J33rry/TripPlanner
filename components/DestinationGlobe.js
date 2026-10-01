"use client";

import { useEffect, useRef, useState } from "react";
import {
  arrivalRadius,
  buildArc,
  buildLandDots,
  buildSphereDots,
  cross,
  normalize,
  shortestDelta,
  toView,
  viewFor,
  worldVector,
} from "@/lib/globeGeometry";
import { usePlaceImages } from "@/hooks/usePlaceImages";

const IDLE_SPIN_DEG_PER_S = 3;
const THINKING_SPIN_DEG_PER_S = 9;
const START_VIEW = { lat: 18, lon: 22 };
const MAX_TILT = 60;
const ARRIVE_ROTATE_S = 1.5;
const ARRIVE_ZOOM_START_S = 0.35;
const ARRIVE_TOTAL_S = 2.3;
const INTRO_GROW_S = 1.35;
const SCREEN_SPIN_DEG_PER_S = 150;
// Entering an auth screen spins at least this far, settling back on START_VIEW so the pins face front.
const AUTH_SPIN_MIN_DEG = 160;
const AUTH_SPIN_S = 1.7;

const ORB_AXES = [normalize([0.18, 1, 0.12]), normalize([1, 0.3, -0.25]), normalize([-0.55, 0.45, 0.7])];
const ORB_SPEEDS = [1.6, -1.2, 2.05];
const ORB_COLORS = [[214, 190, 255], [170, 118, 255], [246, 236, 255]];
const IDLE_COLOR = [247, 245, 251];
const OCEAN_DOTS = 2600;
const ALPHA_LEVELS = 6;

const RINGS = [
  { radius: 1.17, inclination: 64, azimuth: -30, precession: 1.2, speed: 0.22, riders: [0.1, 0.58] },
  { radius: 1.25, inclination: 76, azimuth: 38, precession: -0.8, speed: -0.16, riders: [0.36] },
  { radius: 1.11, inclination: 22, azimuth: 60, precession: 1.6, speed: 0.28, riders: [0.82] },
];
// Each flight: a dashed path that drifts along, plus a glowing plane-and-trail that
// crosses it, rests, and goes again. Staggered so they don't all fly at once.
const FLIGHT_CYCLE_S = 5.2;
const FLIGHT_TRAVEL = 0.62; // share of the cycle spent in the air
const FLIGHT_TAIL = 0.22; // trail length, as a share of the route
const FLIGHT_TAIL_STEPS = 14;
const FLIGHT_COLOR = "186, 140, 255";
const FLIGHT_FRONT_COLOR = "206, 176, 255"; // lighter, to read against the dark globe

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeInCubic = (t) => t * t * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const mod = (a, n) => ((a % n) + n) % n;

const AUTH_SCREENS = new Set(["login", "signup"]);

function homeLayout(width, height, screen = "home") {
  const auth = AUTH_SCREENS.has(screen);
  const stacked = width < (screen === "home" ? 760 : 900);
  if (stacked && auth) {
    const r = Math.min(width * 0.3, height * 0.17);
    return { cx: width / 2, cy: r + 36, r };
  }
  if (stacked) {
    const r = Math.min(width * 0.36, height * 0.24);
    return { cx: width / 2, cy: r + 52, r };
  }
  if (auth) {
    // The globe sits opposite the form card, above the headline.
    const r = Math.min(height * 0.33, width * 0.2);
    return { cx: width * (screen === "login" ? 0.71 : 0.29), cy: height * 0.4, r };
  }
  if (screen === "trips") {
    const r = Math.min(height * 0.4, width * 0.235);
    return { cx: width * 0.29, cy: height * 0.5, r };
  }
  const r = Math.min(height * 0.335, width * 0.25);
  return { cx: width * 0.535, cy: height * 0.44, r };
}

function ringBasis(ring, t) {
  const inc = ring.inclination * (Math.PI / 180);
  const az = (ring.azimuth + ring.precession * t) * (Math.PI / 180);
  const n = [Math.sin(inc) * Math.cos(az), Math.cos(inc), Math.sin(inc) * Math.sin(az)];
  const u = normalize(cross(n, [0, 0, 1]));
  const v = cross(n, u);
  return { u, v };
}

export default function DestinationGlobe({ destinations, routes = [], screen = "home", mode = "idle", target, hidden, intro, focusId, disabled, onSelect, onArrive }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const markerRefs = useRef({});
  const [activeId, setActiveId] = useState(null);
  const images = usePlaceImages(destinations.map((d) => d.landmark));

  const live = useRef({ mode, screen, target, hidden, intro, focusId, activeId, onArrive });
  useEffect(() => {
    live.current = { mode, screen, target, hidden, intro, focusId, activeId, onArrive };
  });

  const markersRef = useRef([]);
  useEffect(() => {
    markersRef.current = destinations.map((d) => ({
      id: d.id,
      lat: d.latitude,
      lon: d.longitude,
      world: worldVector(d.latitude, d.longitude),
      labelSide: d.labelSide || "right",
      labelWidth: 20 + d.name.length * 8,
    }));
  }, [destinations]);
  const focusRequest = useRef(null);

  const flightsRef = useRef([]);
  useEffect(() => {
    flightsRef.current = routes.map((route, i) => ({
      points: buildArc(route.from, route.to),
      cycle: FLIGHT_CYCLE_S + (i % 4) * 0.85,
      offset: i * 0.37,
    }));
  }, [routes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const land = buildLandDots();
    const ocean = buildSphereDots(OCEAN_DOTS);

    const bucketCount = 3 * ALPHA_LEVELS;
    const capacity = land.count + ocean.count;
    const buckets = Array.from({ length: bucketCount }, () => ({ xs: new Float32Array(capacity * 3), n: 0 }));

    const state = {
      width: 0, height: 0, dpr: 1,
      lat: START_VIEW.lat, lon: START_VIEW.lon,
      layout: null,
      orb: 0, orbTime: 0, clock: 0,
      angles: [0, 0, 0],
      drag: null, velocity: 0,
      arrival: null,
      lastMode: "idle",
      arrivedFired: false,
      screen: null,
      introGrow: null,
      spin: null,
      last: performance.now(),
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.width = rect.width;
      state.height = rect.height;
      canvas.width = Math.round(rect.width * state.dpr);
      canvas.height = Math.round(rect.height * state.dpr);
      if (!state.arrival) state.layout = homeLayout(rect.width, rect.height, live.current.screen);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const onPointerDown = (event) => {
      if (live.current.mode !== "idle" || !state.layout) return;
      const rect = canvas.getBoundingClientRect();
      const dx = event.clientX - rect.left - state.layout.cx;
      const dy = event.clientY - rect.top - state.layout.cy;
      if (Math.hypot(dx, dy) > state.layout.r * 1.05) return;
      state.drag = { x: event.clientX, y: event.clientY, t: performance.now() };
      state.velocity = 0;
      state.spin = null;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-dragging");
    };
    const onPointerMove = (event) => {
      if (!state.drag) return;
      const degPerPx = 57.3 / state.layout.r;
      const dx = event.clientX - state.drag.x;
      const dy = event.clientY - state.drag.y;
      const now = performance.now();
      state.lon -= dx * degPerPx;
      state.lat = Math.max(-MAX_TILT, Math.min(MAX_TILT, state.lat + dy * degPerPx));
      state.velocity = (-dx * degPerPx) / Math.max(1, now - state.drag.t) * 1000;
      state.drag = { x: event.clientX, y: event.clientY, t: now };
    };
    const onPointerUp = () => {
      state.drag = null;
      canvas.classList.remove("is-dragging");
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    const project = (x, y, r, cx, cy) => [cx + x * r, cy - y * r];

    const strokePath = (points, fromFront, alpha, width, color = "186, 140, 255") => {
      ctx.lineWidth = width;
      ctx.strokeStyle = `rgba(${color}, ${alpha})`;
      ctx.beginPath();
      let drawing = false;
      for (const [sx, sy, z] of points) {
        const include = !fromFront || z > 0;
        if (include && drawing) ctx.lineTo(sx, sy);
        else if (include) { ctx.moveTo(sx, sy); drawing = true; }
        else drawing = false;
      }
      ctx.stroke();
    };

    const glowDot = (x, y, radius, alpha, core = "255,255,255") => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      glow.addColorStop(0, `rgba(196, 150, 255, ${0.55 * alpha})`);
      glow.addColorStop(1, "rgba(196, 150, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${core}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const collect = (dots, view, orbMix, r, cx, cy, baseAlpha, rot) => {
      const t = state.clock;
      const dotSize = Math.min(4.5, Math.max(0.7, r * 0.0034));
      for (let i = 0; i < dots.count; i++) {
        let [x, y, z] = toView(dots.x[i], dots.y[i], dots.z[i], view);
        const family = dots.family[i];
        if (orbMix > 0.001) {
          const { k, c, s } = rot[family];
          const dot = k[0] * x + k[1] * y + k[2] * z;
          const rx = x * c + (k[1] * z - k[2] * y) * s + k[0] * dot * (1 - c);
          const ry = y * c + (k[2] * x - k[0] * z) * s + k[1] * dot * (1 - c);
          const rz = z * c + (k[0] * y - k[1] * x) * s + k[2] * dot * (1 - c);
          x += (rx - x) * orbMix;
          y += (ry - y) * orbMix;
          z += (rz - z) * orbMix;
          const ripple = (1 + orbMix * 0.05 * Math.sin(t * 3.1 + dots.phase[i])) / (Math.hypot(x, y, z) || 1);
          x *= ripple; y *= ripple; z *= ripple;
        }
        if (z <= 0.02) continue;
        let alpha = baseAlpha * (0.16 + 0.84 * Math.pow(z, 0.7));
        if (orbMix > 0.001) {
          const wave = 0.5 + 0.5 * Math.sin(t * 4.2 - y * 5 + family * 2.1);
          alpha *= 1 - orbMix * 0.45 + orbMix * 0.6 * wave;
        }
        if (alpha < 0.04) continue;
        const level = Math.min(ALPHA_LEVELS - 1, Math.floor(alpha * ALPHA_LEVELS));
        const bucket = buckets[family * ALPHA_LEVELS + level];
        const o = bucket.n * 3;
        bucket.xs[o] = cx + x * r;
        bucket.xs[o + 1] = cy - y * r;
        bucket.xs[o + 2] = dotSize * (0.55 + 0.45 * z) * (1 + orbMix * 0.3);
        bucket.n++;
      }
    };

    const flushBuckets = (orbMix) => {
      for (let family = 0; family < 3; family++) {
        const tint = ORB_COLORS[family];
        const rgb = IDLE_COLOR.map((c, i) => Math.round(c + (tint[i] - c) * orbMix)).join(",");
        for (let level = 0; level < ALPHA_LEVELS; level++) {
          const bucket = buckets[family * ALPHA_LEVELS + level];
          if (!bucket.n) continue;
          ctx.fillStyle = `rgba(${rgb}, ${(level + 0.5) / ALPHA_LEVELS})`;
          ctx.beginPath();
          for (let j = 0; j < bucket.n; j++) {
            const x = bucket.xs[j * 3];
            const y = bucket.xs[j * 3 + 1];
            const size = bucket.xs[j * 3 + 2];
            ctx.moveTo(x + size, y);
            ctx.arc(x, y, size, 0, Math.PI * 2);
          }
          ctx.fill();
          bucket.n = 0;
        }
      }
    };

    let frame = 0;
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.max(0, Math.min(0.05, (now - state.last) / 1000));
      state.last = now;
      const { mode: currentMode, target: currentTarget, hidden: isHidden, intro, focusId, activeId } = live.current;
      const markers = markersRef.current;
      const hovered = activeId || focusId;
      if (isHidden || document.hidden || !state.width) return;

      if (intro?.phase === "splash") {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      if (intro?.phase === "morph" && intro.from && !state.introGrow) {
        const rect = wrap.getBoundingClientRect();
        state.introGrow = { start: state.clock, from: { cx: intro.from.x - rect.left, cy: intro.from.y - rect.top, r: intro.from.r } };
      }
      const still = reducedMotion.matches;
      state.clock += dt;

      if (live.current.screen !== state.screen) {
        // Spin the way the globe travels: gliding left turns the surface left, and vice versa.
        const shift = state.screen ? homeLayout(state.width, state.height, live.current.screen).cx - homeLayout(state.width, state.height, state.screen).cx : 0;
        const direction = -Math.sign(shift);
        state.spin = null;
        if (Math.abs(shift) > 1 && !still) {
          if (AUTH_SCREENS.has(live.current.screen)) {
            const turn = direction > 0
              ? AUTH_SPIN_MIN_DEG + mod(START_VIEW.lon - state.lon - AUTH_SPIN_MIN_DEG, 360)
              : -(AUTH_SPIN_MIN_DEG + mod(state.lon - START_VIEW.lon - AUTH_SPIN_MIN_DEG, 360));
            state.spin = { start: state.clock, lon0: state.lon, lat0: state.lat, dLon: turn };
            state.velocity = 0;
          } else {
            state.velocity = direction * SCREEN_SPIN_DEG_PER_S;
          }
        }
        state.screen = live.current.screen;
      }

      if (currentMode !== state.lastMode) {
        if (currentMode === "arriving" && currentTarget) {
          state.arrival = {
            start: state.clock,
            lat0: state.lat, lon0: state.lon,
            dLon: shortestDelta(state.lon, currentTarget.lng),
            lat1: Math.max(-80, Math.min(80, currentTarget.lat)),
            layout0: { ...state.layout },
            orb0: state.orb,
          };
          state.arrivedFired = false;
          state.spin = null;
        } else {
          state.arrival = null;
        }
        state.lastMode = currentMode;
      }

      const home = homeLayout(state.width, state.height, live.current.screen);
      let ringFade = 1;
      let markerFade = 1;
      let introProgress = 1;

      if (state.arrival) {
        const a = state.arrival;
        const elapsed = still ? ARRIVE_TOTAL_S : state.clock - a.start;
        const turn = easeInOutCubic(clamp01(elapsed / ARRIVE_ROTATE_S));
        state.lon = a.lon0 + a.dLon * turn;
        state.lat = a.lat0 + (a.lat1 - a.lat0) * turn;
        state.orb = a.orb0 * (1 - clamp01(elapsed / 0.6));

        const zoom = easeInCubic(clamp01((elapsed - ARRIVE_ZOOM_START_S) / (ARRIVE_TOTAL_S - ARRIVE_ZOOM_START_S)));
        const finalR = arrivalRadius(state.width, state.height);
        const glide = easeInOutCubic(clamp01((elapsed - ARRIVE_ZOOM_START_S * 0.5) / (ARRIVE_TOTAL_S - ARRIVE_ZOOM_START_S)));
        state.layout = {
          cx: a.layout0.cx + (state.width / 2 - a.layout0.cx) * glide,
          cy: a.layout0.cy + (state.height / 2 - a.layout0.cy) * glide,
          r: a.layout0.r * Math.pow(finalR / a.layout0.r, zoom),
        };
        ringFade = 1 - clamp01(elapsed / 0.9);
        markerFade = 0;
        if (elapsed >= ARRIVE_TOTAL_S && !state.arrivedFired) {
          state.arrivedFired = true;
          live.current.onArrive?.({ radius: state.layout.r });
        }
      } else if (state.introGrow && !state.introGrow.done) {
        const g = state.introGrow;
        const p = still ? 1 : clamp01((state.clock - g.start) / INTRO_GROW_S);
        const e = easeInOutCubic(p);
        state.layout = {
          cx: g.from.cx + (home.cx - g.from.cx) * e,
          cy: g.from.cy + (home.cy - g.from.cy) * e,
          r: g.from.r * Math.pow(home.r / g.from.r, e),
        };
        state.lon += IDLE_SPIN_DEG_PER_S * dt;
        introProgress = p;
        if (p >= 1) g.done = true;
      } else {
        const k = 1 - Math.exp(-dt * 3.2);
        state.layout = {
          cx: state.layout.cx + (home.cx - state.layout.cx) * k,
          cy: state.layout.cy + (home.cy - state.layout.cy) * k,
          r: state.layout.r * Math.pow(home.r / state.layout.r, k),
        };
        const orbTarget = currentMode === "thinking" ? 1 : 0;
        state.orb += (orbTarget - state.orb) * (1 - Math.exp(-dt * (orbTarget ? 2.2 : 3)));
        if (Math.abs(state.orb - orbTarget) < 0.002) state.orb = orbTarget;
        markerFade = 1 - state.orb;

        const listFocus = focusId && markers.find((m) => m.id === focusId);
        if (state.spin) {
          const s = state.spin;
          const p = clamp01((state.clock - s.start) / AUTH_SPIN_S);
          const e = easeInOutCubic(p);
          state.lon = s.lon0 + s.dLon * e;
          state.lat = s.lat0 + (START_VIEW.lat - s.lat0) * e;
          if (p >= 1) state.spin = null;
        } else if (focusRequest.current || listFocus) {
          const f = focusRequest.current || listFocus;
          const kf = 1 - Math.exp(-dt * 5);
          state.lon += shortestDelta(state.lon, f.lon) * kf;
          state.lat += (Math.max(-MAX_TILT, Math.min(MAX_TILT, f.lat)) - state.lat) * kf;
        } else if (!state.drag && !still) {
          const paused = hovered && currentMode === "idle";
          if (Math.abs(state.velocity) > 0.5) {
            state.lon += state.velocity * dt;
            state.velocity *= Math.exp(-dt * 2.5);
          } else if (!paused) {
            state.lon += (currentMode === "thinking" ? THINKING_SPIN_DEG_PER_S : IDLE_SPIN_DEG_PER_S) * dt;
          }
        }
      }

      if (introProgress < 1) {
        ringFade *= clamp01((introProgress - 0.35) / 0.65);
        markerFade *= clamp01((introProgress - 0.75) / 0.25);
      }
      const detailFade = clamp01(introProgress / 0.55);

      const orbMix = still ? state.orb * 0.35 : state.orb;
      if (orbMix > 0.001 && !still) state.orbTime += dt * (0.4 + orbMix);
      const rot = ORB_AXES.map((k, i) => {
        const angle = state.orbTime * ORB_SPEEDS[i];
        return { k, c: Math.cos(angle), s: Math.sin(angle) };
      });

      const { cx, cy } = state.layout;
      const pulse = 1 + orbMix * 0.035 * Math.sin(state.clock * 2.4);
      const r = state.layout.r * pulse;
      const view = viewFor(state.lat, state.lon);

      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.clearRect(0, 0, state.width, state.height);

      const haloStrength = (0.2 + orbMix * (0.28 + 0.12 * Math.sin(state.clock * 3))) * detailFade;
      const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.5);
      halo.addColorStop(0, `rgba(190, 150, 250, ${haloStrength})`);
      halo.addColorStop(1, "rgba(190, 150, 250, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);

      const ringSpeedBoost = 1 + orbMix * 3;
      const ringPaths = RINGS.map((ring) => {
        const { u, v } = ringBasis(ring, state.clock * ringSpeedBoost);
        const at = (theta) => {
          const px = (u[0] * Math.cos(theta) + v[0] * Math.sin(theta)) * ring.radius;
          const py = (u[1] * Math.cos(theta) + v[1] * Math.sin(theta)) * ring.radius;
          const pz = (u[2] * Math.cos(theta) + v[2] * Math.sin(theta)) * ring.radius;
          const [sx, sy] = project(px, py, r, cx, cy);
          return [sx, sy, pz];
        };
        const points = Array.from({ length: 121 }, (_, i) => at((i / 120) * Math.PI * 2));
        const riders = ring.riders.map((offset) => at((offset + state.clock * ring.speed * ringSpeedBoost) * Math.PI * 2));
        return { points, riders };
      });
      const flightPaths = flightsRef.current.map((flight) => {
        const points = flight.points.map(([wx, wy, wz]) => {
          const [x, y, z] = toView(wx, wy, wz, view);
          const [sx, sy] = project(x, y, r, cx, cy);
          return [sx, sy, z];
        });
        const phase = mod(state.clock / flight.cycle + flight.offset, 1) / FLIGHT_TRAVEL;
        return { points, head: phase <= 1 + FLIGHT_TAIL ? easeInOutCubic(clamp01(phase)) + Math.max(0, phase - 1) : null };
      });
      // In front of the globe, or lifted past its edge.
      const seen = ([sx, sy, z]) => z > 0 || Math.hypot(sx - cx, sy - cy) > r;

      const strokeRoute = (points, alpha, onlySeen, { dashed = true, width = onlySeen ? 1.5 : 1.1 } = {}) => {
        ctx.save();
        if (dashed) {
          ctx.setLineDash([4, 5]);
          ctx.lineDashOffset = -state.clock * 10;
        }
        ctx.lineWidth = width;
        ctx.strokeStyle = `rgba(${onlySeen ? FLIGHT_FRONT_COLOR : FLIGHT_COLOR}, ${alpha})`;
        ctx.beginPath();
        let drawing = false;
        for (const point of points) {
          if (onlySeen && !seen(point)) { drawing = false; continue; }
          if (drawing) ctx.lineTo(point[0], point[1]);
          else { ctx.moveTo(point[0], point[1]); drawing = true; }
        }
        ctx.stroke();
        ctx.restore();
      };

      const pointAt = (points, t) => {
        const f = clamp01(t) * (points.length - 1);
        const i = Math.min(points.length - 2, Math.floor(f));
        const k = f - i;
        const a = points[i];
        const b = points[i + 1];
        return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      };

      const drawFlight = ({ points, head }, alpha) => {
        if (head == null) return;
        ctx.lineCap = "round";
        let prev = pointAt(points, head - FLIGHT_TAIL);
        for (let step = 1; step <= FLIGHT_TAIL_STEPS; step++) {
          const share = step / FLIGHT_TAIL_STEPS;
          const t = head - FLIGHT_TAIL * (1 - share);
          const next = pointAt(points, t);
          if (t > 0 && t <= 1 && seen(prev) && seen(next)) {
            ctx.lineWidth = 0.8 + 2 * share;
            ctx.strokeStyle = `rgba(${FLIGHT_FRONT_COLOR}, ${alpha * share})`;
            ctx.beginPath();
            ctx.moveTo(prev[0], prev[1]);
            ctx.lineTo(next[0], next[1]);
            ctx.stroke();
          }
          prev = next;
        }
        ctx.lineCap = "butt";
        if (head <= 1) {
          const tip = pointAt(points, head);
          if (seen(tip)) glowDot(tip[0], tip[1], 2.4, alpha);
        }
      };

      // Flight paths step aside while the globe is "thinking" up a trip.
      const flightFade = ringFade * (1 - state.orb) ** 2;
      if (ringFade > 0) {
        const lineAlpha = (0.42 + orbMix * 0.3) * ringFade;
        ringPaths.forEach(({ points }) => strokePath(points, false, lineAlpha, 1));
      }
      if (flightFade > 0.01) {
        flightPaths.forEach(({ points }) => strokeRoute(points, 0.42 * flightFade * 0.7, false));
      }

      const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.42, r * 0.05, cx, cy, r * 1.05);
      body.addColorStop(0, "#47464d");
      body.addColorStop(0.5, "#1d1d22");
      body.addColorStop(1, "#0b0b0e");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      if (orbMix > 0.001) {
        ctx.globalCompositeOperation = "lighter";
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        core.addColorStop(0, `rgba(150, 95, 240, ${0.34 * orbMix * (0.75 + 0.25 * Math.sin(state.clock * 2.6))})`);
        core.addColorStop(0.7, `rgba(120, 70, 210, ${0.12 * orbMix})`);
        core.addColorStop(1, "rgba(120, 70, 210, 0)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      collect(land, view, orbMix, r, cx, cy, detailFade, rot);
      if (orbMix > 0.02) collect(ocean, view, orbMix, r, cx, cy, orbMix * 0.75, rot);
      flushBuckets(orbMix);

      const rim = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r);
      rim.addColorStop(0, "rgba(255,255,255,0)");
      rim.addColorStop(1, `rgba(225, 205, 255, ${0.1 + orbMix * 0.12})`);
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      if (ringFade > 0) {
        const lineAlpha = (0.55 + orbMix * 0.3) * ringFade;
        ringPaths.forEach(({ points, riders }) => {
          strokePath(points, true, lineAlpha, 1.1);
          riders.forEach(([x, y, z]) => {
            const inFront = z > 0 || Math.hypot(x - cx, y - cy) > r;
            if (inFront) glowDot(x, y, 2.2, ringFade);
          });
        });
      }
      if (flightFade > 0.01) {
        const flightAlpha = 0.55 * flightFade;
        flightPaths.forEach((flight) => {
          strokeRoute(flight.points, flightAlpha * 0.35, true, { dashed: false, width: 2.4 });
          strokeRoute(flight.points, Math.min(1, flightAlpha * 1.4), true);
          drawFlight(flight, flightFade);
        });
      }

      const placed = [];
      for (const marker of markers) {
        const [x, y, z] = toView(marker.world[0], marker.world[1], marker.world[2], view);
        const [sx, sy] = project(x, y, r, cx, cy);
        const visible = z > 0.12 ? Math.min(1, (z - 0.12) / 0.15) * markerFade : 0;
        if (visible > 0) glowDot(sx, sy, marker.id === hovered ? 5 : 3.8, visible);
        placed.push({ marker, sx, sy, visible });
      }
      placed.sort((a, b) => (b.marker.id === hovered) - (a.marker.id === hovered));
      const boxes = [];
      for (const { marker, sx, sy, visible } of placed) {
        const el = markerRefs.current[marker.id];
        if (!el) continue;
        el.style.transform = `translate(${sx}px, ${sy}px)`;
        el.style.opacity = visible.toFixed(3);
        el.dataset.hidden = visible < 0.3 ? "true" : "false";
        if (visible < 0.3) continue;
        const width = marker.labelWidth;
        const boxFor = (side) => (side === "left" ? [sx - 12 - width, sy - 13, sx - 6, sy + 13] : [sx + 6, sy - 13, sx + 12 + width, sy + 13]);
        const clear = (box) => boxes.every((o) => box[2] < o[0] || box[0] > o[2] || box[3] < o[1] || box[1] > o[3]);
        const sides = marker.labelSide === "left" ? ["left", "right"] : ["right", "left"];
        const side = sides.find((candidate) => clear(boxFor(candidate)));
        el.dataset.side = side || sides[0];
        el.dataset.label = side || marker.id === hovered ? "shown" : "hidden";
        boxes.push(side ? boxFor(side) : [sx - 6, sy - 6, sx + 6, sy + 6]);
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  const closeTimer = useRef(null);
  const open = (id) => {
    clearTimeout(closeTimer.current);
    setActiveId(id);
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setActiveId(null), 220);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const interactive = mode === "idle" && !hidden;

  return (
    <div className={`globe mode-${mode} ${hidden ? "is-hidden" : ""}`} ref={wrapRef}>
      <canvas ref={canvasRef} className="globe-canvas" aria-hidden="true" />
      <div className="globe-markers" aria-label={screen === "trips" ? "Your trip destinations" : "Suggested destinations"} hidden={!interactive}>
        {destinations.map((destination) => {
          const isActive = activeId === destination.id;
          const image = images[destination.landmark];
          return (
            <div
              key={destination.id}
              className={`globe-marker ${isActive ? "is-active" : ""}`}
              ref={(el) => { markerRefs.current[destination.id] = el; }}
              onPointerEnter={() => open(destination.id)}
              onPointerLeave={scheduleClose}
              onKeyDown={(event) => { if (event.key === "Escape") setActiveId(null); }}
            >
              <button
                type="button"
                className="marker-pin"
                aria-expanded={isActive}
                aria-label={destination.cardTitle}
                onClick={() => (isActive ? setActiveId(null) : open(destination.id))}
                onFocus={() => {
                  focusRequest.current = { lat: destination.latitude, lon: destination.longitude };
                  open(destination.id);
                }}
                onBlur={() => { focusRequest.current = null; }}
              >
                <span className="marker-label">{destination.name}</span>
              </button>
              {isActive && (
                <div className="marker-card" onPointerEnter={() => open(destination.id)}>
                  <div className="marker-card-image" style={image ? { backgroundImage: `url("${image}")` } : undefined} aria-hidden="true" />
                  <div className="marker-card-body">
                    <h3>{destination.cardTitle}</h3>
                    <p>{destination.cardText}</p>
                    <button
                      type="button"
                      className="dark-pill"
                      disabled={disabled}
                      onFocus={() => open(destination.id)}
                      onClick={() => { setActiveId(null); onSelect(destination); }}
                    >
                      {destination.actionLabel} <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
