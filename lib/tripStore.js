import { Channel, ID, Permission, Query, Role } from "appwrite";
import { APPWRITE, appwrite, sessionJwt } from "./appwrite";
import { deleteTripExpenses } from "./expenseStore";
import { DEFAULT_CURRENCY } from "./splits";

const LEGACY_STORAGE_KEY = "tripplanner_saved_trips";
const LIST_LIMIT = 100;

const table = () => ({ databaseId: APPWRITE.databaseId, tableId: APPWRITE.tripsTableId });

function parseRoutes(json) {
  try {
    const routes = JSON.parse(json || "{}");
    return routes && typeof routes === "object" ? routes : {};
  } catch {
    return {};
  }
}

export function fromRow(row) {
  try {
    const data = JSON.parse(row.data);
    return data?.stops
      ? {
          id: row.$id,
          title: row.title,
          savedAt: row.$updatedAt,
          data,
          routes: parseRoutes(row.routes),
          shareId: row.shareId || null,
          // Trips saved before collaboration have no owner column; only their owner could read them.
          ownerId: row.ownerId || null,
          teamId: row.teamId || null,
          inviteId: row.inviteId || null,
          updatedBy: row.updatedBy || null,
          currency: row.currency || DEFAULT_CURRENCY,
        }
      : null;
  } catch {
    return null;
  }
}

// ~1 m precision is plenty for drawing a route and roughly halves what's stored.
const round = (n) => Math.round(n * 1e5) / 1e5;
const compactRoutes = (routes) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(routes || {})
        .filter(([, route]) => Array.isArray(route?.geometry?.coordinates))
        .map(([key, route]) => [
          key,
          { ...route, geometry: { ...route.geometry, coordinates: route.geometry.coordinates.map(([lng, lat]) => [round(lng), round(lat)]) } },
        ])
    )
  );

export async function listTrips() {
  const { rows } = await appwrite().tables.listRows({
    ...table(),
    queries: [Query.orderDesc("$updatedAt"), Query.limit(LIST_LIMIT)],
  });
  return rows.map(fromRow).filter(Boolean);
}

/** Whether `userId` owns the saved trip (and so may delete it and manage who's on it). */
export const ownsTrip = (saved, userId) => Boolean(saved && userId) && (!saved.ownerId || saved.ownerId === userId);

/**
 * Creates the trip, or overwrites it when `rowId` names an existing saved trip.
 * `routes` maps each map segment's key (see planSegments) to its fetched route.
 */
export async function saveTrip(userId, trip, rowId = null, routes = {}) {
  const data = { title: trip.tripTitle, data: JSON.stringify(trip), routes: compactRoutes(routes), updatedBy: userId };
  const { tables } = appwrite();
  const row = rowId
    ? await tables.updateRow({ ...table(), rowId, data })
    : await tables.createRow({
        ...table(),
        rowId: ID.unique(),
        data: { ...data, ownerId: userId },
        permissions: [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))],
      });
  return fromRow(row);
}

/** The trip as it is saved right now (autosave checks nobody else saved since it last looked). */
export async function fetchTrip(rowId) {
  return fromRow(await appwrite().tables.getRow({ ...table(), rowId }));
}

/**
 * Calls `onUpdate(entry)` whenever anyone saves the trip, and `onDelete()` if
 * it's deleted. Returns a function that stops watching.
 */
export function watchTrip(rowId, { onUpdate, onDelete }) {
  const channel = Channel.tablesdb(APPWRITE.databaseId).table(APPWRITE.tripsTableId).row(rowId);
  const subscription = appwrite().realtime.subscribe(channel, (event) => {
    if (event.events.some((name) => name.endsWith(".delete"))) return onDelete();
    const entry = fromRow(event.payload);
    if (entry) onUpdate(entry);
  });
  subscription.catch((error) => console.error("Couldn’t watch trip for changes", error));
  return () => {
    subscription.then((sub) => sub.unsubscribe()).catch(() => {});
  };
}

/** Stores routes that finished loading after the trip itself was saved. */
export async function saveTripRoutes(rowId, routes) {
  const row = await appwrite().tables.updateRow({ ...table(), rowId, data: { routes: compactRoutes(routes) } });
  return fromRow(row);
}

// 24 random bytes as base64url: unguessable, and a valid Appwrite query value.
function newShareId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

export const shareUrl = (shareId) => `${window.location.origin}/share/${shareId}`;

/**
 * Turns on the trip's view-only link. The row stays private to its owner; the
 * /share page looks it up by this ID on the server, so the link can be revoked.
 */
export async function shareTrip(rowId) {
  const row = await appwrite().tables.updateRow({ ...table(), rowId, data: { shareId: newShareId() } });
  return fromRow(row);
}

/** Kills the link; sharing again issues a new one. */
export async function unshareTrip(rowId) {
  const row = await appwrite().tables.updateRow({ ...table(), rowId, data: { shareId: null } });
  return fromRow(row);
}

/** Only the owner can delete a trip; its expenses and team go with it. */
export async function deleteTrip(rowId, teamId = null) {
  const { tables, teams } = appwrite();
  if (teamId) await deleteTripExpenses(rowId);
  await tables.deleteRow({ ...table(), rowId });
  if (teamId) await teams.delete({ teamId }).catch((error) => console.error("Couldn’t delete trip team", error));
}

/**
 * Lets friends edit the trip: makes an Appwrite team for it (the owner is its
 * `owner`) and hands the row to that team. Everyone on the team can read and
 * change the trip; only its owners can delete it. Safe to call again.
 */
export async function enableCollaboration(saved, userId) {
  if (saved.teamId) return saved;
  const { tables, teams } = appwrite();
  const team = await teams.create({ teamId: ID.unique(), name: (saved.title || "Trip").slice(0, 128) });
  const row = await tables.updateRow({
    ...table(),
    rowId: saved.id,
    data: { teamId: team.$id, ownerId: saved.ownerId || userId },
    permissions: [
      Permission.read(Role.team(team.$id)),
      Permission.update(Role.team(team.$id)),
      Permission.delete(Role.team(team.$id, "owner")),
    ],
  });
  return fromRow(row);
}

/** The currency the trip's expenses are in (the owner picks it before the first expense). */
export async function setTripCurrency(rowId, currency) {
  const row = await appwrite().tables.updateRow({ ...table(), rowId, data: { currency } });
  return fromRow(row);
}

export const inviteUrl = (inviteId) => `${window.location.origin}/join/${inviteId}`;

/**
 * Issues a fresh join link (/join/<inviteId>); any older link stops working.
 * Anyone who opens it and signs in joins the trip as an editor.
 */
export async function createInviteLink(rowId) {
  const row = await appwrite().tables.updateRow({ ...table(), rowId, data: { inviteId: newShareId() } });
  return fromRow(row);
}

/** Stops new people joining; current members stay. */
export async function revokeInviteLink(rowId) {
  const row = await appwrite().tables.updateRow({ ...table(), rowId, data: { inviteId: null } });
  return fromRow(row);
}

/**
 * Everyone on the trip, owners first: `[{ membershipId, userId, name, owner }]`.
 * Asked of the server, because Appwrite blanks other members' IDs and names
 * when a member lists their own team from the browser.
 */
export async function listMembers(teamId) {
  const ask = async (fresh) =>
    fetch("/api/trips/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, jwt: await sessionJwt({ fresh }) }),
    });
  let response = await ask(false);
  // A reused token may belong to a session that has since ended.
  if (response.status === 401) response = await ask(true);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Couldn’t load trip members");
  return result.members.sort((a, b) => Number(b.owner) - Number(a.owner));
}

/** An owner taking someone off the trip. */
export async function removeMember(teamId, membershipId) {
  await appwrite().teams.deleteMembership({ teamId, membershipId });
}

/** Takes the signed-in user off a trip someone else owns. */
export async function leaveTrip(teamId, userId) {
  const { teams } = appwrite();
  const { memberships } = await teams.listMemberships({ teamId, queries: [Query.equal("userId", userId), Query.limit(1)] });
  if (memberships[0]) await teams.deleteMembership({ teamId, membershipId: memberships[0].$id });
}

/**
 * Trips saved before accounts existed lived in localStorage. The first account
 * to sign in on this browser adopts them, then the local copy is dropped.
 */
export async function importLegacyTrips(userId) {
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
  } catch {
    return 0;
  }
  if (!Array.isArray(legacy) || !legacy.length) return 0;
  const trips = legacy.filter((item) => item?.data?.stops).reverse();
  const results = await Promise.allSettled(trips.map((item) => saveTrip(userId, item.data)));
  const failed = trips.filter((_, index) => results[index].status === "rejected").reverse();
  if (failed.length) localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(failed));
  else localStorage.removeItem(LEGACY_STORAGE_KEY);
  return trips.length - failed.length;
}
