/**
 * 世界杯数据抓取脚本
 *
 * 用法: pnpm run fetch-data
 *
 * 赛后从数据源抓取比赛结果、球员统计等数据，
 * 更新 src/data/ 下的 JSON 文件。
 *
 * TODO: 配置具体数据源 (FIFA API / ESPN / SofaScore scraping)
 * 当前为骨架代码，比赛开始前配置具体抓取逻辑。
 */

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("src/data");

interface Match {
  id: string;
  status: string;
  score: { home: number | null; away: number | null };
  stats: any;
}

async function fetchMatchResults(): Promise<Match[]> {
  // TODO: 从 FIFA/ESPN/SofaScore API 抓取比赛结果
  // 示例: const res = await fetch("https://api.fifa.com/v3/...");
  // 返回格式匹配 Match 接口
  console.log("Fetching match results... (source not configured)");
  return [];
}

async function fetchPlayerStats(): Promise<any[]> {
  // TODO: 抓取球员数据
  console.log("Fetching player stats... (source not configured)");
  return [];
}

async function main() {
  console.log("World Cup 2026 - Data Fetch");
  console.log("=" .repeat(40));

  // 1. Fetch match results
  const matchResults = await fetchMatchResults();
  if (matchResults.length > 0) {
    const matchesFile = path.join(DATA_DIR, "matches.json");
    const matches = JSON.parse(fs.readFileSync(matchesFile, "utf-8"));

    for (const result of matchResults) {
      const idx = matches.matches.findIndex((m: Match) => m.id === result.id);
      if (idx >= 0 && matches.matches[idx].status !== "finished") {
        matches.matches[idx].status = result.status;
        matches.matches[idx].score = result.score;
        matches.matches[idx].stats = result.stats;
      }
    }

    matches.lastUpdated = new Date().toISOString();
    fs.writeFileSync(matchesFile, JSON.stringify(matches, null, 2));
    console.log(`Updated ${matchResults.length} matches`);
  }

  // 2. Fetch player stats
  const playerStats = await fetchPlayerStats();
  if (playerStats.length > 0) {
    const playersFile = path.join(DATA_DIR, "players.json");
    fs.writeFileSync(playersFile, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      players: playerStats,
    }, null, 2));
    console.log(`Updated ${playerStats.length} players`);
  }

  console.log("Done!");
}

main().catch(console.error);
