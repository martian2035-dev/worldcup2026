/**
 * 本地数据存储（localStorage）
 *
 * 所有竞猜数据存储在浏览器本地，无需外部后端。
 * 比赛结果和赔率从静态 JSON 文件读取。
 */

const KEYS = {
  profile: "wc2026_profile",
  bets: "wc2026_bets",
};

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
}

export interface MatchOdds {
  match_id: string;
  home_win: number;
  draw: number;
  away_win: number;
}

// ============================================================
// Profile
// ============================================================

export function getProfile(): LocalProfile | null {
  try {
    const raw = localStorage.getItem(KEYS.profile);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function createProfile(username: string): LocalProfile {
  const profile: LocalProfile = {
    username,
    beans: 10000,
    totalBets: 0,
    wonBets: 0,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(KEYS.profile, JSON.stringify(profile));
  return profile;
}

export function updateProfile(updates: Partial<LocalProfile>): LocalProfile | null {
  const profile = getProfile();
  if (!profile) return null;
  const updated = { ...profile, ...updates };
  localStorage.setItem(KEYS.profile, JSON.stringify(updated));
  return updated;
}

export function clearProfile(): void {
  localStorage.removeItem(KEYS.profile);
}

// ============================================================
// Bets
// ============================================================

export function getBets(): LocalBet[] {
  try {
    const raw = localStorage.getItem(KEYS.bets);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addBet(bet: Omit<LocalBet, "id" | "createdAt" | "settledAt">): LocalBet {
  const bets = getBets();
  const newBet: LocalBet = {
    ...bet,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
    settledAt: null,
  };
  bets.unshift(newBet);
  localStorage.setItem(KEYS.bets, JSON.stringify(bets));
  return newBet;
}

export function updateBet(id: string, updates: Partial<LocalBet>): void {
  const bets = getBets();
  const idx = bets.findIndex((b) => b.id === id);
  if (idx >= 0) {
    bets[idx] = { ...bets[idx], ...updates };
    localStorage.setItem(KEYS.bets, JSON.stringify(bets));
  }
}

// ============================================================
// Settlement（客户端结算）
// ============================================================

export interface MatchResult {
  id: string;
  status: string;
  score: { home: number; away: number } | null;
  home: { name: string };
  away: { name: string };
}

export function getMatchResult(match: MatchResult): "home_win" | "draw" | "away_win" | null {
  if (match.status !== "finished" || !match.score) return null;
  if (match.score.home > match.score.away) return "home_win";
  if (match.score.home < match.score.away) return "away_win";
  return "draw";
}

/** 结算所有待处理的投注 */
export function settlePendingBets(matches: MatchResult[]): number {
  const bets = getBets();
  const profile = getProfile();
  if (!profile) return 0;

  const matchMap = new Map(matches.map((m) => [m.id, m]));
  let settled = 0;

  for (const bet of bets) {
    if (bet.status !== "pending") continue;

    const match = matchMap.get(bet.matchId);
    if (!match || match.status !== "finished") continue;

    const result = getMatchResult(match);
    if (!result) continue;

    if (bet.betType === result) {
      bet.status = "won";
      bet.payout = Math.round(bet.amount * bet.odds);
      profile.beans += bet.payout;
      profile.wonBets++;
    } else {
      bet.status = "lost";
      bet.payout = 0;
    }
    bet.settledAt = new Date().toISOString();
    settled++;
  }

  localStorage.setItem(KEYS.bets, JSON.stringify(bets));
  localStorage.setItem(KEYS.profile, JSON.stringify(profile));
  return settled;
}

// ============================================================
// Odds（从静态 JSON 加载）
// ============================================================

export function getDefaultOdds(): MatchOdds {
  return { match_id: "", home_win: 2.50, draw: 3.20, away_win: 2.50 };
}

export function loadOddsFromJson(): Record<string, MatchOdds> {
  // 赔率数据尝试从本地加载，否则用默认值
  try {
    if (typeof window !== "undefined" && (window as any).__WC_ODDS__) {
      return (window as any).__WC_ODDS__;
    }
  } catch {}
  return {};
}
