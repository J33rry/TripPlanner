"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CompassMark } from "./Wordmark";

const TIMELINE = { title: 1100, morph: 2600, done: 3700 };
const REDUCED_TIMELINE = { title: 0, morph: 900, done: 1300 };

export default function IntroSplash({ onMorph, onDone }) {
  const [phase, setPhase] = useState("icon");
  const rowRef = useRef(null);
  const compassRef = useRef(null);
  const ringRef = useRef(null);
  const handlers = useRef({ onMorph, onDone });
  useEffect(() => {
    handlers.current = { onMorph, onDone };
  });

  useLayoutEffect(() => {
    const measure = () => {
      const row = rowRef.current?.getBoundingClientRect();
      const compass = compassRef.current?.getBoundingClientRect();
      if (!row || !compass) return;
      const shift = row.left + row.width / 2 - (compass.left + compass.width / 2);
      rowRef.current.style.setProperty("--shift", `${shift}px`);
    };
    measure();
    document.fonts?.ready.then(measure);
  }, []);

  useEffect(() => {
    const times = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? REDUCED_TIMELINE : TIMELINE;
    const startMorph = () => {
      setPhase("morph");
      const ring = ringRef.current?.getBoundingClientRect();
      handlers.current.onMorph?.(ring ? { x: ring.left + ring.width / 2, y: ring.top + ring.height / 2, r: ring.width / 2 } : null);
    };
    const timers = [
      setTimeout(() => setPhase("title"), times.title),
      setTimeout(startMorph, times.morph),
      setTimeout(() => handlers.current.onDone?.(), times.done),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className={`intro-splash phase-${phase}`} aria-hidden="true">
      <div className="intro-backdrop" />
      <div className="intro-row" ref={rowRef}>
        <span className="intro-clip intro-clip-left"><span className="intro-letters">r</span></span>
        <span className="intro-compass" ref={compassRef}><CompassMark ref={ringRef} /></span>
        <span className="intro-clip intro-clip-right"><span className="intro-letters">am</span></span>
      </div>
    </div>
  );
}
