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
  let updated = 0;

  const matches = localMatches.map((match) => {
    const fifaMatch = findFifaMatch(match, fifaMatches);
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
  const next = {
    ...match,
    fifaMatchId: fifaMatch.IdMatch || match.fifaMatchId,
    datetime: fifaMatch.Date ? toBeijingIsoString(fifaMatch.Date) : match.datetime,
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

function getTeamCode(raw, side) {
  const team = side === "home" ? raw.Home || raw.HomeTeam : raw.Away || raw.AwayTeam;
  return team?.Abbreviation || team?.IdCountry || team?.IdTeam || null;
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
