/**
 * 竞猜数据存储 — Cloudflare Worker + GitHub 事件方案
 *
 * 公开数据由聚合工作流写入 GitHub 仓库 src/data/bets/index.json。
 * 新投注由 Cloudflare Worker 接收，写入 prediction-submissions 分支的不可变事件。
 *
 * 浏览器只保留用户名和设备标识，不再保存 GitHub Token。
 */

import predictionConfig from "../data/predictions/config.json";

const REPO_OWNER = "martian2035-dev";
const REPO_NAME = "worldcup2026";
const BETS_RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/src/data/bets/index.json`;
const PREDICTION_API_BASE = predictionConfig.apiBase;

// ============================================================
// 类型
// ============================================================

export interface BetRecord {
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

export interface UserRecord {
  username: string;
  beans: number;
  totalBets: number;
  wonBets: number;
  createdAt: string;
  bets: BetRecord[];
}

export interface BetData {
  users: Record<string, UserRecord>;
  lastUpdated: string;
}

export interface MatchOdds {
  match_id: string;
  home_win: number;
  draw: number;
  away_win: number;
}

// ============================================================
// 用户名（仅此项用 localStorage 记住）
// ============================================================

const USERNAME_KEY = "wc2026_user";

export function getSavedUsername(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(USERNAME_KEY) || ""; } catch { return ""; }
}

export function saveUsername(name: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(USERNAME_KEY, name); } catch {}
}

export function clearUsername(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(USERNAME_KEY); } catch {}
}

// ============================================================
// 设备标识
// ============================================================

const DEVICE_KEY = "wc2026_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const next = `device-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, next);
    return next;
  } catch {
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export function hasPredictionApi(): boolean {
  return PREDICTION_API_BASE.length > 0;
}

// ============================================================
// 从 GitHub 读取数据
// ============================================================

export async function fetchBetData(): Promise<BetData> {
  try {
    const res = await fetch(BETS_RAW_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { users: {}, lastUpdated: "" };
  }
}

export async function fetchUserRecord(username: string): Promise<UserRecord | null> {
  const data = await fetchBetData();
  return data.users[username] || null;
}

export async function fetchLeaderboard(): Promise<UserRecord[]> {
  const data = await fetchBetData();
  return Object.values(data.users).sort((a, b) => b.beans - a.beans);
}

// ============================================================
// 提交投注到 GitHub
// ============================================================

export async function placeBet(
  username: string,
  matchId: string,
  matchLabel: string,
  betType: string,
  amount: number,
  odds: number
): Promise<{ success: boolean; message: string }> {
  if (!PREDICTION_API_BASE) {
    return { success: false, message: "竞猜接口尚未配置，请稍后再试" };
  }

  try {
    const res = await fetch(`${PREDICTION_API_BASE}/api/bets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        deviceId: getDeviceId(),
        matchId,
        matchLabel,
        betType,
        amount,
        odds,
        clientTimestamp: new Date().toISOString(),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      return { success: true, message: "投注已提交！稍后可在排行榜看到" };
    }
    return { success: false, message: body.message || `提交失败: HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: `网络错误: ${err.message}` };
  }
}

// ============================================================
// 结算（读取 GitHub 数据 + matches.json 进行结算）
// ============================================================

export interface MatchResult {
  id: string; status: string;
  score: { home: number; away: number } | null;
  home: { name: string }; away: { name: string };
}

export function getMatchResult(match: MatchResult): "home_win" | "draw" | "away_win" | null {
  if (match.status !== "finished" || !match.score) return null;
  if (match.score.home > match.score.away) return "home_win";
  if (match.score.home < match.score.away) return "away_win";
  return "draw";
}

/**
 * 客户端展示用：根据已加载的 betData 和 matches 计算用户的结算后状态
 * 不写入 GitHub（结算由 GitHub Action settle-bets.ts 完成）
 */
export function computeSettledState(
  user: UserRecord,
  matches: MatchResult[]
): { beans: number; wonBets: number; settledBets: BetRecord[] } {
  let beans = user.beans;
  let wonBets = user.wonBets;
  const settledBets = user.bets.map(bet => {
    if (bet.status !== "pending") return bet;
    const match = matches.find(m => m.id === bet.matchId);
    if (!match || match.status !== "finished") return bet;
    const result = getMatchResult(match);
    if (!result) return bet;

    const newStatus: BetRecord["status"] = bet.betType === result ? "won" : "lost";
    const payout = newStatus === "won" ? Math.round(bet.amount * bet.odds) : 0;
    if (newStatus === "won") { beans += payout; wonBets++; }
    return { ...bet, status: newStatus, payout };
  }) as BetRecord[];
  return { beans, wonBets, settledBets };
}

export { REPO_OWNER, REPO_NAME, BETS_RAW_URL };
