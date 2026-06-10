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
// API 工具
// ============================================================

function apiUrl(path: string): string {
  return `${PREDICTION_API_BASE}${path}`;
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
// Worker API — 用户
// ============================================================

export async function registerUser(username: string): Promise<UserRecord | null> {
  const result = await apiFetch<{ user: UserRecord }>("/api/register", {
    method: "POST",
    body: JSON.stringify({ username, deviceId: getDeviceId() }),
  });
  if (result?.user) {
    setLocalUserCache(result.user);
    return result.user;
  }
  return null;
}

export async function fetchUserFromWorker(username: string): Promise<UserRecord | null> {
  const result = await apiFetch<{ user: UserRecord }>(`/api/users/${encodeURIComponent(username)}`);
  if (result?.user) {
    setLocalUserCache(result.user);
    return result.user;
  }
  return null;
}

// ============================================================
// Worker API — 排行榜
// ============================================================

export async function fetchLeaderboardFromWorker(): Promise<UserRecord[] | null> {
  return apiFetch<UserRecord[]>("/api/leaderboard");
}

// ============================================================
// 综合读取（Worker 优先 → GitHub fallback → 本地缓存）
// ============================================================

export async function fetchBetData(): Promise<BetData> {
  // 1. Worker
  if (hasPredictionApi()) {
    const leaders = await fetchLeaderboardFromWorker();
    if (leaders && leaders.length > 0) {
      const users: Record<string, UserRecord> = {};
      for (const u of leaders) users[u.username] = u;
      return { users, lastUpdated: new Date().toISOString() };
    }
  }

  // 2. GitHub raw（Worker 不可用时）
  try {
    const res = await fetch(BETS_RAW_URL, { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch {}

  return { users: {}, lastUpdated: "" };
}

export async function fetchUserRecord(username: string): Promise<UserRecord | null> {
  // 1. Worker
  const fromWorker = await fetchUserFromWorker(username);
  if (fromWorker) return fromWorker;

  // 2. GitHub raw
  const data = await fetchBetData();
  if (data.users[username]) return data.users[username];

  // 3. 本地缓存
  const cached = getLocalUserCache();
  if (cached && cached.username === username) return cached;

  return null;
}

export async function fetchLeaderboard(): Promise<UserRecord[]> {
  // 1. Worker
  const fromWorker = await fetchLeaderboardFromWorker();
  if (fromWorker && fromWorker.length > 0) return fromWorker;

  // 2. GitHub raw
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
