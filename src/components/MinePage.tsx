import { useState, useEffect, useCallback } from "react";
import {
  getSavedUsername, getLocalUserCache, updateLocalUserCache,
  fetchUserRecord, computeSettledState, cancelBet as cancelRemoteBet,
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
  const [fromCache, setFromCache] = useState(false);

  const loadData = useCallback(async () => {
    const name = getSavedUsername();
    if (!name) { setLoading(false); return; }

    try {
      let matches: MatchResult[] = preloadMatches;
      if (matches.length === 0) {
        try {
          const res = await fetch(`${BASE}/matches.json`);
          const data = await res.json();
          matches = data.matches || [];
        } catch {}
      }

      // 1. 尝试远程
      const remoteUser = await fetchUserRecord(name);

      // 2. 远程无数据，尝试本地缓存
      let userData = remoteUser;
      if (!userData) {
        const cached = getLocalUserCache();
        if (cached && cached.username === name) {
          userData = cached;
          setFromCache(true);
        }
      }

      if (userData) {
        const settled = computeSettledState(userData, matches);
        setUser({ ...userData, beans: settled.beans, wonBets: settled.wonBets });
        setBets(settled.settledBets.reverse());
      } else {
        // 既无远程也无本地：空状态
        setUser(null);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const cancelBet = async (betId: string) => {
    if (!user) return;
    const bet = user.bets.find(b => b.id === betId);
    if (!bet || bet.status !== "pending") return;

    const result = await cancelRemoteBet(user.username, bet.matchId, bet.id);
    if (!result.success) {
      setMsg("⚠️ " + result.message);
      setTimeout(() => setMsg(""), 5000);
      return;
    }

    const updatedUser: UserRecord = {
      ...user,
      beans: user.beans + bet.amount,
      bets: user.bets.filter(b => b.id !== betId),
    };
    updatedUser.totalBets = updatedUser.bets.length;
    setUser(updatedUser);
    setBets(updatedUser.bets);
    updateLocalUserCache(updatedUser);
    setMsg("↩ " + result.message);
    setTimeout(() => loadData(), 30000);
    setTimeout(() => setMsg(""), 5000);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>加载中...</div>;

  // 有保存的昵称但无用户数据 → 显示空状态
  const savedName = getSavedUsername();
  if (!savedName) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
      请先 <a href={`${BASE}/bet/`} style={{ color: "var(--color-accent)" }}>登录</a> 查看竞猜记录
    </div>
  );

  if (!user || bets.length === 0) return (
    <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>👋 {savedName}，还没有投注记录</div>
      <a href={`${BASE}/bet/`} style={{ color: "var(--color-accent)" }}>去竞猜大厅投注 →</a>
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
      {msg && <div style={{ textAlign: "center", padding: 6, color: msg.includes("↩") ? "var(--color-positive)" : "var(--color-text-muted)", fontSize: 13, marginBottom: 12 }}>{msg}</div>}
      {fromCache && <div style={{ textAlign: "center", padding: 6, color: "var(--color-text-muted)", fontSize: 10, marginBottom: 12 }}>💡 数据来自本地缓存，首次投注后将同步</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14 }}>
          <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>🫘 {user.beans.toLocaleString()}</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 11, marginLeft: 6 }}>{user.username}</span>
          <button onClick={loadData} style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 10, marginLeft: 6 }}>🔄</button>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href={`${BASE}/bet/`} style={{ color: "var(--color-accent)", fontSize: 11, textDecoration: "none" }}>← 返回竞猜大厅</a>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            共 {bets.length} 注 · 赢 {bets.filter(b => b.status === "won").length} 注
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {bets.map(b => {
          const ss = statusStyle(b.status);
          return (
            <div key={b.id} style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{b.matchLabel}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {b.betType === "home_win" ? "主胜" : b.betType === "away_win" ? "客胜" : "平局"} @ {Number(b.odds).toFixed(2)}
                </div>
              </div>
              <div style={{ textAlign: "right", marginRight: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🫘 {b.amount}</div>
                <div style={{ fontSize: 11, color: ss.color }}>{ss.label}{b.payout != null ? ` → 🫘${b.payout}` : ""}</div>
              </div>
              {b.status === "pending" && (
                <button onClick={() => cancelBet(b.id)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#E53935", cursor: "pointer", fontSize: 10, padding: "2px 6px" }}>撤销</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
