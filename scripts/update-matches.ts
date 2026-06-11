import fs from "node:fs";
import path from "node:path";
import { fetchMatches } from "./fifa-client";
import { syncMatchesWithFifa } from "./matches-core.js";

const DATA_DIR = path.resolve("src/data");
const PUBLIC_DIR = path.resolve("public");

export async function updateMatchesFromFifa(): Promise<{ updated: number } | null> {
  console.log("📅 从 FIFA API 更新比赛结果...");

  const fifaMatches = await fetchMatches();
  if (!fifaMatches?.length) {
    console.log("  ⏭  未获取到 FIFA 比赛数据");
    return null;
  }

  const matchesPath = path.join(DATA_DIR, "matches.json");
  const publicMatchesPath = path.join(PUBLIC_DIR, "matches.json");
  const matchesData = JSON.parse(fs.readFileSync(matchesPath, "utf-8"));
  const result = syncMatchesWithFifa(matchesData.matches || [], fifaMatches);

  matchesData.matches = result.matches;
  matchesData.lastUpdated = new Date().toISOString();

  fs.writeFileSync(matchesPath, JSON.stringify(matchesData, null, 2));
  fs.writeFileSync(publicMatchesPath, JSON.stringify(matchesData, null, 2));

  console.log(`  ✅ 比赛结果同步完成: ${result.updated} 场更新`);
  return { updated: result.updated };
}
