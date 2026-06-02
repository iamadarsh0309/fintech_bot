import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import { settings } from "../src/config.js";
import {
  createAccessToken,
  decodeAccessToken,
  getPasswordHash,
  verifyPassword,
} from "../src/services/security.js";

test("password hash is not plaintext and verifies", () => {
  const hashed = getPasswordHash("s3cret-pass");
  assert.notEqual(hashed, "s3cret-pass");
  assert.equal(verifyPassword("s3cret-pass", hashed), true);
});

test("verifyPassword rejects the wrong password", () => {
  const hashed = getPasswordHash("correct-horse");
  assert.equal(verifyPassword("wrong-horse", hashed), false);
});

test("password hashes are salted and unique", () => {
  const first = getPasswordHash("same-password");
  const second = getPasswordHash("same-password");
  assert.notEqual(first, second);
  assert.ok(verifyPassword("same-password", first));
  assert.ok(verifyPassword("same-password", second));
});

test("createAccessToken roundtrips the subject", () => {
  const token = createAccessToken("user-123");
  const payload = decodeAccessToken(token);
  assert.equal(payload.sub, "user-123");
  assert.ok("exp" in payload);
});

test("createAccessToken encodes an expiry in the future", () => {
  const token = createAccessToken("user-123");
  const payload = jwt.verify(token, settings.jwtSecretKey, {
    algorithms: [settings.jwtAlgorithm],
  });
  assert.ok(payload.exp > 0);
});

test("decodeAccessToken rejects a tampered token", () => {
  const token = createAccessToken("user-123");
  const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
  assert.throws(
    () => decodeAccessToken(tampered),
    (error) => error.statusCode === 401,
  );
});

test("decodeAccessToken rejects garbage", () => {
  assert.throws(
    () => decodeAccessToken("not-a-real-jwt"),
    (error) => error.statusCode === 401,
  );
});

test("decodeAccessToken rejects a token signed with a different secret", () => {
  const foreignToken = jwt.sign({ sub: "intruder" }, "a-different-secret", {
    algorithm: settings.jwtAlgorithm,
  });
  assert.throws(() => decodeAccessToken(foreignToken));
});
