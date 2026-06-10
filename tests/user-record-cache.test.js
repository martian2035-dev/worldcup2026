import test from "node:test";
import assert from "node:assert/strict";
import { resolveUserRecordSnapshot } from "../src/lib/user-record-cache.js";

test("keeps a local submitted bet when the remote aggregate is stale", () => {
  const remote = userRecord({ bets: [], beans: 10000 });
  const local = userRecord({
    bets: [betRecord({ id: "bet-new", matchId: "A01", amount: 50 })],
    beans: 9950,
    __clientUpdatedAt: "2026-06-10T12:05:00+08:00",
  });

  const resolved = resolveUserRecordSnapshot(remote, local, "阿北", "2026-06-10T12:00:00+08:00");

  assert.equal(resolved.bets.length, 1);
  assert.equal(resolved.bets[0].id, "bet-new");
  assert.equal(resolved.beans, 9950);
});

test("keeps a local cancellation when the remote aggregate still contains the old bet", () => {
  const remote = userRecord({
    bets: [betRecord({ id: "bet-old", matchId: "A01", amount: 80 })],
    beans: 9920,
  });
  const local = userRecord({
    bets: [],
    beans: 10000,
    __clientUpdatedAt: "2026-06-10T12:05:00+08:00",
  });

  const resolved = resolveUserRecordSnapshot(remote, local, "阿北", "2026-06-10T12:00:00+08:00");

  assert.equal(resolved.bets.length, 0);
  assert.equal(resolved.beans, 10000);
});

test("uses remote aggregate once it includes newer settled data", () => {
  const local = userRecord({
    bets: [betRecord({ id: "bet-old", matchId: "A01", amount: 80 })],
    beans: 9920,
  });
  const remote = userRecord({
    bets: [betRecord({ id: "bet-old", matchId: "A01", amount: 80, status: "won", payout: 146 })],
    beans: 10066,
    wonBets: 1,
  });

  const resolved = resolveUserRecordSnapshot(remote, local, "阿北", "2026-06-10T12:30:00+08:00");

  assert.equal(resolved.bets.length, 1);
  assert.equal(resolved.bets[0].status, "won");
  assert.equal(resolved.beans, 10066);
});

function userRecord(overrides = {}) {
  return {
    username: "阿北",
    beans: 10000,
    totalBets: overrides.bets?.length ?? 0,
    wonBets: 0,
    createdAt: "2026-06-10T12:00:00+08:00",
    bets: [],
    ...overrides,
  };
}

function betRecord(overrides = {}) {
  return {
    id: "bet-1",
    username: "阿北",
    matchId: "A01",
    matchLabel: "墨西哥 vs 南非",
    betType: "home_win",
    amount: 10,
    odds: 1.82,
    status: "pending",
    payout: null,
    createdAt: "2026-06-10T12:00:00+08:00",
    ...overrides,
  };
}
