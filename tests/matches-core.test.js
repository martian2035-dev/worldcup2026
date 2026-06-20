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

test("syncMatchesWithFifa falls back to FIFA group slot when local matchup is wrong", () => {
  const localMatches = [
    {
      id: "B01",
      group: "B",
      stage: "group",
      home: { code: "CAN", name: "加拿大" },
      away: { code: "BIH", name: "波黑" },
      datetime: "2026-06-13T03:00:00+08:00",
      status: "finished",
      score: { home: 1, away: 1 },
      venue: { name: "Existing", city: "Existing" },
    },
    {
      id: "B02",
      group: "B",
      stage: "group",
      home: { code: "QAT", name: "卡塔尔" },
      away: { code: "SUI", name: "瑞士" },
      datetime: "2026-06-14T03:00:00+08:00",
      status: "finished",
      score: { home: 1, away: 1 },
      venue: { name: "Existing", city: "Existing" },
    },
    {
      id: "B03",
      group: "B",
      stage: "group",
      home: { code: "BIH", name: "波黑" },
      away: { code: "QAT", name: "卡塔尔" },
      datetime: "2026-06-20T03:00:00+08:00",
      status: "upcoming",
      score: { home: null, away: null },
      venue: { name: "Old Stadium", city: "Old City" },
    },
  ];

  const fifaMatches = [
    {
      IdMatch: "400021449",
      Date: "2026-06-12T19:00:00Z",
      GroupName: [{ Locale: "zh-CN", Description: "B 组" }],
      MatchNumber: 3,
      Home: { Abbreviation: "CAN", Score: 1 },
      Away: { Abbreviation: "BIH", Score: 1 },
      ResultType: 1,
      MatchTime: "97'",
      OfficialityStatus: 1,
      Stadium: { Name: "Existing", CityName: "Existing" },
    },
    {
      IdMatch: "400021447",
      Date: "2026-06-13T19:00:00Z",
      GroupName: [{ Locale: "zh-CN", Description: "B 组" }],
      MatchNumber: 8,
      Home: { Abbreviation: "QAT", Score: 1 },
      Away: { Abbreviation: "SUI", Score: 1 },
      ResultType: 1,
      MatchTime: "98'",
      OfficialityStatus: 1,
      Stadium: { Name: "Existing", CityName: "Existing" },
    },
    {
      IdMatch: "400021446",
      Date: "2026-06-18T19:00:00Z",
      GroupName: [{ Locale: "zh-CN", Description: "B 组" }],
      MatchNumber: 26,
      Home: {
        Abbreviation: "SUI",
        Score: 4,
        TeamName: [{ Locale: "zh-CN", Description: "瑞士" }],
      },
      Away: {
        Abbreviation: "BIH",
        Score: 1,
        TeamName: [{ Locale: "zh-CN", Description: "波黑" }],
      },
      ResultType: 1,
      Winner: "43971",
      MatchTime: "98'",
      OfficialityStatus: 1,
      Stadium: {
        Name: [{ Locale: "en-GB", Description: "Toronto Stadium" }],
        CityName: [{ Locale: "zh-CN", Description: "多伦多" }],
      },
    },
  ];

  const result = syncMatchesWithFifa(localMatches, fifaMatches);

  assert.ok(result.updated >= 1);
  const updated = result.matches.find((match) => match.id === "B03");
  assert.equal(updated.fifaMatchId, "400021446");
  assert.equal(updated.datetime, "2026-06-19T03:00:00+08:00");
  assert.deepEqual(updated.home, { code: "SUI", name: "瑞士" });
  assert.deepEqual(updated.away, { code: "BIH", name: "波黑" });
  assert.equal(updated.status, "finished");
  assert.deepEqual(updated.score, { home: 4, away: 1 });
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
