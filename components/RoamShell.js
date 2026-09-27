"use client";

// The persistent app shell, rendered by the root layout so the globe, the
// intro, the open trip and generation state all survive navigation between
// Home (/) and Trips (/trips). Each route only renders its own overlay
// (HomeScreen / TripsScreen) and talks to the shell through useRoam().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import DestinationGlobe from "./DestinationGlobe";
import ErrorBanner from "./ErrorBanner";
import IntroSplash from "./IntroSplash";
import ItineraryView from "./ItineraryView";
import RefineInput from "./RefineInput";
import TripMap from "./TripMap";
import Wordmark from "./Wordmark";
import { BookmarkIcon, CheckIcon, PlusIcon } from "./icons";
import { useDayRoutes } from "@/hooks/useDayRoutes";
import { useGenerateTrip } from "@/hooks/useGenerateTrip";
import { usePlaceImages } from "@/hooks/usePlaceImages";
import { useTripState } from "@/hooks/useTripState";
import { DESTINATIONS } from "@/lib/destinations";
import { distanceKm, getTripCenter, getTripStops } from "@/lib/geo";
import { dayCount, destinationLabel, placeTitle } from "@/lib/tripDisplay";

const STORAGE_KEY = "tripplanner_saved_trips";
// If map tiles are slow, don't hold the zoomed-in globe forever.
const MAP_READY_TIMEOUT_MS = 3500;
const DESKTOP_MIN_WIDTH = 900;
// Markers closer than this get their labels pushed apart (west one on the left).
const LABEL_CLASH_KM = 1200;

function loadSavedTrips() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.data?.stops) : [];
  } catch {
    return [];
  }
}

/** Saves (or updates) a trip and returns its entry, or null on failure. */
function saveTripToStorage(trip) {
  try {
    // Dedupe on the stable tripId so re-saving an edited trip updates its entry
    // (keeping its id, and so its /trips/[id] URL), while two distinct trips
    // that share an AI-generated title stay separate.
    const all = loadSavedTrips();
    const existing = all.find((item) => item.data?.tripId === trip.tripId);
    const others = all.filter((item) => item !== existing);
    const entry = { id: existing?.id ?? Date.now(), title: trip.tripTitle, savedAt: new Date().toISOString(), data: trip };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...others].slice(0, 10)));
    return entry;
  } catch {
    return null;
  }
}

/** Each saved trip has its own page. */
export const tripHref = (saved) => `/trips/${saved.id}`;
const TRIP_ROUTE = /^\/trips\/([^/]+)$/;

// Home globe: suggested destinations that start a new plan.
const SUGGESTION_MARKERS = DESTINATIONS.map((d) => ({
  ...d,
  cardTitle: `${d.name}, ${d.region}`,
  cardText: d.note,
  actionLabel: "Plan a trip here",
}));

/** Trips globe: one marker per saved destination (the most recent trip wins). */
function tripMarkers(savedTrips) {
  const byPlace = new Map();
  for (const saved of savedTrips) {
    const d = saved.data.destination;
    if (d?.latitude == null || d?.longitude == null) continue;
    const key = (d.name || saved.title).toLowerCase();
    if (byPlace.has(key)) continue;
    byPlace.set(key, {
      id: `trip-${saved.id}`,
      savedId: saved.id,
      name: d.name || saved.title,
      latitude: d.latitude,
      longitude: d.longitude,
      landmark: placeTitle(saved.data),
      cardTitle: saved.title,
      cardText: `${destinationLabel(saved.data)} · ${dayCount(saved.data)}`,
      actionLabel: "Open trip",
    });
  }
  const markers = [...byPlace.values()];
  for (const marker of markers) {
    const clashesEast = markers.some(
      (other) => other !== marker && other.longitude > marker.longitude && distanceKm(marker, other) < LABEL_CLASH_KM
    );
    marker.labelSide = clashesEast ? "left" : "right";
  }
  return markers;
}

const RoamContext = createContext(null);
export const useRoam = () => useContext(RoamContext);

export default function RoamShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  // The id in /trips/[id] decides which saved trip is open.
  const routeTripId = pathname.match(TRIP_ROUTE)?.[1] ?? null;
  // Which list the globe is framed for. A trip page keeps the list it was
  // opened from, so the dive starts where the globe already is.
  const [screen, setScreen] = useState(pathname === "/trips" ? "trips" : "home");
  const [screenPath, setScreenPath] = useState(pathname);
  if (pathname !== screenPath) {
    setScreenPath(pathname);
    if (!routeTripId) setScreen(pathname === "/trips" ? "trips" : "home");
  }

  const { trip, setTrip, toggleActivity, deleteActivity, deleteDay, editActivity, reorderActivities, reorderDays, togglePackingItem, clearTrip } = useTripState();
  const [view, setView] = useState("globe"); // globe → arriving → trip
  // Opening sequence: splash (compass + title) → morph (compass becomes the globe) → done
  const [intro, setIntro] = useState({ phase: "splash", from: null });
  const [savedTrips, setSavedTrips] = useState([]);
  const [savedLoaded, setSavedLoaded] = useState(false);
  // The saved trip that is open (its id, as in the URL); null for a fresh,
  // unsaved plan.
  const [openSavedId, setOpenSavedId] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [activeDayId, setActiveDayId] = useState(null);
  const [hoveredStopId, setHoveredStopId] = useState(null);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [globeFocusId, setGlobeFocusId] = useState(null);
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

  const openTrip = useCallback((data, savedId = null) => {
    clearTimeout(arrivalRef.current.timer);
    setOpenSavedId(savedId);
    arrivalRef.current = { globe: false, map: false, timer: null };
    setTrip(data);
    setActiveDayId(null);
    setSelectedStopId(null);
    setHoveredStopId(null);
    setGlobeFocusId(null);
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
        openTrip(data);
      }
    }, [setTrip, openTrip])
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSavedTrips(loadSavedTrips());
      setSavedLoaded(true);
    });
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
  const generateFromPrompt = (input) => {
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
    const entry = saveTripToStorage(trip);
    setSaveMessage(entry ? "Saved" : "Couldn’t save");
    setSavedTrips(loadSavedTrips());
    if (entry && String(entry.id) !== routeTripId) {
      // A fresh plan now has a home of its own.
      setOpenSavedId(String(entry.id));
      router.replace(tripHref(entry));
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveMessage(""), 2200);
  };

  const deleteSaved = (id) => {
    const remaining = loadSavedTrips().filter((item) => item.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
      setSavedTrips(remaining);
    } catch { /* Keep the in-memory list unchanged if storage is unavailable. */ }
  };

  /** Leave the open trip and return to the globe (zooming back out). */
  const closeTrip = () => {
    cancel();
    clearError();
    clearTimeout(arrivalRef.current.timer);
    clearTrip();
    setOpenSavedId(null);
    setPrompt("");
    setView("globe");
    setSavedTrips(loadSavedTrips());
  };

  const startNewTrip = () => {
    closeTrip();
    if (pathname !== "/") router.push("/");
  };

  // ── URL ↔ open trip ───────────────────────────────────────────────────────
  // Opening happens here, not in click handlers, so links, reloads, shared
  // URLs and Back/Forward all behave the same. On a first visit it waits for
  // the intro so the dive follows the compass → globe morph.
  const closeTripRef = useRef(closeTrip);
  useEffect(() => {
    closeTripRef.current = closeTrip;
  });
  const introDone = intro.phase === "done";
  useEffect(() => {
    if (!routeTripId) {
      // Left a trip page (e.g. Back): zoom out again.
      if (openSavedId != null) closeTripRef.current();
      return;
    }
    if (!savedLoaded || !introDone || openSavedId === routeTripId) return;
    const saved = savedTrips.find((item) => String(item.id) === routeTripId);
    if (!saved) return; // rendered as "trip not found" by TripRouteScreen
    cancel(); // a plan still generating must not overwrite the one being opened
    // Syncing from an external source (the URL) once async preconditions are
    // met is exactly what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openTrip(saved.data, routeTripId);
  }, [routeTripId, savedLoaded, introDone, openSavedId, savedTrips, openTrip, cancel]);

  useEffect(() => {
    if (view === "trip" && trip) document.title = `${trip.tripTitle} — Roam`;
  }, [view, trip]);

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
    ...savedTrips.map((saved) => placeTitle(saved.data)),
  ]);

  const savedMarkers = useMemo(() => tripMarkers(savedTrips), [savedTrips]);
  const markers = screen === "trips" ? savedMarkers : SUGGESTION_MARKERS;
  const markerIdBySaved = useMemo(() => {
    // Trips sharing a destination all point at that destination's marker.
    const byName = new Map(savedMarkers.map((m) => [m.name.toLowerCase(), m.id]));
    return Object.fromEntries(
      savedTrips.map((s) => [s.id, byName.get((s.data.destination?.name || s.title).toLowerCase()) || null])
    );
  }, [savedMarkers, savedTrips]);

  const handleMarkerSelect = (marker) => {
    if (marker.savedId != null) {
      router.push(`/trips/${marker.savedId}`);
    } else {
      generateFromPrompt(marker.prompt);
    }
  };

  const globeMode = view === "arriving" ? "arriving" : loading && view === "globe" ? "thinking" : "idle";
  const showMap = view !== "globe" && trip;

  const context = {
    screen,
    view,
    loading,
    error,
    prompt,
    setPrompt,
    generateFromPrompt,
    cancel,
    clearError,
    retryLastRequest,
    savedTrips,
    images,
    deleteSaved,
    // Asked-for trip that isn't saved in this browser.
    missingTrip: Boolean(routeTripId) && savedLoaded && !savedTrips.some((item) => String(item.id) === routeTripId),
    focusSavedTrip: (savedId) => setGlobeFocusId(savedId == null ? null : markerIdBySaved[savedId]),
  };

  // Nav links also close an open trip, so the globe zooms back out.
  const navLink = (href, label) => (
    <Link
      href={href}
      className={`nav-link ${pathname === href && view === "globe" ? "is-active" : ""}`}
      aria-current={pathname === href ? "page" : undefined}
      onClick={() => { if (view !== "globe") closeTrip(); }}
    >
      {label}
    </Link>
  );

  return (
    <RoamContext.Provider value={context}>
      <div className={`roam-app phase-${view} screen-${screen} ${intro.phase !== "done" ? `intro-stage-${intro.phase}` : ""}`}>
        {intro.phase !== "done" && (
          <IntroSplash
            onMorph={(from) => setIntro({ phase: "morph", from })}
            onDone={() => setIntro({ phase: "done", from: null })}
          />
        )}
        <header className="roam-header">
          <Link href="/" className="roam-brand" aria-label="Roam home" onClick={() => { if (view !== "globe") closeTrip(); }}>
            <Wordmark />
          </Link>
          {view === "trip" && trip && (
            <div className="trip-header-title"><span>{trip.tripTitle}</span></div>
          )}
          <nav className="header-nav" aria-label="Main">
            {navLink("/", "Home")}
            {navLink("/trips", "Trips")}
          </nav>
          {view === "trip" && trip && (
            <div className="header-actions">
              <button type="button" className="outline-pill" onClick={handleSave}>
                {saveMessage ? <CheckIcon /> : <BookmarkIcon />}
                <span>{saveMessage || "Save trip"}</span>
              </button>
              <button type="button" className="outline-pill" onClick={startNewTrip}>
                <PlusIcon /><span>New trip</span>
              </button>
            </div>
          )}
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
            destinations={markers}
            screen={screen}
            mode={globeMode}
            target={view === "arriving" ? center : null}
            hidden={view === "trip"}
            intro={intro.phase === "done" ? null : intro}
            focusId={globeFocusId}
            disabled={loading}
            onSelect={handleMarkerSelect}
            onArrive={handleGlobeArrived}
          />

          {view !== "trip" && children}

          {showMap && (
            <aside ref={panelRef} className={`trip-panel ${view === "trip" ? "is-open" : ""}`} aria-label="Itinerary">
              <div className="panel-scroll">
                <header className="trip-hero">
                  <div className="hero-image" style={images[placeTitle(trip)] ? { backgroundImage: `url("${images[placeTitle(trip)]}")` } : undefined} aria-hidden="true" />
                  <div className="hero-text">
                    <h1>{destinationLabel(trip)}</h1>
                    <p className="hero-meta">
                      {dayCount(trip)}
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
                <RefineInput onRefine={handleRefine} loading={loading} error={error} />
                <p className="panel-disclaimer">AI suggestions — check places, hours and prices before you go.</p>
              </div>
            </aside>
          )}
        </main>
      </div>
    </RoamContext.Provider>
  );
}
