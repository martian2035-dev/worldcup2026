const MATCH_TIME_TOLERANCE_MS = 6 * 60 * 60 * 1000;
const KNOCKOUT_ID_PREFIX = {
  round32: "KO32",
  round16: "KO16",
  quarterfinal: "QF",
  semifinal: "SF",
  third: "THIRD",
  final: "FINAL",
};

const KNOCKOUT_ROUND = {
  round32: 1,
  round16: 2,
  quarterfinal: 3,
  semifinal: 4,
  third: 5,
  final: 6,
};

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
  const localByFifaMatchId = new Map(
    localMatches.filter((match) => match.fifaMatchId).map((match) => [String(match.fifaMatchId), match])
  );
  let updated = 0;

  const syncedGroupMatches = localMatches.filter((match) => isGroupStage(match)).map((match) => {
    const fifaMatch = findFifaGroupSlotMatch(match, groupSlotIndex) || findFifaMatch(match, fifaMatches);
    if (!fifaMatch) return match;

    const next = buildUpdatedMatch(match, fifaMatch, now);
    if (JSON.stringify(next) !== JSON.stringify(match)) updated++;
    return next;
  });
  const fifaKnockoutMatches = buildFifaKnockoutMatches(fifaMatches, localByFifaMatchId, now);
  const localKnockoutMatches = localMatches.filter((match) => !isGroupStage(match));
  const matches = fifaKnockoutMatches.length
    ? [...syncedGroupMatches, ...fifaKnockoutMatches]
    : [...syncedGroupMatches, ...localKnockoutMatches];

  if (fifaKnockoutMatches.length) {
    const previousById = new Map(localMatches.map((match) => [match.id, match]));
    for (const match of fifaKnockoutMatches) {
      const previous = previousById.get(match.id) || localByFifaMatchId.get(String(match.fifaMatchId));
      if (!previous || JSON.stringify(previous) !== JSON.stringify(match)) updated++;
    }
    if (localKnockoutMatches.length !== fifaKnockoutMatches.length) {
      updated += Math.abs(localKnockoutMatches.length - fifaKnockoutMatches.length);
    }
  }

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
  if (!isGroupStage(match)) return null;
  const group = match.group || groupFromMatchId(match.id);
  const slot = slotFromMatchId(match.id);
  if (!group || !slot) return null;

  return groupSlotIndex.get(group)?.[slot - 1] || null;
}

function buildFifaKnockoutMatches(fifaMatches, localByFifaMatchId, now) {
  const counters = new Map();

  return fifaMatches
    .map((fifaMatch) => ({ fifaMatch, stage: getFifaStageKey(fifaMatch) }))
    .filter(({ stage }) => stage && stage !== "group")
    .sort((a, b) => compareFifaMatches(a.fifaMatch, b.fifaMatch))
    .map(({ fifaMatch, stage }) => {
      const index = (counters.get(stage) || 0) + 1;
      counters.set(stage, index);
      const existing = localByFifaMatchId.get(String(fifaMatch.IdMatch));
      return buildKnockoutMatch(fifaMatch, stage, index, existing, now);
    });
}

function buildKnockoutMatch(fifaMatch, stage, index, existing, now) {
  const homeScore = getScore(fifaMatch, "home");
  const awayScore = getScore(fifaMatch, "away");
  const hasScore = Number.isFinite(homeScore) && Number.isFinite(awayScore);
  const id = existing?.id || buildKnockoutMatchId(stage, index);

  return {
    ...existing,
    id,
    group: null,
    stage,
    round: KNOCKOUT_ROUND[stage] || existing?.round || 1,
    fifaMatchId: fifaMatch.IdMatch || existing?.fifaMatchId,
    datetime: fifaMatch.Date ? toBeijingIsoString(fifaMatch.Date) : existing?.datetime,
    home: buildFifaSide(fifaMatch, "home"),
    away: buildFifaSide(fifaMatch, "away"),
    venue: buildFifaVenue(fifaMatch, existing?.venue),
    status: getFifaMatchStatus(fifaMatch, now),
    score: hasScore ? { home: homeScore, away: awayScore } : { home: null, away: null },
    stats: existing?.stats || null,
  };
}

function buildKnockoutMatchId(stage, index) {
  const prefix = KNOCKOUT_ID_PREFIX[stage] || "KO";
  if (stage === "final") return "FINAL";
  if (stage === "third") return "THIRD";
  return `${prefix}-${String(index).padStart(2, "0")}`;
}

function buildFifaSide(fifaMatch, side) {
  const code = getTeamCode(fifaMatch, side);
  const name = getTeamName(fifaMatch, side);
  const placeholder = side === "home" ? fifaMatch.PlaceHolderA : fifaMatch.PlaceHolderB;
  const placeholderCode = normalizePlaceholderCode(placeholder);

  return {
    code: code || placeholderCode || "TBD",
    name: name || formatPlaceholderName(placeholderCode) || "待定",
  };
}

function buildFifaVenue(fifaMatch, previousVenue) {
  const stadiumName = getLocalizedText(fifaMatch.Stadium?.Name);
  const cityName = getLocalizedText(fifaMatch.Stadium?.CityName);
  return {
    ...previousVenue,
    name: stadiumName || previousVenue?.name || "待定",
    city: cityName || previousVenue?.city || "待定",
  };
}

function compareFifaMatches(a, b) {
  return (
    Number(a.MatchNumber || 0) - Number(b.MatchNumber || 0) ||
    new Date(a.Date || 0).getTime() - new Date(b.Date || 0).getTime()
  );
}

function isGroupStage(match) {
  return !match.stage || match.stage === "group";
}

function getFifaStageKey(raw) {
  const stageName = String(getLocalizedText(raw.StageName) || "").replace(/\s+/g, "");
  if (!stageName || stageName.includes("第一阶段") || stageName.toLowerCase() === "group") return "group";
  if (stageName.includes("32强")) return "round32";
  if (stageName.includes("16强")) return "round16";
  if (stageName.includes("四分之一") || stageName.toLowerCase().includes("quarter")) return "quarterfinal";
  if (stageName.includes("半决赛") || stageName.toLowerCase().includes("semi")) return "semifinal";
  if (stageName.includes("第三名") || stageName.toLowerCase().includes("third")) return "third";
  if (stageName === "决赛" || stageName.toLowerCase() === "final") return "final";
  return null;
}

function normalizePlaceholderCode(value) {
  if (value === null || value === undefined) return null;
  const code = String(value).trim();
  return code || null;
}

function formatPlaceholderName(code) {
  if (!code) return null;

  const groupRank = /^([123])([A-L])$/.exec(code);
  if (groupRank) return `${groupRank[2]}组第${groupRank[1]}`;

  const thirdGroups = /^3([A-L]{2,})$/.exec(code);
  if (thirdGroups) return `${thirdGroups[1].split("").join("/")}组第三`;

  const winner = /^W(\d+)$/.exec(code);
  if (winner) return `W${winner[1]}胜者`;

  const runnerUp = /^RU(\d+)$/.exec(code);
  if (runnerUp) return `${runnerUp[1]}负者`;

  return code;
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
    value.find((item) => item.Locale === "zh")?.Description ||
    value.find((item) => item.Locale === "zh-CN")?.Description ||
    value.find((item) => item.Locale === "en-GB")?.Description ||
    value.find((item) => item.Locale === "en")?.Description ||
    value.find((item) => item.Description)?.Description ||
    null
  );
}

function getFifaGroupCode(raw) {
  const groupName = getLocalizedText(raw.GroupName);
  const normalized = String(groupName || "").trim();
  const zhMatch = /^([A-L])\s*组$/i.exec(normalized);
  if (zhMatch) return zhMatch[1].toUpperCase();
  const enMatch = /^Group\s+([A-L])$/i.exec(normalized);
  return enMatch?.[1]?.toUpperCase() || null;
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
