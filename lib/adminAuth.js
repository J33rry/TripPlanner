import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { Query } from "node-appwrite";
import { APPWRITE } from "./appwrite";
import { ADMIN_TABLES, adminServices } from "./adminStore";
import { DUMMY_HASH, verifyPassword } from "./passwordHash";

// Admin accounts live only in the admins table and are created or changed with
// `npm run seed:admin` (or by editing the row): the site can sign in, never sign up
// or change a password. A session is a signed, HttpOnly cookie scoped to the admin
// path. It's signed over the admin's password hash too, so changing the password
// in the database ends every session that used the old one.
export const ADMIN_PATH = "/secretadmin";
const COOKIE = "roam_admin";
const SESSION_MS = 8 * 60 * 60 * 1000;

// Failed sign-ins per client address and per user ID, kept in memory for this server process.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 5;
const MAX_FAILURES_PER_USER = 20;
const failures = new Map();

function limited(key, max) {
  const entry = failures.get(key);
  if (entry && entry.resetAt < Date.now()) failures.delete(key);
  return (failures.get(key)?.count || 0) >= max;
}

function recordFailure(key) {
  const entry = failures.get(key);
  if (entry && entry.resetAt >= Date.now()) entry.count += 1;
  else failures.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
}

async function findAdmin(username) {
  const { rows } = await adminServices().tables.listRows({
    databaseId: APPWRITE.databaseId,
    tableId: ADMIN_TABLES.admins,
    queries: [Query.equal("username", username), Query.limit(1)],
    total: false,
  });
  return rows[0] || null;
}

const sign = (payload, admin) =>
  createHmac("sha256", process.env.APPWRITE_ADMIN_API_KEY).update(`${payload}.${admin.$id}.${admin.passwordHash}`).digest("base64url");

/** The signed-in admin ({ username, lastLoginAt }), or null. */
export async function currentAdmin() {
  if (!adminServices()) return null;
  const [payload, signature = ""] = ((await cookies()).get(COOKIE)?.value || "").split(".");
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof claims?.u !== "string" || !(claims.exp > Date.now())) return null;
  const admin = await findAdmin(claims.u).catch(() => null);
  if (!admin) return null;
  const expected = Buffer.from(sign(payload, admin));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { username: admin.username, lastLoginAt: claims.last ?? null };
}

/** Checks a user ID and password and starts a session; returns an error message on failure. */
export async function signIn(username, password, clientIp) {
  if (!adminServices()) return "The admin page isn’t set up on this server.";
  const ipKey = `ip:${clientIp || "unknown"}`;
  const userKey = `user:${username.toLowerCase()}`;
  if (limited(ipKey, MAX_FAILURES_PER_IP) || limited(userKey, MAX_FAILURES_PER_USER)) {
    return "Too many failed attempts. Try again in 15 minutes.";
  }
  let admin;
  try {
    admin = username ? await findAdmin(username) : null;
  } catch (err) {
    console.error("Admin sign-in: couldn’t read the admins table —", String(err?.message ?? err).slice(0, 200));
    return "Couldn’t check your details just now. Please try again.";
  }
  // Hash even for an unknown user ID, so response times don't reveal which IDs exist.
  const matches = await verifyPassword(password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !matches) {
    recordFailure(ipKey);
    recordFailure(userKey);
    return "Wrong user ID or password.";
  }
  failures.delete(ipKey);
  failures.delete(userKey);

  const payload = Buffer.from(
    JSON.stringify({ u: admin.username, exp: Date.now() + SESSION_MS, last: admin.lastLoginAt ?? null })
  ).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload, admin)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: ADMIN_PATH,
    maxAge: SESSION_MS / 1000,
  });
  await adminServices()
    .tables.updateRow({
      databaseId: APPWRITE.databaseId,
      tableId: ADMIN_TABLES.admins,
      rowId: admin.$id,
      data: { lastLoginAt: new Date().toISOString() },
    })
    .catch((err) => console.warn("Admin sign-in: couldn’t record the login time —", err?.message));
  return null;
}

export async function signOut() {
  (await cookies()).delete({ name: COOKIE, path: ADMIN_PATH });
}
