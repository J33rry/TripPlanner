// Adds an admin account for /secretadmin, or sets a new password for an existing one.
// The site itself can't create admins or change their passwords; this script (or
// editing the row in the Appwrite console) is the only way.
//
//   npm run seed:admin -- <userid>          asks for the password (twice, hidden)
//   ADMIN_PASSWORD=… npm run seed:admin -- <userid>
//   npm run seed:admin -- --hash            only prints a hash, to paste into a row's passwordHash by hand
//
// Needs APPWRITE_ADMIN_API_KEY (rows.read/write) or APPWRITE_API_KEY, and the admins
// table from `npm run setup:appwrite`. Reads .env.local / .env when present.
import { existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { Client, ID, Query, TablesDB } from "node-appwrite";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../lib/passwordHash.js";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const USER_ID = /^[A-Za-z0-9._@-]{3,64}$/;

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (hidden && process.stdin.isTTY) {
      // Echo the prompt, but not what's typed.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) rl.output.write(question);
        else if (/[\r\n]/.test(text)) rl.output.write("\n");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const password = await ask("Password: ", { hidden: true });
  if ((await ask("Repeat password: ", { hidden: true })) !== password) {
    console.error("✗ The passwords don’t match.");
    process.exit(1);
  }
  return password;
}

async function newHash() {
  const password = await readPassword();
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`✗ Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }
  return hashPassword(password);
}

const arg = process.argv[2];
if (arg === "--hash") {
  console.log(await newHash());
  process.exit(0);
}
if (!USER_ID.test(arg || "")) {
  console.error("Usage: npm run seed:admin -- <userid>   (3–64 letters, digits, . _ @ -)");
  process.exit(1);
}

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_ADMIN_API_KEY || process.env.APPWRITE_API_KEY;
const table = {
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "roam",
  tableId: process.env.APPWRITE_ADMINS_TABLE_ID || "roam_admins",
};
if (!projectId || !apiKey) {
  console.error("Set NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_ADMIN_API_KEY (or APPWRITE_API_KEY) first.");
  process.exit(1);
}

const tables = new TablesDB(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));
const passwordHash = await newHash();
try {
  const { rows } = await tables.listRows({ ...table, queries: [Query.equal("username", arg), Query.limit(1)] });
  if (rows[0]) {
    await tables.updateRow({ ...table, rowId: rows[0].$id, data: { passwordHash } });
    console.log(`✓ new password set for admin "${arg}" — their open sessions have ended`);
  } else {
    await tables.createRow({ ...table, rowId: ID.unique(), data: { username: arg, passwordHash } });
    console.log(`✓ created admin "${arg}"`);
  }
} catch (error) {
  console.error(`✗ ${error?.message || error}`);
  if (error?.code === 404) console.error("  Run `npm run setup:appwrite` first to create the admins table.");
  if (error?.code === 401) console.error("  The API key needs the rows.read and rows.write scopes.");
  process.exit(1);
}
