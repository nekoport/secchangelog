import test from "node:test";
import assert from "node:assert/strict";
import { formatTicketId, migrateLegacyTicketId, planLegacyTicketMigration, NEW_TICKET_PATTERN } from "../../src/lib/security/ticket-id.ts";

test("generates new date-based ticket ids", () => {
  const id = formatTicketId(new Date(2026, 7, 21), 12);
  assert.equal(id, "SOC-20260821-0012");
  assert.match(id, NEW_TICKET_PATTERN);
});

test("legacy migration planning rejects duplicate targets before writes", () => {
  assert.throws(() => planLegacyTicketMigration([{ id: "a", ticketId: "SOC-2026/08/21-0001" }, { id: "b", ticketId: "SOC-2026/08/21-0001" }]));
});

test("migrates only valid legacy ticket ids", () => {
  assert.equal(migrateLegacyTicketId("SOC-2026/08/21-0012"), "SOC-20260821-0012");
  assert.equal(migrateLegacyTicketId("SOC-20260821-0012"), null);
  assert.equal(migrateLegacyTicketId("SOC-2026/8/21-0012"), null);
});
