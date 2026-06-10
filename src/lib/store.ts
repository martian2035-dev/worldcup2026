/**
 * 竞猜数据存储 — Cloudflare Worker 方案
 *
 * 所有用户数据通过 Cloudflare Worker API 读写：
 * - POST /api/register    注册用户
 * - GET  /api/users/{name} 获取用户档案
 * - GET  /api/leaderboard  排行榜
 * - POST /api/bets         提交投注
 *
 * Worker 不可用时 fallback 到 GitHub raw + 本地缓存。
 */

const REPO_OWNER = "martian2035-dev";
const REPO_NAME = "worldcup2026";
const BETS_RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/src/data/bets/index.json`;

// Worker URL：优先环境变量（CI 构建注入），fallback config.json（本地开发）
import predictionConfig from "../data/predictions/config.json";
const PREDICTION_API_BASE = import.meta.env.PUBLIC_PREDICTION_API_BASE || predictionConfig.apiBase || "";

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
// API 工具
// ============================================================

function apiUrl(path: string): string {
  // 去掉可能的尾部斜杠，避免 double-slash
  const base = PREDICTION_API_BASE.replace(/\/+$/, "");
  return `${base}${path}`;
}

export function hasPredictionApi(): boolean {
  return PREDICTION_API_BASE.length > 0;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  if (!hasPredictionApi()) return null;
  try {
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) {
      console.warn(`Worker API ${path}: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`Worker API ${path}: ${err.message}`);
    return null;
  }
}

// ============================================================
// 用户名 + 本地缓存（仅用于离线恢复）
// ============================================================

const USERNAME_KEY = "wc2026_user";
const USER_CACHE_KEY = "wc2026_user_cache";

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

export function setLocalUserCache(user: UserRecord): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user)); } catch {}
}

export function getLocalUserCache(): UserRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function updateLocalUserCache(updates: Partial<UserRecord> & { username: string }): void {
  const cached = getLocalUserCache();
  const defaults: UserRecord = {
    username: updates.username, beans: 10000, totalBets: 0, wonBets: 0,
    bets: [], createdAt: new Date().toISOString(),
  };
  const base = (cached && cached.username === updates.username) ? cached : defaults;
  setLocalUserCache({ ...base, ...updates });
}

export function clearLocalUserCache(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(USER_CACHE_KEY); } catch {}
}

// ============================================================
// 设备标识
// ============================================================

const DEVICE_KEY = "wc2026_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (id) return id;
    id = `device-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

// ============================================================
// Worker API — 写入（注册 + 投注）
// ============================================================

export async function registerUser(username: string): Promise<UserRecord | null> {
  const result = await apiFetch<{ ok: boolean; eventId: string; accountId: string }>("/api/register", {
    method: "POST",
    body: JSON.stringify({ username, deviceId: getDeviceId() }),
  });
  if (result?.ok) {
    // Worker 注册成功后返回本地构造的 user（真实数据由 aggregate 流程写入 bets/index.json）
    const user: UserRecord = {
      username, beans: 10000, totalBets: 0, wonBets: 0,
      createdAt: new Date().toISOString(), bets: [],
    };
    setLocalUserCache(user);
    return user;
  }
  return null;
}

// ============================================================
// 读取 — 从 GitHub bets/index.json（由 aggregate-predictions 工作流聚合）
// ============================================================

export async function fetchBetData(): Promise<BetData> {
  try {
    const res = await fetch(BETS_RAW_URL, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch {}
  return { users: {}, lastUpdated: "" };
}

export async function fetchUserRecord(username: string): Promise<UserRecord | null> {
  // 1. GitHub raw（Worker 写入后由 aggregate 工作流聚合至此）
  const data = await fetchBetData();
  if (data.users[username]) return data.users[username];

  // 2. 本地缓存
  const cached = getLocalUserCache();
  if (cached && cached.username === username) return cached;

  return null;
}

export async function fetchLeaderboard(): Promise<UserRecord[]> {
  const data = await fetchBetData();
  return Object.values(data.users).sort((a, b) => b.beans - a.beans);
}

// ============================================================
// 提交投注
// ============================================================

export async function placeBet(
  username: string,
  matchId: string,
  matchLabel: string,
  betType: string,
  amount: number,
  odds: number
): Promise<{ success: boolean; message: string }> {
  if (!hasPredictionApi()) {
    return { success: false, message: "竞猜接口尚未配置，请稍后再试" };
  }

  try {
    const res = await fetch(apiUrl("/api/bets"), {
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
// 结算
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
