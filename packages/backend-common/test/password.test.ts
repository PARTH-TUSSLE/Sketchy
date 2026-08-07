import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/index.ts";

test("hashPassword produces a salted hash, never the plaintext", () => {
  const hash = hashPassword("supersecret");
  assert.notEqual(hash, "supersecret");
  assert.ok(hash.includes("$"));
});

test("verifyPassword returns true for the correct password", () => {
  const hash = hashPassword("correct horse");
  assert.equal(verifyPassword("correct horse", hash), true);
});

test("verifyPassword returns false for a wrong password", () => {
  const hash = hashPassword("correct horse");
  assert.equal(verifyPassword("battery staple", hash), false);
});

test("verifyPassword returns false for malformed stored hash", () => {
  assert.equal(verifyPassword("anything", "not-a-valid-hash"), false);
});

test("hashes are unique per plaintext (salting)", () => {
  const a = hashPassword("same");
  const b = hashPassword("same");
  assert.notEqual(a, b);
  assert.equal(verifyPassword("same", a), true);
  assert.equal(verifyPassword("same", b), true);
});