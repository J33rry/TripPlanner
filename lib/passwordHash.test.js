import { test } from "node:test";
import assert from "node:assert/strict";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./passwordHash.js";

test("a hashed password verifies, and a different one doesn't", async () => {
  const stored = await hashPassword("correct horse battery");
  assert.match(stored, /^scrypt\$16384\$8\$1\$[\w-]{22}\$[\w-]{86}$/);
  assert.equal(await verifyPassword("correct horse battery", stored), true);
  assert.equal(await verifyPassword("correct horse batterY", stored), false);
});

test("the same password hashes differently each time", async () => {
  assert.notEqual(await hashPassword("same password!"), await hashPassword("same password!"));
});

test("malformed or missing hashes never verify", async () => {
  for (const stored of [null, "", "plaintext", "bcrypt$x$y", "scrypt$abc$8$1$salt$hash", `scrypt$${2 ** 24}$8$1$AAAA$AAAA`]) {
    assert.equal(await verifyPassword("anything", stored), false);
  }
  assert.equal(await verifyPassword("anything", DUMMY_HASH), false);
});
