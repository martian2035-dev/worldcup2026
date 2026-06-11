import assert from "node:assert/strict";
import test from "node:test";

import { buildMatchDetailsFromFifa } from "../scripts/match-details-core.js";

test("buildMatchDetailsFromFifa extracts attendance, stats, formations, lineups and substitutions", () => {
  const match = {
    id: "A01",
    home: { code: "MEX", name: "墨西哥" },
    away: { code: "RSA", name: "南非" },
    score: { home: 2, away: 0 },
  };

  const details = buildMatchDetailsFromFifa({
    match,
    liveData: {
      Attendance: "80824",
      HomeTeam: {
        Abbreviation: "MEX",
        IdTeam: "43911",
        Tactics: "4-1-2-3",
        Players: [
          player("429157", "Julian QUINONES", 16, 3, 1),
          player("448051", "Luis CHAVEZ", 18, 2, 2),
        ],
        Substitutions: [
          {
            IdPlayerOff: "429157",
            IdPlayerOn: "448051",
            Minute: "76'",
            IdTeam: "43911",
            PlayerOffName: [{ Locale: "en-GB", Description: "Julian QUINONES" }],
            PlayerOnName: [{ Locale: "en-GB", Description: "Luis CHAVEZ" }],
          },
        ],
        Bookings: [],
      },
      AwayTeam: {
        Abbreviation: "RSA",
        IdTeam: "43883",
        Tactics: "4-4-2",
        Players: [player("395986", "Ronwen WILLIAMS", 1, 0, 1)],
        Substitutions: [],
        Bookings: [],
      },
    },
    timelineData: {
      Event: [
        event(12, "43911", "429157"),
        event(0, "43911", "429157"),
        event(16, "43911", "429157"),
        event(18, "43883", "395986"),
        event(2, "43883", "395986"),
      ],
    },
  });

  assert.equal(details.attendance, 80824);
  assert.deepEqual(details.stats.home, {
    possession: null,
    shots: 1,
    shotsOnTarget: 1,
    corners: 1,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
  });
  assert.equal(details.stats.away.fouls, 1);
  assert.equal(details.stats.away.yellowCards, 1);
  assert.equal(details.lineups.home.formation, "4-1-2-3");
  assert.equal(details.lineups.home.starting.length, 1);
  assert.equal(details.lineups.home.substitutes.length, 1);
  assert.equal(details.lineups.home.substitutions[0].playerOnName, "Luis CHAVEZ");
});

function player(id, name, number, position, status) {
  return {
    IdPlayer: id,
    IdTeam: id.startsWith("3") ? "43883" : "43911",
    ShirtNumber: number,
    Position: position,
    Status: status,
    PlayerName: [{ Locale: "en-GB", Description: name }],
    ShortName: [{ Locale: "en-GB", Description: name }],
  };
}

function event(type, teamId, playerId) {
  return { Type: type, IdTeam: teamId, IdPlayer: playerId, MatchMinute: "9'" };
}
