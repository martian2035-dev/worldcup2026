import assert from "node:assert/strict";
import test from "node:test";

import { applyFifaMatchStats } from "../scripts/player-stats-core.js";

const match = {
  id: "A01",
  fifaMatchId: "400021443",
  datetime: "2026-06-12T03:00:00+08:00",
  status: "finished",
  home: { code: "MEX", name: "墨西哥" },
  away: { code: "RSA", name: "南非" },
  score: { home: 2, away: 0 },
};

const liveData = {
  IdMatch: "400021443",
  MatchTime: "98'",
  HomeTeam: {
    Abbreviation: "MEX",
    IdTeam: "43911",
    Players: [
      {
        IdPlayer: "429157",
        IdTeam: "43911",
        ShirtNumber: 16,
        Status: 1,
        Position: 3,
        PlayerName: [{ Locale: "en-GB", Description: "Julian QUINONES" }],
        ShortName: [{ Locale: "en-GB", Description: "Julian QUINONES" }],
        PlayerPicture: { PictureUrl: "https://img.example/julian" },
      },
      {
        IdPlayer: "419518",
        IdTeam: "43911",
        ShirtNumber: 6,
        Status: 1,
        Position: 2,
        PlayerName: [{ Locale: "en-GB", Description: "Erik LIRA" }],
        ShortName: [{ Locale: "en-GB", Description: "Erik LIRA" }],
      },
      {
        IdPlayer: "448051",
        IdTeam: "43911",
        ShirtNumber: 18,
        Status: 2,
        Position: 2,
        PlayerName: [{ Locale: "en-GB", Description: "Luis CHAVEZ" }],
        ShortName: [{ Locale: "en-GB", Description: "L.CHAVEZ" }],
      },
    ],
    Substitutions: [
      {
        IdPlayerOff: "419518",
        IdPlayerOn: "448051",
        Minute: "76'",
        IdTeam: "43911",
      },
    ],
    Bookings: [
      { IdPlayer: "448051", Card: 1, Minute: "82'", IdTeam: "43911" },
    ],
  },
  AwayTeam: {
    Abbreviation: "RSA",
    IdTeam: "43883",
    Players: [
      {
        IdPlayer: "395986",
        IdTeam: "43883",
        ShirtNumber: 1,
        Status: 1,
        Position: 0,
        PlayerName: [{ Locale: "en-GB", Description: "Ronwen WILLIAMS" }],
        ShortName: [{ Locale: "en-GB", Description: "WILLIAMS" }],
      },
    ],
    Substitutions: [],
    Bookings: [],
  },
};

const timelineData = {
  IdMatch: "400021443",
  Event: [
    {
      Type: 1,
      IdPlayer: "419518",
      IdTeam: "43911",
      MatchMinute: "9'",
      TypeLocalized: [{ Locale: "en-GB", Description: "Assist" }],
    },
    {
      Type: 12,
      IdPlayer: "429157",
      IdTeam: "43911",
      MatchMinute: "9'",
      TypeLocalized: [{ Locale: "en-GB", Description: "Attempt at Goal" }],
    },
    {
      Type: 0,
      IdPlayer: "429157",
      IdTeam: "43911",
      MatchMinute: "9'",
      TypeLocalized: [{ Locale: "en-GB", Description: "Goal!" }],
    },
    {
      Type: 18,
      IdPlayer: "448051",
      IdTeam: "43911",
      MatchMinute: "83'",
      TypeLocalized: [{ Locale: "en-GB", Description: "Foul" }],
    },
    {
      Type: 2,
      IdPlayer: "448051",
      IdTeam: "43911",
      MatchMinute: "84'",
      TypeLocalized: [{ Locale: "en-GB", Description: "Yellow card" }],
    },
  ],
};

test("applyFifaMatchStats enriches players and records per-match event totals", () => {
  const players = [
    {
      id: "wrong-number-player",
      name: "Santiago Gimenez",
      nameEn: "Santiago Gimenez",
      team: "MEX",
      position: "FW",
      number: 16,
      isStar: false,
      dataSource: "generated",
      stats: emptyStats(),
      matchLog: [],
    },
    {
      id: "erik-lira",
      name: "Erik Lira",
      nameEn: "Erik Lira",
      team: "MEX",
      position: "MF",
      number: 6,
      isStar: false,
      stats: emptyStats(),
      matchLog: [],
    },
  ];

  const result = applyFifaMatchStats({
    players,
    match,
    liveData,
    timelineData,
  });

  assert.equal(result.updatedPlayers, 4);
  assert.equal(result.playerEvents.length, 4);

  const scorer = result.players.find((p) => p.fifaId === "429157");
  assert.ok(scorer);
  assert.equal(scorer.id, "fifa-429157");
  assert.equal(scorer.nameEn, "Julian QUINONES");
  assert.equal(scorer.number, 16);
  assert.equal(scorer.photoUrl, "https://img.example/julian");
  assert.equal(scorer.stats.goals, 1);
  assert.equal(scorer.stats.shots, 1);
  assert.equal(scorer.stats.minutesPlayed, 98);

  const wrongNumberPlayer = result.players.find((p) => p.id === "wrong-number-player");
  assert.equal(wrongNumberPlayer.fifaId, undefined);
  assert.equal(wrongNumberPlayer.stats.goals, 0);

  // erik-lira 现在通过 nameEn 归一化匹配被正确识别为与 FIFA 419518 同一人
  // 保留原有 ID，但 fifaId 和数据已被更新
  const localAssister = result.players.find((p) => p.id === "erik-lira");
  assert.ok(localAssister);
  assert.equal(localAssister.fifaId, "419518"); // nameEn 匹配后更新了 fifaId
  assert.equal(localAssister.stats.assists, 1); // 助攻数据已合并
  assert.equal(localAssister.stats.minutesPlayed, 76);

  const assister = result.players.find((p) => p.fifaId === "419518");
  assert.equal(assister.id, "erik-lira"); // 保留了原 ID，没有创建新 fifa-419518

  const sub = result.players.find((p) => p.fifaId === "448051");
  assert.equal(sub.stats.appearances, 1);
  assert.equal(sub.stats.starts, 0);
  assert.equal(sub.stats.minutesPlayed, 22);
  assert.equal(sub.stats.yellowCards, 1);
  assert.equal(sub.stats.foulsCommitted, 1);
});

test("applyFifaMatchStats replaces an existing match log instead of double-counting", () => {
  const players = [
    {
      id: "fifa-429157",
      fifaId: "429157",
      name: "Julian QUINONES",
      nameEn: "Julian QUINONES",
      team: "MEX",
      position: "FW",
      number: 16,
      isStar: false,
      stats: emptyStats(),
      matchLog: [
        {
          matchId: "A01",
          date: match.datetime,
          opponent: "RSA",
          minutesPlayed: 98,
          isStart: true,
          goals: 3,
          assists: 0,
          shots: 3,
          shotsOnTarget: 3,
          yellowCard: false,
          redCard: false,
          rating: null,
        },
      ],
    },
  ];

  const result = applyFifaMatchStats({ players, match, liveData, timelineData });
  const scorer = result.players.find((p) => p.fifaId === "429157");

  assert.equal(scorer.matchLog.length, 1);
  assert.equal(scorer.stats.goals, 1);
  assert.equal(scorer.stats.shots, 1);
});

test("applyFifaMatchStats removes stale match logs for players no longer in the FIFA match", () => {
  const players = [
    {
      id: "stale-player",
      fifaId: "999999",
      name: "Stale Player",
      nameEn: "Stale Player",
      team: "MEX",
      position: "FW",
      number: 99,
      isStar: false,
      stats: {
        ...emptyStats(),
        appearances: 1,
        goals: 2,
        shots: 2,
        minutesPlayed: 90,
      },
      matchLog: [
        {
          matchId: "A01",
          date: match.datetime,
          opponent: "RSA",
          minutesPlayed: 90,
          isStart: true,
          goals: 2,
          assists: 0,
          shots: 2,
          shotsOnTarget: 2,
          yellowCard: false,
          redCard: false,
          rating: null,
        },
      ],
    },
  ];

  const result = applyFifaMatchStats({ players, match, liveData, timelineData });
  const stale = result.players.find((p) => p.id === "stale-player");

  assert.equal(stale.matchLog.length, 0);
  assert.equal(stale.stats.appearances, 0);
  assert.equal(stale.stats.goals, 0);
});

function emptyStats() {
  return {
    appearances: 0,
    starts: 0,
    minutesPlayed: 0,
    goals: 0,
    penalties: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    distanceKm: 0,
    yellowCards: 0,
    redCards: 0,
    foulsCommitted: 0,
    foulsSuffered: 0,
    offsides: 0,
    passes: 0,
    passAccuracy: null,
    tackles: 0,
    matchRatings: [],
  };
}
