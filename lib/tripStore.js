import { ID, Permission, Query, Role } from "appwrite";
import { APPWRITE, appwrite } from "./appwrite";

const LEGACY_STORAGE_KEY = "tripplanner_saved_trips";
const LIST_LIMIT = 100;

const table = () => ({ databaseId: APPWRITE.databaseId, tableId: APPWRITE.tripsTableId });

function fromRow(row) {
  try {
    const data = JSON.parse(row.data);
    return data?.stops ? { id: row.$id, title: row.title, savedAt: row.$updatedAt, data } : null;
  } catch {
    return null;
  }
}

export async function listTrips() {
  const { rows } = await appwrite().tables.listRows({
    ...table(),
    queries: [Query.orderDesc("$updatedAt"), Query.limit(LIST_LIMIT)],
  });
  return rows.map(fromRow).filter(Boolean);
}

/** Creates the trip, or overwrites it when `rowId` names an existing saved trip. */
export async function saveTrip(userId, trip, rowId = null) {
  const data = { title: trip.tripTitle, data: JSON.stringify(trip) };
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
