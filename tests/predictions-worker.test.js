import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvent,
  handleRequest,
  validateCancelPayload,
  validateBetPayload,
  validateRegisterPayload,
} from "../workers/predictions-worker.js";

test("worker accepts nickname registration without client GitHub token", () => {
  const result = validateRegisterPayload({
    username: "阿北2026",
    deviceId: "device-1234567890",
  });

  assert.equal(result.ok, true);
});

test("worker rejects invalid bet payloads before GitHub writes", () => {
  assert.equal(validateBetPayload({ username: "A", deviceId: "device-1234567890" }).reason, "invalid-username");
  assert.equal(validateBetPayload({ username: "阿北", deviceId: "short" }).reason, "invalid-device");
  assert.equal(validateBetPayload({ username: "阿北", deviceId: "device-1234567890", matchId: "bad", betType: "home_win", amount: 20, odds: 1.8 }).reason, "invalid-match");
  assert.equal(validateBetPayload({ username: "阿北", deviceId: "device-1234567890", matchId: "A01", betType: "score", amount: 20, odds: 1.8 }).reason, "invalid-bet-type");
  assert.equal(validateBetPayload({ username: "阿北", deviceId: "device-1234567890", matchId: "A01", betType: "home_win", amount: 5, odds: 1.8 }).reason, "invalid-amount");
});

test("worker creates normalized immutable bet events", () => {
  const event = createEvent("bet", {
    username: " 阿 北 ",
    deviceId: "device-1234567890",
    matchId: "A01",
    matchLabel: "墨西哥 vs 南非",
    betType: "home_win",
    amount: "20",
    odds: "1.82",
    clientTimestamp: "2026-06-10T12:00:00+08:00",
  });

  assert.equal(event.type, "bet");
  assert.equal(event.username, "阿北");
  assert.equal(event.matchId, "A01");
  assert.equal(event.betType, "home_win");
  assert.equal(event.amount, 20);
  assert.equal(event.odds, 1.82);
  assert.match(event.accountId, /^acct-/);
});

test("worker accepts cancel payloads for pending bets", () => {
  const result = validateCancelPayload({
    username: "阿北",
    deviceId: "device-1234567890",
    matchId: "A01",
    betId: "bet-123",
  });

  assert.equal(result.ok, true);
  assert.equal(validateCancelPayload({ username: "阿北", deviceId: "device-1234567890", matchId: "bad", betId: "bet-123" }).reason, "invalid-match");
  assert.equal(validateCancelPayload({ username: "阿北", deviceId: "device-1234567890", matchId: "A01", betId: "" }).reason, "invalid-bet");
});

test("worker creates normalized cancel events", () => {
  const event = createEvent("cancel", {
    username: " 阿 北 ",
    deviceId: "device-1234567890",
    matchId: "A01",
    betId: "bet-123",
    clientTimestamp: "2026-06-10T12:10:00+08:00",
  });

  assert.equal(event.type, "cancel");
  assert.equal(event.username, "阿北");
  assert.equal(event.matchId, "A01");
  assert.equal(event.betId, "bet-123");
  assert.equal(event.betType, undefined);
  assert.equal(event.amount, undefined);
});

test("worker health endpoint supports checks without Origin header", async () => {
  const response = await handleRequest(new Request("https://worker.example/health"), {
    ALLOWED_ORIGIN: "https://martian2035-dev.github.io",
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
});

test("worker reports GitHub write failures as CORS-safe JSON errors", async () => {
  const request = new Request("https://worker.example/api/bets", {
    method: "POST",
    headers: {
      Origin: "https://martian2035-dev.github.io",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: "阿北",
      deviceId: "device-1234567890",
      matchId: "A01",
      matchLabel: "墨西哥 vs 南非",
      betType: "home_win",
      amount: 20,
      odds: 1.82,
    }),
  });

  const response = await handleRequest(request, {
    ALLOWED_ORIGIN: "https://martian2035-dev.github.io",
    GITHUB_OWNER: "martian2035-dev",
    GITHUB_REPO: "worldcup2026",
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://martian2035-dev.github.io");
  assert.equal(body.ok, false);
  assert.equal(body.reason, "github-write-failed");
});
