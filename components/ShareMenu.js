"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, LinkIcon } from "./icons";
import { shareUrl } from "@/lib/tripStore";

const COPIED_MS = 1800;
const FAILED = Symbol("failed");

/**
 * "Share" in the trip header. `onShare` saves the trip and resolves to its
 * share ID (or null when it sent a guest off to log in); `onStopSharing`
 * turns the link off.
 */
export default function ShareMenu({ shareId, onShare, onStopSharing }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);
  const copiedTimer = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.type === "keydown" ? event.key === "Escape" : !wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (shareError) {
      console.error("Couldn’t update sharing", shareError);
      setError("That didn’t work. Check your connection and try again.");
      return FAILED;
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    if (open) return setOpen(false);
    setCopied(false);
    const id = await run(onShare);
    if (id !== null) setOpen(true);
  };

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return wrapRef.current?.querySelector("input")?.select();
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  const url = shareId ? shareUrl(shareId) : "";

  return (
    <div className="share" ref={wrapRef}>
      <button type="button" className="outline-pill" onClick={toggle} disabled={busy && !open} aria-haspopup="dialog" aria-expanded={open}>
        <LinkIcon /><span>{busy && !open ? "Sharing…" : "Share"}</span>
      </button>
      {open && (
        <div className="share-menu" role="dialog" aria-label="Share this trip">
          <h2>Share this trip</h2>
          {shareId && (
            <>
              <p>Anyone with the link can view the trip, but they can’t change it. Changes you save show up for them too.</p>
              <div className="share-link">
                <label className="sr-only" htmlFor="share-url">Share link</label>
                <input id="share-url" value={url} readOnly onFocus={(event) => event.target.select()} />
                <button type="button" className="dark-pill small" onClick={() => copy(url)}>
                  {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                </button>
              </div>
              <button
                type="button"
                className="share-stop"
                disabled={busy}
                onClick={async () => {
                  if ((await run(onStopSharing)) !== FAILED) setOpen(false);
                }}
              >
                {busy ? "Turning off…" : "Stop sharing"}
              </button>
            </>
          )}
          {error && <p className="share-error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
