import { useState, useEffect, useCallback } from "react";
import {
  getSavedUsername, fetchUserRecord, computeSettledState,
  type UserRecord, type BetRecord, type MatchResult,
} from "../lib/store";

const BASE = import.meta.env.BASE_URL || "";

export default function MinePage({ matchData }: { matchData?: string }) {
  const preloadMatches: MatchResult[] = (() => {
    try { return matchData ? JSON.parse(matchData) : []; } catch { return []; }
  })();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const loadData = useCallback(async () => {
    const name = getSavedUsername();
    if (!name) { setLoading(false); return; }

    try {
      // 加载比赛数据用于本地结算展示
      const userData = await fetchUserRecord(name);

      let matches: MatchResult[] = preloadMatches;
      if (matches.length === 0) {
        try {
          const res = await fetch(`${BASE}/matches.json`);
          const data = await res.json();
          matches = data.matches || [];
        } catch {}
      }

      if (userData) {
        const settled = computeSettledState(userData, matches);
        setUser({ ...userData, beans: settled.beans, wonBets: settled.wonBets });
        setBets(settled.settledBets.reverse());
        if (settled.settledBets.some((b, i) => b.status !== (userData.bets[i]?.status || "pending"))) {
          setMsg("💡 结算数据来自本地计算，最终结果以 GitHub 为准");
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>加载中...</div>;

  if (!user) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
      请先 <a href={`${BASE}/bet/`} style={{ color: "var(--color-accent)" }}>登录</a> 查看竞猜记录
    </div>
  );

  const statusStyle = (s: string): { color: string; label: string } => {
    switch (s) {
      case "won": return { color: "#43A047", label: "✅ 赢" };
      case "lost": return { color: "#E53935", label: "❌ 输" };
      case "refunded": return { color: "#FFA000", label: "↩ 退还" };
      default: return { color: "var(--color-text-muted)", label: "⏳ 待定" };
    }
  };

  return (
    <div>
      {msg && <div style={{ textAlign: "center", padding: 6, color: "var(--color-text-muted)", fontSize: 11, marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14 }}>
          <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>🫘 {user.beans.toLocaleString()}</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 11, marginLeft: 6 }}>{user.username}</span>
          <button onClick={loadData} style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 10, marginLeft: 6 }}>🔄</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
          共 {bets.length} 注 · 赢 {bets.filter(b => b.status === "won").length} 注
        </div>
      </div>

      {bets.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
          还没有投注记录，<a href={`${BASE}/bet/`} style={{ color: "var(--color-accent)" }}>去竞猜</a>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {bets.map(b => {
            const ss = statusStyle(b.status);
            return (
              <div key={b.id} style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{b.matchLabel}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {b.betType === "home_win" ? "主胜" : b.betType === "away_win" ? "客胜" : "平局"} @ {Number(b.odds).toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>🫘 {b.amount}</div>
                  <div style={{ fontSize: 11, color: ss.color }}>{ss.label}{b.payout != null ? ` → 🫘${b.payout}` : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
