"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { tripHref, useRoam } from "./RoamShell";
import { sessionJwt } from "@/lib/appwrite";
import { dayCount, destinationLabel } from "@/lib/tripDisplay";

/**
 * Overlay for /join/[inviteId]. A guest logs in (or signs up) and comes back
 * here; a signed-in user joins the trip as an editor and lands in it.
 */
export default function JoinTripScreen({ inviteId, invite }) {
  const { auth, savedTrips, savedLoaded, refreshTrips } = useRoam();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  if (!invite) {
    return (
      <div className="trip-missing" role="alert">
        <h1>This invite isn’t working</h1>
        <p>It may be mistyped, or the trip’s owner has turned the link off. Ask them for a new one.</p>
        <div className="trip-missing-actions">
          <Link href="/" className="dark-pill">Plan your own trip</Link>
        </div>
      </div>
    );
  }

  const here = `/join/${inviteId}`;
  const alreadyIn = savedLoaded ? savedTrips.find((saved) => saved.inviteId === inviteId) : null;
  const people = invite.memberCount === 1 ? "1 person planning" : `${invite.memberCount} people planning`;

  const join = async () => {
    setJoining(true);
    setError("");
    try {
      const jwt = await sessionJwt({ fresh: true });
      const response = await fetch("/api/trips/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, jwt }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Couldn’t join the trip. Try again in a moment.");
      // The trip page opens trips from the saved list, so it must include this one first.
      await refreshTrips();
      router.replace(tripHref({ id: result.tripId }));
    } catch (joinError) {
      console.error("Couldn’t join trip", joinError);
      setError(joinError.message || "Couldn’t join the trip. Try again in a moment.");
      setJoining(false);
    }
  };

  return (
    <div className="trip-missing join-card" role="dialog" aria-labelledby="join-title">
      <p className="join-eyebrow">{invite.ownerName ? `${invite.ownerName} invited you to plan` : "You’re invited to plan"}</p>
      <h1 id="join-title">{invite.title}</h1>
      <p>
        {destinationLabel(invite.data)} · {dayCount(invite.data)} · {people}.{" "}
        Join to change the plan together — everyone on the trip can edit it.
      </p>
      <div className="trip-missing-actions">
        {auth.status === "loading" ? null : auth.status !== "user" ? (
          <>
            <Link href={`/login?next=${encodeURIComponent(here)}`} className="dark-pill">Log in to join</Link>
            <Link href={`/signup?next=${encodeURIComponent(here)}`} className="ghost-pill">Create an account</Link>
          </>
        ) : alreadyIn ? (
          <Link href={tripHref(alreadyIn)} className="dark-pill">You’re on this trip — open it</Link>
        ) : (
          <button type="button" className="dark-pill" onClick={join} disabled={joining || !savedLoaded}>
            {joining ? "Joining…" : "Join trip"}
          </button>
        )}
      </div>
      {error && <p className="join-error" role="alert">{error}</p>}
    </div>
  );
}
