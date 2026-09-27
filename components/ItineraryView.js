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
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import DayCard from "./DayCard";
import PackingList from "./PackingList";
import TripTips from "./TripTips";
import ErrorBoundary from "./ErrorBoundary";

export default function ItineraryView({
  trip,
  images,
  stopNumbers,
  activeDayId,
  hoveredStopId,
  selectedStopId,
  onSelectDay,
  onHoverStop,
  onSelectStop,
  onToggleActivity,
  onDeleteActivity,
  onDeleteDay,
  onEditActivity,
  onReorderActivities,
  onReorderDays,
  onTogglePackingItem,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id) return;

    if (trip.stops.some((s) => s.id === active.id)) {
      const oldIndex = trip.stops.findIndex((s) => s.id === active.id);
      const newIndex = trip.stops.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) onReorderDays(arrayMove(trip.stops, oldIndex, newIndex));
      return;
    }

    // Activity drag — reorder within its own day.
    for (const stop of trip.stops) {
      const oldIndex = stop.activities.findIndex((a) => a.id === active.id);
      if (oldIndex === -1) continue;
      const newIndex = stop.activities.findIndex((a) => a.id === over.id);
      if (newIndex !== -1) onReorderActivities(stop.id, arrayMove(stop.activities, oldIndex, newIndex));
      break;
    }
  };

  return (
    <ErrorBoundary>
      <div className="itinerary">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={trip.stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {trip.stops.map((stop) => (
              <DayCard
                key={stop.id}
                stop={stop}
                images={images}
                stopNumbers={stopNumbers}
                active={activeDayId === stop.id}
                hoveredStopId={hoveredStopId}
                selectedStopId={selectedStopId}
                canDelete={trip.stops.length > 1}
                onSelectDay={onSelectDay}
                onHoverStop={onHoverStop}
                onSelectStop={onSelectStop}
                onToggleActivity={onToggleActivity}
                onDeleteActivity={onDeleteActivity}
                onEditActivity={onEditActivity}
                onDeleteDay={onDeleteDay}
              />
            ))}
          </SortableContext>
        </DndContext>

        <PackingList items={trip.packingList} onToggle={onTogglePackingItem} />
        <TripTips tips={trip.tips} />
      </div>
    </ErrorBoundary>
  );
}
