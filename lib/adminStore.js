import "server-only";
import { Client, TablesDB, Users } from "node-appwrite";
import { APPWRITE } from "./appwrite";

// Server-side access for the admin page and usage metrics, with a key scoped to
// users.read, rows.read and rows.write. The admins and metrics tables have no
// permissions at all, so nothing in the browser can read or change them.
export const ADMIN_TABLES = {
  admins: process.env.APPWRITE_ADMINS_TABLE_ID || "roam_admins",
  metrics: process.env.APPWRITE_METRICS_TABLE_ID || "roam_metrics",
};

let services = null;

export const adminConfigured = () => Boolean(APPWRITE.projectId && process.env.APPWRITE_ADMIN_API_KEY);

/** { tables, users }, or null when the admin key isn't set. */
export function adminServices() {
  if (!adminConfigured()) return null;
  if (!services) {
    const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.projectId).setKey(process.env.APPWRITE_ADMIN_API_KEY);
    services = { tables: new TablesDB(client), users: new Users(client) };
  }
  return services;
}
