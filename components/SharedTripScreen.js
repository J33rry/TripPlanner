"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRoam } from "./RoamShell";

/**
 * Overlay for /share/[shareId]. Hands the trip to the shell, which dives into
 * it view-only; until then the globe shows on its own.
 */
export default function SharedTripScreen({ shared }) {
  const { showSharedTrip } = useRoam();

  useEffect(() => {
    if (shared) showSharedTrip(shared);
  }, [shared, showSharedTrip]);

  if (shared) return null;

  return (
    <div className="trip-missing" role="alert">
      <h1>This link isn’t working</h1>
      <p>It may be mistyped, or the trip’s owner has stopped sharing it.</p>
      <div className="trip-missing-actions">
        <Link href="/" className="dark-pill">Plan your own trip</Link>
      </div>
    </div>
  );
}
