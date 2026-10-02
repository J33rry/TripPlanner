"use client";

import { useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ActivityCard from "./ActivityCard";
import { GripIcon, ChevronIcon, CloseIcon } from "./icons";

export default function DayCard({
  stop,
  readOnly,
  images,
  stopNumbers,
  active,
  hoveredStopId,
  selectedStopId,
  canDelete,
  onSelectDay,
  onHoverStop,
  onSelectStop,
  onToggleActivity,
  onDeleteActivity,
  onEditActivity,
  onDeleteDay,
}) {
  const [expanded, setExpanded] = useState(true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id, disabled: readOnly });
  const completed = stop.activities.filter((a) => a.completed).length;

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`day-card ${active ? "is-active" : ""} ${isDragging ? "is-dragging" : ""}`}
      aria-label={`Day ${stop.day}${stop.theme ? `: ${stop.theme}` : ""}`}
    >
      <header className="day-header">
        {!readOnly && (
          <button type="button" className="drag-handle day-drag" {...attributes} {...listeners} aria-label={`Reorder day ${stop.day}`}>
            <GripIcon />
          </button>
        )}
        <button
          type="button"
          className="day-title"
          onClick={() => {
            onSelectDay(active ? null : stop.id);
            setExpanded(true);
          }}
          aria-pressed={active}
          title={active ? "Show the whole trip on the map" : "Show this day on the map"}
        >
          <span className="day-pill">Day {stop.day}</span>
          <span className="day-theme">{stop.theme || stop.date || `Day ${stop.day}`}</span>
          {completed > 0 && <span className="day-progress">{completed}/{stop.activities.length} done</span>}
        </button>
        {canDelete && (
          <button type="button" className="icon-button day-delete" onClick={() => onDeleteDay(stop.id)} aria-label={`Delete day ${stop.day}`}>
            <CloseIcon />
          </button>
        )}
        <button
          type="button"
          className={`icon-button day-toggle ${expanded ? "is-open" : ""}`}
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse day ${stop.day}` : `Expand day ${stop.day}`}
        >
          <ChevronIcon />
        </button>
      </header>

      {expanded && (
        <div className="day-activities">
          <SortableContext items={stop.activities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            {stop.activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                dayId={stop.id}
                readOnly={readOnly}
                image={images[activity.location]}
                number={stopNumbers[activity.id]}
                hovered={hoveredStopId === activity.id}
                selected={selectedStopId === activity.id}
                onHover={onHoverStop}
                onSelect={onSelectStop}
                onToggle={onToggleActivity}
                onDelete={onDeleteActivity}
                onEdit={(activityId, updates) => onEditActivity(stop.id, activityId, updates)}
              />
            ))}
          </SortableContext>
          {stop.activities.length === 0 && (
            <p className="day-empty">{readOnly ? "Nothing planned for this day." : "Nothing planned yet. Delete this day or ask Roam to fill it."}</p>
          )}
        </div>
      )}
    </section>
  );
}
