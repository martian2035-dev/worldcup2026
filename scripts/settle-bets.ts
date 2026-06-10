/**
 * 竞猜结算脚本
 *
 * 检查已完赛比赛的投注记录，根据比赛结果进行结算。
 * 赢取金额 = 投注额 × 赔率（含本金）
 *
 * 用法: tsx scripts/settle-bets.ts
 */

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

interface MatchData {
  id: string;
  status: string;
  score: { home: number; away: number } | null;
  home: { code: string; name: string };
  away: { code: string; name: string };
}

interface BetRecord {
  id: string;
  user_id: string;
  match_id: string;
  bet_type: string;
  amount: number;
  odds: number;
  payout: number | null;
  status: string;
}

interface ProfileRecord {
  id: string;
  beans: number;
}

// ============================================================
// 1. 确定比赛结果
// ============================================================

function getMatchResult(match: MatchData): "home_win" | "draw" | "away_win" | null {
  if (match.status !== "finished" || !match.score) return null;
  if (match.score.home > match.score.away) return "home_win";
  if (match.score.home < match.score.away) return "away_win";
  return "draw";
}

// ============================================================
// 2. 通过 Supabase REST API 操作
// ============================================================

async function supabaseFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function getPendingBets(matchId: string): Promise<BetRecord[]> {
  return supabaseFetch(
    `bets?match_id=eq.${matchId}&status=eq.pending&select=*`
  );
}

async function settleBet(bet: BetRecord, payout: number): Promise<void> {
  await supabaseFetch(`bets?id=eq.${bet.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "won",
      payout,
      settled_at: new Date().toISOString(),
    }),
  });
}

async function loseBet(bet: BetRecord): Promise<void> {
  await supabaseFetch(`bets?id=eq.${bet.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "lost",
      payout: 0,
      settled_at: new Date().toISOString(),
    }),
  });
}

async function refundBet(bet: BetRecord): Promise<void> {
  await supabaseFetch(`bets?id=eq.${bet.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "refunded",
      payout: bet.amount,
      settled_at: new Date().toISOString(),
    }),
  });
}

async function getUserProfile(userId: string): Promise<ProfileRecord | null> {
  const profiles = await supabaseFetch(`profiles?id=eq.${userId}&select=id,beans`);
  return profiles?.[0] || null;
}

async function updateUserBeans(userId: string, beans: number): Promise<void> {
  await supabaseFetch(`profiles?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ beans }),
  });
}

async function incrementUserStats(userId: string, won: boolean): Promise<void> {
  const profile = await getUserProfile(userId);
  if (!profile) return;

  const data: any = {};
  if (won) {
    data.won_bets = (await getProfileField(userId, "won_bets")) + 1;
  }
  data.total_bets = (await getProfileField(userId, "total_bets")) + 1;

  await supabaseFetch(`profiles?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

async function getProfileField(userId: string, field: string): Promise<number> {
  const profiles = await supabaseFetch(`profiles?id=eq.${userId}&select=${field}`);
  return profiles?.[0]?.[field] || 0;
}

// ============================================================
// 3. 本地模式（无 Supabase 时）
// ============================================================

function settleLocalMode(): { settled: number } {
  console.log("ℹ 使用本地模式（无 Supabase 配置）");
  console.log("  结算逻辑: 读取 matches.json → 查找完赛比赛 → 对比投注");

  const matchesPath = path.join("src/data", "matches.json");
  const matches: MatchData[] = JSON.parse(fs.readFileSync(matchesPath, "utf-8")).matches;
  const finishedMatches = matches.filter((m) => m.status === "finished" && m.score);

  for (const match of finishedMatches) {
    const result = getMatchResult(match);
    if (result) {
      console.log(`  ${match.id} → ${result} (${match.score!.home}-${match.score!.away})`);
    }
  }

  return { settled: finishedMatches.length };
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log("=" .repeat(50));
  console.log("💰 竞猜结算系统");
  console.log("=" .repeat(50));

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    settleLocalMode();
    return;
  }

  // 1. 获取已完赛的比赛
  const matchesPath = path.join("src/data", "matches.json");
  const matches: MatchData[] = JSON.parse(fs.readFileSync(matchesPath, "utf-8")).matches;
  const finishedMatches = matches.filter((m) => m.status === "finished" && m.score);

  console.log(`📋 发现 ${finishedMatches.length} 场已完赛比赛`);

  let totalSettled = 0;
  let totalPayout = 0;

  // 2. 逐场结算
  for (const match of finishedMatches) {
    const result = getMatchResult(match);
    if (!result) continue;

    // 获取该场比赛的 pending 投注
    let bets: BetRecord[];
    try {
      bets = await getPendingBets(match.id);
    } catch {
      console.warn(`  ⚠ 无法获取 ${match.id} 的投注记录`);
      continue;
    }

    if (bets.length === 0) continue;

    console.log(`\n🏟 ${match.home.name} ${match.score!.home}-${match.score!.away} ${match.away.name}`);
    console.log(`  结果: ${result} | 待结算: ${bets.length} 注`);

    for (const bet of bets) {
      try {
        if (bet.bet_type === result) {
          // 赢：返本金 + 盈利
          const payout = Math.round(bet.amount * bet.odds);
          await settleBet(bet, payout);

          // 更新用户余额
          const profile = await getUserProfile(bet.user_id);
          if (profile) {
            await updateUserBeans(bet.user_id, profile.beans + payout);
          }
          await incrementUserStats(bet.user_id, true);

          console.log(`  ✅ ${bet.user_id.slice(0,8)} 赢 +${payout} 豆 (投${bet.amount} × ${bet.odds})`);
          totalPayout += payout;
        } else {
          // 输
          await loseBet(bet);
          await incrementUserStats(bet.user_id, false);
          console.log(`  ❌ ${bet.user_id.slice(0,8)} 输 -${bet.amount} 豆`);
        }
        totalSettled++;
      } catch (err: any) {
        console.warn(`  ⚠ 结算失败: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ 结算完成: ${totalSettled} 注 | 总派彩: ${totalPayout} 豆`);
}

main().catch(console.error);
