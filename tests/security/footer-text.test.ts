import test from "node:test";
import assert from "node:assert/strict";
import { resolveFooterText } from "../../src/lib/security/footer-text.ts";

test("footer text falls back for blank values", () => {
  assert.equal(resolveFooterText("   ", "System X"), "System X");
  assert.equal(resolveFooterText(" Custom ", "System X"), "Custom");
  assert.equal(resolveFooterText(undefined, ""), "SecChangeLog");
});
