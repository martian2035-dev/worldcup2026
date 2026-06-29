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

test("rebuildStandingsFromMatches marks top two and eight best third-place teams as round32 qualifiers", () => {
  const groupNames = "ABCDEFGHIJKL".split("");
  const standings = {
    tournamentStats: {
      totalGoals: 0,
      avgGoalsPerMatch: 0,
      totalYellowCards: 0,
      totalRedCards: 0,
      totalAttendance: 0,
    },
    groups: groupNames.map((group) => ({
      name: group,
      teams: [1, 2, 3, 4].map((seed) => emptyTeam(`${group}${seed}`, `${group}${seed}`)),
    })),
  };
  const matches = groupNames.flatMap((group) => buildFinishedGroup(group));

  const result = rebuildStandingsFromMatches(standings, matches, new Date("2026-06-29T23:00:00+08:00"));
  const qualified = result.groups.flatMap((group) =>
    group.teams.filter((team) => team.qualified === "round32").map((team) => team.code)
  );

  assert.equal(qualified.length, 32);
  for (const group of groupNames) {
    assert.ok(qualified.includes(`${group}1`));
    assert.ok(qualified.includes(`${group}2`));
  }
  for (const group of groupNames.slice(0, 8)) {
    assert.ok(qualified.includes(`${group}3`));
  }
  for (const group of groupNames.slice(8)) {
    assert.equal(result.groups.find((item) => item.name === group).teams.find((team) => team.code === `${group}3`).qualified, null);
  }
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

function buildFinishedGroup(group) {
  const [first, second, third, fourth] = [1, 2, 3, 4].map((seed) => ({
    code: `${group}${seed}`,
    name: `${group}${seed}`,
  }));

  return [
    groupMatch(group, 1, first, second, 3, 0),
    groupMatch(group, 2, first, third, 2, 0),
    groupMatch(group, 3, first, fourth, 1, 0),
    groupMatch(group, 4, second, third, 2, 0),
    groupMatch(group, 5, second, fourth, 1, 0),
    groupMatch(group, 6, third, fourth, 1, 0),
  ];
}

function groupMatch(group, slot, home, away, homeScore, awayScore) {
  return {
    id: `${group}${String(slot).padStart(2, "0")}`,
    group,
    stage: "group",
    status: "finished",
    datetime: "2026-06-29T19:00:00+08:00",
    home,
    away,
    score: { home: homeScore, away: awayScore },
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
