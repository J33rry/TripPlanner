"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HomeScreen from "./HomeScreen";
import TripsScreen from "./TripsScreen";
import { useRoam } from "./RoamShell";

/**
 * Overlay for /trips/[id]. The shell opens the trip itself (dive, map and
 * itinerary); until the dive starts this keeps showing the list the trip was
 * opened from, so navigating here looks seamless.
 */
export default function TripRouteScreen() {
  const { screen, missingTrip, auth } = useRoam();
  const pathname = usePathname();

  if (missingTrip && auth.status === "guest") {
    return (
      <div className="trip-missing" role="alert">
        <h1>Log in to open this trip</h1>
        <p>Saved trips belong to the account that saved them.</p>
        <div className="trip-missing-actions">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="dark-pill">Log in</Link>
          <Link href="/" className="ghost-pill">Plan a new trip</Link>
        </div>
      </div>
    );
  }

  if (missingTrip) {
    return (
      <div className="trip-missing" role="alert">
        <h1>We couldn’t find that trip</h1>
        <p>It may have been deleted, or saved to a different account.</p>
        <div className="trip-missing-actions">
          <Link href="/trips" className="dark-pill">See your trips</Link>
          <Link href="/" className="ghost-pill">Plan a new trip</Link>
        </div>
      </div>
    );
  }

  return screen === "trips" ? <TripsScreen /> : <HomeScreen />;
}
