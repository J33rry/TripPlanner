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

// ── Motion ────────────────────────────────────────────────────────────────
const IDLE_SPIN_DEG_PER_S = 3; // one lazy revolution every two minutes
const THINKING_SPIN_DEG_PER_S = 9;
const START_VIEW = { lat: 18, lon: 22 }; // Europe, Africa and India in view
const MAX_TILT = 60;
const ARRIVE_ROTATE_S = 1.5;
const ARRIVE_ZOOM_START_S = 0.35;
const ARRIVE_TOTAL_S = 2.1;

// ── AI orb ────────────────────────────────────────────────────────────────
// While thinking, every dot leaves its continent and swirls around one of
// three tilted axes; easing the mix back to 0 lets each dot flow home.
const ORB_AXES = [normalize([0.18, 1, 0.12]), normalize([1, 0.3, -0.25]), normalize([-0.55, 0.45, 0.7])];
const ORB_SPEEDS = [1.6, -1.2, 2.05];
const ORB_COLORS = [[214, 190, 255], [170, 118, 255], [246, 236, 255]];
const IDLE_COLOR = [247, 245, 251];
const OCEAN_DOTS = 2600;
const ALPHA_LEVELS = 6;

// ── Decoration ────────────────────────────────────────────────────────────
const RINGS = [
  { radius: 1.17, inclination: 64, azimuth: -30, precession: 1.2, speed: 0.22, riders: [0.1, 0.58] },
  { radius: 1.25, inclination: 76, azimuth: 38, precession: -0.8, speed: -0.16, riders: [0.36] },
  { radius: 1.11, inclination: 22, azimuth: 60, precession: 1.6, speed: 0.28, riders: [0.82] },
];
const ARCS = [
  { from: { lat: 51.5, lon: -0.13 }, to: { lat: 40.7, lon: -74 }, speed: 0.12 },
  { from: { lat: 48.86, lon: 2.35 }, to: { lat: 27.2, lon: 78 }, speed: 0.09 },
  { from: { lat: 27.2, lon: 78 }, to: { lat: -33.9, lon: 18.4 }, speed: 0.1 },
];

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeInCubic = (t) => t * t * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));

/** Where the globe sits on the home screen (CSS pixels). Mirrored in globals.css. */
function homeLayout(width, height) {
  if (width < 760) {
    const r = Math.min(width * 0.36, height * 0.24);
    return { cx: width / 2, cy: r + 52, r };
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

export default function DestinationGlobe({ destinations, mode = "idle", target, hidden, disabled, onSelect, onArrive }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const markerRefs = useRef({});
  const [activeId, setActiveId] = useState(null);
  const images = usePlaceImages(destinations.map((d) => d.landmark));

  // Props read inside the animation loop without restarting it.
  const live = useRef({ mode, target, hidden, activeId, onArrive });
  useEffect(() => {
    live.current = { mode, target, hidden, activeId, onArrive };
  });
  const focusRequest = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ctx = canvas.getContext("2d");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const land = buildLandDots();
    const ocean = buildSphereDots(OCEAN_DOTS);
    const arcs = ARCS.map((arc) => ({ ...arc, points: buildArc(arc.from, arc.to) }));
    const markers = destinations.map((d) => ({ id: d.id, world: worldVector(d.latitude, d.longitude) }));

    // Per-frame scratch space for batching dots by colour family × alpha level.
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
      last: performance.now(),
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.width = rect.width;
      state.height = rect.height;
      canvas.width = Math.round(rect.width * state.dpr);
      canvas.height = Math.round(rect.height * state.dpr);
      // Snap to the new framing (the arrival dive computes its own).
      if (!state.arrival) state.layout = homeLayout(rect.width, rect.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    // ── Drag to rotate ──────────────────────────────────────────────────
    const onPointerDown = (event) => {
      if (live.current.mode !== "idle" || !state.layout) return;
      const rect = canvas.getBoundingClientRect();
      const dx = event.clientX - rect.left - state.layout.cx;
      const dy = event.clientY - rect.top - state.layout.cy;
      if (Math.hypot(dx, dy) > state.layout.r * 1.05) return;
      state.drag = { x: event.clientX, y: event.clientY, t: performance.now() };
      state.velocity = 0;
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

    // ── Drawing helpers ─────────────────────────────────────────────────
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

    // Push one dot set through the view (and orb swirl) into the buckets.
    const collect = (dots, view, orbMix, r, cx, cy, baseAlpha, rot) => {
      const t = state.clock;
      const dotSize = Math.max(0.7, r * 0.0034);
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

    // ── Frame ───────────────────────────────────────────────────────────
    let frame = 0;
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      // rAF timestamps can trail performance.now(), so clamp away negative steps.
      const dt = Math.max(0, Math.min(0.05, (now - state.last) / 1000));
      state.last = now;
      const { mode: currentMode, target: currentTarget, hidden: isHidden, activeId: hovered } = live.current;
      if (isHidden || document.hidden || !state.width) return;
      const still = reducedMotion.matches;
      state.clock += dt;

      // Mode transitions
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
        } else {
          state.arrival = null;
        }
        state.lastMode = currentMode;
      }

      const home = homeLayout(state.width, state.height);
      let ringFade = 1;
      let markerFade = 1;

      if (state.arrival) {
        // Calm the orb, turn the destination to face us, then dive in.
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
      } else {
        // Ease back toward the home framing (this is also the zoom-out when
        // returning from a trip), and spin.
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

        if (focusRequest.current) {
          // Keyboard focus on a marker: bring it round to face the viewer.
          const f = focusRequest.current;
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

      // Soft lavender halo behind the sphere.
      const haloStrength = 0.2 + orbMix * (0.28 + 0.12 * Math.sin(state.clock * 3));
      const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.5);
      halo.addColorStop(0, `rgba(190, 150, 250, ${haloStrength})`);
      halo.addColorStop(1, "rgba(190, 150, 250, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);

      // Orbit rings and flight arcs: draw fully first; the sphere then hides
      // whatever passes behind it, and the front halves are redrawn on top.
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
      const arcPaths = arcs.map((arc) => {
        const points = arc.points.map(([wx, wy, wz]) => {
          const [x, y, z] = toView(wx, wy, wz, view);
          const [sx, sy] = project(x, y, r, cx, cy);
          return [sx, sy, z];
        });
        const progress = (((state.clock * arc.speed) % 1) + 1) % 1;
        return { points, rider: points[Math.floor(progress * (points.length - 1))] };
      });

      if (ringFade > 0) {
        const lineAlpha = (0.42 + orbMix * 0.3) * ringFade;
        ringPaths.forEach(({ points }) => strokePath(points, false, lineAlpha, 1));
        arcPaths.forEach(({ points }) => strokePath(points, false, lineAlpha * 0.9, 1));
      }

      // The sphere
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

      collect(land, view, orbMix, r, cx, cy, 1, rot);
      if (orbMix > 0.02) collect(ocean, view, orbMix, r, cx, cy, orbMix * 0.75, rot);
      flushBuckets(orbMix);

      // Rim light
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
        arcPaths.forEach(({ points, rider }) => {
          strokePath(points, true, lineAlpha * 0.9, 1.1);
          if (rider[2] > 0) glowDot(rider[0], rider[1], 1.8, ringFade);
        });
      }

      // Destination markers: glow on canvas, label/hit area as HTML overlay.
      for (const marker of markers) {
        const [x, y, z] = toView(marker.world[0], marker.world[1], marker.world[2], view);
        const [sx, sy] = project(x, y, r, cx, cy);
        const visible = z > 0.12 ? Math.min(1, (z - 0.12) / 0.15) * markerFade : 0;
        if (visible > 0) glowDot(sx, sy, marker.id === hovered ? 5 : 3.8, visible);
        const el = markerRefs.current[marker.id];
        if (el) {
          el.style.transform = `translate(${sx}px, ${sy}px)`;
          el.style.opacity = visible.toFixed(3);
          el.dataset.hidden = visible < 0.3 ? "true" : "false";
        }
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
  }, [destinations]);

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
      <div className="globe-markers" aria-label="Suggested destinations" hidden={!interactive}>
        {destinations.map((destination) => {
          const isActive = activeId === destination.id;
          const image = images[destination.landmark];
          return (
            <div
              key={destination.id}
              className={`globe-marker label-${destination.labelSide || "right"} ${isActive ? "is-active" : ""}`}
              ref={(el) => { markerRefs.current[destination.id] = el; }}
              onPointerEnter={() => open(destination.id)}
              onPointerLeave={scheduleClose}
              onKeyDown={(event) => { if (event.key === "Escape") setActiveId(null); }}
            >
              <button
                type="button"
                className="marker-pin"
                aria-expanded={isActive}
                aria-label={`${destination.name}, ${destination.region}`}
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
                    <h3>{destination.name}, {destination.region}</h3>
                    <p>{destination.note}</p>
                    <button
                      type="button"
                      className="dark-pill"
                      disabled={disabled}
                      onFocus={() => open(destination.id)}
                      onClick={() => { setActiveId(null); onSelect(destination.prompt); }}
                    >
                      Plan a trip here <span aria-hidden="true">→</span>
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
