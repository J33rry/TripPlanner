"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import DestinationGlobe from "./DestinationGlobe";
import ErrorBanner from "./ErrorBanner";
import ExpensesPanel from "./ExpensesPanel";
import IntroSplash from "./IntroSplash";
import ItineraryView from "./ItineraryView";
import RefineInput from "./RefineInput";
import TripMap from "./TripMap";
import Wordmark from "./Wordmark";
import AccountMenu from "./AccountMenu";
import MembersMenu from "./MembersMenu";
import ShareMenu from "./ShareMenu";
import ThemeToggle from "./ThemeToggle";
import { BookmarkIcon, CheckIcon, EyeIcon, PlusIcon } from "./icons";
import { useAuth } from "@/hooks/useAuth";
import { routesFor, useDayRoutes } from "@/hooks/useDayRoutes";
import { useGenerateTrip } from "@/hooks/useGenerateTrip";
import { usePlaceImages } from "@/hooks/usePlaceImages";
import { useTripExpenses } from "@/hooks/useTripExpenses";
import { useTripMembers } from "@/hooks/useTripMembers";
import { useTripState } from "@/hooks/useTripState";
import { deleteExpense, listExpenses, saveExpense } from "@/lib/expenseStore";
import { formatMoney, netBalances } from "@/lib/splits";
import { DESTINATIONS, FLIGHT_ROUTES } from "@/lib/destinations";
import { distanceKm, getTripCenter, getTripStops } from "@/lib/geo";
import { dayCount, destinationLabel, placeTitle } from "@/lib/tripDisplay";
import {
  createInviteLink,
  deleteTrip,
  enableCollaboration,
  fetchTrip,
  importLegacyTrips,
  leaveTrip,
  listMembers,
  listTrips,
  ownsTrip,
  removeMember,
  revokeInviteLink,
  saveTrip,
  saveTripRoutes,
  setTripCurrency,
  shareTrip,
  unshareTrip,
  watchTrip,
} from "@/lib/tripStore";

const MAP_READY_TIMEOUT_MS = 3500;
// Saved trips save themselves this long after the last edit (longer while saving keeps failing).
const AUTOSAVE_MS = 1200;
const AUTOSAVE_RETRY_MS = 15000;
const NOTICE_MS = 3500;
const DESKTOP_MIN_WIDTH = 900;
const LABEL_CLASH_KM = 1200;

// A guest's "Save trip" parks the trip here while they sign in (it survives the Google redirect).
const PENDING_KEY = "roam_pending_trip";
const PENDING_TTL_MS = 30 * 60 * 1000;

function readPendingTrip() {
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
    return pending?.trip?.stops && Date.now() - pending.at < PENDING_TTL_MS ? pending.trip : null;
  } catch {
    return null;
  }
}

function writePendingTrip(trip) {
  try {
    if (trip) sessionStorage.setItem(PENDING_KEY, JSON.stringify({ at: Date.now(), trip }));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch { }
}

const AUTH_SCREENS = { "/login": "login", "/signup": "signup", "/reset-password": "login", "/auth/callback": "login" };

/** Only same-site, non-auth paths, so `?next=` can't bounce people elsewhere or in circles. */
export const safeNext = (next) =>
  typeof next === "string" && /^\/(?![/\\])/.test(next) && !AUTH_SCREENS[next.split(/[?#]/)[0]] ? next : "/";

const screenFor = (pathname) => (pathname === "/trips" ? "trips" : AUTH_SCREENS[pathname] || "home");
export const isAuthScreen = (screen) => screen === "login" || screen === "signup";

export const tripHref = (saved) => `/trips/${saved.id}`;
const TRIP_ROUTE = /^\/trips\/([^/]+)$/;
const SHARE_ROUTE = /^\/share\/([^/]+)$/;

const SUGGESTION_MARKERS = DESTINATIONS.map((d) => ({
  ...d,
  cardTitle: `${d.name}, ${d.region}`,
  cardText: d.note,
  actionLabel: "Plan a trip here",
}));

function tripMarkers(savedTrips) {
  const byPlace = new Map();
  for (const saved of savedTrips) {
    const d = saved.data.destination;
    if (d?.latitude == null || d?.longitude == null) continue;
    const key = (d.name || saved.title).toLowerCase();
    if (byPlace.has(key)) continue;
    byPlace.set(key, {
      id: `trip-${saved.id}`,
      savedId: saved.id,
      name: d.name || saved.title,
      latitude: d.latitude,
      longitude: d.longitude,
      landmark: placeTitle(saved.data),
      cardTitle: saved.title,
      cardText: `${destinationLabel(saved.data)} · ${dayCount(saved.data)}`,
      actionLabel: "Open trip",
    });
  }
  const markers = [...byPlace.values()];
  for (const marker of markers) {
    const clashesEast = markers.some(
      (other) => other !== marker && other.longitude > marker.longitude && distanceKm(marker, other) < LABEL_CLASH_KM
    );
    marker.labelSide = clashesEast ? "left" : "right";
  }
  return markers;
}

/** Flight paths linking saved destinations in the order they were saved, oldest first. */
function tripRoutes(markers) {
  const ordered = [...markers].reverse();
  const routes = [];
  for (let i = 1; i < ordered.length; i++) {
    const [from, to] = [ordered[i - 1], ordered[i]];
    if (distanceKm(from, to) < 50) continue;
    routes.push({ from: { lat: from.latitude, lon: from.longitude }, to: { lat: to.latitude, lon: to.longitude } });
  }
  return routes;
}

const RoamContext = createContext(null);
export const useRoam = () => useContext(RoamContext);

export default function RoamShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const routeTripId = pathname.match(TRIP_ROUTE)?.[1] ?? null;
  const routeShareId = pathname.match(SHARE_ROUTE)?.[1] ?? null;
  const [screen, setScreen] = useState(screenFor(pathname));
  const [screenPath, setScreenPath] = useState(pathname);
  // A shared trip the viewer closed stays closed until they navigate (closing runs before the URL changes).
  const [closedShareId, setClosedShareId] = useState(null);
  if (pathname !== screenPath) {
    setScreenPath(pathname);
    setClosedShareId(null);
    if (!routeTripId && !routeShareId) setScreen(screenFor(pathname));
  }

  const auth = useAuth();
  const userId = auth.user?.$id ?? null;

  const { trip, setTrip, toggleActivity, deleteActivity, deleteDay, editActivity, reorderActivities, reorderDays, togglePackingItem, clearTrip } = useTripState();
  const [view, setView] = useState("globe");
  const [intro, setIntro] = useState({ phase: "splash", from: null });
  const [savedTrips, setSavedTrips] = useState([]);
  const [tripsOwner, setTripsOwner] = useState(undefined);
  const [tripsReload, setTripsReload] = useState(0);
  const [pendingTrip, setPendingTrip] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openSavedId, setOpenSavedId] = useState(null);
  // A trip someone shared: the /share page loads it, and it opens view-only.
  const [sharedTrip, setSharedTrip] = useState(null);
  const [openShareId, setOpenShareId] = useState(null);
  const viewOnly = openShareId != null;
  const openSaved = useMemo(() => savedTrips.find((item) => item.id === openSavedId) || null, [savedTrips, openSavedId]);
  const [prompt, setPrompt] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [activeDayId, setActiveDayId] = useState(null);
  const [hoveredStopId, setHoveredStopId] = useState(null);
  const [selectedStopId, setSelectedStopId] = useState(null);
  const [globeFocusId, setGlobeFocusId] = useState(null);
  const [insets, setInsets] = useState({ right: 0, bottom: 0 });
  const lastRequestRef = useRef(null);
  const viewRef = useRef(view);
  const tripRef = useRef(trip);
  const arrivalRef = useRef({ globe: false, map: false, timer: null });
  const panelRef = useRef(null);
  const saveTimer = useRef(null);
  // Live sync: "idle" | "saving" | "error"; a remote change that clashes with unsaved edits; "Updated by …".
  const [autosave, setAutosave] = useState("idle");
  const [conflict, setConflict] = useState(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef(null);
  // JSON of the trip an autosave is writing, so its realtime echo isn't mistaken for someone else's change.
  const inFlightRef = useRef(null);
  const membersCache = useRef(new Map());
  const syncRef = useRef({ openSaved: null, tripJson: "", baseJson: "", dirty: false });

  const tripJson = useMemo(() => (trip ? JSON.stringify(trip) : ""), [trip]);
  const baseJson = useMemo(() => (openSaved ? JSON.stringify(openSaved.data) : ""), [openSaved]);
  // Saved trips autosave; a trip that was never saved (or a view-only one) doesn't.
  const syncing = Boolean(openSaved && userId && !viewOnly && trip);
  const dirty = syncing && tripJson !== baseJson;

  // Collaboration data for the open trip: who's on it and what they've spent.
  const [panelTab, setPanelTab] = useState("itinerary");
  const tripMembers = useTripMembers(syncing ? openSaved.teamId : null);
  const tripExpenses = useTripExpenses(syncing && openSaved.teamId ? openSaved.id : null);
  const balances = useMemo(() => netBalances(tripExpenses.expenses || []), [tripExpenses.expenses]);
  const currency = openSaved?.currency;
  // Members' names, with the account's own name for the user (membership privacy may hide names).
  const people = useMemo(() => {
    const me = { userId, name: auth.user?.name || auth.user?.email || "You" };
    if (!tripMembers.members) return userId ? [me] : [];
    return tripMembers.members.map((member) => (member.userId === userId ? { ...me, name: auth.user?.name || member.name } : member));
  }, [tripMembers.members, userId, auth.user]);
  /** `{ owes, amount }` while `memberId` has an unsettled balance on the open trip, else null. */
  const owing = (memberId) => {
    const amount = balances[memberId];
    return amount ? { owes: amount < 0, amount: formatMoney(Math.abs(amount), currency) } : null;
  };

  useEffect(() => {
    viewRef.current = view;
    tripRef.current = trip;
    syncRef.current = { openSaved, tripJson, baseJson, dirty };
  });

  const revealIfReady = useCallback(() => {
    const arrival = arrivalRef.current;
    if (viewRef.current === "arriving" && arrival.globe && arrival.map) {
      clearTimeout(arrival.timer);
      setView("trip");
    }
  }, []);

  const openTrip = useCallback((data, savedId = null, shareId = null) => {
    clearTimeout(arrivalRef.current.timer);
    setConflict(null);
    setOpenSavedId(savedId);
    setPanelTab("itinerary");
    setOpenShareId(shareId);
    arrivalRef.current = { globe: false, map: false, timer: null };
    setTrip(data);
    setActiveDayId(null);
    setSelectedStopId(null);
    setHoveredStopId(null);
    setGlobeFocusId(null);
    const skipGlobe = !getTripCenter(data) || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setView(skipGlobe ? "trip" : "arriving");
  }, [setTrip]);

  const handleGlobeArrived = useCallback(() => {
    arrivalRef.current.globe = true;
    arrivalRef.current.timer = setTimeout(() => {
      if (viewRef.current === "arriving") setView("trip");
    }, MAP_READY_TIMEOUT_MS);
    revealIfReady();
  }, [revealIfReady]);

  const handleMapReady = useCallback(() => {
    arrivalRef.current.map = true;
    revealIfReady();
  }, [revealIfReady]);

  const { loading, error, generate, cancel, clearError } = useGenerateTrip(
    useCallback((data) => {
      if (viewRef.current === "trip" && tripRef.current) {
        setTrip({ ...data, tripId: tripRef.current.tripId });
      } else {
        openTrip(data);
      }
    }, [setTrip, openTrip])
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPendingTrip(readPendingTrip()));
    const arrival = arrivalRef.current;
    return () => {
      window.cancelAnimationFrame(frame);
      clearTimeout(saveTimer.current);
      clearTimeout(noticeTimer.current);
      clearTimeout(arrival.timer);
    };
  }, []);

  // Saved trips belong to the signed-in account; guests have none.
  useEffect(() => {
    if (auth.status === "loading") return;
    let cancelled = false;
    const load = userId
      ? importLegacyTrips(userId).catch(() => 0).then(listTrips)
      : Promise.resolve([]);
    load
      .catch((loadError) => {
        console.error("Couldn’t load saved trips", loadError);
        return [];
      })
      .then((trips) => {
        if (cancelled) return;
        setSavedTrips(trips);
        setTripsOwner(userId);
      });
    return () => { cancelled = true; };
  }, [auth.status, userId, tripsReload]);
  const savedLoaded = auth.status !== "loading" && tripsOwner === userId;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => {
      const desktop = window.innerWidth >= DESKTOP_MIN_WIDTH;
      setInsets({ right: desktop ? panel.offsetWidth : 0, bottom: desktop ? 0 : panel.offsetHeight });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [view]);

  const generateFromPrompt = (input) => {
    const cleanInput = input.trim();
    if (!cleanInput || loading) return;
    lastRequestRef.current = { userInput: cleanInput };
    setPrompt(cleanInput);
    generate(lastRequestRef.current);
  };

  const handleRefine = (refinement) => {
    if (!trip) return;
    const cleanTrip = {
      ...trip,
      tripId: undefined,
      packingList: trip.packingList?.map((item) => (typeof item === "object" ? item.text : item)),
      stops: trip.stops.map((stop) => ({
        ...stop,
        id: undefined,
        activities: stop.activities.map((activity) => ({ ...activity, id: undefined, completed: undefined, edited: undefined })),
      })),
    };
    lastRequestRef.current = { existingTrip: cleanTrip, refinement };
    generate(lastRequestRef.current);
  };

  const retryLastRequest = () => {
    if (lastRequestRef.current) generate(lastRequestRef.current);
  };

  const flashSaveMessage = (message) => {
    setSaveMessage(message);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveMessage(""), 2200);
  };

  const rememberSaved = (entry) => setSavedTrips((list) => [entry, ...list.filter((item) => item.id !== entry.id)]);

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
    setSavedTrips((list) => list.filter((item) => item.id !== id));
    if (syncRef.current.openSaved?.id !== id) return;
    syncRef.current = { ...syncRef.current, dirty: false };
    closeTripRef.current();
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
    setConflict(null);
    setAutosave("saving");
    try {
      rememberSaved(await saveTrip(userId, tripRef.current, base.id, routesFor(tripRef.current, base.routes)));
      setAutosave("idle");
    } catch (saveError) {
      console.error("Couldn’t save trip", saveError);
      rememberSaved(base);
      setAutosave("error");
    }
  };

  /** Saves the open trip and resolves to its saved entry; a guest is sent to log in first (null). */
  const persistTrip = async () => {
    if (auth.status !== "user") {
      writePendingTrip(trip);
      setPendingTrip(trip);
      closeTrip();
      router.push("/login");
      return null;
    }
    const existing = savedTrips.find((item) => item.data?.tripId === trip.tripId);
    // A saved trip saves itself; writing it again here could overwrite a friend's change.
    if (existing && existing.id === openSavedId && !syncRef.current.dirty) return existing;
    setSaving(true);
    try {
      const entry = await saveTrip(userId, trip, existing?.id, routesFor(trip, existing?.routes));
      rememberSaved(entry);
      if (entry.id !== routeTripId) {
        setOpenSavedId(entry.id);
        router.replace(tripHref(entry));
      }
      return entry;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!trip || saving) return;
    try {
      if (await persistTrip()) flashSaveMessage("Saved");
    } catch (saveError) {
      console.error("Couldn’t save trip", saveError);
      flashSaveMessage("Couldn’t save");
    }
  };

  /** Shares what's on screen: saves it, then makes sure it has a link. */
  const handleShare = async () => {
    const entry = await persistTrip();
    if (!entry) return null;
    const shared = entry.shareId ? entry : await shareTrip(entry.id);
    rememberSaved(shared);
    return shared.shareId;
  };

  const handleStopSharing = async () => {
    if (openSavedId != null) rememberSaved(await unshareTrip(openSavedId));
  };

  /** The owner's first "Invite": saves the trip, hands it to a team, and gives it a join link. */
  const handleInvite = async () => {
    const entry = await persistTrip();
    if (!entry) return null;
    const withTeam = await enableCollaboration(entry, userId);
    const invited = withTeam.inviteId ? withTeam : await createInviteLink(withTeam.id);
    rememberSaved(invited);
    return invited;
  };

  const handleNewInviteLink = async () => {
    if (!openSaved) return;
    const withTeam = openSaved.teamId ? openSaved : await enableCollaboration(openSaved, userId);
    rememberSaved(await createInviteLink(withTeam.id));
  };

  const handleStopInviting = async () => {
    if (openSavedId != null) rememberSaved(await revokeInviteLink(openSavedId));
  };

  const handleRemoveMember = async (membershipId) => {
    await removeMember(openSaved.teamId, membershipId);
    tripMembers.forget(membershipId);
  };

  /** Adds or edits an expense; a trip nobody's been invited to yet gets its team first. */
  const handleSaveExpense = async (expense, rowId) => {
    let saved = openSaved;
    if (!saved.teamId) {
      saved = await enableCollaboration(saved, userId);
      rememberSaved(saved);
    }
    tripExpenses.applySaved(await saveExpense({ tripId: saved.id, teamId: saved.teamId, userId, expense, rowId }));
  };

  const handleDeleteExpense = async (expenseId) => {
    await deleteExpense(expenseId);
    tripExpenses.applyDeleted(expenseId);
  };

  const handleChangeCurrency = async (code) => rememberSaved(await setTripCurrency(openSaved.id, code));

  const handleLeaveTrip = async () => {
    const left = openSaved;
    await leaveTrip(left.teamId, userId);
    dropTrip(left.id);
    router.push("/trips");
  };

  /** Reloads the saved list now (a trip someone just joined has to be in it before it can open). */
  const refreshTrips = async () => {
    if (!userId) return;
    setSavedTrips(await listTrips());
    setTripsOwner(userId);
  };

  /** After any sign-in: save the trip that sent them here, else go where they were headed. */
  const completeAuth = async (account, next) => {
    const pending = readPendingTrip();
    writePendingTrip(null);
    setPendingTrip(null);
    if (pending && account) {
      try {
        const entry = await saveTrip(account.$id, pending, null, routesFor(pending));
        rememberSaved(entry);
        setTripsReload((n) => n + 1);
        router.replace(tripHref(entry));
        return;
      } catch (saveError) {
        console.error("Couldn’t save trip after sign-in", saveError);
      }
    }
    router.replace(safeNext(next));
  };

  const resumePendingTrip = () => {
    const pending = readPendingTrip();
    writePendingTrip(null);
    setPendingTrip(null);
    router.push("/");
    if (pending) openTrip(pending);
  };

  /**
   * Deletes a trip the user owns; on someone else's trip it means leaving it,
   * which waits until the user's share of its expenses is settled.
   */
  const deleteSaved = async (id) => {
    const saved = savedTrips.find((item) => item.id === id);
    if (!saved) return;
    if (!ownsTrip(saved, userId)) {
      let owed;
      try {
        owed = netBalances(await listExpenses(id))[userId];
      } catch (checkError) {
        console.error("Couldn’t check trip balance", checkError);
        window.alert("Couldn’t check what you owe on this trip. Check your connection and try again.");
        return;
      }
      if (owed) {
        const amount = formatMoney(Math.abs(owed), saved.currency);
        window.alert(`You ${owed < 0 ? "still owe" : "are still owed"} ${amount} on “${saved.title}”. Settle up in its Expenses tab before leaving.`);
        return;
      }
    }
    setSavedTrips((list) => list.filter((item) => item.id !== id));
    const action = ownsTrip(saved, userId) ? deleteTrip(id, saved.teamId) : leaveTrip(saved.teamId, userId);
    action.catch((deleteError) => {
      console.error("Couldn’t remove trip", deleteError);
      setTripsReload((n) => n + 1);
    });
  };

  const logout = async () => {
    // Shared trips don't depend on an account, so a viewer keeps looking at theirs.
    if (view !== "globe" && !viewOnly) closeTrip();
    await auth.logout();
    if (routeTripId) router.push("/trips");
  };

  const closeTrip = () => {
    // Edits made in the last moment before leaving the trip still get saved.
    const { dirty: unsaved, openSaved: leaving } = syncRef.current;
    if (unsaved && leaving && !conflict && tripRef.current) autosaveRef.current(tripRef.current, leaving, { quiet: true });
    setConflict(null);
    setNotice("");
    setAutosave("idle");
    cancel();
    clearError();
    clearTimeout(arrivalRef.current.timer);
    clearTrip();
    setOpenSavedId(null);
    if (openShareId != null) setClosedShareId(openShareId);
    setOpenShareId(null);
    setPrompt("");
    setView("globe");
  };

  const startNewTrip = () => {
    closeTrip();
    if (pathname !== "/") router.push("/");
  };

  const closeTripRef = useRef(closeTrip);
  const autosaveRef = useRef(autosaveTrip);
  const remoteUpdateRef = useRef(handleRemoteUpdate);
  const dropTripRef = useRef(dropTrip);
  useEffect(() => {
    closeTripRef.current = closeTrip;
    autosaveRef.current = autosaveTrip;
    remoteUpdateRef.current = handleRemoteUpdate;
    dropTripRef.current = dropTrip;
  });

  // Autosave: shortly after the last edit, then again with a longer wait while it keeps failing.
  useEffect(() => {
    if (!dirty || conflict || autosave === "saving") return;
    const timer = setTimeout(
      () => autosaveRef.current(tripRef.current, syncRef.current.openSaved),
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
  const introDone = intro.phase === "done";
  useEffect(() => {
    if (!routeTripId) {
      if (openSavedId != null) closeTripRef.current();
      return;
    }
    if (!savedLoaded || !introDone || openSavedId === routeTripId) return;
    const saved = savedTrips.find((item) => String(item.id) === routeTripId);
    if (!saved) return;
    cancel();
    openTrip(saved.data, routeTripId);
  }, [routeTripId, savedLoaded, introDone, openSavedId, savedTrips, openTrip, cancel]);

  useEffect(() => {
    if (!routeShareId) {
      if (openShareId != null) closeTripRef.current();
      return;
    }
    if (!introDone || openShareId === routeShareId || closedShareId === routeShareId || sharedTrip?.shareId !== routeShareId) return;
    cancel();
    openTrip(sharedTrip.data, null, routeShareId);
  }, [routeShareId, introDone, openShareId, closedShareId, sharedTrip, openTrip, cancel]);

  useEffect(() => {
    if (view === "trip" && trip) document.title = `${trip.tripTitle} — Roam`;
  }, [view, trip]);

  const selectStop = (stopId) => {
    setSelectedStopId(stopId);
    if (!stopId) return;
    const day = trip?.stops.find((stop) => stop.activities.some((activity) => activity.id === stopId));
    if (day && activeDayId && activeDayId !== day.id) setActiveDayId(day.id);
  };

  const stops = useMemo(() => getTripStops(trip), [trip]);
  const stopNumbers = useMemo(() => Object.fromEntries(stops.map((stop) => [stop.id, stop.number])), [stops]);
  const center = useMemo(() => getTripCenter(trip), [trip]);
  const dayRoutes = useDayRoutes(trip, viewOnly ? sharedTrip?.routes : openSaved?.routes);
  // An unsaved trip is the user's own; a saved one may belong to a friend who invited them.
  const isOwner = !openSaved || ownsTrip(openSaved, userId);
  const showExpenses = syncing && panelTab === "expenses";

  // Legs that finish loading after the trip was saved are stored with it too,
  // once nothing is still loading. Only the saved version's legs count, so
  // unsaved edits don't leak into the stored routes.
  const routesSettled = dayRoutes.every((segment) => !segment.loading);
  const readyRouteKeys = dayRoutes.filter((segment) => segment.route).map((segment) => segment.key).join("|");
  useEffect(() => {
    if (!openSaved || !userId || !routesSettled) return;
    const routes = routesFor(openSaved.data, openSaved.routes);
    if (!Object.keys(routes).some((key) => !openSaved.routes?.[key])) return;
    const timer = setTimeout(() => {
      saveTripRoutes(openSaved.id, routes)
        .then((entry) => setSavedTrips((list) => list.map((item) => (item.id === entry.id ? entry : item))))
        .catch((routesError) => console.error("Couldn’t store trip routes", routesError));
    }, 1200);
    return () => clearTimeout(timer);
  }, [openSaved, userId, routesSettled, readyRouteKeys]);
  const images = usePlaceImages([
    placeTitle(trip),
    ...(trip?.stops.flatMap((day) => day.activities.map((activity) => activity.location)) || []),
    ...savedTrips.map((saved) => placeTitle(saved.data)),
  ]);

  const savedMarkers = useMemo(() => tripMarkers(savedTrips), [savedTrips]);
  const markers = screen === "trips" ? savedMarkers : SUGGESTION_MARKERS;
  const savedRoutes = useMemo(() => tripRoutes(savedMarkers), [savedMarkers]);
  const routes = screen === "trips" ? savedRoutes : FLIGHT_ROUTES;
  const markerIdBySaved = useMemo(() => {
    const byName = new Map(savedMarkers.map((m) => [m.name.toLowerCase(), m.id]));
    return Object.fromEntries(
      savedTrips.map((s) => [s.id, byName.get((s.data.destination?.name || s.title).toLowerCase()) || null])
    );
  }, [savedMarkers, savedTrips]);

  const handleMarkerSelect = (marker) => {
    if (marker.savedId != null) {
      router.push(`/trips/${marker.savedId}`);
    } else {
      // From the login page the trip is planned on home, where its progress shows.
      if (isAuthScreen(screen)) router.push("/");
      generateFromPrompt(marker.prompt);
    }
  };

  const globeMode = view === "arriving" ? "arriving" : loading && view === "globe" ? "thinking" : "idle";
  const showMap = view !== "globe" && trip;

  const context = {
    screen,
    view,
    loading,
    error,
    prompt,
    setPrompt,
    generateFromPrompt,
    cancel,
    clearError,
    retryLastRequest,
    savedTrips,
    savedLoaded,
    images,
    deleteSaved,
    auth,
    completeAuth,
    pendingTrip,
    resumePendingTrip,
    missingTrip: Boolean(routeTripId) && savedLoaded && !savedTrips.some((item) => String(item.id) === routeTripId),
    focusSavedTrip: (savedId) => setGlobeFocusId(savedId == null ? null : markerIdBySaved[savedId]),
    showSharedTrip: setSharedTrip,
    refreshTrips,
  };

  const navLink = (href, label) => (
    <Link
      href={href}
      className={`nav-link ${pathname === href && view === "globe" ? "is-active" : ""}`}
      aria-current={pathname === href ? "page" : undefined}
      onClick={() => { if (view !== "globe") closeTrip(); }}
    >
      {label}
    </Link>
  );

  return (
    <RoamContext.Provider value={context}>
      <div className={`roam-app phase-${view} screen-${screen} ${intro.phase !== "done" ? `intro-stage-${intro.phase}` : ""}`}>
        {intro.phase !== "done" && (
          <IntroSplash
            onMorph={(from) => setIntro({ phase: "morph", from })}
            onDone={() => setIntro({ phase: "done", from: null })}
          />
        )}
        <header className="roam-header">
          <Link href="/" className="roam-brand" aria-label="Roam home" onClick={() => { if (view !== "globe") closeTrip(); }}>
            <Wordmark />
          </Link>
          {view === "trip" && trip && (
            <div className="trip-header-title"><span>{trip.tripTitle}</span></div>
          )}
          {!isAuthScreen(screen) && (
            <nav className="header-nav" aria-label="Main">
              {navLink("/", "Home")}
              {navLink("/trips", "Trips")}
            </nav>
          )}
          {view === "trip" && trip && viewOnly && (
            <div className="header-actions">
              <span className="view-only-chip" title="Shared with you — you can look, but not change it">
                <EyeIcon /><span>View only</span>
              </span>
              <button type="button" className="outline-pill" onClick={startNewTrip}>
                <PlusIcon /><span>Plan your own</span>
              </button>
            </div>
          )}
          {view === "trip" && trip && !viewOnly && (
            <div className="header-actions">
              {syncing ? (
                <button
                  type="button"
                  className={`outline-pill sync-status ${autosave === "error" ? "is-error" : ""}`}
                  onClick={() => setAutosave("idle")}
                  disabled={autosave !== "error"}
                  title={autosave === "error" ? "Try saving again" : "Changes save automatically"}
                  aria-live="polite"
                >
                  {autosave === "error" ? <BookmarkIcon /> : dirty || autosave === "saving" || conflict ? <span className="sync-dot" aria-hidden="true" /> : <CheckIcon />}
                  <span>
                    {autosave === "error" ? "Couldn’t save · Retry" : conflict ? "Not saved" : dirty || autosave === "saving" ? "Saving…" : "Saved"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="outline-pill"
                  onClick={handleSave}
                  disabled={saving}
                  title={auth.status === "user" ? undefined : "Log in to save this trip"}
                >
                  {saveMessage === "Saved" ? <CheckIcon /> : <BookmarkIcon />}
                  <span>{saveMessage || (saving ? "Saving…" : "Save trip")}</span>
                </button>
              )}
              <MembersMenu
                key={`members-${trip.tripId}`}
                saved={openSaved}
                isOwner={isOwner}
                userId={userId}
                onInvite={handleInvite}
                onNewLink={handleNewInviteLink}
                onStopInviting={handleStopInviting}
                members={tripMembers.members}
                membersError={tripMembers.error}
                owing={owing}
                onReloadMembers={tripMembers.reload}
                onRemove={handleRemoveMember}
                onLeave={handleLeaveTrip}
              />
              {isOwner && <ShareMenu key={trip.tripId} shareId={openSaved?.shareId} onShare={handleShare} onStopSharing={handleStopSharing} />}
              <button type="button" className="outline-pill header-new-trip" onClick={startNewTrip}>
                <PlusIcon /><span>New trip</span>
              </button>
            </div>
          )}
          <ThemeToggle />
          {!isAuthScreen(screen) && auth.status !== "loading" && (
            <AccountMenu user={auth.user} onLogout={logout} onNavigate={() => { if (view !== "globe") closeTrip(); }} />
          )}
        </header>

        <main className="roam-stage">
          {showMap && (
            <div className={`map-layer ${view === "trip" ? "is-visible" : ""}`}>
              <TripMap
                key={trip.tripId}
                center={center}
                stops={stops}
                dayRoutes={dayRoutes}
                activeDayId={activeDayId}
                hoveredStopId={hoveredStopId}
                selectedStopId={selectedStopId}
                revealed={view === "trip"}
                insets={insets}
                onReady={handleMapReady}
                onStopSelect={selectStop}
              />
            </div>
          )}

          <DestinationGlobe
            destinations={markers}
            routes={routes}
            screen={screen}
            mode={globeMode}
            target={view === "arriving" ? center : null}
            hidden={view === "trip"}
            intro={intro.phase === "done" ? null : intro}
            focusId={globeFocusId}
            disabled={loading}
            onSelect={handleMarkerSelect}
            onArrive={handleGlobeArrived}
          />

          {view !== "trip" && children}

          {showMap && (
            <aside ref={panelRef} className={`trip-panel ${view === "trip" ? "is-open" : ""}`} aria-label="Itinerary">
              {notice && <div className="sync-toast" role="status">{notice}</div>}
              <div className="panel-scroll">
                <header className="trip-hero">
                  <div className="hero-image" style={images[placeTitle(trip)] ? { backgroundImage: `url("${images[placeTitle(trip)]}")` } : undefined} aria-hidden="true" />
                  <div className="hero-text">
                    <h1>{destinationLabel(trip)}</h1>
                    <p className="hero-meta">
                      {dayCount(trip)}
                      {trip.totalBudgetEstimate && <> · {trip.totalBudgetEstimate}</>}
                    </p>
                  </div>
                </header>
                {syncing && (
                  <div className="panel-tabs" role="tablist" aria-label="Trip sections">
                    {[["itinerary", "Itinerary"], ["expenses", "Expenses"]].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`tab-${key}`}
                        aria-selected={panelTab === key}
                        aria-controls="trip-tab-panel"
                        onClick={() => {
                          setPanelTab(key);
                          if (key === "expenses") tripMembers.reload();
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {trip.summary && !showExpenses && <p className="trip-summary">{trip.summary}</p>}
                {!viewOnly && <ErrorBanner error={error} onRetry={retryLastRequest} onDismiss={clearError} />}
                {conflict && (
                  <div className="error-banner is-notice sync-conflict" role="alert">
                    <div className="error-body">
                      <strong>{conflict.by} changed this trip while you were editing.</strong>
                      <p>Load their version, or keep yours and replace their changes.</p>
                    </div>
                    <div className="error-actions">
                      <button type="button" className="dark-pill small" onClick={loadTheirs}>Load theirs</button>
                      <button type="button" className="ghost-pill" onClick={keepMine}>Keep mine</button>
                    </div>
                  </div>
                )}
                {showExpenses ? (
                  <div id="trip-tab-panel" role="tabpanel" aria-labelledby="tab-expenses">
                    <ExpensesPanel
                      expenses={tripExpenses.expenses}
                      error={tripExpenses.error}
                      onRetry={tripExpenses.reload}
                      people={people}
                      me={userId}
                      currency={currency}
                      canChangeCurrency={isOwner}
                      onChangeCurrency={handleChangeCurrency}
                      budget={trip.totalBudgetEstimate}
                      onSave={handleSaveExpense}
                      onDelete={handleDeleteExpense}
                    />
                  </div>
                ) : (
                  <div
                    id={syncing ? "trip-tab-panel" : undefined}
                    role={syncing ? "tabpanel" : undefined}
                    aria-labelledby={syncing ? "tab-itinerary" : undefined}
                    className={`itinerary-wrap ${loading ? "is-refreshing" : ""}`}
                    aria-busy={loading}
                  >
                    <ItineraryView
                      trip={trip}
                      readOnly={viewOnly}
                      images={images}
                      stopNumbers={stopNumbers}
                      activeDayId={activeDayId}
                      hoveredStopId={hoveredStopId}
                      selectedStopId={selectedStopId}
                      onSelectDay={setActiveDayId}
                      onHoverStop={setHoveredStopId}
                      onSelectStop={selectStop}
                      onToggleActivity={toggleActivity}
                      onDeleteActivity={deleteActivity}
                      onDeleteDay={(dayId) => { if (activeDayId === dayId) setActiveDayId(null); deleteDay(dayId); }}
                      onEditActivity={editActivity}
                      onReorderActivities={reorderActivities}
                      onReorderDays={reorderDays}
                      onTogglePackingItem={togglePackingItem}
                    />
                  </div>
                )}
              </div>
              <div className="panel-footer">
                {viewOnly ? (
                  <p className="view-only-note"><EyeIcon /> Shared with you — view only</p>
                ) : showExpenses ? null : (
                  <RefineInput onRefine={handleRefine} loading={loading} error={error} />
                )}
                <p className="panel-disclaimer">
                  {showExpenses ? "Everyone on the trip can add, edit and delete expenses." : "AI suggestions — check places, hours and prices before you go."}
                </p>
              </div>
            </aside>
          )}
        </main>
      </div>
    </RoamContext.Provider>
  );
}
