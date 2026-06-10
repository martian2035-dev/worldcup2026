import { useState, useEffect, useCallback } from "react";
import {
  getSavedUsername, saveUsername,
  getLocalUserCache, setLocalUserCache, updateLocalUserCache,
  registerUser, fetchUserRecord, placeBet, cancelBet as cancelRemoteBet, hasPredictionApi,
  type UserRecord, type MatchOdds, type BetRecord,
} from "../lib/store";

const BASE = import.meta.env.BASE_URL || "";

const FLAG: Record<string, string> = {
  "墨西哥":"🇲🇽","南非":"🇿🇦","韩国":"🇰🇷","捷克":"🇨🇿","加拿大":"🇨🇦","波黑":"🇧🇦","卡塔尔":"🇶🇦","瑞士":"🇨🇭",
  "巴西":"🇧🇷","摩洛哥":"🇲🇦","海地":"🇭🇹","苏格兰":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","美国":"🇺🇸","巴拉圭":"🇵🇾","澳大利亚":"🇦🇺","土耳其":"🇹🇷",
  "德国":"🇩🇪","库拉索":"🇨🇼","科特迪瓦":"🇨🇮","厄瓜多尔":"🇪🇨","荷兰":"🇳🇱","日本":"🇯🇵","瑞典":"🇸🇪","突尼斯":"🇹🇳",
  "比利时":"🇧🇪","埃及":"🇪🇬","伊朗":"🇮🇷","新西兰":"🇳🇿","西班牙":"🇪🇸","佛得角":"🇨🇻","沙特":"🇸🇦","乌拉圭":"🇺🇾",
  "法国":"🇫🇷","塞内加尔":"🇸🇳","伊拉克":"🇮🇶","挪威":"🇳🇴","阿根廷":"🇦🇷","阿尔及利亚":"🇩🇿","奥地利":"🇦🇹","约旦":"🇯🇴",
  "葡萄牙":"🇵🇹","刚果":"🇨🇩","乌兹别克斯坦":"🇺🇿","哥伦比亚":"🇨🇴","英格兰":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","克罗地亚":"🇭🇷","加纳":"🇬🇭","巴拿马":"🇵🇦",
};
const F = (n: string) => FLAG[n] || "🏳️";

interface MatchInfo { id: string; datetime: string; home: { name: string }; away: { name: string }; }
type BetType = "home_win" | "draw" | "away_win";

export default function BetPage({ matchData }: { matchData?: string }) {
  const preloadMatches: MatchInfo[] = (() => {
    try { return matchData ? JSON.parse(matchData) : []; } catch { return []; }
  })();
  const [username, setUsername] = useState("");
  const [showAuth, setShowAuth] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [odds, setOdds] = useState<Record<string, MatchOdds>>({});
  const [msg, setMsg] = useState("");
  const [betSlip, setBetSlip] = useState<{ match: MatchInfo; betType: BetType; odds: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [apiReady, setApiReady] = useState(false);

  // 客户端初始化：自动检测已登录用户
  useEffect(() => {
    setApiReady(hasPredictionApi());
    const saved = getSavedUsername();
    if (saved) {
      setUsername(saved);
      loadUser(saved);
    } else {
      setLoading(false);
    }
  }, []);

  // 加载比赛
  useEffect(() => {
    if (preloadMatches.length > 0) {
      setMatches(preloadMatches);
    } else {
      fetch(`${BASE}/matches.json`).then(r => r.json()).then(d => {
        setMatches(d.matches.filter((m: any) => m.status !== "finished").sort((a: any, b: any) => a.datetime.localeCompare(b.datetime)).slice(0, 24));
      }).catch(() => {});
    }
    fetch(`${BASE}/odds.json`).then(r => r.json()).then(d => {
      if (d.odds) setOdds(Object.fromEntries(d.odds.map((o: any) => [o.match_id, o])));
    }).catch(() => {});
  }, []);

  const loadUser = useCallback(async (name: string) => {
    setLoading(true);
    // 1. 从 Worker API 获取用户档案
    const remoteUser = await fetchUserRecord(name);

    if (remoteUser) {
      setUser(remoteUser);
      setLocalUserCache(remoteUser);
      setShowAuth(false);
    } else {
      // 2. 本地缓存
      const cachedUser = getLocalUserCache();
      if (cachedUser && cachedUser.username === name) {
        setUser(cachedUser);
        setShowAuth(false);
        setMsg("💡 使用本地缓存，首次投注后将同步到服务器");
        setTimeout(() => setMsg(""), 4000);
      } else {
        // 3. Worker 注册新用户
        const workerUser = await registerUser(name);
        if (workerUser) {
          setUser(workerUser);
          setShowAuth(false);
        } else {
          // Worker 不可用，本地创建
          const newUser: UserRecord = {
            username: name, beans: 10000, totalBets: 0, wonBets: 0,
            createdAt: new Date().toISOString(), bets: [],
          };
          setUser(newUser);
          setLocalUserCache(newUser);
          setShowAuth(false);
          if (!hasPredictionApi()) {
            setMsg("💡 竞猜接口未配置，数据保存在本地");
            setTimeout(() => setMsg(""), 4000);
          }
        }
      }
    }
    setLoading(false);
  }, []);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (name.length < 2) { setMsg("昵称至少2个字符"); return; }
    saveUsername(name);
    if (isNewUser) {
      // 新用户注册
      loadNewUser(name);
    } else {
      // 已有用户登录
      loadUser(name);
    }
    setMsg("");
  };

  const loadNewUser = useCallback(async (name: string) => {
    setLoading(true);
    // 通过 Worker 注册
    const workerUser = await registerUser(name);
    if (workerUser) {
      setUser(workerUser);
      setShowAuth(false);
    } else {
      // Worker 不可用，本地创建
      const newUser: UserRecord = {
        username: name, beans: 10000, totalBets: 0, wonBets: 0,
        createdAt: new Date().toISOString(), bets: [],
      };
      setUser(newUser);
      setLocalUserCache(newUser);
      setShowAuth(false);
      if (!hasPredictionApi()) {
        setMsg("💡 竞猜接口未配置，数据保存在本地");
        setTimeout(() => setMsg(""), 4000);
      }
    }
    setLoading(false);
  }, []);

  const handleBet = (match: MatchInfo, betType: BetType, oddsValue: number) => {
    if (!user || user.beans < 10) { setMsg("余额不足"); return; }
    if (user.bets.some(b => b.matchId === match.id && b.status === "pending")) {
      setMsg("⚠️ 每场比赛只能下注一次，撤销后可重新选择");
      setTimeout(() => setMsg(""), 4000);
      return;
    }
    setBetSlip({ match, betType, odds: oddsValue });
  };

  const confirmBet = async (amount: number) => {
    if (!betSlip || !user || amount > user.beans) return;
    setSyncing(true);
    setBetSlip(null);

    const matchLabel = `${betSlip.match.home.name} vs ${betSlip.match.away.name}`;

    // 先提交到远程，成功后用 Worker 事件 ID 展示
    const result = await placeBet(
      user.username, betSlip.match.id,
      matchLabel,
      betSlip.betType, amount, betSlip.odds
    );

    if (!result.success || !result.eventId) {
      setMsg("⚠️ " + result.message);
      setSyncing(false);
      setTimeout(() => setMsg(""), 5000);
      return;
    }

    const newBet: BetRecord = {
      id: result.eventId,
      username: user.username,
      matchId: betSlip.match.id,
      matchLabel,
      betType: betSlip.betType,
      amount,
      odds: betSlip.odds,
      payout: null,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const updatedUser = {
      ...user,
      beans: user.beans - amount,
      totalBets: user.totalBets + 1,
      bets: [newBet, ...user.bets],
    };
    setUser(updatedUser);
    updateLocalUserCache(updatedUser);

    setMsg("✅ " + result.message);
    // 延迟刷新获取真实数据
    setTimeout(() => loadUser(user.username), 30000);
    setSyncing(false);
    setTimeout(() => setMsg(""), 5000);
  };

  const cancelBet = async (betId: string) => {
    if (!user) return;
    const bet = user.bets.find(b => b.id === betId);
    if (!bet || bet.status !== "pending") return;
    setSyncing(true);

    const result = await cancelRemoteBet(user.username, bet.matchId, bet.id);
    if (!result.success) {
      setMsg("⚠️ " + result.message);
      setSyncing(false);
      setTimeout(() => setMsg(""), 5000);
      return;
    }

    const updatedUser = {
      ...user,
      beans: user.beans + bet.amount,
      bets: user.bets.filter(b => b.id !== betId),
    };
    updatedUser.totalBets = updatedUser.bets.length;
    setUser(updatedUser);
    updateLocalUserCache(updatedUser);
    setMsg("↩ " + result.message);
    setSyncing(false);
    setTimeout(() => loadUser(user.username), 30000);
    setTimeout(() => setMsg(""), 5000);
  };

  const fmtTime = (dt: string) => { const d = new Date(dt); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const isPast = (dt: string) => new Date(dt).getTime() < Date.now() + 300000;
  const od = (m: MatchInfo): MatchOdds => odds[m.id] || { match_id: m.id, home_win: 2.50, draw: 3.20, away_win: 2.50 };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>加载中...</div>;

  // 登录/注册
  if (showAuth) return (
    <div style={{ maxWidth: 400, margin: "40px auto", background: "var(--color-bg)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>🎯 世界杯竞猜</h2>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 12, margin: "0 0 20px" }}>
        {isNewUser ? "新用户注册，立即获取 10000 豆" : "已有账户？输入昵称登录"}
      </p>

      {/* 模式切换 */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
        <button
          onClick={() => { setIsNewUser(false); setMsg(""); }}
          style={{
            flex: 1, padding: "10px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: !isNewUser ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05))" : "transparent",
            color: !isNewUser ? "var(--color-accent)" : "var(--color-text-muted)",
            transition: "all 0.2s",
          }}
        >
          🔑 已有账户登录
        </button>
        <button
          onClick={() => { setIsNewUser(true); setMsg(""); }}
          style={{
            flex: 1, padding: "10px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            background: isNewUser ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05))" : "transparent",
            color: isNewUser ? "var(--color-accent)" : "var(--color-text-muted)",
            transition: "all 0.2s",
          }}
        >
          🆕 新用户注册
        </button>
      </div>

      <form onSubmit={handleAuth}>
        <input autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="输入昵称..." maxLength={20}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", outline: "none", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        {msg && <div style={{ color: msg.includes("✅") ? "var(--color-positive)" : msg.includes("💡") ? "var(--color-accent)" : "#E53935", fontSize: 11, marginTop: 6 }}>{msg}</div>}
        <button type="submit" style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#0a1628", fontSize: 15, fontWeight: 700 }}>
          {isNewUser ? "🚀 注册并领取 10000 豆" : "🔑 登录账户"}
        </button>
      </form>
      <p style={{ color: "var(--color-text-muted)", fontSize: 10, marginTop: 14 }}>
        {isNewUser ? "昵称唯一，请牢记。登录后可在排行榜查看排名" : "输入已有昵称即可恢复账户数据"}
      </p>
    </div>
  );

  // 当前待处理的投注
  const pendingBets = user?.bets.filter(b => b.status === "pending") ?? [];

  // 竞猜大厅
  return (
    <div>
      {msg && <div style={{ textAlign: "center", padding: 8, color: msg.includes("✅") ? "var(--color-positive)" : msg.includes("↩") ? "var(--color-positive)" : msg.includes("⚠") ? "#FFA000" : "var(--color-accent)", fontSize: 13, marginBottom: 8 }}>{msg}</div>}

      {/* 顶栏 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 15 }}>
          <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>🫘 {user?.beans?.toLocaleString() ?? 0}</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 11, marginLeft: 8 }}>{user?.username}</span>
          <button onClick={() => loadUser(user!.username)} disabled={syncing} style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 10, marginLeft: 8 }}>🔄</button>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span title={apiReady ? "竞猜接口已连接" : "竞猜接口未配置"} style={{ color: apiReady ? "var(--color-positive)" : "#FFA000", fontSize: 10 }}>
            {apiReady ? "🔗" : "⏳"}
          </span>
          <a href={`${BASE}/bet/mine/`} style={{ color: "var(--color-text-secondary)", fontSize: 11, textDecoration: "none" }}>📋 我的</a>
          <a href={`${BASE}/bet/board/`} style={{ color: "var(--color-text-secondary)", fontSize: 11, textDecoration: "none" }}>🏆 排行</a>
          <button onClick={() => { setUser(null); setShowAuth(true); }} style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 10 }}>切换</button>
        </div>
      </div>

      {/* 待处理投注 */}
      {pendingBets.length > 0 && (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.12)" }}>
          <div style={{ color: "var(--color-accent)", fontSize: 10, marginBottom: 8 }}>⏳ 待处理投注</div>
          {pendingBets.map(b => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "4px 0" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>{b.matchLabel}</span>
              <span>{b.betType === "home_win" ? "主胜" : b.betType === "away_win" ? "客胜" : "平局"} @ {Number(b.odds).toFixed(2)}</span>
              <span style={{ color: "var(--color-accent)" }}>🫘{b.amount}</span>
              <button onClick={() => cancelBet(b.id)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#E53935", cursor: "pointer", fontSize: 10, padding: "2px 6px" }}>撤销</button>
            </div>
          ))}
        </div>
      )}

      {/* 比赛列表 */}
      <div style={{ display: "grid", gap: 10 }}>
        {matches.map(m => {
          const o = od(m); const past = isPast(m.datetime);
          const alreadyBet = user?.bets.some(b => b.matchId === m.id && b.status === "pending") ?? false;
          return (
            <div key={m.id} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: past ? 0.5 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>{fmtTime(m.datetime)}</span>
                {past ? <span style={{ color: "#E53935", fontSize: 10 }}>已截止</span> : alreadyBet && <span style={{ color: "var(--color-accent)", fontSize: 10 }}>已下注</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {([
                  { k: "home_win" as BetType, l: m.home.name, fl: F(m.home.name), od: o.home_win },
                  { k: "draw" as BetType, l: "平局", fl: "🤝", od: o.draw },
                  { k: "away_win" as BetType, l: m.away.name, fl: F(m.away.name), od: o.away_win },
                ]).map(b => (
                  <button key={b.k} onClick={() => { if (!past && !alreadyBet) handleBet(m, b.k, b.od); }} disabled={past || alreadyBet}
                    style={{ padding: "10px 6px", borderRadius: 8, border: "1px solid transparent", cursor: (past || alreadyBet) ? "not-allowed" : "pointer", background: "rgba(255,255,255,0.04)", opacity: (past || alreadyBet) ? 0.4 : 1 }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{b.fl}</div>
                    <div style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>{b.l}</div>
                    <div style={{ color: "var(--color-accent)", fontSize: 14, fontWeight: 700 }}>{Number(b.od).toFixed(2)}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 投注确认弹窗 */}
      {betSlip && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setBetSlip(null)} style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "relative", background: "var(--color-bg)", borderRadius: 16, padding: "24px 20px", maxWidth: 360, width: "90%", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 style={{ margin: "0 0 14px" }}>📝 确认投注</h3>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{betSlip.match.home.name} vs {betSlip.match.away.name}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                投注: {betSlip.betType === "home_win" ? betSlip.match.home.name : betSlip.betType === "away_win" ? betSlip.match.away.name : "平局"}
                <span style={{ color: "var(--color-accent)" }}> @ {Number(betSlip.odds).toFixed(2)}</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
              {[10, 20, 50, 100].map(a => (
                <button key={a} onClick={() => confirmBet(a)} disabled={syncing || a > (user?.beans ?? 0)}
                  style={{ padding: 10, borderRadius: 8, border: "none", cursor: (syncing || a > (user?.beans ?? 0)) ? "not-allowed" : "pointer", background: "rgba(255,255,255,0.04)", color: "#fff", opacity: (syncing || a > (user?.beans ?? 0)) ? 0.4 : 1 }}>
                  🫘 {a}
                </button>
              ))}
            </div>
            <button onClick={() => setBetSlip(null)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
