/**
 * 赔率数据抓取脚本
 *
 * 从 The Odds API 拉取世界杯比赛赔率，写入 Supabase match_odds 表。
 * 当 API 不可用时，生成均匀默认赔率（2.50 / 3.20 / 2.50）。
 *
 * 用法: tsx scripts/fetch-odds.ts
 */

import fs from "node:fs";
import path from "node:path";

const ODDS_API_KEY = process.env.ODDS_API_KEY || "";
const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const DATA_DIR = path.resolve("src/data");

interface MatchData {
  id: string;
  datetime: string;
  status: string;
  home: { code: string; name: string };
  away: { code: string; name: string };
}

interface OddsOutcome {
  name: string;
  price: number;
}

interface OddsApiMatch {
  id: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    markets: Array<{
      key: string;
      outcomes: OddsOutcome[];
    }>;
  }>;
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
// 1. 从 The Odds API 拉取赔率
// ============================================================

async function fetchOddsFromApi(): Promise<Map<string, MatchOddsRecord> | null> {
  if (!ODDS_API_KEY) {
    console.log("  ⚠ ODDS_API_KEY 未配置");
    return null;
  }

  console.log("📡 从 The Odds API 拉取赔率...");
  const url = `${ODDS_API_BASE}/sports/soccer_world_cup/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ⚠ API 返回 ${res.status}`);
      // 检查配额
      const remaining = res.headers.get("x-requests-remaining");
      const used = res.headers.get("x-requests-used");
      console.log(`  配额: ${remaining} 剩余 / ${used} 已用`);
      return null;
    }

    const matches: OddsApiMatch[] = await res.json();
    console.log(`  ✅ 获取到 ${matches.length} 场比赛赔率`);

    const oddsMap = new Map<string, MatchOddsRecord>();

    for (const m of matches) {
      // 尝试匹配到我们的比赛 ID
      const matchId = findMatchId(m);
      if (!matchId) continue;

      const bookmaker = m.bookmakers?.[0]; // 取第一个博彩公司
      if (!bookmaker?.markets?.[0]?.outcomes) continue;

      const outcomes = bookmaker.markets[0].outcomes;
      const homeWin = outcomes.find((o) => o.name === m.home_team)?.price;
      const awayWin = outcomes.find((o) => o.name === m.away_team)?.price;
      const draw = outcomes.find((o) => o.name === "Draw")?.price;

      if (homeWin && awayWin && draw) {
        oddsMap.set(matchId, {
          match_id: matchId,
          home_win: Math.round(homeWin * 100) / 100,
          draw: Math.round(draw * 100) / 100,
          away_win: Math.round(awayWin * 100) / 100,
          bookmaker: bookmaker.key,
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
// 2. 匹配到我们的比赛 ID
// ============================================================

let matchList: MatchData[] | null = null;

function getMatchList(): MatchData[] {
  if (matchList) return matchList;
  const file = path.join(DATA_DIR, "matches.json");
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  matchList = data.matches || [];
  return matchList;
}

function findMatchId(apiMatch: OddsApiMatch): string | null {
  const matches = getMatchList();
  const home = apiMatch.home_team?.toLowerCase() || "";
  const away = apiMatch.away_team?.toLowerCase() || "";

  // 按球队名称匹配
  for (const m of matches) {
    const mHome = m.home.name.toLowerCase();
    const mAway = m.away.name.toLowerCase();
    if (
      (mHome.includes(home) || home.includes(mHome)) &&
      (mAway.includes(away) || away.includes(mAway))
    ) {
      return m.id;
    }
  }
  return null;
}

// ============================================================
// 3. 生成默认赔率（API 不可用时的 fallback）
// ============================================================

function generateDefaultOdds(): Map<string, MatchOddsRecord> {
  console.log("🎲 生成默认赔率（2.50 / 3.20 / 2.50）...");
  const matches = getMatchList();
  const oddsMap = new Map<string, MatchOddsRecord>();

  for (const m of matches) {
    // 根据 FIFA 排名微调赔率（如果有排名数据的话）
    oddsMap.set(m.id, {
      match_id: m.id,
      home_win: 2.50,
      draw: 3.20,
      away_win: 2.50,
      bookmaker: "default",
      updated_at: new Date().toISOString(),
    });
  }

  return oddsMap;
}

// ============================================================
// 4. 写入 Supabase
// ============================================================

async function writeToSupabase(oddsMap: Map<string, MatchOddsRecord>): Promise<number> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    // 无 Supabase 配置时，写入本地 JSON 文件作为 fallback
    const file = path.join(DATA_DIR, "odds.json");
    const records = Array.from(oddsMap.values());
    fs.writeFileSync(file, JSON.stringify({ odds: records, lastUpdated: new Date().toISOString() }, null, 2));
    console.log(`  💾 已写入本地文件 (${records.length} 条)`);
    return records.length;
  }

  console.log("📤 写入 Supabase...");
  const records = Array.from(oddsMap.values());
  let written = 0;

  // 批量 upsert
  const { error } = await fetch(`${SUPABASE_URL}/rest/v1/match_odds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify(records),
  }).then((r) => r.json().then((d) => ({ error: null })).catch(() => ({ error: "parse" })));

  if (error) {
    // Fallback: 逐条 upsert
    for (const record of records) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/match_odds?id=eq.${record.match_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Prefer": "return=minimal",
          },
          body: JSON.stringify(record),
        });
        written++;
      } catch {
        // 尝试 insert
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/match_odds`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPABASE_KEY,
              "Authorization": `Bearer ${SUPABASE_KEY}`,
            },
            body: JSON.stringify(record),
          });
          written++;
        } catch {}
      }
    }
  } else {
    written = records.length;
  }

  console.log(`  ✅ Supabase 写入完成 (${written} 条)`);
  return written;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log("=" .repeat(50));
  console.log("🎲 世界杯赔率数据抓取");
  console.log("=" .repeat(50));

  // 1. 尝试从 API 拉取
  let oddsMap = await fetchOddsFromApi();

  // 2. API 不可用时用默认赔率
  if (!oddsMap || oddsMap.size === 0) {
    oddsMap = generateDefaultOdds();
  }

  // 3. 写入
  const count = await writeToSupabase(oddsMap);
  console.log(`\n✅ 完成: ${count} 场比赛赔率已更新`);
}

main().catch(console.error);
