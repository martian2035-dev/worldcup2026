import assert from "node:assert/strict";
import test from "node:test";

import { rebuildStandingsFromMatches } from "../scripts/standings-core.js";

test("rebuildStandingsFromMatches updates group table and tournament summary", () => {
  const standings = {
    tournamentStats: {
      totalGoals: 0,
      avgGoalsPerMatch: 0,
      totalYellowCards: 0,
      totalRedCards: 0,
      totalAttendance: 0,
    },
    groups: [
      {
        name: "A",
        teams: [
          emptyTeam("MEX", "墨西哥"),
          emptyTeam("RSA", "南非"),
          emptyTeam("KOR", "韩国"),
          emptyTeam("CZE", "捷克"),
        ],
      },
    ],
  };

  const result = rebuildStandingsFromMatches(standings, [
    {
      id: "A01",
      group: "A",
      stage: "group",
      status: "finished",
      home: { code: "MEX", name: "墨西哥" },
      away: { code: "RSA", name: "南非" },
      score: { home: 2, away: 0 },
      attendance: 80824,
      stats: {
        home: { yellowCards: 1, redCards: 1 },
        away: { yellowCards: 1, redCards: 1 },
      },
    },
  ], new Date("2026-06-12T06:00:00+08:00"));

  const mex = result.groups[0].teams.find((team) => team.code === "MEX");
  const rsa = result.groups[0].teams.find((team) => team.code === "RSA");
  assert.deepEqual(
    pickTableFields(mex),
    { played: 1, won: 1, drawn: 0, lost: 0, gf: 2, ga: 0, gd: 2, pts: 3 }
  );
  assert.deepEqual(
    pickTableFields(rsa),
    { played: 1, won: 0, drawn: 0, lost: 1, gf: 0, ga: 2, gd: -2, pts: 0 }
  );
  assert.deepEqual(result.tournamentStats, {
    totalGoals: 2,
    avgGoalsPerMatch: 2,
    totalYellowCards: 2,
    totalRedCards: 2,
    totalAttendance: 80824,
  });
});

function emptyTeam(code, name) {
  return {
    code,
    name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
    qualified: null,
  };
}

function pickTableFields(team) {
  return {
    played: team.played,
    won: team.won,
    drawn: team.drawn,
    lost: team.lost,
    gf: team.gf,
    ga: team.ga,
    gd: team.gd,
    pts: team.pts,
  };
}
