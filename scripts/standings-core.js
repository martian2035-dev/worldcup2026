export function rebuildStandingsFromMatches(standingsData, matches, now = new Date()) {
  const groups = cloneGroups(standingsData.groups || []);
  const teamsByCode = new Map();

  for (const group of groups) {
    for (const team of group.teams) {
      resetTeam(team);
      teamsByCode.set(team.code, team);
    }
  }

  const finishedMatches = matches.filter((match) => isFinishedGroupMatch(match, now));

  for (const match of finishedMatches) {
    const home = teamsByCode.get(match.home?.code);
    const away = teamsByCode.get(match.away?.code);
    const homeScore = Number(match.score?.home);
    const awayScore = Number(match.score?.away);
    if (!home || !away || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;

    applyResult(home, homeScore, awayScore);
    applyResult(away, awayScore, homeScore);
  }

  for (const group of groups) {
    group.teams.sort(compareStandingTeams);
  }
  markQualifiedTeams(groups);

  return {
    ...standingsData,
    lastUpdated: now.toISOString(),
    tournamentStats: buildTournamentStats(matches, now),
    groups,
  };
}

function cloneGroups(groups) {
  return groups.map((group) => ({
    ...group,
    teams: group.teams.map((team) => ({ ...team })),
  }));
}

function resetTeam(team) {
  team.played = 0;
  team.won = 0;
  team.drawn = 0;
  team.lost = 0;
  team.gf = 0;
  team.ga = 0;
  team.gd = 0;
  team.pts = 0;
  team.qualified = null;
}

function markQualifiedTeams(groups) {
  const completedGroups = groups.filter((group) => isGroupComplete(group));
  const thirdPlacedTeams = [];

  for (const group of completedGroups) {
    if (group.teams[0]) group.teams[0].qualified = "round32";
    if (group.teams[1]) group.teams[1].qualified = "round32";
    if (group.teams[2]) thirdPlacedTeams.push(group.teams[2]);
  }

  if (completedGroups.length !== groups.length) return;

  thirdPlacedTeams
    .sort(compareStandingTeams)
    .slice(0, 8)
    .forEach((team) => {
      team.qualified = "round32";
    });
}

function isGroupComplete(group) {
  return group.teams.length > 0 && group.teams.every((team) => team.played >= 3);
}

function applyResult(team, goalsFor, goalsAgainst) {
  team.played += 1;
  team.gf += goalsFor;
  team.ga += goalsAgainst;
  team.gd = team.gf - team.ga;

  if (goalsFor > goalsAgainst) {
    team.won += 1;
    team.pts += 3;
  } else if (goalsFor === goalsAgainst) {
    team.drawn += 1;
    team.pts += 1;
  } else {
    team.lost += 1;
  }
}

function buildTournamentStats(matches, now) {
  const finished = matches.filter((match) => isFinishedMatch(match, now));
  const totalGoals = finished.reduce(
    (sum, match) => sum + Number(match.score?.home || 0) + Number(match.score?.away || 0),
    0
  );
  const totalYellowCards = finished.reduce(
    (sum, match) => sum + Number(match.stats?.home?.yellowCards || 0) + Number(match.stats?.away?.yellowCards || 0),
    0
  );
  const totalRedCards = finished.reduce(
    (sum, match) => sum + Number(match.stats?.home?.redCards || 0) + Number(match.stats?.away?.redCards || 0),
    0
  );
  const totalAttendance = finished.reduce((sum, match) => sum + Number(match.attendance || 0), 0);

  return {
    totalGoals,
    avgGoalsPerMatch: finished.length ? roundOne(totalGoals / finished.length) : 0,
    totalYellowCards,
    totalRedCards,
    totalAttendance,
  };
}

function isFinishedGroupMatch(match, now) {
  return match.stage === "group" && isFinishedMatch(match, now);
}

function isFinishedMatch(match, now) {
  if (match.status !== "finished") return false;
  if (!Number.isFinite(Number(match.score?.home)) || !Number.isFinite(Number(match.score?.away))) return false;
  if (!match.datetime) return true;
  const kickoff = new Date(match.datetime).getTime();
  return Number.isNaN(kickoff) || kickoff <= now.getTime();
}

function compareStandingTeams(a, b) {
  return (
    b.pts - a.pts ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name, "zh-CN")
  );
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}
