import "server-only";
import { cache } from "react";
import { Client, Query, TablesDB } from "node-appwrite";
import { APPWRITE } from "./appwrite";
import { fromRow } from "./tripStore";

// Trip rows are readable only by their owner, so a shared one is fetched here
// with a server key (rows.read) rather than being made public — public rows
// would let anyone list every shared trip.
const SHARE_ID = /^[A-Za-z0-9_-]{20,64}$/;

let tables = null;
let warned = false;

function serverTables() {
  const key = process.env.APPWRITE_SHARE_API_KEY;
  if (!APPWRITE.projectId || !key) {
    if (!warned) console.warn("Shared trips: set NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_SHARE_API_KEY to open share links.");
    warned = true;
    return null;
  }
  tables ??= new TablesDB(new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.projectId).setKey(key));
  return tables;
}

/** The trip behind a share link, or null when the link is wrong or was turned off. */
export const getSharedTrip = cache(async (shareId) => {
  if (!SHARE_ID.test(shareId || "")) return null;
  const db = serverTables();
  if (!db) return null;
  try {
    const { rows } = await db.listRows({
      databaseId: APPWRITE.databaseId,
      tableId: APPWRITE.tripsTableId,
      queries: [Query.equal("shareId", shareId), Query.limit(1)],
    });
    const trip = rows[0] && fromRow(rows[0]);
    // Only what the page draws: never the owner's row ID or permissions.
    return trip ? { shareId, title: trip.title, savedAt: trip.savedAt, data: trip.data, routes: trip.routes } : null;
  } catch (error) {
    console.error("Couldn’t load shared trip", error?.message || error);
    return null;
  }
});
