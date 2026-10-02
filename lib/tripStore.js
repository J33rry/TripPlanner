import { ID, Permission, Query, Role } from "appwrite";
import { APPWRITE, appwrite } from "./appwrite";

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

function fromRow(row) {
  try {
    const data = JSON.parse(row.data);
    return data?.stops
      ? { id: row.$id, title: row.title, savedAt: row.$updatedAt, data, routes: parseRoutes(row.routes) }
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

/**
 * Creates the trip, or overwrites it when `rowId` names an existing saved trip.
 * `routes` maps each map segment's key (see planSegments) to its fetched route.
 */
export async function saveTrip(userId, trip, rowId = null, routes = {}) {
  const data = { title: trip.tripTitle, data: JSON.stringify(trip), routes: compactRoutes(routes) };
  const { tables } = appwrite();
  const row = rowId
    ? await tables.updateRow({ ...table(), rowId, data })
    : await tables.createRow({
        ...table(),
        rowId: ID.unique(),
        data,
        permissions: [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))],
      });
  return fromRow(row);
}

/** Stores routes that finished loading after the trip itself was saved. */
export async function saveTripRoutes(rowId, routes) {
  const row = await appwrite().tables.updateRow({ ...table(), rowId, data: { routes: compactRoutes(routes) } });
  return fromRow(row);
}

export async function deleteTrip(rowId) {
  await appwrite().tables.deleteRow({ ...table(), rowId });
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
