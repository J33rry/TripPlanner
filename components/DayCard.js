"use client";

import { useState } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ActivityCard from "./ActivityCard";

export default function DayCard({
  stop,
  onToggleActivity,
  onDeleteActivity,
  onDeleteDay,
  totalDays,
}) {
  const [expanded, setExpanded] = useState(true);
  const completedCount = stop.activities.filter((a) => a.completed).length;
  const totalCount = stop.activities.length;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Day theme colors (cycles through a palette)
  const themeColors = [
    "from-primary/20 to-accent-violet/10",
    "from-accent-sky/20 to-primary/10",
    "from-accent-green/20 to-accent-sky/10",
    "from-accent-amber/20 to-accent-green/10",
    "from-accent-violet/20 to-accent-rose/10",
  ];
  const colorClass = themeColors[(stop.day - 1) % themeColors.length];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-card mb-4 overflow-hidden animate-fade-in
        ${isDragging ? "dragging" : ""}`}
    >
      {/* Day header */}
      <div
        className={`flex items-center gap-3 p-4 cursor-pointer
          bg-gradient-to-r ${colorClass}
          hover:brightness-110 transition-all duration-200`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-text-muted
            hover:text-text-secondary transition-colors touch-none"
          aria-label="Drag to reorder day"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <circle cx="3" cy="2" r="1.2" />
            <circle cx="9" cy="2" r="1.2" />
            <circle cx="3" cy="6" r="1.2" />
            <circle cx="9" cy="6" r="1.2" />
            <circle cx="3" cy="10" r="1.2" />
            <circle cx="9" cy="10" r="1.2" />
          </svg>
        </button>

        {/* Day number badge */}
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-text-primary">
            {stop.day}
          </span>
        </div>

        {/* Day info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {stop.date || `Day ${stop.day}`}
            {stop.theme && (
              <span className="text-text-secondary font-normal ml-2">
                — {stop.theme}
              </span>
            )}
          </h3>
          <p className="text-xs text-text-muted">
            {totalCount} {totalCount === 1 ? "activity" : "activities"}
            {completedCount > 0 && (
              <span className="text-accent-green ml-1">
                · {completedCount} done
              </span>
            )}
          </p>
        </div>

        {/* Progress ring */}
        {totalCount > 0 && (
          <div className="relative w-8 h-8 flex-shrink-0">
            <svg
              className="w-8 h-8 -rotate-90"
              viewBox="0 0 32 32"
            >
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                fill="none"
                stroke="var(--accent-green)"
                strokeWidth="3"
                strokeDasharray={`${(completedCount / totalCount) * 75.4} 75.4`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
          </div>
        )}

        {/* Expand/collapse icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`text-text-muted transition-transform duration-200
            ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>

        {/* Delete day button */}
        {totalDays > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteDay(stop.id);
            }}
            className="p-1.5 rounded-lg text-text-muted
              hover:text-accent-rose hover:bg-accent-rose/10
              transition-all duration-200"
            aria-label="Delete day"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {/* Activities list */}
      {expanded && (
        <div className="animate-slide-down px-2 pb-2">
          <SortableContext
            items={stop.activities.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            {stop.activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                dayId={stop.id}
                onToggle={onToggleActivity}
                onDelete={onDeleteActivity}
              />
            ))}
          </SortableContext>

          {stop.activities.length === 0 && (
            <p className="text-sm text-text-muted text-center py-6">
              No activities remaining. Delete this day or add new ones.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
