"use client";

import Link from "next/link";
import ErrorBanner from "./ErrorBanner";
import { tripHref, useRoam } from "./RoamShell";
import { ArrowIcon, CloseIcon, SparkleIcon } from "./icons";
import { placeTitle, savedMeta } from "@/lib/tripDisplay";

const RECENT_LIMIT = 5;

export default function HomeScreen() {
  const { view, loading, error, prompt, setPrompt, generateFromPrompt, cancel, clearError, retryLastRequest, savedTrips, images, deleteSaved } = useRoam();

  return (
    <div className="home-ui" aria-hidden={view === "arriving"}>
      <aside className="recent-card" aria-label="Recent trips">
        <div className="recent-heading">
          <h2>Recent trips</h2>
          {savedTrips.length > 0 && (
            <Link href="/trips" className="icon-button" aria-label="See all trips"><ArrowIcon /></Link>
          )}
        </div>
        {savedTrips.length ? (
          <ul>
            {savedTrips.slice(0, RECENT_LIMIT).map((saved, index) => {
              const image = images[placeTitle(saved.data)];
              return (
                <li key={saved.id}>
                  <Link href={tripHref(saved)} className="recent-open">
                    <span className={`recent-thumb tint-${index % 5}`} style={image ? { backgroundImage: `url("${image}")` } : undefined} aria-hidden="true" />
                    <span className="recent-text">
                      <strong>{saved.title}</strong>
                      <small>{savedMeta(saved)}</small>
                    </span>
                    <span className="recent-chevron" aria-hidden="true">›</span>
                  </Link>
                  <button type="button" className="icon-button recent-delete" onClick={() => deleteSaved(saved.id)} aria-label={`Delete ${saved.title}`}>
                    <CloseIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="recent-empty">Trips you save will be waiting here.</p>
        )}
      </aside>

      <div className="composer-wrap">
        <ErrorBanner error={view === "globe" ? error : null} onRetry={retryLastRequest} onDismiss={clearError} />
        {loading && view === "globe" && (
          <p className="thinking-caption" role="status">
            <SparkleIcon /> Sketching your trip{prompt ? ` — “${prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt}”` : ""}
          </p>
        )}
        <form className={`trip-composer ${loading ? "is-loading" : ""}`} onSubmit={(event) => { event.preventDefault(); generateFromPrompt(prompt); }}>
          <span className="composer-icon" aria-hidden="true"><SparkleIcon /></span>
          <label className="sr-only" htmlFor="roam-prompt">Where would you like to go?</label>
          <input
            id="roam-prompt"
            value={prompt}
            maxLength={500}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Where would you like to go?"
            disabled={loading}
            autoComplete="off"
          />
          {loading ? (
            <button type="button" className="dark-pill composer-submit" onClick={cancel}>Cancel</button>
          ) : (
            <button type="submit" className="dark-pill composer-submit" disabled={!prompt.trim()} aria-label="Plan my trip">
              <span className="submit-label">Plan my trip</span> <ArrowIcon />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
