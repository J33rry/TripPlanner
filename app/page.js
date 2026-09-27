"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DestinationGlobe from "@/components/DestinationGlobe";
import ErrorBanner from "@/components/ErrorBanner";
import IntroSplash from "@/components/IntroSplash";
import ItineraryView from "@/components/ItineraryView";
import RefineInput from "@/components/RefineInput";
import TripMap from "@/components/TripMap";
import Wordmark from "@/components/Wordmark";
import { ArrowIcon, BookmarkIcon, CheckIcon, CloseIcon, PlusIcon, SparkleIcon } from "@/components/icons";
import { useDayRoutes } from "@/hooks/useDayRoutes";
import { useGenerateTrip } from "@/hooks/useGenerateTrip";
import { usePlaceImages } from "@/hooks/usePlaceImages";
import { useTripState } from "@/hooks/useTripState";
import { DESTINATIONS } from "@/lib/destinations";
import { getTripCenter, getTripStops } from "@/lib/geo";

const STORAGE_KEY = "tripplanner_saved_trips";
// If map tiles are slow, don't hold the zoomed-in globe forever.
const MAP_READY_TIMEOUT_MS = 3500;
const DESKTOP_MIN_WIDTH = 900;

function loadSavedTrips() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.data?.stops) : [];
  } catch {
    return [];
  }
}

function saveTripToStorage(trip) {
  try {
    // Dedupe on the stable tripId so re-saving an edited trip updates its entry,
    // while two distinct trips that share an AI-generated title stay separate.
    const saved = loadSavedTrips().filter((item) => item.data?.tripId !== trip.tripId);
    const entry = { id: Date.now(), title: trip.tripTitle, savedAt: new Date().toISOString(), data: trip };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...saved].slice(0, 10)));
    return true;
  } catch {
    return false;
  }
}

const placeTitle = (trip) => trip?.destination?.landmark || trip?.destination?.name || "";

function destinationLabel(trip) {
  const { name, country } = trip.destination || {};
  if (!name) return trip.tripTitle;
  return country && country !== name ? `${name}, ${country}` : name;
}

function savedMeta(saved) {
  const days = saved.data.stops.length;
  const date = new Date(saved.savedAt).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return `${date} · ${days} ${days === 1 ? "day" : "days"}`;
}

export default function HomePage() {
  const { trip, setTrip, toggleActivity, deleteActivity, deleteDay, editActivity, reorderActivities, reorderDays, togglePackingItem, clearTrip } = useTripState();
  const [view, setView] = useState("home"); // home → arriving → trip
  // Opening sequence: splash (compass + title) → morph (compass becomes the globe) → done
  const [intro, setIntro] = useState({ phase: "splash", from: null });
  const [savedTrips, setSavedTrips] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [activeDayId, setActiveDayId] = useState(null);
  const [hoveredStopId, setHoveredStopId] = useState(null);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [insets, setInsets] = useState({ right: 0, bottom: 0 });
  const lastRequestRef = useRef(null);
  const viewRef = useRef(view);
  const tripRef = useRef(trip);
  const arrivalRef = useRef({ globe: false, map: false, timer: null });
  const panelRef = useRef(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    viewRef.current = view;
    tripRef.current = trip;
  });

  // ── Arrival: globe dive + map load must both finish before the reveal ─────
  const revealIfReady = useCallback(() => {
    const arrival = arrivalRef.current;
    if (viewRef.current === "arriving" && arrival.globe && arrival.map) {
      clearTimeout(arrival.timer);
      setView("trip");
    }
  }, []);

  const beginArrival = useCallback((data) => {
    clearTimeout(arrivalRef.current.timer);
    arrivalRef.current = { globe: false, map: false, timer: null };
    setTrip(data);
    setActiveDayId(null);
    setSelectedStopId(null);
    setHoveredStopId(null);
    const skipGlobe = !getTripCenter(data) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setView(skipGlobe ? "trip" : "arriving");
  }, [setTrip]);

  const handleGlobeArrived = useCallback(() => {
    arrivalRef.current.globe = true;
    arrivalRef.current.timer = setTimeout(() => {
      if (viewRef.current === "arriving") setView("trip");
    }, MAP_READY_TIMEOUT_MS);
    revealIfReady();
  }, [revealIfReady]);

  const handleMapReady = useCallback(() => {
    arrivalRef.current.map = true;
    revealIfReady();
  }, [revealIfReady]);

  const { loading, error, generate, cancel, clearError } = useGenerateTrip(
    useCallback((data) => {
      if (viewRef.current === "trip" && tripRef.current) {
        // A refinement: update in place and keep the trip's identity.
        setTrip({ ...data, tripId: tripRef.current.tripId });
      } else {
        beginArrival(data);
      }
    }, [setTrip, beginArrival])
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSavedTrips(loadSavedTrips()));
    const arrival = arrivalRef.current;
    return () => {
      window.cancelAnimationFrame(frame);
      clearTimeout(saveTimer.current);
      clearTimeout(arrival.timer);
    };
  }, []);

  // Keep the map's framing clear of the itinerary panel (side panel on
  // desktop, bottom sheet on small screens).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      const desktop = window.innerWidth >= DESKTOP_MIN_WIDTH;
      setInsets({ right: desktop ? panel.offsetWidth : 0, bottom: desktop ? 0 : panel.offsetHeight });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [view]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleGenerate = (input) => {
    const cleanInput = input.trim();
    if (!cleanInput || loading) return;
    lastRequestRef.current = { userInput: cleanInput };
    setPrompt(cleanInput);
    generate(lastRequestRef.current);
  };

  const handleRefine = (refinement) => {
    if (!trip) return;
    // Send the plan without client-only fields (undefined keys drop out of JSON).
    const cleanTrip = {
      ...trip,
      tripId: undefined,
      packingList: trip.packingList?.map((item) => (typeof item === "object" ? item.text : item)),
      stops: trip.stops.map((stop) => ({
        ...stop,
        id: undefined,
        activities: stop.activities.map((activity) => ({ ...activity, id: undefined, completed: undefined, edited: undefined })),
      })),
    };
    lastRequestRef.current = { existingTrip: cleanTrip, refinement };
    generate(lastRequestRef.current);
  };

  const retryLastRequest = () => {
    if (lastRequestRef.current) generate(lastRequestRef.current);
  };

  const handleSave = () => {
    if (!trip) return;
    const success = saveTripToStorage(trip);
    setSaveMessage(success ? "Saved" : "Couldn’t save");
    setSavedTrips(loadSavedTrips());
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveMessage(""), 2200);
  };

  const handleDeleteSaved = (id) => {
    const remaining = loadSavedTrips().filter((item) => item.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      setSavedTrips(remaining);
    } catch { /* Keep the in-memory list unchanged if storage is unavailable. */ }
  };

  const startNewTrip = () => {
    cancel();
    clearError();
    clearTimeout(arrivalRef.current.timer);
    clearTrip();
    setPrompt("");
    setView("home");
    setSavedTrips(loadSavedTrips());
  };

  const selectStop = (stopId) => {
    setSelectedStopId(stopId);
    if (!stopId) return;
    const day = trip?.stops.find((stop) => stop.activities.some((activity) => activity.id === stopId));
    if (day && activeDayId && activeDayId !== day.id) setActiveDayId(day.id);
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const stops = useMemo(() => getTripStops(trip), [trip]);
  const stopNumbers = useMemo(() => Object.fromEntries(stops.map((stop) => [stop.id, stop.number])), [stops]);
  const center = useMemo(() => getTripCenter(trip), [trip]);
  const dayRoutes = useDayRoutes(trip);
  const images = usePlaceImages([
    placeTitle(trip),
    ...(trip?.stops.flatMap((day) => day.activities.map((activity) => activity.location)) || []),
    ...savedTrips.slice(0, 5).map((saved) => placeTitle(saved.data)),
  ]);

  const globeMode = view === "arriving" ? "arriving" : loading && view === "home" ? "thinking" : "idle";
  const showMap = view !== "home" && trip;

  return (
    <div className={`roam-app phase-${view} ${intro.phase !== "done" ? `intro-stage-${intro.phase}` : ""}`}>
      {intro.phase !== "done" && (
        <IntroSplash
          onMorph={(from) => setIntro({ phase: "morph", from })}
          onDone={() => setIntro({ phase: "done", from: null })}
        />
      )}
      <header className="roam-header">
        <button type="button" className="roam-brand" onClick={startNewTrip} aria-label="Roam home"><Wordmark /></button>
        {view === "trip" && trip && (
          <div className="trip-header-title"><span>{trip.tripTitle}</span></div>
        )}
        <div className="header-actions">
          {view === "trip" && trip && (
            <>
              <button type="button" className="outline-pill" onClick={handleSave}>
                {saveMessage ? <CheckIcon /> : <BookmarkIcon />}
                <span>{saveMessage || "Save trip"}</span>
              </button>
              <button type="button" className="outline-pill" onClick={startNewTrip}>
                <PlusIcon /><span>New trip</span>
              </button>
            </>
          )}
        </div>
      </header>

      <main className="roam-stage">
        {showMap && (
          <div className={`map-layer ${view === "trip" ? "is-visible" : ""}`}>
            <TripMap
              key={trip.tripId}
              center={center}
              stops={stops}
              dayRoutes={dayRoutes}
              activeDayId={activeDayId}
              hoveredStopId={hoveredStopId}
              selectedStopId={selectedStopId}
              revealed={view === "trip"}
              insets={insets}
              onReady={handleMapReady}
              onStopSelect={selectStop}
            />
          </div>
        )}

        <DestinationGlobe
          destinations={DESTINATIONS}
          mode={globeMode}
          target={view === "arriving" ? center : null}
          hidden={view === "trip"}
          intro={intro.phase === "done" ? null : intro}
          disabled={loading}
          onSelect={handleGenerate}
          onArrive={handleGlobeArrived}
        />

        {view !== "trip" && (
          <div className="home-ui" aria-hidden={view === "arriving"}>
            <aside className="recent-card" aria-label="Recent trips">
              <h2>Recent trips</h2>
              {savedTrips.length ? (
                <ul>
                  {savedTrips.slice(0, 5).map((saved, index) => {
                    const image = images[placeTitle(saved.data)];
                    return (
                      <li key={saved.id}>
                        <button type="button" className="recent-open" onClick={() => beginArrival(saved.data)} disabled={loading}>
                          <span className={`recent-thumb tint-${index % 5}`} style={image ? { backgroundImage: `url("${image}")` } : undefined} aria-hidden="true" />
                          <span className="recent-text">
                            <strong>{saved.title}</strong>
                            <small>{savedMeta(saved)}</small>
                          </span>
                          <span className="recent-chevron" aria-hidden="true">›</span>
                        </button>
                        <button type="button" className="icon-button recent-delete" onClick={() => handleDeleteSaved(saved.id)} aria-label={`Delete ${saved.title}`}>
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
              <ErrorBanner error={view === "home" ? error : null} onRetry={retryLastRequest} onDismiss={clearError} />
              {loading && view === "home" && (
                <p className="thinking-caption" role="status">
                  <SparkleIcon /> Sketching your trip{prompt ? ` — “${prompt.length > 60 ? `${prompt.slice(0, 57)}…` : prompt}”` : ""}
                </p>
              )}
              <form className={`trip-composer ${loading ? "is-loading" : ""}`} onSubmit={(event) => { event.preventDefault(); handleGenerate(prompt); }}>
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
        )}

        {showMap && (
          <aside ref={panelRef} className={`trip-panel ${view === "trip" ? "is-open" : ""}`} aria-label="Itinerary">
            <div className="panel-scroll">
              <header className="trip-hero">
                <div className="hero-image" style={images[placeTitle(trip)] ? { backgroundImage: `url("${images[placeTitle(trip)]}")` } : undefined} aria-hidden="true" />
                <div className="hero-text">
                  <h1>{destinationLabel(trip)}</h1>
                  <p className="hero-meta">
                    {trip.stops.length} {trip.stops.length === 1 ? "day" : "days"}
                    {trip.totalBudgetEstimate && <> · {trip.totalBudgetEstimate}</>}
                  </p>
                </div>
              </header>
              {trip.summary && <p className="trip-summary">{trip.summary}</p>}
              <ErrorBanner error={error} onRetry={retryLastRequest} onDismiss={clearError} />
              <div className={`itinerary-wrap ${loading ? "is-refreshing" : ""}`} aria-busy={loading}>
                <ItineraryView
                  trip={trip}
                  images={images}
                  stopNumbers={stopNumbers}
                  activeDayId={activeDayId}
                  hoveredStopId={hoveredStopId}
                  selectedStopId={selectedStopId}
                  onSelectDay={setActiveDayId}
                  onHoverStop={setHoveredStopId}
                  onSelectStop={selectStop}
                  onToggleActivity={toggleActivity}
                  onDeleteActivity={deleteActivity}
                  onDeleteDay={(dayId) => { if (activeDayId === dayId) setActiveDayId(null); deleteDay(dayId); }}
                  onEditActivity={editActivity}
                  onReorderActivities={reorderActivities}
                  onReorderDays={reorderDays}
                  onTogglePackingItem={togglePackingItem}
                />
              </div>
            </div>
            <div className="panel-footer">
              <RefineInput onRefine={handleRefine} loading={loading} />
              <p className="panel-disclaimer">AI suggestions — check places, hours and prices before you go.</p>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
