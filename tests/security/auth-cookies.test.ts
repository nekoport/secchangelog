import test from "node:test";
import assert from "node:assert/strict";
import { getAuthCookieName, isSecureAuthCookie } from "../../src/lib/security/auth-cookies.ts";

test("production auth cookies use __Host and secure", () => {
  assert.equal(getAuthCookieName("csrf-token", true), "__Host-next-auth.csrf-token");
  assert.equal(isSecureAuthCookie(true), true);
});

test("development auth cookies work on HTTP localhost", () => {
  assert.equal(getAuthCookieName("csrf-token", false), "next-auth.csrf-token");
  assert.equal(isSecureAuthCookie(false), false);
});
