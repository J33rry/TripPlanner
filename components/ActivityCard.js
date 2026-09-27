"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ACTIVITY_CONFIG } from "@/lib/constants";
import { CheckIcon, GripIcon, MoreIcon, PencilIcon, TrashIcon } from "./icons";

const draftFrom = (activity) => ({
  title: activity.title,
  time: activity.time || "",
  location: activity.location || "",
  description: activity.description || "",
});

export default function ActivityCard({
  activity,
  dayId,
  image,
  number,
  hovered,
  selected,
  onHover,
  onSelect,
  onToggle,
  onDelete,
  onEdit,
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(activity));
  const rowRef = useRef(null);
  const menuRef = useRef(null);
  const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.activity;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: activity.id, disabled: editing });

  // Bring the row into view when its pin is picked on the map.
  useEffect(() => {
    if (selected) rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const meta = [activity.time, activity.location].filter(Boolean).join(" · ");
  const setRefs = (el) => {
    setNodeRef(el);
    rowRef.current = el;
  };

  return (
    <div
      ref={setRefs}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`activity-row ${hovered ? "is-hovered" : ""} ${selected ? "is-selected" : ""} ${activity.completed ? "is-done" : ""} ${isDragging ? "is-dragging" : ""}`}
      onPointerEnter={() => onHover(activity.id)}
      onPointerLeave={() => onHover(null)}
    >
      <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={`Reorder ${activity.title}`}>
        <GripIcon />
      </button>

      <div className={`activity-thumb type-${activity.type}`} style={image ? { backgroundImage: `url("${image}")` } : undefined}>
        {!image && <span aria-hidden="true">{config.icon}</span>}
        {number && <b className="thumb-number">{number}</b>}
        {activity.completed && <span className="thumb-done"><CheckIcon /></span>}
      </div>

      {editing ? (
        <form
          className="activity-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.title.trim()) onEdit(activity.id, { ...draft, title: draft.title.trim(), edited: true });
            setEditing(false);
          }}
        >
          <input aria-label="Activity title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required autoFocus />
          <div className="activity-edit-row">
            <input aria-label="Time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} placeholder="Time" />
            <input aria-label="Place" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Place" />
          </div>
          <textarea aria-label="Notes" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Add a note" />
          <div className="activity-edit-actions">
            <button type="button" className="ghost-pill" onClick={() => { setDraft(draftFrom(activity)); setEditing(false); }}>Cancel</button>
            <button type="submit" className="dark-pill small">Save</button>
          </div>
        </form>
      ) : (
        <button type="button" className="activity-main" onClick={() => onSelect(selected ? null : activity.id)} aria-expanded={selected}>
          <span className="activity-title">
            {activity.title}
            {activity.edited && <span className="edited-tag">Edited</span>}
          </span>
          {meta && <span className="activity-meta">{meta}</span>}
          {selected && (activity.description || activity.cost || activity.duration) && (
            <span className="activity-details">
              {activity.description && <span>{activity.description}</span>}
              {(activity.cost || activity.duration) && (
                <span className="activity-facts">{[activity.duration, activity.cost].filter(Boolean).join(" · ")}</span>
              )}
            </span>
          )}
        </button>
      )}

      {!editing && (
        <div className="activity-actions" ref={menuRef}>
          <button type="button" className="icon-button" onClick={() => { setDraft(draftFrom(activity)); setEditing(true); }} aria-label={`Edit ${activity.title}`}>
            <PencilIcon />
          </button>
          <button type="button" className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`More options for ${activity.title}`}>
            <MoreIcon />
          </button>
          {menuOpen && (
            <div className="row-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { onToggle(dayId, activity.id); setMenuOpen(false); }}>
                <CheckIcon /> {activity.completed ? "Mark as not done" : "Mark as done"}
              </button>
              <button type="button" role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDelete(dayId, activity.id); }}>
                <TrashIcon /> Remove from plan
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
