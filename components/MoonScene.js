"use client";

import { useEffect, useRef } from "react";
import MoonCanvas from "./MoonCanvas";

const C = 320; // orbit viewBox centre; the moon's radius in it is 196 (see .nf-sphere)

// Tilted orbits. `riders` are glowing dots that travel the orbit, like the ones circling the home globe.
// Speed is in laps per second; negative runs the other way.
const ORBITS = [
  { rx: 296, ry: 104, rot: -32, riders: [{ at: 196, speed: 0.07 }] },
  { rx: 304, ry: 92, rot: 16, riders: [{ at: 62, speed: 0.06 }, { at: 262, speed: 0.06 }] },
];
const RIDERS = ORBITS.flatMap((orbit) => orbit.riders.map((rider) => ({ orbit, ...rider })));

function orbitPoint({ rx, ry, rot }, deg) {
  const t = (deg * Math.PI) / 180;
  const r = (rot * Math.PI) / 180;
  const x = rx * Math.cos(t);
  const y = ry * Math.sin(t);
  return { x: C + x * Math.cos(r) - y * Math.sin(r), y: C + x * Math.sin(r) + y * Math.cos(r), front: Math.sin(t) > 0 };
}

function Orbits({ half }) {
  return ORBITS.map((o, i) => (
    <g key={i} transform={`rotate(${o.rot} ${C} ${C})`}>
      <ellipse
        className="nf-orbit"
        cx={C}
        cy={C}
        rx={o.rx}
        ry={o.ry}
        clipPath={half === "front" ? "url(#nf-front-half)" : undefined}
      />
    </g>
  ));
}

// Each rider exists in both layers; the animation shows whichever side of the moon it is on.
function Riders({ half, refs }) {
  return RIDERS.map((rider, i) => {
    const p = orbitPoint(rider.orbit, rider.at);
    return (
      <g
        key={i}
        ref={(el) => { refs.current[i] = el; }}
        transform={`translate(${p.x} ${p.y})`}
        style={p.front === (half === "front") ? undefined : { display: "none" }}
      >
        <circle r={14} fill="url(#nf-rider-glow)" />
        <circle className="nf-rider" r={3.6} />
      </g>
    );
  });
}

// Orbits pass behind and in front of the moon, so they sit in two SVG layers
// around the sphere, which stacks a lit base, the spinning surface and its shading.
export default function MoonScene() {
  const backRefs = useRef([]);
  const frontRefs = useRef([]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden || reducedMotion.matches) return;
      const clock = (now - start) / 1000;
      RIDERS.forEach((rider, i) => {
        const p = orbitPoint(rider.orbit, rider.at + rider.speed * 360 * clock);
        const transform = `translate(${p.x} ${p.y})`;
        const back = backRefs.current[i];
        const front = frontRefs.current[i];
        back.setAttribute("transform", transform);
        front.setAttribute("transform", transform);
        back.style.display = p.front ? "none" : "";
        front.style.display = p.front ? "" : "none";
      });
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="nf-moon">
      <svg className="nf-layer" viewBox="0 0 640 640" aria-hidden="true" focusable="false">
        <defs>
          {/* In each orbit's own (rotated) frame, the half nearer the viewer is y > centre. */}
          <clipPath id="nf-front-half" clipPathUnits="userSpaceOnUse">
            <rect x="-200" y={C} width="1040" height="600" />
          </clipPath>
          <radialGradient id="nf-rider-glow">
            <stop offset="0" stopColor="rgb(196, 150, 255)" stopOpacity="0.6" />
            <stop offset="1" stopColor="rgb(196, 150, 255)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="nf-halo" cx={C} cy={C} r={222} />
        <Orbits half="back" />
        <Riders half="back" refs={backRefs} />
      </svg>
      <div className="nf-sphere">
        <MoonCanvas />
        <div className="nf-sphere-shade" />
      </div>
      <svg className="nf-layer" viewBox="0 0 640 640" aria-hidden="true" focusable="false">
        <Orbits half="front" />
        <Riders half="front" refs={frontRefs} />
      </svg>
    </div>
  );
}
