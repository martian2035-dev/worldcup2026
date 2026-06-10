import test from "node:test";
import assert from "node:assert/strict";
import { settlePredictionEvents } from "../scripts/predictions/core.js";

const rules = {
  initialBeans: 10000,
  minimumStake: 10,
  maximumStake: 100,
  closeMinutesBeforeKickoff: 5,
};

const matches = [
  {
    id: "A01",
    datetime: "2026-06-12T03:00:00+08:00",
    status: "upcoming",
    home: { name: "墨西哥" },
    away: { name: "南非" },
    score: { home: null, away: null },
  },
];

const odds = {
  odds: [
    {
      match_id: "A01",
      home_win: 1.82,
      draw: 3.45,
      away_win: 4.4,
    },
  ],
};

test("settles prediction events into the legacy bets index shape", () => {
  const event = betEvent("bet-1", "阿北", "device-a", "home_win", 20, 1.82);
  const result = settlePredictionEvents([event], { rules, matches, odds });

  assert.equal(result.rejections.length, 0);
  assert.equal(result.betData.users["阿北"].beans, 9980);
  assert.equal(result.betData.users["阿北"].totalBets, 1);
  assert.equal(result.betData.users["阿北"].bets[0].matchLabel, "墨西哥 vs 南非");
  assert.equal(result.betData.users["阿北"].bets[0].status, "pending");
});

test("rejects duplicate match bets and stakes over available beans", () => {
  const events = [
    betEvent("bet-1", "阿北", "device-a", "home_win", 100, 1.82),
    betEvent("bet-2", "阿北", "device-a", "draw", 10, 3.45),
    betEvent("bet-3", "小南", "device-b", "away_win", 10100, 4.4),
  ];
  const result = settlePredictionEvents(events, { rules, matches, odds });

  assert.deepEqual(result.rejections.map((item) => item.reason), ["duplicate-match-bet", "amount-out-of-range"]);
  assert.equal(result.betData.users["阿北"].beans, 9900);
});

test("settles finished matches using locked odds", () => {
  const finishedMatches = [{
    ...matches[0],
    status: "finished",
    score: { home: 2, away: 1 },
  }];
  const events = [
    betEvent("bet-1", "阿北", "device-a", "home_win", 100, 1.82),
    betEvent("bet-2", "小南", "device-b", "away_win", 80, 4.4),
  ];
  const result = settlePredictionEvents(events, {
    rules,
    matches: finishedMatches,
    odds,
    now: new Date("2026-06-12T06:00:00+08:00"),
  });

  assert.equal(result.betData.users["阿北"].beans, 10082);
  assert.equal(result.betData.users["阿北"].wonBets, 1);
  assert.equal(result.betData.users["阿北"].bets[0].status, "won");
  assert.equal(result.betData.users["小南"].bets[0].status, "lost");
});

function betEvent(id, username, deviceId, betType, amount, oddsValue) {
  return {
    id,
    type: "bet",
    accountId: `acct-${username}-${deviceId}`,
    username,
    deviceId,
    matchId: "A01",
    matchLabel: "墨西哥 vs 南非",
    betType,
    amount,
    odds: oddsValue,
    clientTimestamp: "2026-06-10T12:00:00+08:00",
    serverTimestamp: "2026-06-10T12:00:00+08:00",
  };
}
