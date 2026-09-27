"use client";

import { useState } from "react";
import Link from "next/link";
import { tripHref, useRoam } from "./RoamShell";
import { ChevronIcon, CloseIcon, SearchIcon } from "./icons";
import { dayCount, destinationLabel, placeTitle } from "@/lib/tripDisplay";

const matches = (saved, query) => {
  const haystack = [saved.title, saved.data.destination?.name, saved.data.destination?.country, saved.data.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return query.split(/\s+/).every((word) => haystack.includes(word));
};

export default function TripsScreen() {
  const { view, savedTrips, images, deleteSaved, focusSavedTrip } = useRoam();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? savedTrips.filter((saved) => matches(saved, q)) : savedTrips;
  const count = savedTrips.length;

  return (
    <div className="trips-ui" aria-hidden={view === "arriving"}>
      <section className="trips-panel" aria-labelledby="trips-title">
        <h1 id="trips-title">Your trips</h1>
        <p className="trips-count">{count ? `${count} saved ${count === 1 ? "trip" : "trips"}` : "No saved trips yet"}</p>

        {count > 0 && (
          <label className="trips-search">
            <SearchIcon />
            <span className="sr-only">Search trips</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trips" autoComplete="off" />
          </label>
        )}

        {count === 0 ? (
          <div className="trips-empty">
            <p>Plan a trip and save it — it will appear here and on the globe.</p>
            <Link href="/" className="dark-pill">Plan a trip</Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="trips-empty">No trips match “{query.trim()}”.</p>
        ) : (
          <ul className="trips-list">
            {visible.map((saved, index) => {
              const image = images[placeTitle(saved.data)];
              return (
                <li key={saved.id} onPointerEnter={() => focusSavedTrip(saved.id)} onPointerLeave={() => focusSavedTrip(null)}>
                  <Link
                    href={tripHref(saved)}
                    className="trip-card"
                    onFocus={() => focusSavedTrip(saved.id)}
                    onBlur={() => focusSavedTrip(null)}
                  >
                    <span className={`trip-card-image tint-${index % 5}`} style={image ? { backgroundImage: `url("${image}")` } : undefined} aria-hidden="true" />
                    <span className="trip-card-text">
                      <strong>{saved.title}</strong>
                      <small>{destinationLabel(saved.data)} · {dayCount(saved.data)}</small>
                    </span>
                    <span className="trip-card-chevron" aria-hidden="true"><ChevronIcon /></span>
                  </Link>
                  <button type="button" className="icon-button trip-card-delete" onClick={() => deleteSaved(saved.id)} aria-label={`Delete ${saved.title}`}>
                    <CloseIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
