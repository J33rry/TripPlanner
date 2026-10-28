"use client";

import { useRef, useState } from "react";
import { PencilIcon } from "./icons";

const MAX_LENGTH = 80;

/**
 * The trip's name as the panel heading. AI names can repeat across trips to
 * the same place, so anyone who can edit the trip can rename it in place.
 */
export default function TripName({ title, readOnly, onRename }) {
  const [draft, setDraft] = useState(null);
  // Closing the field can still fire its blur; that blur mustn't save (again).
  const closed = useRef(false);

  if (readOnly) return <h1 className="trip-name">{title}</h1>;

  if (draft == null) {
    const split = title.lastIndexOf(" ");
    const head = split === -1 ? "" : title.slice(0, split);
    const tail = title.slice(split + 1);
    return (
      <h1 className="trip-name">
        <button
          type="button"
          className="trip-name-button"
          onClick={() => {
            closed.current = false;
            setDraft(title);
          }}
          title="Rename trip"
        >
          {head && `${head} `}
          {/* The pencil stays on the line with the last word instead of wrapping alone. */}
          <span className="trip-name-tail">
            {tail}
            <PencilIcon />
          </span>
        </button>
      </h1>
    );
  }

  const commit = () => {
    if (closed.current) return;
    closed.current = true;
    const name = draft.trim().replace(/\s+/g, " ");
    if (name && name !== title) onRename(name);
    setDraft(null);
  };

  return (
    <form
      className="trip-name-edit"
      onSubmit={(event) => {
        event.preventDefault();
        commit();
      }}
    >
      <input
        aria-label="Trip name"
        value={draft}
        maxLength={MAX_LENGTH}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          closed.current = true;
          setDraft(null);
        }}
        onFocus={(event) => event.target.select()}
        autoFocus
      />
    </form>
  );
}
