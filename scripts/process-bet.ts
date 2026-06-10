/**
 * 投注处理脚本（由 GitHub Action 调用）
 *
 * 读取 bets/index.json，追加新投注，扣减余额，写回。
 */

import fs from "node:fs";
import path from "node:path";

const BETS_FILE = path.resolve("src/data/bets/index.json");

interface BetRecord {
  id: string;
  username: string;
  matchId: string;
  matchLabel: string;
  betType: "home_win" | "draw" | "away_win";
  amount: number;
  odds: number;
  status: "pending" | "won" | "lost" | "refunded";
  payout: number | null;
  createdAt: string;
}

interface UserRecord {
  username: string;
  beans: number;
  totalBets: number;
  wonBets: number;
  createdAt: string;
  bets: BetRecord[];
}

interface BetData {
  users: Record<string, UserRecord>;
  lastUpdated: string;
}

function load(): BetData {
  return JSON.parse(fs.readFileSync(BETS_FILE, "utf-8"));
}

function save(data: BetData): void {
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(BETS_FILE, JSON.stringify(data, null, 2));
}

function main() {
  const inputs = {
    username: process.env.INPUT_USERNAME || "",
    matchId: process.env.INPUT_MATCH_ID || "",
    matchLabel: process.env.INPUT_MATCH_LABEL || "",
    betType: process.env.INPUT_BET_TYPE || "home_win",
    amount: parseInt(process.env.INPUT_AMOUNT || "0", 10),
    odds: parseFloat(process.env.INPUT_ODDS || "2.50"),
  };

  if (!inputs.username || !inputs.matchId || inputs.amount < 10) {
    console.error("❌ 无效的投注数据:", inputs);
    process.exit(1);
  }

  console.log(`📝 处理投注: ${inputs.username} → ${inputs.matchLabel} (${inputs.betType}) 🫘${inputs.amount}`);

  const data = load();

  // 获取或创建用户
  if (!data.users[inputs.username]) {
    data.users[inputs.username] = {
      username: inputs.username,
      beans: 10000,
      totalBets: 0,
      wonBets: 0,
      createdAt: new Date().toISOString(),
      bets: [],
    };
    console.log(`  👤 新用户: ${inputs.username}，赠送 10000 豆`);
  }

  const user = data.users[inputs.username];

  // 检查余额
  if (user.beans < inputs.amount) {
    console.error(`  ❌ 余额不足: ${user.beans} < ${inputs.amount}`);
    process.exit(1);
  }

  // 创建投注记录
  const bet: BetRecord = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    username: inputs.username,
    matchId: inputs.matchId,
    matchLabel: inputs.matchLabel,
    betType: inputs.betType as BetRecord["betType"],
    amount: inputs.amount,
    odds: inputs.odds,
    status: "pending",
    payout: null,
    createdAt: new Date().toISOString(),
  };

  user.bets.push(bet);
  user.beans -= inputs.amount;
  user.totalBets++;

  save(data);
  console.log(`  ✅ 投注完成 | 余额: ${user.beans} | 总注数: ${user.totalBets}`);
}

main();
