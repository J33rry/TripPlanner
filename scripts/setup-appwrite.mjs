// Creates the database and tables Roam saves trips, expenses, admin accounts and usage metrics to. Safe to re-run.
//
//   APPWRITE_API_KEY=<key with databases.read/write, tables.read/write, columns.read/write> npm run setup:appwrite
//
// Reads NEXT_PUBLIC_APPWRITE_* from .env.local / .env when present.
import { existsSync } from "node:fs";
import { Client, Permission, Role, TablesDB, TablesDBIndexType } from "node-appwrite";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "roam";
const tableId = process.env.NEXT_PUBLIC_APPWRITE_TRIPS_TABLE_ID || "roam_trips";
const expensesTableId = process.env.NEXT_PUBLIC_APPWRITE_EXPENSES_TABLE_ID || "roam_expenses";
const adminsTableId = process.env.APPWRITE_ADMINS_TABLE_ID || "roam_admins";
const metricsTableId = process.env.APPWRITE_METRICS_TABLE_ID || "roam_metrics";
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
// Any signed-in user may create rows; each row is then readable/writable only by its owner,
// or by the trip's team once the owner invites friends.
await ensure(`table "${tableId}"`, () =>
  tables.createTable({ databaseId, tableId, name: "Roam trips", rowSecurity: true, permissions: [Permission.create(Role.users())] })
);
// The database may be shared with other apps; never add columns to a table Roam didn't make.
const { columns } = await tables.getTable({ databaseId, tableId });
const foreign = columns.map((column) => column.key).filter((key) => !["title", "data", "routes", "shareId", "ownerId", "teamId", "inviteId", "updatedBy", "currency"].includes(key));
if (foreign.length) {
  console.error(`✗ table "${tableId}" already exists with other columns (${foreign.join(", ")}) — it belongs to something else.`);
  console.error("  Set NEXT_PUBLIC_APPWRITE_TRIPS_TABLE_ID to an unused ID and run this again.");
  process.exit(1);
}
await ensure("column title", () => tables.createVarcharColumn({ databaseId, tableId, key: "title", size: 256, required: true }));
await ensure("column data", () => tables.createLongtextColumn({ databaseId, tableId, key: "data", required: true }));
// Map routes fetched for the trip, so reopening it doesn't depend on the routing service.
await ensure("column routes", () => tables.createLongtextColumn({ databaseId, tableId, key: "routes", required: false }));
// A trip's view-only link (/share/<shareId>); empty while the trip isn't shared.
await ensure("column shareId", () => tables.createVarcharColumn({ databaseId, tableId, key: "shareId", size: 64, required: false }));
// Who created the trip, and the Appwrite team of everyone who can edit it (empty until the first invite).
await ensure("column ownerId", () => tables.createVarcharColumn({ databaseId, tableId, key: "ownerId", size: 36, required: false }));
await ensure("column teamId", () => tables.createVarcharColumn({ databaseId, tableId, key: "teamId", size: 36, required: false }));
// The trip's join link (/join/<inviteId>); empty while the owner isn't inviting anyone.
await ensure("column inviteId", () => tables.createVarcharColumn({ databaseId, tableId, key: "inviteId", size: 64, required: false }));
// Who saved last, so collaborators can be told who changed the trip.
await ensure("column updatedBy", () => tables.createVarcharColumn({ databaseId, tableId, key: "updatedBy", size: 36, required: false }));

// The currency (ISO code) every expense on the trip is in; empty means INR.
await ensure("column currency", () => tables.createVarcharColumn({ databaseId, tableId, key: "currency", size: 3, required: false }));

// A new column is usable only once Appwrite finishes building it.
async function waitForColumn(key, table = tableId) {
  for (let tries = 0; ; tries++) {
    const column = await tables.getColumn({ databaseId, tableId: table, key });
    if (column.status === "available") return;
    if (column.status === "failed" || tries >= 30) throw new Error(`column ${key} is ${column.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
for (const key of ["shareId", "inviteId"]) {
  await waitForColumn(key);
  await ensure(`index ${key}`, () =>
    tables.createIndex({ databaseId, tableId, key, type: TablesDBIndexType.Key, columns: [key] })
  );
}

// Shared expenses: one row per expense or repayment. Rows belong to the trip's
// team (read/update/delete), so everyone on the trip sees and edits them.
await ensure(`table "${expensesTableId}"`, () =>
  tables.createTable({ databaseId, tableId: expensesTableId, name: "Roam expenses", rowSecurity: true, permissions: [Permission.create(Role.users())] })
);
const EXPENSE_COLUMNS = ["tripId", "kind", "description", "amount", "paidBy", "paidByName", "splitType", "splits", "category", "spentAt", "createdBy", "updatedBy"];
const expenseTable = await tables.getTable({ databaseId, tableId: expensesTableId });
const foreignExpense = expenseTable.columns.map((column) => column.key).filter((key) => !EXPENSE_COLUMNS.includes(key));
if (foreignExpense.length) {
  console.error(`✗ table "${expensesTableId}" already exists with other columns (${foreignExpense.join(", ")}) — it belongs to something else.`);
  console.error("  Set NEXT_PUBLIC_APPWRITE_EXPENSES_TABLE_ID to an unused ID and run this again.");
  process.exit(1);
}
const expenses = { databaseId, tableId: expensesTableId };
await ensure("expense column tripId", () => tables.createVarcharColumn({ ...expenses, key: "tripId", size: 36, required: true }));
await ensure("expense column kind", () => tables.createEnumColumn({ ...expenses, key: "kind", elements: ["expense", "settlement"], required: true }));
await ensure("expense column description", () => tables.createVarcharColumn({ ...expenses, key: "description", size: 256, required: true }));
// In the currency's minor unit (paise, cents), so shares always add up exactly.
await ensure("expense column amount", () => tables.createIntegerColumn({ ...expenses, key: "amount", required: true, min: 1 }));
await ensure("expense column paidBy", () => tables.createVarcharColumn({ ...expenses, key: "paidBy", size: 36, required: true }));
// Names are copied in so an expense still reads right after someone leaves the trip.
await ensure("expense column paidByName", () => tables.createVarcharColumn({ ...expenses, key: "paidByName", size: 128, required: false }));
await ensure("expense column splitType", () =>
  tables.createEnumColumn({ ...expenses, key: "splitType", elements: ["equal", "exact", "percent", "shares"], required: true })
);
// JSON [{ userId, name, value }]; see lib/splits.js for what `value` means per split type.
await ensure("expense column splits", () => tables.createLongtextColumn({ ...expenses, key: "splits", required: true }));
await ensure("expense column category", () => tables.createVarcharColumn({ ...expenses, key: "category", size: 32, required: false }));
await ensure("expense column spentAt", () => tables.createDatetimeColumn({ ...expenses, key: "spentAt", required: true }));
await ensure("expense column createdBy", () => tables.createVarcharColumn({ ...expenses, key: "createdBy", size: 36, required: false }));
await ensure("expense column updatedBy", () => tables.createVarcharColumn({ ...expenses, key: "updatedBy", size: 36, required: false }));
await waitForColumn("tripId", expensesTableId);
await ensure("expense index tripId", () =>
  tables.createIndex({ ...expenses, key: "tripId", type: TablesDBIndexType.Key, columns: ["tripId"] })
);

// The admin page's tables. No permissions at all: only server keys can read or
// write them, so admin accounts can't be listed, created or changed from the site.
function ensureOwnColumns(table, id, known, envName) {
  const foreignColumns = table.columns.map((column) => column.key).filter((key) => !known.includes(key));
  if (!foreignColumns.length) return;
  console.error(`✗ table "${id}" already exists with other columns (${foreignColumns.join(", ")}) — it belongs to something else.`);
  console.error(`  Set ${envName} to an unused ID and run this again.`);
  process.exit(1);
}

// Admin accounts, added with `npm run seed:admin`. Passwords are scrypt hashes (lib/passwordHash.js).
await ensure(`table "${adminsTableId}"`, () =>
  tables.createTable({ databaseId, tableId: adminsTableId, name: "Roam admins", rowSecurity: false, permissions: [] })
);
ensureOwnColumns(await tables.getTable({ databaseId, tableId: adminsTableId }), adminsTableId, ["username", "passwordHash", "lastLoginAt"], "APPWRITE_ADMINS_TABLE_ID");
const admins = { databaseId, tableId: adminsTableId };
await ensure("admin column username", () => tables.createVarcharColumn({ ...admins, key: "username", size: 64, required: true }));
await ensure("admin column passwordHash", () => tables.createVarcharColumn({ ...admins, key: "passwordHash", size: 256, required: true }));
await ensure("admin column lastLoginAt", () => tables.createDatetimeColumn({ ...admins, key: "lastLoginAt", required: false }));
await waitForColumn("username", adminsTableId);
await ensure("admin index username", () =>
  tables.createIndex({ ...admins, key: "username", type: TablesDBIndexType.Unique, columns: ["username"] })
);

// Usage counters for the admin page: one row per metric per UTC day (lib/metrics.js).
await ensure(`table "${metricsTableId}"`, () =>
  tables.createTable({ databaseId, tableId: metricsTableId, name: "Roam metrics", rowSecurity: false, permissions: [] })
);
ensureOwnColumns(await tables.getTable({ databaseId, tableId: metricsTableId }), metricsTableId, ["day", "metric", "count"], "APPWRITE_METRICS_TABLE_ID");
const metrics = { databaseId, tableId: metricsTableId };
await ensure("metric column day", () => tables.createVarcharColumn({ ...metrics, key: "day", size: 10, required: true }));
await ensure("metric column metric", () => tables.createVarcharColumn({ ...metrics, key: "metric", size: 96, required: true }));
await ensure("metric column count", () => tables.createIntegerColumn({ ...metrics, key: "count", required: false, min: 0, xdefault: 0 }));
await waitForColumn("day", metricsTableId);
await ensure("metric index day", () =>
  tables.createIndex({ ...metrics, key: "day", type: TablesDBIndexType.Key, columns: ["day"] })
);

console.log("Appwrite is ready for Roam.");
