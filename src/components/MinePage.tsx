import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured, type Profile, type Bet } from "../lib/supabase";

export default function MinePage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [noSupabase, setNoSupabase] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setNoSupabase(true);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) { setLoading(false); return; }
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).single();
        if (prof) {
          setProfile(prof as Profile);
          const { data: betsData } = await supabase.from("bets").select("*").eq("user_id", (prof as Profile).id).order("created_at", { ascending: false }).limit(100);
          if (betsData) setBets(betsData as Bet[]);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>加载中...</div>;
  if (noSupabase) return <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)", fontSize: 13 }}>需要 <a href="/bet/" style={{ color: "var(--color-accent)" }}>配置 Supabase</a> 后可用</div>;
  if (!profile) return <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>请先 <a href="/bet/" style={{ color: "var(--color-accent)" }}>登录</a> 查看竞猜记录</div>;
  if (!bets.length) return <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>还没有投注记录，<a href="/bet/" style={{ color: "var(--color-accent)" }}>去竞猜</a></div>;

  const statusStyle = (s: string) => {
    switch (s) {
      case "won": return { color: "#43A047", label: "✅ 赢" };
      case "lost": return { color: "#E53935", label: "❌ 输" };
      case "refunded": return { color: "#FFA000", label: "↩ 退还" };
      default: return { color: "var(--color-text-muted)", label: "⏳ 待定" };
    }
  };

  return (
    <div>
      <div style={{ fontSize: 14, marginBottom: 14 }}>
        🫘 <strong style={{ color: "var(--color-accent)" }}>{profile.beans}</strong> 豆 | 共 <strong>{bets.length}</strong> 注
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {bets.map((b) => {
          const ss = statusStyle(b.status);
          return (
            <div key={b.id} style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{new Date(b.created_at).toLocaleDateString("zh-CN")} · {b.match_id}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {b.bet_type === "home_win" ? "主胜" : b.bet_type === "away_win" ? "客胜" : "平局"} @ {Number(b.odds).toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🫘 {b.amount}</div>
                <div style={{ fontSize: 11, color: ss.color }}>{ss.label} {b.payout ? `→ 🫘${b.payout}` : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
