import { Account, Client, TablesDB } from "appwrite";

export const APPWRITE = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "roam",
  tripsTableId: process.env.NEXT_PUBLIC_APPWRITE_TRIPS_TABLE_ID || "roam_trips",
};

export const appwriteConfigured = Boolean(APPWRITE.projectId);

let services = null;

/** Lazily built so the SDK never touches `window` during server rendering. */
export function appwrite() {
  if (!services) {
    const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.projectId);
    services = { client, account: new Account(client), tables: new TablesDB(client) };
  }
  return services;
}
