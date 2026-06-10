import { useState, useEffect } from "react";
import { getLocalProfile, getLocalBets, settleLocalBets, type LocalProfile, type LocalBet, type MatchResult } from "../lib/store";

export default function MinePage() {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [bets, setBets] = useState<LocalBet[]>([]);
  const [settled, setSettled] = useState(0);

  useEffect(() => {
    const p = getLocalProfile();
    setProfile(p);
    if (p) refreshBets();
  }, []);

  const refreshBets = async () => {
    try {
      const res = await fetch("/matches.json");
      const data = await res.json();
      const matches: MatchResult[] = data.matches || [];
      const s = settleLocalBets(matches);
      if (s > 0) {
        setSettled(s);
        const updated = getLocalProfile();
        if (updated) setProfile(updated);
      }
    } catch {}
    setBets(getLocalBets());
  };

  if (!profile) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
      请先 <a href="/bet/" style={{ color: "var(--color-accent)" }}>注册</a> 查看竞猜记录
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
      {settled > 0 && <div style={{ textAlign: "center", padding: 8, color: "var(--color-positive)", fontSize: 13, marginBottom: 12 }}>🎉 已自动结算 {settled} 场！</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14 }}>
          <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>🫘 {profile.beans.toLocaleString()}</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 11, marginLeft: 6 }}>{profile.username}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
          共 {bets.length} 注 · 赢 {bets.filter(b => b.status === "won").length} 注
        </div>
      </div>

      {bets.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
          还没有投注记录，<a href="/bet/" style={{ color: "var(--color-accent)" }}>去竞猜</a>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {bets.map(b => {
            const ss = statusStyle(b.status);
            return (
              <div key={b.id} style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    {b.matchLabel} · {new Date(b.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {b.betType === "home_win" ? "主胜" : b.betType === "away_win" ? "客胜" : "平局"} @ {Number(b.odds).toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>🫘 {b.amount}</div>
                  <div style={{ fontSize: 11, color: ss.color }}>
                    {ss.label}{b.payout != null ? ` → 🫘${b.payout}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
