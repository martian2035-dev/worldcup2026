/**
 * 竞猜数据存储 — 纯 GitHub 方案
 *
 * 所有数据存储在 GitHub 仓库 src/data/bets/index.json
 * - 读取：raw.githubusercontent.com
 * - 写入：GitHub workflow_dispatch API
 *
 * 仅保留用户名在内存/localStorage（用于记住登录状态），
 * 余额、投注记录等一律从 GitHub 读取。
 */

const REPO_OWNER = "martian2035-dev";
const REPO_NAME = "worldcup2026";
const BETS_RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/src/data/bets/index.json`;

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
// GitHub Token
// ============================================================

const TOKEN_KEY = "wc2026_gh_token";

export function getGitHubToken(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

export function setGitHubToken(token: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function hasGitHubToken(): boolean {
  return getGitHubToken().length > 0;
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
  const token = getGitHubToken();
  if (!token) {
    return { success: false, message: "未配置 GitHub Token" };
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
          inputs: { username, match_id: matchId, match_label: matchLabel, bet_type: betType, amount: String(amount), odds: String(odds) },
        }),
      }
    );
    if (res.ok || res.status === 204) {
      return { success: true, message: "投注已提交！约 30 秒后可在排行榜看到" };
    }
    return { success: false, message: `提交失败: HTTP ${res.status}` };
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
