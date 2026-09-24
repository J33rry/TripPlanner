"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import DayCard from "./DayCard";
import PackingList from "./PackingList";
import TripTips from "./TripTips";
import BudgetSummary from "./BudgetSummary";
import RefineInput from "./RefineInput";
import ErrorBoundary from "./ErrorBoundary";

export default function ItineraryView({
  trip,
  onToggleActivity,
  onDeleteActivity,
  onDeleteDay,
  onReorderActivities,
  onReorderDays,
  onTogglePackingItem,
  onRefine,
  refineLoading,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;

    // Check if it's a day being dragged
    const isDayDrag = trip.stops.some((s) => s.id === active.id);

    if (isDayDrag) {
      const oldIndex = trip.stops.findIndex((s) => s.id === active.id);
      const newIndex = trip.stops.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderDays(arrayMove(trip.stops, oldIndex, newIndex));
      }
      return;
    }

    // Activity drag — find which day it belongs to
    for (const stop of trip.stops) {
      const oldIndex = stop.activities.findIndex((a) => a.id === active.id);
      if (oldIndex !== -1) {
        const newIndex = stop.activities.findIndex((a) => a.id === over.id);
        if (newIndex !== -1) {
          onReorderActivities(
            stop.id,
            arrayMove(stop.activities, oldIndex, newIndex)
          );
        }
        break;
      }
    }
  };

  return (
    <ErrorBoundary>
      <div className="animate-fade-in">
        {/* Trip header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">
            {trip.tripTitle}
          </h1>
          {trip.summary && (
            <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
              {trip.summary}
            </p>
          )}
        </div>

        {/* Budget + Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <BudgetSummary budget={trip.totalBudgetEstimate} />

          <div className="glass-card p-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-1">
              <span>📅</span> Duration
            </h3>
            <p className="text-2xl font-bold text-accent-sky">
              {trip.stops.length} {trip.stops.length === 1 ? "Day" : "Days"}
            </p>
          </div>

          <div className="glass-card p-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-1">
              <span>🎯</span> Activities
            </h3>
            <p className="text-2xl font-bold text-accent-violet">
              {trip.stops.reduce((sum, s) => sum + s.activities.length, 0)}
            </p>
          </div>
        </div>

        {/* Day cards with drag and drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={trip.stops.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {trip.stops.map((stop) => (
              <DayCard
                key={stop.id}
                stop={stop}
                onToggleActivity={onToggleActivity}
                onDeleteActivity={onDeleteActivity}
                onDeleteDay={onDeleteDay}
                totalDays={trip.stops.length}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Extras: packing list & tips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <PackingList
            items={trip.packingList}
            onToggle={onTogglePackingItem}
          />
          <TripTips tips={trip.tips} />
        </div>

        {/* Refinement input */}
        <div className="mt-6">
          <RefineInput onRefine={onRefine} loading={refineLoading} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
