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

test("syncMatchesWithFifa prefers group slot over stale exact team matchup", () => {
  const localMatches = [
    {
      id: "L01",
      group: "L",
      stage: "group",
      home: { code: "ENG", name: "英格兰" },
      away: { code: "CRO", name: "克罗地亚" },
      datetime: "2026-06-18T04:00:00+08:00",
      status: "finished",
      score: { home: 4, away: 2 },
    },
    {
      id: "L02",
      group: "L",
      stage: "group",
      home: { code: "ENG", name: "英格兰" },
      away: { code: "CRO", name: "克罗地亚" },
      datetime: "2026-06-18T04:00:00+08:00",
      status: "finished",
      score: { home: 4, away: 2 },
    },
  ];
  const fifaMatches = [
    {
      IdMatch: "400021510",
      Date: "2026-06-17T23:00:00Z",
      GroupName: [{ Locale: "zh-CN", Description: "L 组" }],
      MatchNumber: 21,
      Home: { Abbreviation: "GHA", Score: 1, TeamName: [{ Locale: "zh-CN", Description: "加纳" }] },
      Away: { Abbreviation: "PAN", Score: 0, TeamName: [{ Locale: "zh-CN", Description: "巴拿马" }] },
      ResultType: 1,
      MatchTime: "98'",
      OfficialityStatus: 1,
    },
    {
      IdMatch: "400021507",
      Date: "2026-06-17T20:00:00Z",
      GroupName: [{ Locale: "zh-CN", Description: "L 组" }],
      MatchNumber: 22,
      Home: { Abbreviation: "ENG", Score: 4, TeamName: [{ Locale: "zh-CN", Description: "英格兰" }] },
      Away: { Abbreviation: "CRO", Score: 2, TeamName: [{ Locale: "zh-CN", Description: "克罗地亚" }] },
      ResultType: 1,
      MatchTime: "98'",
      OfficialityStatus: 1,
    },
  ];

  const result = syncMatchesWithFifa(localMatches, fifaMatches);

  assert.deepEqual(result.matches.map((match) => [match.id, match.fifaMatchId, match.home.code, match.away.code]), [
    ["L01", "400021510", "GHA", "PAN"],
    ["L02", "400021507", "ENG", "CRO"],
  ]);
});

test("syncMatchesWithFifa replaces stale knockout template with FIFA knockout calendar", () => {
  const localMatches = [
    {
      id: "A01",
      group: "A",
      stage: "group",
      round: 1,
      home: { code: "MEX", name: "墨西哥" },
      away: { code: "RSA", name: "南非" },
      datetime: "2026-06-12T03:00:00+08:00",
      status: "finished",
      score: { home: 2, away: 0 },
      venue: { name: "Azteca", city: "Mexico City" },
    },
    {
      id: "KO32-01",
      group: null,
      stage: "round32",
      round: 1,
      home: { code: "A", name: "A" },
      away: { code: "待定小", name: "待定小组第三" },
      datetime: "2026-07-03T19:00:00+08:00",
      status: "upcoming",
      score: { home: null, away: null },
      venue: { name: "Old", city: "Old" },
    },
    {
      id: "KO32-02",
      group: null,
      stage: "round32",
      round: 1,
      home: { code: "B", name: "B" },
      away: { code: "待定小", name: "待定小组第三" },
      datetime: "2026-07-03T23:00:00+08:00",
      status: "upcoming",
      score: { home: null, away: null },
      venue: { name: "Old", city: "Old" },
    },
  ];

  const fifaMatches = [
    {
      IdMatch: "400021443",
      Date: "2026-06-11T19:00:00Z",
      GroupName: [{ Locale: "zh-CN", Description: "A 组" }],
      MatchNumber: 1,
      StageName: [{ Locale: "zh-CN", Description: "第一阶段" }],
      Home: { Abbreviation: "MEX", Score: 2 },
      Away: { Abbreviation: "RSA", Score: 0 },
      ResultType: 1,
      MatchTime: "98'",
      OfficialityStatus: 1,
      Stadium: { Name: "Azteca", CityName: "Mexico City" },
    },
    {
      IdMatch: "400021518",
      Date: "2026-06-28T19:00:00Z",
      MatchNumber: 73,
      StageName: [{ Locale: "zh-CN", Description: "32强赛" }],
      PlaceHolderA: "2A",
      PlaceHolderB: "2B",
      Home: {
        Abbreviation: "RSA",
        Score: 0,
        TeamName: [{ Locale: "zh-CN", Description: "南非" }],
      },
      Away: {
        Abbreviation: "CAN",
        Score: 1,
        TeamName: [{ Locale: "zh-CN", Description: "加拿大" }],
      },
      ResultType: 1,
      MatchTime: "98'",
      OfficialityStatus: 1,
      Stadium: { Name: "Philadelphia Stadium", CityName: "费城" },
    },
    {
      IdMatch: "400021530",
      Date: "2026-07-04T17:00:00Z",
      MatchNumber: 90,
      StageName: [{ Locale: "zh-CN", Description: "16 强" }],
      PlaceHolderA: "W73",
      PlaceHolderB: "W75",
      Home: {
        Abbreviation: "CAN",
        Score: null,
        TeamName: [{ Locale: "zh-CN", Description: "加拿大" }],
      },
      Away: null,
      Stadium: { Name: "New York New Jersey Stadium", CityName: "纽约新泽西" },
    },
  ];

  const result = syncMatchesWithFifa(localMatches, fifaMatches);
  const knockout = result.matches.filter((match) => match.stage !== "group");

  assert.equal(knockout.length, 2);
  assert.deepEqual(
    knockout.map((match) => [match.id, match.stage, match.fifaMatchId, match.home.code, match.away.code, match.datetime]),
    [
      ["KO32-01", "round32", "400021518", "RSA", "CAN", "2026-06-29T03:00:00+08:00"],
      ["KO16-01", "round16", "400021530", "CAN", "W75", "2026-07-05T01:00:00+08:00"],
    ]
  );
  assert.deepEqual(knockout[0].score, { home: 0, away: 1 });
  assert.equal(knockout[1].away.name, "W75胜者");
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
