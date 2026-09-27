"use client";

import Link from "next/link";
import HomeScreen from "./HomeScreen";
import TripsScreen from "./TripsScreen";
import { useRoam } from "./RoamShell";

/**
 * Overlay for /trips/[id]. The shell opens the trip itself (dive, map and
 * itinerary); until the dive starts this keeps showing the list the trip was
 * opened from, so navigating here looks seamless.
 */
export default function TripRouteScreen() {
  const { screen, missingTrip } = useRoam();

  if (missingTrip) {
    return (
      <div className="trip-missing" role="alert">
        <h1>We couldn’t find that trip</h1>
        <p>Saved trips live in the browser they were saved in. It may have been deleted, or saved on another device.</p>
        <div className="trip-missing-actions">
          <Link href="/trips" className="dark-pill">See your trips</Link>
          <Link href="/" className="ghost-pill">Plan a new trip</Link>
        </div>
      </div>
    );
  }

  return screen === "trips" ? <TripsScreen /> : <HomeScreen />;
}
