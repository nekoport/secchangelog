import assert from "node:assert/strict";
import test from "node:test";

import {
  canDeleteScreenshot,
  canLinkScreenshot,
  canManageSystemSettings,
  canModifySystemAdmin,
  canUpdateChangeLog,
  shouldInvalidateSession,
} from "../../src/lib/security/authorization.ts";

test("auditor cannot update a change log", () => {
  assert.equal(
    canUpdateChangeLog({
      role: "AUDITOR",
      userId: "auditor-1",
      createdById: "auditor-1",
      isDeleted: false,
    }),
    false
  );
});

test("engineer can update only their own non-deleted change log", () => {
  assert.equal(
    canUpdateChangeLog({
      role: "ENGINEER",
      userId: "engineer-1",
      createdById: "engineer-1",
      isDeleted: false,
    }),
    true
  );
  assert.equal(
    canUpdateChangeLog({
      role: "ENGINEER",
      userId: "engineer-1",
      createdById: "engineer-2",
      isDeleted: false,
    }),
    false
  );
  assert.equal(
    canUpdateChangeLog({
      role: "ENGINEER",
      userId: "engineer-1",
      createdById: "engineer-1",
      isDeleted: true,
    }),
    false
  );
});

test("admin can update any non-deleted change log", () => {
  assert.equal(
    canUpdateChangeLog({
      role: "ADMIN",
      userId: "admin-1",
      createdById: "engineer-1",
      isDeleted: false,
    }),
    true
  );
});

test("auditor cannot delete screenshots", () => {
  assert.equal(
    canDeleteScreenshot({
      role: "AUDITOR",
      userId: "auditor-1",
      uploadedById: "auditor-1",
      changeLogCreatedById: null,
    }),
    false
  );
});

test("engineer can delete only screenshots they uploaded or attached to their record", () => {
  assert.equal(
    canDeleteScreenshot({
      role: "ENGINEER",
      userId: "engineer-1",
      uploadedById: "engineer-1",
      changeLogCreatedById: null,
    }),
    true
  );
  assert.equal(
    canDeleteScreenshot({
      role: "ENGINEER",
      userId: "engineer-1",
      uploadedById: "engineer-2",
      changeLogCreatedById: "engineer-2",
    }),
    false
  );
});

test("linking accepts own orphan upload and rejects attached or foreign upload", () => {
  assert.equal(
    canLinkScreenshot({
      role: "ENGINEER",
      userId: "engineer-1",
      uploadedById: "engineer-1",
      currentChangeLogId: null,
      targetChangeLogId: "log-1",
    }),
    true
  );
  assert.equal(
    canLinkScreenshot({
      role: "ENGINEER",
      userId: "engineer-1",
      uploadedById: "engineer-2",
      currentChangeLogId: null,
      targetChangeLogId: "log-1",
    }),
    false
  );
  assert.equal(
    canLinkScreenshot({
      role: "ENGINEER",
      userId: "engineer-1",
      uploadedById: "engineer-1",
      currentChangeLogId: "log-2",
      targetChangeLogId: "log-1",
    }),
    false
  );
});

test("only admin can change system settings", () => {
  assert.equal(canManageSystemSettings("ADMIN"), true);
  assert.equal(canManageSystemSettings("SUPERVISOR"), false);
  assert.equal(canManageSystemSettings("ENGINEER"), false);
  assert.equal(canManageSystemSettings("AUDITOR"), false);
});

test("only the absolute system administrator is locked", () => {
  assert.equal(
    canModifySystemAdmin({ isSystemAdmin: false, fields: ["role", "password", "isActive"] }),
    true
  );
  assert.equal(
    canModifySystemAdmin({ isSystemAdmin: true, fields: ["role"] }),
    false
  );
  assert.equal(
    canModifySystemAdmin({ isSystemAdmin: true, fields: ["password"] }),
    false
  );
  assert.equal(
    canModifySystemAdmin({ isSystemAdmin: true, fields: ["name"] }),
    true
  );
});

test("session invalidates when user is disabled or version changes", () => {
  assert.equal(
    shouldInvalidateSession({
      isActive: true,
      tokenSessionVersion: 2,
      userSessionVersion: 2,
    }),
    false
  );
  assert.equal(
    shouldInvalidateSession({
      isActive: false,
      tokenSessionVersion: 2,
      userSessionVersion: 2,
    }),
    true
  );
  assert.equal(
    shouldInvalidateSession({
      isActive: true,
      tokenSessionVersion: 2,
      userSessionVersion: 3,
    }),
    true
  );
});
