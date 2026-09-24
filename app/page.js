"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import TripInput from "@/components/TripInput";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import ErrorBanner from "@/components/ErrorBanner";
import ItineraryView from "@/components/ItineraryView";
import { useTripState } from "@/hooks/useTripState";
import { useGenerateTrip } from "@/hooks/useGenerateTrip";

// LocalStorage key for saving trips
const STORAGE_KEY = "tripplanner_saved_trips";

function loadSavedTrips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTripToStorage(trip) {
  try {
    const saved = loadSavedTrips();
    const entry = {
      id: Date.now(),
      title: trip.tripTitle,
      savedAt: new Date().toISOString(),
      data: trip,
    };
    saved.unshift(entry);
    // Keep only latest 10
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 10)));
    return true;
  } catch {
    return false;
  }
}

export default function HomePage() {
  const {
    trip,
    setTrip,
    toggleActivity,
    deleteActivity,
    deleteDay,
    reorderActivities,
    reorderDays,
    togglePackingItem,
    clearTrip,
  } = useTripState();

  const lastInputRef = useRef("");
  const inputRef = useRef(null);

  const { loading, error, generate, cancel, clearError } = useGenerateTrip(
    useCallback(
      (data) => {
        setTrip(data);
      },
      [setTrip]
    )
  );

  // Saved trips state
  const [savedTrips, setSavedTrips] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Load saved trips on mount
  useEffect(() => {
    setSavedTrips(loadSavedTrips());
  }, []);

  const handleGenerate = (input) => {
    lastInputRef.current = input;
    generate({ userInput: input });
  };

  const handleRetry = () => {
    if (lastInputRef.current) {
      generate({ userInput: lastInputRef.current });
    }
  };

  const handleRefine = (refinement) => {
    if (!trip) return;
    // Strip client-side properties before sending to AI
    const cleanTrip = {
      ...trip,
      packingList: trip.packingList?.map((item) =>
        typeof item === "object" ? item.text : item
      ),
      stops: trip.stops.map((stop) => ({
        ...stop,
        activities: stop.activities.map(({ id, completed, ...rest }) => rest),
      })),
    };
    generate({ existingTrip: cleanTrip, refinement });
  };

  const handleExampleClick = (prompt) => {
    // Set the input value and auto-submit
    handleGenerate(prompt);
  };

  const handleSave = () => {
    if (trip) {
      const success = saveTripToStorage(trip);
      setSaveMessage(success ? "Trip saved!" : "Failed to save");
      setSavedTrips(loadSavedTrips());
      setTimeout(() => setSaveMessage(""), 2000);
    }
  };

  const handleLoadTrip = (savedTrip) => {
    setTrip(savedTrip.data);
    setShowSaved(false);
  };

  const handleDeleteSaved = (id) => {
    try {
      const saved = loadSavedTrips().filter((t) => t.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      setSavedTrips(saved);
    } catch {}
  };

  return (
    <div className="relative z-10 flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🗺️</span>
            <h1 className="text-base font-semibold text-text-primary">
              Trip Planner
            </h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              AI
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Saved trips toggle */}
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="px-3 py-1.5 rounded-lg text-xs text-text-secondary
                hover:text-text-primary hover:bg-white/5
                transition-all duration-200 flex items-center gap-1.5"
            >
              <span>📋</span>
              Saved ({savedTrips.length})
            </button>

            {/* Save current trip */}
            {trip && (
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-accent-green/10 text-accent-green
                  hover:bg-accent-green/20 transition-all duration-200
                  flex items-center gap-1.5"
              >
                {saveMessage || (
                  <>
                    <span>💾</span> Save
                  </>
                )}
              </button>
            )}

            {/* New trip */}
            {trip && (
              <button
                onClick={clearTrip}
                className="px-3 py-1.5 rounded-lg text-xs text-text-muted
                  hover:text-text-secondary hover:bg-white/5
                  transition-all duration-200"
              >
                + New
              </button>
            )}
          </div>
        </div>

        {/* Saved trips dropdown */}
        {showSaved && (
          <div className="border-t border-white/[0.06] bg-surface/90 backdrop-blur-md">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
              {savedTrips.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-2">
                  No saved trips yet
                </p>
              ) : (
                <div className="space-y-2">
                  {savedTrips.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between glass-card px-3 py-2"
                    >
                      <button
                        onClick={() => handleLoadTrip(saved)}
                        className="flex-1 text-left"
                      >
                        <span className="text-sm text-text-primary">
                          {saved.title}
                        </span>
                        <span className="text-xs text-text-muted ml-2">
                          {new Date(saved.savedAt).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(saved.id)}
                        className="p-1 text-text-muted hover:text-accent-rose
                          transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Input area — always visible when no trip */}
        {!trip && (
          <div className="mb-6">
            <TripInput
              ref={inputRef}
              onSubmit={handleGenerate}
              loading={loading}
              onCancel={cancel}
            />
          </div>
        )}

        {/* Error banner */}
        <ErrorBanner
          error={error}
          onRetry={handleRetry}
          onDismiss={clearError}
        />

        {/* Content states */}
        {loading && !trip && <LoadingSkeleton />}

        {!loading && !trip && !error && (
          <EmptyState onExampleClick={handleExampleClick} />
        )}

        {trip && (
          <ItineraryView
            trip={trip}
            onToggleActivity={toggleActivity}
            onDeleteActivity={deleteActivity}
            onDeleteDay={deleteDay}
            onReorderActivities={reorderActivities}
            onReorderDays={reorderDays}
            onTogglePackingItem={togglePackingItem}
            onRefine={handleRefine}
            refineLoading={loading}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-4">
        <p className="text-center text-xs text-text-muted">
          Built with Next.js & Groq AI · Trip Planner
        </p>
      </footer>
    </div>
  );
}
