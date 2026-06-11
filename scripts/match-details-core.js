const POSITION_LABELS = new Map([
  [0, "门将"],
  [1, "后卫"],
  [2, "中场"],
  [3, "前锋"],
]);

export function buildMatchDetailsFromFifa({ match, liveData, timelineData }) {
  const homeTeam = liveData?.HomeTeam;
  const awayTeam = liveData?.AwayTeam;
  const homeCode = match.home?.code;
  const awayCode = match.away?.code;
  const homeTeamId = homeTeam?.IdTeam;
  const awayTeamId = awayTeam?.IdTeam;

  return {
    attendance: parseNumber(liveData?.Attendance),
    stats: buildTeamStats({
      events: timelineData?.Event || [],
      homeTeamId,
      awayTeamId,
    }),
    lineups: {
      home: buildTeamLineup(homeTeam, homeCode),
      away: buildTeamLineup(awayTeam, awayCode),
    },
  };
}

export function applyFifaMatchDetails(match, liveData, timelineData) {
  const details = buildMatchDetailsFromFifa({ match, liveData, timelineData });
  return {
    ...match,
    attendance: details.attendance ?? match.attendance ?? null,
    stats: details.stats || match.stats || null,
    lineups: details.lineups || match.lineups || null,
  };
}

function buildTeamStats({ events, homeTeamId, awayTeamId }) {
  const home = emptyStats();
  const away = emptyStats();

  for (const event of events) {
    const bucket = event.IdTeam === homeTeamId ? home : event.IdTeam === awayTeamId ? away : null;
    if (!bucket) continue;

    if (event.Type === 12) bucket.shots += 1;
    if (event.Type === 0) bucket.shotsOnTarget += 1;
    if (event.Type === 57) {
      const attackingBucket = bucket === home ? away : home;
      attackingBucket.shotsOnTarget += 1;
    }
    if (event.Type === 16) bucket.corners += 1;
    if (event.Type === 18) bucket.fouls += 1;
    if (event.Type === 2) bucket.yellowCards += 1;
    if (event.Type === 3) bucket.redCards += 1;
  }

  home.shotsOnTarget = Math.min(home.shotsOnTarget, home.shots);
  away.shotsOnTarget = Math.min(away.shotsOnTarget, away.shots);
  return { home, away };
}

function buildTeamLineup(team, code) {
  const players = Array.isArray(team?.Players) ? team.Players : [];
  const normalized = players.map((player) => normalizeLineupPlayer(player, code));

  return {
    formation: team?.Tactics || null,
    starting: normalized.filter((player) => player.status === 1),
    substitutes: normalized.filter((player) => player.status !== 1),
    substitutions: (team?.Substitutions || []).map((item) => ({
      minute: item.Minute || "",
      playerOffId: item.IdPlayerOff ? `fifa-${item.IdPlayerOff}` : null,
      playerOnId: item.IdPlayerOn ? `fifa-${item.IdPlayerOn}` : null,
      playerOffName: getLocalizedText(item.PlayerOffName) || "",
      playerOnName: getLocalizedText(item.PlayerOnName) || "",
    })),
  };
}

function normalizeLineupPlayer(player, code) {
  return {
    id: `fifa-${player.IdPlayer}`,
    fifaId: player.IdPlayer,
    name: getLocalizedText(player.PlayerName) || getLocalizedText(player.ShortName) || `#${player.ShirtNumber}`,
    shortName: getLocalizedText(player.ShortName) || getLocalizedText(player.PlayerName) || `#${player.ShirtNumber}`,
    team: code,
    number: Number(player.ShirtNumber) || 0,
    position: POSITION_LABELS.get(Number(player.Position)) || "球员",
    positionCode: Number(player.Position),
    status: Number(player.Status),
    captain: Boolean(player.Captain),
    photoUrl: player.PlayerPicture?.PictureUrl || null,
  };
}

function emptyStats() {
  return {
    possession: null,
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
  };
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getLocalizedText(value) {
  if (!Array.isArray(value)) return value || null;
  return (
    value.find((item) => item.Locale === "zh-CN")?.Description ||
    value.find((item) => item.Locale === "en-GB")?.Description ||
    value.find((item) => item.Description)?.Description ||
    null
  );
}
