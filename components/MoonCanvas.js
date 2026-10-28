"use client";

import { useEffect, useRef } from "react";
import { DEG, toView, viewFor } from "@/lib/globeGeometry";
import { KINDS, RIM, RING, SPECK, buildMoonSurface } from "@/lib/moonSurface";

const SPIN_DEG_PER_S = 6; // one turn a minute
const VIEW_LAT = 12; // look down a little onto the north pole
const AXIAL_TILT = -23.4 * DEG; // Earth's tilt, north leaning right
const ALPHA_LEVELS = 6;
const COLORS = {
  [RING]: "58, 56, 68",
  [SPECK]: "255, 255, 255",
  [RIM]: "255, 255, 255",
};
const PIT_COLOR = "88, 86, 98";

/**
 * The moon's surface, spinning on a tilted axis. Only the dots and crater floors
 * are drawn here; the lit base and the shading are CSS layers either side of
 * the canvas, so lighting stays fixed while the surface turns under it.
 */
export default function MoonCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const { dots, craters } = buildMoonSurface();
    const buckets = Array.from({ length: KINDS * ALPHA_LEVELS }, () => ({ xs: new Float32Array(dots.count * 3), n: 0 }));
    const cosT = Math.cos(AXIAL_TILT);
    const sinT = Math.sin(AXIAL_TILT);
    const state = { size: 0, dpr: 1, lon: 0, last: performance.now() };

    const draw = () => {
      const { size, dpr } = state;
      if (!size) return;
      const r = size / 2;
      const view = viewFor(VIEW_LAT, state.lon);
      // Screen position of a view-space point, after rolling by the axial tilt.
      const sx = (x, y) => r + (x * cosT - y * sinT) * r;
      const sy = (x, y) => r - (x * sinT + y * cosT) * r;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      for (const { c, rho } of craters) {
        const [x, y, z] = toView(c[0], c[1], c[2], view);
        if (z < -Math.sin(rho)) continue;
        const px = sx(x, y);
        const py = sy(x, y);
        const radius = Math.sin(rho) * r;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.atan2(py - r, px - r));
        ctx.scale(Math.max(0.04, z), 1);
        const floor = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        floor.addColorStop(0, "rgba(64, 62, 76, 0.4)");
        floor.addColorStop(0.8, "rgba(90, 88, 102, 0.2)");
        floor.addColorStop(1, "rgba(110, 108, 122, 0)");
        ctx.fillStyle = floor;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = 0; i < dots.count; i++) {
        const [x, y, z] = toView(dots.x[i], dots.y[i], dots.z[i], view);
        if (z <= 0.01) continue;
        // Dots thin out and shrink toward the limb, where the surface turns away.
        const alpha = 0.18 + 0.82 * Math.pow(z, 0.6);
        const level = Math.min(ALPHA_LEVELS - 1, Math.floor(alpha * ALPHA_LEVELS));
        const bucket = buckets[dots.kind[i] * ALPHA_LEVELS + level];
        const o = bucket.n * 3;
        bucket.xs[o] = sx(x, y);
        bucket.xs[o + 1] = sy(x, y);
        bucket.xs[o + 2] = Math.max(0.35, dots.size[i] * r * (0.45 + 0.55 * z));
        bucket.n++;
      }

      for (let kind = 0; kind < KINDS; kind++) {
        for (let level = 0; level < ALPHA_LEVELS; level++) {
          const bucket = buckets[kind * ALPHA_LEVELS + level];
          if (!bucket.n) continue;
          const strength = kind === SPECK ? 0.75 : kind === RIM ? 0.9 : 0.72;
          ctx.fillStyle = `rgba(${COLORS[kind] || PIT_COLOR}, ${(strength * (level + 0.5)) / ALPHA_LEVELS})`;
          ctx.beginPath();
          for (let j = 0; j < bucket.n; j++) {
            const x = bucket.xs[j * 3];
            const y = bucket.xs[j * 3 + 1];
            const s = bucket.xs[j * 3 + 2];
            ctx.moveTo(x + s, y);
            ctx.arc(x, y, s, 0, Math.PI * 2);
          }
          ctx.fill();
          bucket.n = 0;
        }
      }
    };

    const resize = () => {
      state.size = canvas.clientWidth;
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(state.size * state.dpr);
      canvas.height = Math.round(state.size * state.dpr);
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frame = 0;
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - state.last) / 1000);
      state.last = now;
      if (document.hidden || reducedMotion.matches) return;
      // Decreasing the centre longitude carries the surface west to east, as Earth turns.
      state.lon -= SPIN_DEG_PER_S * dt;
      draw();
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="nf-surface" aria-hidden="true" />;
}
