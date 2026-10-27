// Admin passwords are stored as scrypt hashes: "scrypt$N$r$p$<salt>$<hash>" (base64url).
// Plain Node crypto, so the seed script (scripts/seed-admin.mjs) can use it too.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 12;

const derive = (password, salt, { n, r, p }) =>
  new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: n, r, p, maxmem: 256 * n * r }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  );

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { n: N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** True when `password` matches `stored`; false for a wrong password or a malformed hash. */
export async function verifyPassword(password, stored) {
  const [scheme, n, r, p, salt, hash] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const params = { n: Number(n), r: Number(r), p: Number(p) };
  if (![params.n, params.r, params.p].every(Number.isSafeInteger) || params.n > 1 << 20) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(String(password), Buffer.from(salt, "base64url"), params);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A hash to compare against when the user ID is unknown, so both cases take as long. */
export const DUMMY_HASH = `scrypt$${N}$${R}$${P}$AAAAAAAAAAAAAAAAAAAAAA$${"A".repeat(86)}`;
