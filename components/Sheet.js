"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";

/**
 * A modal card (a bottom sheet on phones). Rendered into <body>, because the
 * trip panel is transformed and would trap a fixed overlay inside it.
 */
export default function Sheet({ title, onClose, children }) {
  const titleId = useId();

  useEffect(() => {
    const close = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [onClose]);

  return createPortal(
    <div className="sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="sheet-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </header>
        {children}
      </div>
    </div>,
    document.body
  );
}
