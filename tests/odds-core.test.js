import test from "node:test";
import assert from "node:assert/strict";
import { createReferenceOdds } from "../scripts/odds/core.js";

test("reference odds follow the worldcup_codex deterministic market shape", () => {
  const odds = createReferenceOdds([{ id: "A01" }, { id: "A02" }], "2026-06-10T00:00:00.000Z");

  assert.equal(odds.length, 2);
  assert.equal(odds[0].match_id, "A01");
  assert.equal(odds[0].bookmaker, "worldcup-codex");
  assert.ok(odds[0].home_win > 1);
  assert.ok(odds[0].draw > 1);
  assert.ok(odds[0].away_win > 1);
  assert.equal(odds[0].updated_at, "2026-06-10T00:00:00.000Z");
});
