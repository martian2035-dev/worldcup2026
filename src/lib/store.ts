/**
 * 竞猜数据存储
 *
 * 双写策略：
 * - localStorage: 即时反馈，秒级响应
 * - GitHub:   持久化存储 + 真实排行榜
 *
 * GitHub 同步:
 * - 通过 workflow_dispatch API 提交投注到 GitHub Action
 * - Action 将数据写入 src/data/bets/index.json 并提交
 * - 排行榜从 raw.githubusercontent.com 读取真实数据
 */

const REPO_OWNER = "martian2035-dev";
const REPO_NAME = "worldcup2026";
const BETS_RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/src/data/bets/index.json`;

// ============================================================
// 类型
// ============================================================

export interface LocalProfile {
  username: string;
  beans: number;
  totalBets: number;
  wonBets: number;
  createdAt: string;
}

export interface LocalBet {
  id: string;
  matchId: string;
  betType: "home_win" | "draw" | "away_win";
  matchLabel: string;
  amount: number;
  odds: number;
  payout: number | null;
  status: "pending" | "won" | "lost" | "refunded";
  createdAt: string;
  settledAt: string | null;
  synced?: boolean;
}

export interface MatchOdds {
  match_id: string;
  home_win: number;
  draw: number;
  away_win: number;
}

export interface RemoteUser {
  username: string;
  beans: number;
  totalBets: number;
  wonBets: number;
  createdAt: string;
  bets: LocalBet[];
}

export interface RemoteBetData {
  users: Record<string, RemoteUser>;
  lastUpdated: string;
}

// ============================================================
// localStorage 操作
// ============================================================

const LK = { profile: "wc2026_profile", bets: "wc2026_bets", token: "wc2026_gh_token" };

export function getLocalProfile(): LocalProfile | null {
  try {
    const raw = localStorage.getItem(LK.profile);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function createLocalProfile(username: string): LocalProfile {
  const p: LocalProfile = { username, beans: 10000, totalBets: 0, wonBets: 0, createdAt: new Date().toISOString() };
  localStorage.setItem(LK.profile, JSON.stringify(p));
  return p;
}

export function updateLocalProfile(updates: Partial<LocalProfile>): LocalProfile | null {
  const p = getLocalProfile();
  if (!p) return null;
  const u = { ...p, ...updates };
  localStorage.setItem(LK.profile, JSON.stringify(u));
  return u;
}

export function clearLocalProfile(): void {
  localStorage.removeItem(LK.profile);
  localStorage.removeItem(LK.bets);
}

export function getLocalBets(): LocalBet[] {
  try {
    const raw = localStorage.getItem(LK.bets);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addLocalBet(bet: Omit<LocalBet, "id" | "createdAt" | "settledAt" | "synced">): LocalBet {
  const bets = getLocalBets();
  const nb: LocalBet = { ...bet, id: "local-" + Date.now().toString(36), createdAt: new Date().toISOString(), settledAt: null, synced: false };
  bets.unshift(nb);
  localStorage.setItem(LK.bets, JSON.stringify(bets));
  return nb;
}

export function updateLocalBet(id: string, updates: Partial<LocalBet>): void {
  const bets = getLocalBets();
  const idx = bets.findIndex(b => b.id === id);
  if (idx >= 0) { bets[idx] = { ...bets[idx], ...updates }; localStorage.setItem(LK.bets, JSON.stringify(bets)); }
}

// ============================================================
// GitHub 同步
// ============================================================

export function getGitHubToken(): string {
  return localStorage.getItem(LK.token) || "";
}

export function setGitHubToken(token: string): void {
  localStorage.setItem(LK.token, token);
}

export function hasGitHubToken(): boolean {
  return getGitHubToken().length > 0;
}

/**
 * 通过 workflow_dispatch 提交投注到 GitHub
 * 需要用户配置 GitHub PAT（仅需 actions:write 权限）
 */
export async function syncBetToGitHub(
  username: string,
  matchId: string,
  matchLabel: string,
  betType: string,
  amount: number,
  odds: number
): Promise<{ success: boolean; message: string }> {
  const token = getGitHubToken();
  if (!token) {
    return { success: false, message: "未配置 GitHub Token，投注仅保存在本地" };
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/accept-bet.yml/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            username,
            match_id: matchId,
            match_label: matchLabel,
            bet_type: betType,
            amount: String(amount),
            odds: String(odds),
          },
        }),
      }
    );

    if (res.ok || res.status === 204) {
      return { success: true, message: "投注已提交！30 秒后出现在排行榜" };
    }
    return { success: false, message: `同步失败: HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: `网络错误: ${err.message}` };
  }
}

/**
 * 从 GitHub 读取真实排行榜数据
 */
export async function fetchRemoteLeaderboard(): Promise<RemoteUser[]> {
  try {
    const res = await fetch(BETS_RAW_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const data: RemoteBetData = await res.json();
    return Object.values(data.users || {}).sort((a, b) => b.beans - a.beans);
  } catch {
    return [];
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

/** 本地结算 */
export function settleLocalBets(matches: MatchResult[]): number {
  const bets = getLocalBets();
  const profile = getLocalProfile();
  if (!profile) return 0;

  const mm = new Map(matches.map(m => [m.id, m]));
  let settled = 0;

  for (const bet of bets) {
    if (bet.status !== "pending") continue;
    const match = mm.get(bet.matchId);
    if (!match || match.status !== "finished") continue;
    const result = getMatchResult(match);
    if (!result) continue;

    bet.status = bet.betType === result ? "won" : "lost";
    bet.payout = bet.betType === result ? Math.round(bet.amount * bet.odds) : 0;
    bet.settledAt = new Date().toISOString();
    if (bet.status === "won") { profile.beans += bet.payout!; profile.wonBets++; }
    settled++;
  }

  localStorage.setItem(LK.bets, JSON.stringify(bets));
  localStorage.setItem(LK.profile, JSON.stringify(profile));
  return settled;
}

export { REPO_OWNER, REPO_NAME, BETS_RAW_URL };
