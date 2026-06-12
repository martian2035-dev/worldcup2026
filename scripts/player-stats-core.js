const POSITION_LABELS = ["GK", "DF", "MF", "FW"];

export function applyFifaMatchStats({ players, match, liveData, timelineData }) {
  const nextPlayers = players.map((player) => clone(player));
  clearMatchLogs(nextPlayers, match.id);
  const playerIndex = buildPlayerIndex(nextPlayers);
  const matchMinutes = parseMinute(liveData?.MatchTime) || 90;
  const teamCodes = buildTeamCodeMap(liveData, match);
  const eventStats = collectEventStats(timelineData?.Event || []);
  const appearances = collectAppearances(liveData, matchMinutes);
  const fifaPlayers = collectFifaPlayers(liveData, teamCodes);
  const playerEvents = [];
  let updatedPlayers = 0;

  for (const fifaPlayer of fifaPlayers) {
    const appearance = appearances.get(fifaPlayer.fifaId);
    if (!appearance) continue;

    let player = findOrCreatePlayer(nextPlayers, playerIndex, fifaPlayer);
    player = enrichPlayer(player, fifaPlayer);

    const stats = eventStats.get(fifaPlayer.fifaId) || emptyEventStats();
    const event = {
      playerId: player.id,
      team: player.team,
      minutesPlayed: appearance.minutesPlayed,
      isStart: appearance.isStart,
      goals: stats.goals,
      assists: stats.assists,
      shots: stats.shots,
      shotsOnTarget: stats.shotsOnTarget,
      yellowCard: stats.yellowCards > 0,
      redCard: stats.redCards > 0,
      rating: null,
      foulsCommitted: stats.foulsCommitted,
      offsides: stats.offsides,
    };

    upsertMatchLog(player, eventToMatchLog(event, match));
    player.stats = recalculateStats(player.matchLog || []);
    playerEvents.push(event);
    updatedPlayers++;
  }

  return { players: nextPlayers, playerEvents, updatedPlayers };
}

function collectFifaPlayers(liveData, teamCodes) {
  const players = [];
  for (const side of ["HomeTeam", "AwayTeam"]) {
    const team = liveData?.[side];
    if (!team?.Players?.length) continue;
    const teamCode = teamCodes.get(team.IdTeam) || team.Abbreviation;

    for (const raw of team.Players) {
      const rawNameEn = getLocalizedTextEn(raw.PlayerName) || getLocalizedTextEn(raw.ShortName);
      const rawNameZh = getLocalizedTextZh(raw.PlayerName) || getLocalizedTextZh(raw.ShortName);
      const displayName = rawNameZh && rawNameZh !== rawNameEn
        ? `${rawNameEn} / ${rawNameZh}`
        : rawNameEn;

      players.push({
        fifaId: raw.IdPlayer,
        fifaTeamId: raw.IdTeam || team.IdTeam,
        team: teamCode,
        name: displayName,
        nameEn: rawNameEn,
        shortName: getLocalizedTextEn(raw.ShortName) || rawNameEn,
        number: raw.ShirtNumber,
        position: POSITION_LABELS[raw.Position] || "FW",
        photoUrl: raw.PlayerPicture?.PictureUrl || "",
        status: raw.Status,
      });
    }
  }
  return players;
}

function collectAppearances(liveData, matchMinutes) {
  const appearances = new Map();

  for (const side of ["HomeTeam", "AwayTeam"]) {
    const team = liveData?.[side];
    if (!team?.Players?.length) continue;

    for (const player of team.Players) {
      if (player.Status === 1) {
        appearances.set(player.IdPlayer, {
          isStart: true,
          startMinute: 0,
          endMinute: matchMinutes,
        });
      }
    }

    for (const sub of team.Substitutions || []) {
      const minute = parseMinute(sub.Minute);
      const outgoing = appearances.get(sub.IdPlayerOff);
      if (outgoing) outgoing.endMinute = Math.min(outgoing.endMinute, minute);

      appearances.set(sub.IdPlayerOn, {
        isStart: false,
        startMinute: minute,
        endMinute: matchMinutes,
      });
    }
  }

  for (const value of appearances.values()) {
    value.minutesPlayed = Math.max(0, value.endMinute - value.startMinute);
  }

  return appearances;
}

function collectEventStats(events) {
  const stats = new Map();

  for (const event of events) {
    if (!event.IdPlayer) continue;
    const entry = getOrCreateEventStats(stats, event.IdPlayer);

    switch (event.Type) {
      case 0:
        entry.goals++;
        entry.shotsOnTarget++;
        break;
      case 1:
        entry.assists++;
        break;
      case 2:
        entry.yellowCards++;
        break;
      case 3:
        entry.redCards++;
        break;
      case 12:
        entry.shots++;
        break;
      case 15:
        entry.offsides++;
        break;
      case 18:
        entry.foulsCommitted++;
        break;
    }
  }

  return stats;
}

function buildPlayerIndex(players) {
  const byFifaId = new Map();
  const byNameEn = new Map();

  for (const player of players) {
    const canonicalFifaId = getCanonicalFifaId(player);
    if (canonicalFifaId) byFifaId.set(canonicalFifaId, player);
    const nameKey = normalizeNameKey(player.nameEn);
    if (nameKey) byNameEn.set(nameKey, player);
  }

  return { byFifaId, byNameEn };
}

function findOrCreatePlayer(players, index, fifaPlayer) {
  // 主匹配：fifaId
  let player = index.byFifaId.get(fifaPlayer.fifaId);

  if (player) {
    player.fifaId = fifaPlayer.fifaId;
    index.byFifaId.set(fifaPlayer.fifaId, player);
    return player;
  }

  // 次匹配：nameEn 归一化
  const nameKey = normalizeNameKey(fifaPlayer.nameEn);
  if (nameKey) {
    player = index.byNameEn.get(nameKey);
    if (player) {
      player.fifaId = fifaPlayer.fifaId;
      index.byFifaId.set(fifaPlayer.fifaId, player);
      return player;
    }
  }

  // 创建新球员
  player = {
    id: `fifa-${fifaPlayer.fifaId}`,
    fifaId: fifaPlayer.fifaId,
    name: fifaPlayer.name || fifaPlayer.nameEn || `Player ${fifaPlayer.fifaId}`,
    nameEn: fifaPlayer.nameEn || fifaPlayer.name || `Player ${fifaPlayer.fifaId}`,
    team: fifaPlayer.team,
    position: fifaPlayer.position,
    number: fifaPlayer.number || 0,
    isStar: false,
    stats: emptyTournamentStats(),
    photoUrl: fifaPlayer.photoUrl || "",
    dataSource: "fifa",
    matchLog: [],
  };
  players.push(player);
  index.byFifaId.set(fifaPlayer.fifaId, player);
  return player;
}

function getCanonicalFifaId(player) {
  if (/^\d+$/.test(String(player.id))) return String(player.id);
  if (player.fifaId && player.id === `fifa-${player.fifaId}`) return player.fifaId;
  return null;
}

/** 归一化 nameEn 用于匹配 */
function normalizeNameKey(name) {
  if (!name) return "";
  return name.toLowerCase().trim().replace(/\s+/g, " ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function enrichPlayer(player, fifaPlayer) {
  player.fifaId = fifaPlayer.fifaId;
  player.fifaTeamId = fifaPlayer.fifaTeamId;
  player.nameEn = fifaPlayer.nameEn || player.nameEn || player.name;
  // 优先使用双语名
  player.name = fifaPlayer.name || player.name || player.nameEn;
  player.team = fifaPlayer.team || player.team;
  player.position = fifaPlayer.position || player.position;
  player.number = fifaPlayer.number || player.number;
  player.photoUrl = fifaPlayer.photoUrl || player.photoUrl || "";
  player.dataSource = player.dataSource === "generated" ? "fifa" : player.dataSource || "fifa";
  player.stats ||= emptyTournamentStats();
  player.matchLog ||= [];
  return player;
}

function upsertMatchLog(player, nextLog) {
  player.matchLog ||= [];
  const index = player.matchLog.findIndex((log) => log.matchId === nextLog.matchId);
  if (index >= 0) {
    player.matchLog[index] = nextLog;
  } else {
    player.matchLog.push(nextLog);
  }
}

function clearMatchLogs(players, matchId) {
  for (const player of players) {
    if (!player.matchLog?.length) continue;
    player.matchLog = player.matchLog.filter((log) => log.matchId !== matchId);
    player.stats = recalculateStats(player.matchLog);
  }
}

function eventToMatchLog(event, match) {
  return {
    matchId: match.id,
    date: match.datetime,
    opponent: match.home.code === event.team ? match.away.code : match.home.code,
    minutesPlayed: event.minutesPlayed,
    isStart: event.isStart,
    goals: event.goals,
    assists: event.assists,
    shots: event.shots,
    shotsOnTarget: event.shotsOnTarget,
    yellowCard: event.yellowCard,
    redCard: event.redCard,
    rating: event.rating,
    foulsCommitted: event.foulsCommitted,
    offsides: event.offsides,
  };
}

function recalculateStats(matchLog) {
  const stats = emptyTournamentStats();
  stats.appearances = matchLog.length;
  stats.starts = matchLog.filter((m) => m.isStart).length;

  for (const log of matchLog) {
    stats.minutesPlayed += log.minutesPlayed || 0;
    stats.goals += log.goals || 0;
    stats.assists += log.assists || 0;
    stats.shots += log.shots || 0;
    stats.shotsOnTarget += log.shotsOnTarget || 0;
    stats.foulsCommitted += log.foulsCommitted || 0;
    stats.offsides += log.offsides || 0;
    if (log.yellowCard) stats.yellowCards++;
    if (log.redCard) stats.redCards++;
    if (log.rating) stats.matchRatings.push(log.rating);
  }

  stats.distanceKm = Math.round(stats.minutesPlayed * 0.115 * 10) / 10;
  return stats;
}

function buildTeamCodeMap(liveData, match) {
  const map = new Map();
  if (liveData?.HomeTeam?.IdTeam) {
    map.set(liveData.HomeTeam.IdTeam, match.home.code || liveData.HomeTeam.Abbreviation);
  }
  if (liveData?.AwayTeam?.IdTeam) {
    map.set(liveData.AwayTeam.IdTeam, match.away.code || liveData.AwayTeam.Abbreviation);
  }
  return map;
}

function emptyEventStats() {
  return {
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    yellowCards: 0,
    redCards: 0,
    foulsCommitted: 0,
    offsides: 0,
  };
}

function getOrCreateEventStats(stats, playerId) {
  if (!stats.has(playerId)) stats.set(playerId, emptyEventStats());
  return stats.get(playerId);
}

function emptyTournamentStats() {
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

function parseMinute(value) {
  if (!value) return 0;
  const [base, added] = String(value)
    .replace("'", "")
    .split("+")
    .map((part) => Number.parseInt(part, 10) || 0);
  return base + (added || 0);
}

function getLocalizedText(value) {
  if (!Array.isArray(value)) return value || "";
  return (
    value.find((item) => item.Locale === "bilingual")?.Description ||
    value.find((item) => item.Locale === "zh-CN" || item.Locale === "zh")?.Description ||
    value.find((item) => item.Locale === "en-GB" || item.Locale === "en")?.Description ||
    value.find((item) => item.Description)?.Description ||
    ""
  );
}

/** 提取英文名 */
function getLocalizedTextEn(value) {
  if (!Array.isArray(value)) return value || "";
  return (
    value.find((item) => item.Locale === "en-GB" || item.Locale === "en")?.Description ||
    value[0]?.Description ||
    ""
  );
}

/** 提取中文名 */
function getLocalizedTextZh(value) {
  if (!Array.isArray(value)) return value || "";
  return (
    value.find((item) => item.Locale === "zh-CN" || item.Locale === "zh")?.Description ||
    ""
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
