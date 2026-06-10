/**
 * 赔率数据抓取脚本
 *
 * 数据源（按优先级）：
 * 1. The Odds API（需配置 ODDS_API_KEY）
 * 2. worldcup_codex 参考逻辑（基于比赛 ID 的可复现赔率，无 API 依赖）
 *
 * 输出: public/odds.json（前端可直接 fetch）
 *
 * 用法: tsx scripts/fetch-odds.ts
 */

import fs from "node:fs";
import path from "node:path";
import { createReferenceOdds } from "./odds/core.js";

const ODDS_API_KEY = process.env.ODDS_API_KEY || "";
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const DATA_DIR = path.resolve("src/data");
const PUBLIC_DIR = path.resolve("public");

// ============================================================
// 类型
// ============================================================

interface MatchData {
  id: string;
  datetime: string;
  status: string;
  home: { code: string; name: string };
  away: { code: string; name: string };
}

interface MatchOddsRecord {
  match_id: string;
  home_win: number;
  draw: number;
  away_win: number;
  bookmaker: string;
  updated_at: string;
}

// ============================================================
// 1. The Odds API（需要 API Key）
// ============================================================

async function fetchOddsFromApi(): Promise<Map<string, MatchOddsRecord> | null> {
  if (!ODDS_API_KEY) {
    console.log("  ⚠ ODDS_API_KEY 未配置，跳过");
    return null;
  }

  console.log("📡 从 The Odds API 拉取赔率...");
  const url = `${ODDS_API_BASE}/sports/soccer_world_cup/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ⚠ API 返回 ${res.status}`);
      const remaining = res.headers.get("x-requests-remaining");
      const used = res.headers.get("x-requests-used");
      if (remaining) console.log(`  配额: ${remaining} 剩余 / ${used} 已用`);
      return null;
    }

    const apiMatches = await res.json() as any[];
    console.log(`  ✅ 获取到 ${apiMatches.length} 场比赛赔率`);

    const oddsMap = new Map<string, MatchOddsRecord>();
    const matches = loadMatches();

    for (const api of apiMatches) {
      const match = matchByName(matches, api.home_team, api.away_team);
      if (!match) continue;

      const bm = api.bookmakers?.[0];
      if (!bm?.markets?.[0]?.outcomes) continue;

      const o = bm.markets[0].outcomes;
      const homeWin = o.find((x: any) => x.name === api.home_team)?.price;
      const awayWin = o.find((x: any) => x.name === api.away_team)?.price;
      const draw = o.find((x: any) => x.name === "Draw")?.price;

      if (homeWin && awayWin && draw) {
        oddsMap.set(match.id, {
          match_id: match.id,
          home_win: Math.round(homeWin * 100) / 100,
          draw: Math.round(draw * 100) / 100,
          away_win: Math.round(awayWin * 100) / 100,
          bookmaker: bm.key,
          updated_at: new Date().toISOString(),
        });
      }
    }
    return oddsMap.size > 0 ? oddsMap : null;
  } catch (err: any) {
    console.warn(`  ⚠ API 请求失败: ${err.message}`);
    return null;
  }
}

// ============================================================
// 2. worldcup_codex 参考赔率（无需 API）
// ============================================================

function generateReferenceOdds(): Map<string, MatchOddsRecord> {
  console.log("🎲 基于 worldcup_codex 参考逻辑生成赔率...");
  const matches = loadMatches();
  const now = new Date().toISOString();
  const records = createReferenceOdds(matches, now) as MatchOddsRecord[];
  const oddsMap = new Map(records.map((record) => [record.match_id, record]));
  console.log(`  ✅ 推算 ${oddsMap.size} 场比赛赔率`);
  return oddsMap;
}

// ============================================================
// 工具函数
// ============================================================

function loadMatches(): MatchData[] {
  const file = path.join(DATA_DIR, "matches.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")).matches ?? [];
}

function matchByName(matches: MatchData[], home: string, away: string): MatchData | undefined {
  const h = home.toLowerCase();
  const a = away.toLowerCase();
  return matches.find(m =>
    (m.home.name.toLowerCase().includes(h) || h.includes(m.home.name.toLowerCase())) &&
    (m.away.name.toLowerCase().includes(a) || a.includes(m.away.name.toLowerCase()))
  );
}

// ============================================================
// 写入
// ============================================================

function writeOdds(oddsMap: Map<string, MatchOddsRecord>): void {
  const records = Array.from(oddsMap.values());
  const output: any = { odds: records, lastUpdated: new Date().toISOString() };

  // 写入两个位置（运行时读取 public/，脚本也可读 src/data/）
  const publicFile = path.join(PUBLIC_DIR, "odds.json");
  const dataFile = path.join(DATA_DIR, "odds.json");

  fs.writeFileSync(publicFile, JSON.stringify(output, null, 2));
  fs.writeFileSync(dataFile, JSON.stringify(output, null, 2));

  // 统计
  const bookmaker = records[0]?.bookmaker || "unknown";
  console.log(`\n📊 赔率统计 (来源: ${bookmaker})`);
  console.log(`${"─".repeat(50)}`);

  // 打印几场样本
  const matches = loadMatches();
  for (const record of records.slice(0, 8)) {
    const m = matches.find(x => x.id === record.match_id);
    if (m) {
      console.log(`  ${m.home.name} vs ${m.away.name}`);
      console.log(`    主胜 ${record.home_win.toFixed(2)} / 平 ${record.draw.toFixed(2)} / 客胜 ${record.away_win.toFixed(2)}`);
    }
  }
  if (records.length > 8) console.log(`  ... 共 ${records.length} 场`);

  console.log(`\n✅ 已写入 public/odds.json 和 src/data/odds.json`);
}

// ============================================================
// 主流程
// ============================================================

async function main(): Promise<void> {
  console.log(`${"=".repeat(50)}`);
  console.log("🎲 世界杯赔率抓取");
  console.log(`${"=".repeat(50)}`);
  console.log(`⏰ ${new Date().toISOString()}`);
  console.log(`📡 ODDS_API_KEY: ${ODDS_API_KEY ? "已配置" : "未配置"}`);

  // 1. 优先 The Odds API
  let oddsMap = await fetchOddsFromApi();

  // 2. Fallback: worldcup_codex 参考逻辑
  if (!oddsMap || oddsMap.size === 0) {
    oddsMap = generateReferenceOdds();
  }

  // 3. 写入
  writeOdds(oddsMap);
}

main().catch(console.error);
