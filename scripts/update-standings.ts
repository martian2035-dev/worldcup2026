import fs from "node:fs";
import path from "node:path";
import { rebuildStandingsFromMatches } from "./standings-core.js";

const DATA_DIR = path.resolve("src/data");

export function updateStandingsFromMatches(): { updated: boolean } {
  console.log("📊 重算积分榜和赛事概览...");

  const standingsPath = path.join(DATA_DIR, "standings.json");
  const matchesPath = path.join(DATA_DIR, "matches.json");
  const standingsData = JSON.parse(fs.readFileSync(standingsPath, "utf-8"));
  const matchesData = JSON.parse(fs.readFileSync(matchesPath, "utf-8"));
  const next = rebuildStandingsFromMatches(standingsData, matchesData.matches || []);
  const changed = JSON.stringify(next) !== JSON.stringify(standingsData);

  if (changed) {
    fs.writeFileSync(standingsPath, JSON.stringify(next, null, 2));
  }

  console.log(changed ? "  ✅ 积分榜已更新" : "  ⏭  积分榜无变化");
  return { updated: changed };
}
