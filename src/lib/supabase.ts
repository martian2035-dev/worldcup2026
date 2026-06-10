import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "placeholder";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }
  return _client;
}

/** 检查 Supabase 是否已配置 */
export function isSupabaseConfigured(): boolean {
  return (
    import.meta.env.PUBLIC_SUPABASE_URL?.length > 0 &&
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.length > 0
  );
}

// Proxy-based lazy supabase client: 所有方法调用时才初始化
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

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
