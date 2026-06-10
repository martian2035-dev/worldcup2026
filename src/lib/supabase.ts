import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "";

/** 检查 Supabase 是否已配置 */
export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseUrl !== "https://placeholder.supabase.co"
    && supabaseAnonKey.length > 0 && supabaseAnonKey !== "placeholder";
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder", {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }
  return _client;
}

// 直接导出 getter 函数，每次调用时确保已初始化
export const supabase = {
  get auth() { return getClient().auth; },
  get from() { return getClient().from.bind(getClient()); },
  get channel() { return getClient().channel.bind(getClient()); },
  get removeChannel() { return getClient().removeChannel.bind(getClient()); },
} as unknown as SupabaseClient;

export interface Profile {
  id: string;
  username: string;
  beans: number;
  total_bets: number;
  won_bets: number;
  created_at: string;
}

export interface MatchOdds {
  match_id: string;
  home_win: number;
  draw: number;
  away_win: number;
  bookmaker: string;
  updated_at: string;
}

export interface Bet {
  id: string;
  user_id: string;
  match_id: string;
  bet_type: "home_win" | "draw" | "away_win";
  amount: number;
  odds: number;
  payout: number | null;
  status: "pending" | "won" | "lost" | "refunded";
  settled_at: string | null;
  created_at: string;
}

export interface LeaderboardRow {
  username: string;
  beans: number;
  total_bets: number;
  won_bets: number;
  win_rate: number;
}
