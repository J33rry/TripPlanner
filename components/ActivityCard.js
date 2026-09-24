"use client";

import { ACTIVITY_CONFIG } from "@/lib/constants";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export default function ActivityCard({
  activity,
  dayId,
  onToggle,
  onDelete,
  dragDisabled,
}) {
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.activity;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-3 py-3 px-3 rounded-xl
        transition-all duration-200
        hover:bg-white/[0.03]
        ${isDragging ? "dragging" : ""}
        ${activity.completed ? "opacity-60" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-1.5 cursor-grab active:cursor-grabbing text-text-muted
          opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        aria-label="Drag to reorder"
      >
        <svg
          width="12"
          height="12"
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

      {/* Completion checkbox */}
      <button
        onClick={() => onToggle(dayId, activity.id)}
        className={`mt-1 w-5 h-5 rounded-md border-2 flex-shrink-0
          flex items-center justify-center transition-all duration-200
          ${
            activity.completed
              ? "bg-accent-green border-accent-green"
              : "border-white/20 hover:border-primary"
          }`}
        aria-label={
          activity.completed ? "Mark as incomplete" : "Mark as complete"
        }
      >
        {activity.completed && (
          <svg
            width="10"
            height="8"
            viewBox="0 0 10 8"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M1 4l3 3 5-6" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {/* Time */}
          {activity.time && (
            <span className="text-xs text-text-muted font-mono">
              {activity.time}
            </span>
          )}

          {/* Type badge */}
          <span className={`badge badge-${activity.type}`}>
            {config.icon} {config.label}
          </span>
        </div>

        {/* Title */}
        <h4
          className={`text-sm font-medium text-text-primary mb-0.5
            ${activity.completed ? "line-through" : ""}`}
        >
          {activity.title}
        </h4>

        {/* Description */}
        {activity.description && (
          <p className="text-xs text-text-secondary leading-relaxed">
            {activity.description}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mt-1.5">
          {activity.cost && (
            <span className="text-xs text-accent-green font-medium">
              {activity.cost}
            </span>
          )}
          {activity.duration && (
            <span className="text-xs text-text-muted">
              ⏱ {activity.duration}
            </span>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={() => onDelete(dayId, activity.id)}
        className="mt-1 p-1.5 rounded-lg text-text-muted
          opacity-0 group-hover:opacity-100
          hover:text-accent-rose hover:bg-accent-rose/10
          transition-all duration-200"
        aria-label="Delete activity"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4h10M5 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M11 4v7.5a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 013 11.5V4" />
        </svg>
      </button>
    </div>
  );
}
