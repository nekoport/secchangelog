import test from "node:test";
import assert from "node:assert/strict";
import { formatDateId, parseDateId, combineDateTimeId } from "../../src/lib/security/date-input.ts";

test("date input uses Indonesian day/month/year", () => {
  assert.equal(formatDateId("2026-08-21"), "21/08/2026");
  assert.equal(parseDateId("21/08/2026"), "2026-08-21");
  assert.equal(parseDateId("31/02/2026"), "");
  assert.equal(combineDateTimeId("21/08/2026", "14:30"), "2026-08-21T14:30");
  assert.equal(combineDateTimeId("21/08/2026", "25:00"), "");
});
