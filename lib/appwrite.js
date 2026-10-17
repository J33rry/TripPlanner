import { Account, Client, Realtime, TablesDB, Teams } from "appwrite";

export const APPWRITE = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "roam",
  tripsTableId: process.env.NEXT_PUBLIC_APPWRITE_TRIPS_TABLE_ID || "roam_trips",
  expensesTableId: process.env.NEXT_PUBLIC_APPWRITE_EXPENSES_TABLE_ID || "roam_expenses",
};

export const appwriteConfigured = Boolean(APPWRITE.projectId);

let services = null;

let cachedJwt = null;
const JWT_REUSE_MS = 10 * 60 * 1000; // Appwrite JWTs last 15 minutes

/**
 * A short-lived token proving who's signed in, for Roam's own API routes.
 * Reused for a few minutes (creating them is rate limited); `fresh` forces a new one.
 */
export async function sessionJwt({ fresh = false } = {}) {
  if (!fresh && cachedJwt && cachedJwt.expires > Date.now()) return cachedJwt.jwt;
  const { jwt } = await appwrite().account.createJWT();
  cachedJwt = { jwt, expires: Date.now() + JWT_REUSE_MS };
  return jwt;
}

export const forgetSessionJwt = () => {
  cachedJwt = null;
};

/** Lazily built so the SDK never touches `window` during server rendering. */
export function appwrite() {
  if (!services) {
    const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.projectId);
    services = { client, account: new Account(client), tables: new TablesDB(client), teams: new Teams(client), realtime: new Realtime(client) };
  }
  return services;
}
