/**
 * 球员统计数据更新器
 *
 * 根据比赛结果增量更新球员的赛事累计数据：
 * - 进球、助攻、射门等攻击数据
 * - 红黄牌、犯规等纪律数据
 * - 出场时间、首发次数
 * - 逐场记录（matchLog）
 *
 * 更新策略：增量追加 + 全量重算
 * - 从 matchLog 重新计算所有累计数据（保证正确性）
 * - 新比赛的 playerEvents 追加到 matchLog
 */

import fs from "node:fs";
import path from "node:path";
import { fetchLiveMatch, fetchMatchTimeline } from "./fifa-client";
import { applyFifaMatchStats } from "./player-stats-core.js";
import type { MatchPlayerEvent, PlayerMatchLog } from "../src/types";

const DATA_DIR = path.resolve("src/data");
const PUBLIC_DIR = path.resolve("public");

// ============================================================
// 核心逻辑：根据比赛数据更新球员统计
// ============================================================

interface PlayerStatsRecord {
  id: string;
  stats: {
    appearances: number;
    starts: number;
    minutesPlayed: number;
    goals: number;
    penalties: number;
    assists: number;
    shots: number;
    shotsOnTarget: number;
    distanceKm: number;
    yellowCards: number;
    redCards: number;
    foulsCommitted: number;
    foulsSuffered: number;
    offsides: number;
    passes: number;
    passAccuracy?: number;
    tackles: number;
    matchRatings: number[];
  };
  matchLog?: PlayerMatchLog[];
}

interface MatchRecord {
  id: string;
  status: string;
  score: { home: number | null; away: number | null } | null;
  fifaMatchId?: string;
  home: { code: string; name: string };
  away: { code: string; name: string };
  datetime: string;
  playerEvents?: MatchPlayerEvent[];
}

/**
 * 从 matches.json 的 playerEvents 更新所有球员统计
 * 这是主要更新路径（离线/本地数据）
 */
export function updateStatsFromMatches(): {
  updated: number;
  matchesProcessed: number;
} {
  console.log("📊 从比赛数据更新球员统计...");

  const matchesPath = path.join(DATA_DIR, "matches.json");
  const playersPath = path.join(DATA_DIR, "players.json");

  const matchesData = JSON.parse(fs.readFileSync(matchesPath, "utf-8"));
  const playersData = JSON.parse(fs.readFileSync(playersPath, "utf-8"));

  const matches: MatchRecord[] = matchesData.matches || [];
  const players: PlayerStatsRecord[] = playersData.players || [];

  // 只处理已完赛且有球员数据的比赛
  const finishedMatches = matches.filter(
    (m) => m.status === "finished" && m.playerEvents && m.playerEvents.length > 0
  );

  if (finishedMatches.length === 0) {
    console.log("  ⏭  无完赛数据，跳过统计更新");
    return { updated: 0, matchesProcessed: 0 };
  }

  const playerIndex = new Map(players.map((p) => [p.id, p]));
  let updatesApplied = 0;

  for (const match of finishedMatches) {
    if (!match.playerEvents) continue;

    for (const event of match.playerEvents) {
      const player = playerIndex.get(event.playerId);
      if (!player) {
        console.warn(`  ⚠ 球员 ${event.playerId} 不存在，跳过`);
        continue;
      }

      // 初始化 matchLog
      if (!player.matchLog) player.matchLog = [];

      // 检查是否已经记录过这场比赛
      const alreadyLogged = player.matchLog.some((log) => log.matchId === match.id);
      if (alreadyLogged) {
        // 更新已有记录（比赛数据可能有修正）
        const idx = player.matchLog.findIndex((log) => log.matchId === match.id);
        player.matchLog[idx] = eventToMatchLog(event, match);
      } else {
        // 新增记录
        player.matchLog.push(eventToMatchLog(event, match));
        updatesApplied++;
      }
    }
  }

  // 从 matchLog 重新计算所有累计数据（保证正确性）
  for (const player of players) {
    if (!player.matchLog || player.matchLog.length === 0) continue;

    player.stats = recalculateStats(player.matchLog);
  }

  // 写入
  playersData.lastUpdated = new Date().toISOString();
  fs.writeFileSync(playersPath, JSON.stringify(playersData, null, 2));

  console.log(`  ✅ 更新了 ${updatesApplied} 条球员比赛记录`);
  console.log(`  📊 处理了 ${finishedMatches.length} 场比赛`);

  return { updated: updatesApplied, matchesProcessed: finishedMatches.length };
}

/**
 * 从 FIFA API 获取比赛球员统计并更新
 */
export async function updateStatsFromFifa(): Promise<{ updated: number } | null> {
  const { isApiConfigured } = await import("./fifa-client");
  if (!isApiConfigured()) {
    console.log("⏭  FIFA API 未配置，跳过在线统计更新");
    return null;
  }

  console.log("📡 从 FIFA API 获取球员比赛统计...");

  const matchesData = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "matches.json"), "utf-8")
  );
  const matches = matchesData.matches || [];

  // 找出已完赛的比赛
  const finishedMatches = matches.filter((m: any) => m.status === "finished");
  if (finishedMatches.length === 0) {
    console.log("  ⏭  无完赛比赛");
    return null;
  }

  const playersData = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "players.json"), "utf-8")
  );
  const players = playersData.players || [];

  let totalUpdated = 0;

  for (const match of finishedMatches) {
    const fifaMatchId = match.fifaMatchId || match.id;
    const [liveData, timelineData] = await Promise.all([
      fetchLiveMatch(fifaMatchId),
      fetchMatchTimeline(fifaMatchId),
    ]);
    if (!liveData || !timelineData) continue;

    const result = applyFifaMatchStats({
      players,
      match,
      liveData,
      timelineData,
    });
    playersData.players = result.players;
    match.playerEvents = result.playerEvents;
    totalUpdated += result.updatedPlayers;
  }

  if (totalUpdated === 0) {
    console.log(`  ✅ FIFA 统计更新: 0 条球员记录`);
    return { updated: 0 };
  }

  // 写入
  matchesData.lastUpdated = new Date().toISOString();
  fs.writeFileSync(
    path.join(DATA_DIR, "matches.json"),
    JSON.stringify(matchesData, null, 2)
  );
  fs.writeFileSync(
    path.join(PUBLIC_DIR, "matches.json"),
    JSON.stringify(matchesData, null, 2)
  );

  playersData.lastUpdated = new Date().toISOString();
  fs.writeFileSync(
    path.join(DATA_DIR, "players.json"),
    JSON.stringify(playersData, null, 2)
  );

  console.log(`  ✅ FIFA 统计更新: ${totalUpdated} 条球员记录`);
  return { updated: totalUpdated };
}

// ============================================================
// 工具函数
// ============================================================

function eventToMatchLog(event: MatchPlayerEvent, match: MatchRecord): PlayerMatchLog {
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

function recalculateStats(matchLog: PlayerMatchLog[]): PlayerStatsRecord["stats"] {
  const stats: PlayerStatsRecord["stats"] = {
    appearances: matchLog.length,
    starts: matchLog.filter((m) => m.isStart).length,
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
    tackles: 0,
    matchRatings: [],
  };

  for (const log of matchLog) {
    stats.minutesPlayed += log.minutesPlayed;
    stats.goals += log.goals;
    stats.assists += log.assists;
    stats.shots += log.shots;
    stats.shotsOnTarget += log.shotsOnTarget;
    stats.foulsCommitted += log.foulsCommitted || 0;
    stats.offsides += log.offsides || 0;
    if (log.yellowCard) stats.yellowCards++;
    if (log.redCard) stats.redCards++;
    if (log.rating) stats.matchRatings.push(log.rating);
  }

  // 估算跑动距离（每分钟约 100-130m）
  stats.distanceKm = Math.round(stats.minutesPlayed * 0.115 * 10) / 10;

  return stats;
}

/**
 * 生成球员统计摘要报告
 */
export function printStatsReport(): void {
  const playersPath = path.join(DATA_DIR, "players.json");
  const playersData = JSON.parse(fs.readFileSync(playersPath, "utf-8"));
  const players = playersData.players || [];

  // 射手榜 Top 5
  const topScorers = players
    .filter((p: any) => p.stats.goals > 0)
    .sort((a: any, b: any) => b.stats.goals - a.stats.goals)
    .slice(0, 5);

  // 黄牌榜 Top 5
  const topCards = players
    .filter((p: any) => p.stats.yellowCards > 0 || p.stats.redCards > 0)
    .sort((a: any, b: any) => b.stats.yellowCards + b.stats.redCards * 2 - a.stats.yellowCards - a.stats.redCards * 2)
    .slice(0, 5);

  // 出场时间 Top 5
  const topMinutes = players
    .filter((p: any) => p.stats.minutesPlayed > 0)
    .sort((a: any, b: any) => b.stats.minutesPlayed - a.stats.minutesPlayed)
    .slice(0, 5);

  console.log("\n📊 球员统计报告");
  console.log("=" .repeat(50));

  console.log("\n⚽ 射手榜 Top 5:");
  for (const p of topScorers) {
    console.log(`  ${p.name} (${p.team}) - ${p.stats.goals} 球 / ${p.stats.assists} 助攻`);
  }

  console.log("\n🟨 纪律榜 Top 5:");
  for (const p of topCards) {
    console.log(`  ${p.name} (${p.team}) - 🟨 ${p.stats.yellowCards} / 🟥 ${p.stats.redCards}`);
  }

  console.log("\n⏱ 出场时间 Top 5:");
  for (const p of topMinutes) {
    console.log(`  ${p.name} (${p.team}) - ${p.stats.minutesPlayed} 分钟 (${p.stats.appearances} 场)`);
  }

  const totalGoals = players.reduce((s: number, p: any) => s + p.stats.goals, 0);
  const totalCards = players.reduce((s: number, p: any) => s + p.stats.yellowCards + p.stats.redCards, 0);
  console.log(`\n📈 总计: ${totalGoals} 进球 / ${totalCards} 红黄牌`);
}
