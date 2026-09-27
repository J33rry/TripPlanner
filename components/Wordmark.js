import { forwardRef } from "react";

const NEEDLE_LIT = "M15.5 -22.1 L5.7 4 L-15.5 22.1 Z";
const NEEDLE_SHADE = "M15.5 -22.1 L-5.7 -4 L-15.5 22.1 Z";

export const CompassMark = forwardRef(function CompassMark({ className = "" }, ringRef) {
  return (
    <svg className={`compass-mark ${className}`} viewBox="-50 -62 100 124" aria-hidden="true" focusable="false">
      <circle className="compass-disc" r="38" />
      <circle ref={ringRef} r="38" fill="none" stroke="currentColor" strokeWidth="6.5" />
      <path d="M0 -60 L4.5 -40 L-4.5 -40 Z" fill="currentColor" />
      <path d="M0 60 L4.5 40 L-4.5 40 Z" fill="currentColor" />
      <g className="compass-needle">
        <path d={NEEDLE_LIT} fill="currentColor" />
        <path d={NEEDLE_SHADE} fill="currentColor" opacity="0.72" />
      </g>
    </svg>
  );
});

export default function Wordmark({ className = "" }) {
  return (
    <span className={`wordmark ${className}`} role="img" aria-label="roam">
      <span className="wm-letters" aria-hidden="true">r</span>
      <CompassMark />
      <span className="wm-letters" aria-hidden="true">am</span>
    </span>
  );
}
