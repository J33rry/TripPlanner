"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { routesFor } from "@/hooks/useDayRoutes";
import { fetchTrip, listMembers, saveTrip, watchTrip } from "@/lib/tripStore";

// Saved trips save themselves this long after the last edit (longer while saving keeps failing).
const AUTOSAVE_MS = 1200;
const AUTOSAVE_RETRY_MS = 15000;
const NOTICE_MS = 3500;

/**
 * Keeps the open saved trip in step with everyone on it: edits autosave,
 * changes from others arrive over Appwrite Realtime, and a change that would
 * throw away unsaved edits waits as a `conflict` (Load theirs / Keep mine).
 * A trip that was never saved, or a view-only one, isn't synced.
 *
 * `onRemoved(id)` takes a trip off the saved list and `onClose()` closes the
 * open one; both run when the trip is deleted or the user is taken off it.
 */
export function useTripSync({ userId, trip, setTrip, openSaved, viewOnly, rememberSaved, onRemoved, onClose }) {
  // Live sync: "idle" | "saving" | "error"; a remote change that clashes with unsaved edits; "Updated by …".
  const [autosave, setAutosave] = useState("idle");
  const [conflict, setConflict] = useState(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);
  // JSON of the trip an autosave is writing, so its realtime echo isn't mistaken for someone else's change.
  const inFlightRef = useRef(null);
  const membersCache = useRef(new Map());
  const syncRef = useRef({ openSaved: null, trip: null, tripJson: "", baseJson: "", dirty: false });

  const tripJson = useMemo(() => (trip ? JSON.stringify(trip) : ""), [trip]);
  const baseJson = useMemo(() => (openSaved ? JSON.stringify(openSaved.data) : ""), [openSaved]);
  // Saved trips autosave; a trip that was never saved (or a view-only one) doesn't.
  const syncing = Boolean(openSaved && userId && !viewOnly && trip);
  const dirty = syncing && tripJson !== baseJson;

  useEffect(() => {
    syncRef.current = { openSaved, trip, tripJson, baseJson, dirty };
  });

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const flashNotice = (message) => {
    setNotice(message);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), NOTICE_MS);
  };

  /** Who saved `entry` last, by name, for "Updated by …". */
  const editorName = async (entry) => {
    if (!entry.updatedBy) return "Someone";
    if (entry.updatedBy === userId) return "You, in another window,";
    if (!entry.teamId) return "Someone";
    let members = membersCache.current.get(entry.teamId);
    if (!members) {
      members = listMembers(entry.teamId).catch(() => []);
      membersCache.current.set(entry.teamId, members);
    }
    const name = (await members).find((member) => member.userId === entry.updatedBy)?.name;
    // Someone who joined since the list was fetched: look again next time.
    if (!name) membersCache.current.delete(entry.teamId);
    return name || "Someone";
  };

  /** The trip was deleted, or the user was taken off it: drop it without trying to save. */
  const dropTrip = (id) => {
    onRemoved(id);
    if (syncRef.current.openSaved?.id !== id) return;
    syncRef.current = { ...syncRef.current, dirty: false };
    onClose();
  };

  /**
   * Saves `snapshot` over `base` unless someone else changed the trip since
   * `base` was loaded — then it asks first (`conflict`). `quiet` is for a last
   * save on the way out: no prompts, and nothing is written over a newer version.
   */
  const autosaveTrip = async (snapshot, base, { quiet = false } = {}) => {
    inFlightRef.current = JSON.stringify(snapshot);
    if (!quiet) setAutosave("saving");
    try {
      const remote = await fetchTrip(base.id);
      if (remote && remote.savedAt !== base.savedAt && JSON.stringify(remote.data) !== JSON.stringify(base.data)) {
        if (!quiet) {
          setConflict({ entry: remote, by: await editorName(remote) });
          setAutosave("idle");
        }
        return;
      }
      const entry = await saveTrip(userId, snapshot, base.id, routesFor(snapshot, (remote || base).routes));
      rememberSaved(entry);
      if (!quiet) setAutosave("idle");
    } catch (saveError) {
      console.error("Couldn’t autosave trip", saveError);
      if (quiet) return;
      // 404: deleted, or no longer shared with this user (rows they can't read look missing).
      if (saveError?.code === 404 || saveError?.code === 401) {
        setAutosave("idle");
        dropTrip(base.id);
      } else {
        setAutosave("error");
      }
    } finally {
      inFlightRef.current = null;
    }
  };

  /** Someone saved the open trip: show it, unless that would throw away edits that aren't saved yet. */
  const handleRemoteUpdate = async (entry) => {
    const { openSaved: base, tripJson: localJson, baseJson: knownJson } = syncRef.current;
    if (!base || entry.id !== base.id || entry.savedAt <= base.savedAt) return;
    const remoteJson = JSON.stringify(entry.data);
    // This window's own save coming back, only the routes changed, or it already matches: just note the new version.
    if (remoteJson === inFlightRef.current || remoteJson === knownJson || remoteJson === localJson) {
      rememberSaved(entry);
      return;
    }
    const by = await editorName(entry);
    if (syncRef.current.dirty || inFlightRef.current) {
      setConflict({ entry, by });
      return;
    }
    rememberSaved(entry);
    setTrip(entry.data);
    flashNotice(`${by} updated the trip`);
  };

  /** Throws away local edits for the newest saved version. */
  const loadTheirs = async () => {
    const pending = conflict;
    setConflict(null);
    setAutosave("saving"); // holds autosave off until their version is on screen
    const latest = await fetchTrip(pending.entry.id).catch(() => pending.entry);
    const entry = latest || pending.entry;
    rememberSaved(entry);
    setTrip(entry.data);
    setAutosave("idle");
  };

  /** Saves what's on screen over the other person's change. */
  const keepMine = async () => {
    const base = conflict.entry;
    const mine = syncRef.current.trip;
    setConflict(null);
    setAutosave("saving");
    try {
      rememberSaved(await saveTrip(userId, mine, base.id, routesFor(mine, base.routes)));
      setAutosave("idle");
    } catch (saveError) {
      console.error("Couldn’t save trip", saveError);
      rememberSaved(base);
      setAutosave("error");
    }
  };

  /** On the way out of the trip: edits made in the last moment still get saved, and the sync state resets. */
  const flush = () => {
    const { dirty: unsaved, openSaved: leaving, trip: current } = syncRef.current;
    if (unsaved && leaving && !conflict && current) autosaveRef.current(current, leaving, { quiet: true });
    setConflict(null);
    setNotice("");
    setAutosave("idle");
  };

  const autosaveRef = useRef(autosaveTrip);
  const remoteUpdateRef = useRef(handleRemoteUpdate);
  const dropTripRef = useRef(dropTrip);
  useEffect(() => {
    autosaveRef.current = autosaveTrip;
    remoteUpdateRef.current = handleRemoteUpdate;
    dropTripRef.current = dropTrip;
  });

  // Autosave: shortly after the last edit, then again with a longer wait while it keeps failing.
  useEffect(() => {
    if (!dirty || conflict || autosave === "saving") return;
    const timer = setTimeout(
      () => autosaveRef.current(syncRef.current.trip, syncRef.current.openSaved),
      autosave === "error" ? AUTOSAVE_RETRY_MS : AUTOSAVE_MS
    );
    return () => clearTimeout(timer);
  }, [dirty, tripJson, conflict, autosave]);

  // Live updates from everyone else on the trip.
  const watchedId = syncing ? openSaved.id : null;
  useEffect(() => {
    if (!watchedId) return;
    return watchTrip(watchedId, {
      onUpdate: (entry) => remoteUpdateRef.current(entry),
      onDelete: () => dropTripRef.current(watchedId),
    });
  }, [watchedId]);

  // Closing the tab mid-save would lose the last edits; let the browser ask first.
  const unsavedWork = dirty || autosave === "saving";
  useEffect(() => {
    if (!unsavedWork) return;
    const warn = (event) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedWork]);

  return {
    syncing,
    dirty,
    autosave,
    conflict,
    notice,
    loadTheirs,
    keepMine,
    /** After a failed save: try again now. */
    retry: () => setAutosave("idle"),
    flush,
    dropTrip,
    clearConflict: useCallback(() => setConflict(null), []),
  };
}
