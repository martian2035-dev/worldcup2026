import assert from "node:assert/strict";
import test from "node:test";

import {
  getFifaMatchStatus,
  syncMatchesWithFifa,
  toBeijingIsoString,
} from "../scripts/matches-core.js";

test("syncMatchesWithFifa matches FIFA UTC kickoff to local +08 match and updates finished score", () => {
  const localMatches = [
    {
      id: "A01",
      home: { code: "MEX", name: "墨西哥" },
      away: { code: "RSA", name: "南非" },
      datetime: "2026-06-12T03:00:00+08:00",
      status: "upcoming",
      score: { home: null, away: null },
      venue: { name: "Azteca", city: "Mexico City" },
    },
  ];

  const fifaMatches = [
    {
      IdMatch: "400021443",
      Date: "2026-06-11T19:00:00Z",
      Home: { Abbreviation: "MEX", Score: 2 },
      Away: { Abbreviation: "RSA", Score: 0 },
      MatchStatus: 0,
      MatchTime: "98'",
      Winner: "43911",
      ResultType: 1,
      OfficialityStatus: 1,
      Stadium: {
        Name: [{ Locale: "en-GB", Description: "Mexico City Stadium" }],
        CityName: [{ Locale: "zh-CN", Description: "墨西哥城" }],
      },
    },
  ];

  const result = syncMatchesWithFifa(localMatches, fifaMatches);

  assert.equal(result.updated, 1);
  assert.equal(result.matches[0].status, "finished");
  assert.deepEqual(result.matches[0].score, { home: 2, away: 0 });
  assert.equal(result.matches[0].fifaMatchId, "400021443");
  assert.equal(result.matches[0].datetime, "2026-06-12T03:00:00+08:00");
  assert.deepEqual(result.matches[0].venue, {
    name: "Mexico City Stadium",
    city: "墨西哥城",
  });
});

test("getFifaMatchStatus does not treat null-score scheduled matches as finished", () => {
  const status = getFifaMatchStatus({
    Date: "2026-06-12T02:00:00Z",
    Home: { Abbreviation: "KOR", Score: null },
    Away: { Abbreviation: "CZE", Score: null },
    MatchStatus: 1,
  });

  assert.equal(status, "upcoming");
});

test("toBeijingIsoString converts FIFA UTC date to +08:00 display timestamp", () => {
  assert.equal(
    toBeijingIsoString("2026-06-11T19:00:00Z"),
    "2026-06-12T03:00:00+08:00"
  );
});
