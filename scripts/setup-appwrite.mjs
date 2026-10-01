// Creates the database and table Roam saves trips to. Safe to re-run.
//
//   APPWRITE_API_KEY=<key with databases.read/write, tables.read/write, columns.read/write> npm run setup:appwrite
//
// Reads NEXT_PUBLIC_APPWRITE_* from .env.local / .env when present.
import { existsSync } from "node:fs";
import { Client, Permission, Role, TablesDB } from "node-appwrite";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "roam";
const tableId = process.env.NEXT_PUBLIC_APPWRITE_TRIPS_TABLE_ID || "roam_trips";
const apiKey = process.env.APPWRITE_API_KEY;

if (!projectId || !apiKey) {
  console.error("Set NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY first.");
  process.exit(1);
}

const tables = new TablesDB(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));

async function ensure(label, create) {
  try {
    await create();
    console.log(`✓ created ${label}`);
  } catch (error) {
    if (error?.code !== 409) throw error;
    console.log(`• ${label} already exists`);
  }
}

await ensure(`database "${databaseId}"`, () => tables.create({ databaseId, name: "Roam" }));
// Any signed-in user may create rows; each row is then readable/writable only by its owner.
await ensure(`table "${tableId}"`, () =>
  tables.createTable({ databaseId, tableId, name: "Roam trips", rowSecurity: true, permissions: [Permission.create(Role.users())] })
);
// The database may be shared with other apps; never add columns to a table Roam didn't make.
const { columns } = await tables.getTable({ databaseId, tableId });
const foreign = columns.map((column) => column.key).filter((key) => key !== "title" && key !== "data");
if (foreign.length) {
  console.error(`✗ table "${tableId}" already exists with other columns (${foreign.join(", ")}) — it belongs to something else.`);
  console.error("  Set NEXT_PUBLIC_APPWRITE_TRIPS_TABLE_ID to an unused ID and run this again.");
  process.exit(1);
}
await ensure("column title", () => tables.createVarcharColumn({ databaseId, tableId, key: "title", size: 256, required: true }));
await ensure("column data", () => tables.createLongtextColumn({ databaseId, tableId, key: "data", required: true }));

console.log("Appwrite is ready for Roam.");
