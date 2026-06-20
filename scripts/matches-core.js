const MATCH_TIME_TOLERANCE_MS = 6 * 60 * 60 * 1000;

export function toBeijingIsoString(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${beijingTime.toISOString().slice(0, 19)}+08:00`;
}

export function getFifaMatchStatus(raw, now = new Date()) {
  const homeScore = getScore(raw, "home");
  const awayScore = getScore(raw, "away");
  const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);

  if (hasScore && isFinalFifaMatch(raw)) return "finished";
  if (hasScore && isKickoffPast(raw, now)) return "live";
  return "upcoming";
}

export function syncMatchesWithFifa(localMatches, fifaMatches, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const groupSlotIndex = buildFifaGroupSlotIndex(fifaMatches);
  let updated = 0;

  const matches = localMatches.map((match) => {
    const fifaMatch = findFifaMatch(match, fifaMatches) || findFifaGroupSlotMatch(match, groupSlotIndex);
    if (!fifaMatch) return match;

    const next = buildUpdatedMatch(match, fifaMatch, now);
    if (JSON.stringify(next) !== JSON.stringify(match)) updated++;
    return next;
  });

  return { matches, updated };
}

function buildUpdatedMatch(match, fifaMatch, now) {
  const homeScore = getScore(fifaMatch, "home");
  const awayScore = getScore(fifaMatch, "away");
  const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);
  const status = getFifaMatchStatus(fifaMatch, now);
  const homeCode = getTeamCode(fifaMatch, "home");
  const awayCode = getTeamCode(fifaMatch, "away");
  const previousFifaMatchId = match.fifaMatchId;
  const next = {
    ...match,
    fifaMatchId: fifaMatch.IdMatch || match.fifaMatchId,
    group: getFifaGroupCode(fifaMatch) || match.group,
    datetime: fifaMatch.Date ? toBeijingIsoString(fifaMatch.Date) : match.datetime,
    home: {
      code: homeCode || match.home?.code,
      name: getTeamName(fifaMatch, "home") || match.home?.name,
    },
    away: {
      code: awayCode || match.away?.code,
      name: getTeamName(fifaMatch, "away") || match.away?.name,
    },
    status,
    score: hasScore
      ? { home: homeScore, away: awayScore }
      : match.score || { home: null, away: null },
  };

  const stadiumName = getLocalizedText(fifaMatch.Stadium?.Name);
  const cityName = getLocalizedText(fifaMatch.Stadium?.CityName);
  if (stadiumName || cityName) {
    next.venue = {
      ...match.venue,
      name: stadiumName || match.venue?.name,
      city: cityName || match.venue?.city,
    };
  }

  if (previousFifaMatchId && fifaMatch.IdMatch && previousFifaMatchId !== fifaMatch.IdMatch) {
    next.stats = null;
    next.attendance = null;
    delete next.lineups;
    delete next.playerEvents;
  }

  return next;
}

function findFifaMatch(match, fifaMatches) {
  return fifaMatches.find((candidate) => {
    const homeCode = getTeamCode(candidate, "home");
    const awayCode = getTeamCode(candidate, "away");
    if (homeCode !== match.home?.code || awayCode !== match.away?.code) return false;
    if (!candidate.Date || !match.datetime) return true;

    const localTime = new Date(match.datetime).getTime();
    const fifaTime = new Date(candidate.Date).getTime();
    if (Number.isNaN(localTime) || Number.isNaN(fifaTime)) return true;
    return Math.abs(localTime - fifaTime) <= MATCH_TIME_TOLERANCE_MS;
  });
}

function buildFifaGroupSlotIndex(fifaMatches) {
  const byGroup = new Map();

  for (const fifaMatch of fifaMatches) {
    const group = getFifaGroupCode(fifaMatch);
    if (!group) continue;
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(fifaMatch);
  }

  for (const matches of byGroup.values()) {
    matches.sort((a, b) => Number(a.MatchNumber || 0) - Number(b.MatchNumber || 0));
  }

  return byGroup;
}

function findFifaGroupSlotMatch(match, groupSlotIndex) {
  if (match.stage && match.stage !== "group") return null;
  const group = match.group || groupFromMatchId(match.id);
  const slot = slotFromMatchId(match.id);
  if (!group || !slot) return null;

  return groupSlotIndex.get(group)?.[slot - 1] || null;
}

function groupFromMatchId(id) {
  const match = /^([A-L])\d{2}$/.exec(String(id || ""));
  return match?.[1] || null;
}

function slotFromMatchId(id) {
  const match = /^[A-L](\d{2})$/.exec(String(id || ""));
  if (!match) return null;
  const slot = Number(match[1]);
  return Number.isInteger(slot) && slot > 0 ? slot : null;
}

function getTeamCode(raw, side) {
  const team = side === "home" ? raw.Home || raw.HomeTeam : raw.Away || raw.AwayTeam;
  return team?.Abbreviation || team?.IdCountry || team?.IdTeam || null;
}

function getTeamName(raw, side) {
  const team = side === "home" ? raw.Home || raw.HomeTeam : raw.Away || raw.AwayTeam;
  return getLocalizedText(team?.TeamName);
}

function getScore(raw, side) {
  const team = side === "home" ? raw.Home || raw.HomeTeam : raw.Away || raw.AwayTeam;
  const value = team?.Score ?? (side === "home" ? raw.HomeTeamScore : raw.AwayTeamScore);
  return value === null || value === undefined ? null : Number(value);
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

function getFifaGroupCode(raw) {
  const groupName = getLocalizedText(raw.GroupName);
  const match = /^([A-L])\s*组$/i.exec(String(groupName || "").trim());
  return match?.[1]?.toUpperCase() || null;
}

function isKickoffPast(raw, now) {
  if (!raw.Date) return false;
  const kickoff = new Date(raw.Date).getTime();
  return !Number.isNaN(kickoff) && kickoff <= now.getTime();
}

function isFinalFifaMatch(raw) {
  if (raw.ResultType && raw.ResultType > 0) return true;
  if (raw.Winner) return true;
  if (raw.OfficialityStatus === 1 && raw.MatchTime) return true;

  const matchTime = String(raw.MatchTime || "").toLowerCase();
  return matchTime.includes("ft") || matchTime.includes("full") || matchTime.includes("98");
}
