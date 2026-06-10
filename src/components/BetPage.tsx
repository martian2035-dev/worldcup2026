import { useState, useEffect } from "react";
import {
  getLocalProfile, createLocalProfile, addLocalBet,
  clearLocalProfile,
  syncBetToGitHub, hasGitHubToken, setGitHubToken, getGitHubToken,
  type LocalProfile, type MatchOdds,
} from "../lib/store";

const FLAG: Record<string, string> = {
  "墨西哥":"🇲🇽","南非":"🇿🇦","韩国":"🇰🇷","捷克":"🇨🇿","加拿大":"🇨🇦","波黑":"🇧🇦","卡塔尔":"🇶🇦","瑞士":"🇨🇭",
  "巴西":"🇧🇷","摩洛哥":"🇲🇦","海地":"🇭🇹","苏格兰":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","美国":"🇺🇸","巴拉圭":"🇵🇾","澳大利亚":"🇦🇺","土耳其":"🇹🇷",
  "德国":"🇩🇪","库拉索":"🇨🇼","科特迪瓦":"🇨🇮","厄瓜多尔":"🇪🇨","荷兰":"🇳🇱","日本":"🇯🇵","瑞典":"🇸🇪","突尼斯":"🇹🇳",
  "比利时":"🇧🇪","埃及":"🇪🇬","伊朗":"🇮🇷","新西兰":"🇳🇿","西班牙":"🇪🇸","佛得角":"🇨🇻","沙特":"🇸🇦","乌拉圭":"🇺🇾",
  "法国":"🇫🇷","塞内加尔":"🇸🇳","伊拉克":"🇮🇶","挪威":"🇳🇴","阿根廷":"🇦🇷","阿尔及利亚":"🇩🇿","奥地利":"🇦🇹","约旦":"🇯🇴",
  "葡萄牙":"🇵🇹","刚果":"🇨🇩","乌兹别克斯坦":"🇺🇿","哥伦比亚":"🇨🇴","英格兰":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","克罗地亚":"🇭🇷","加纳":"🇬🇭","巴拿马":"🇵🇦",
};
const F = (n: string) => FLAG[n] || "🏳️";

interface MatchInfo {
  id: string; datetime: string; home: { name: string }; away: { name: string };
}

type BetType = "home_win" | "draw" | "away_win";

export default function BetPage() {
  const [profile, setProfile] = useState<LocalProfile | null>(getLocalProfile());
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [odds, setOdds] = useState<Record<string, MatchOdds>>({});
  const [showAuth, setShowAuth] = useState(!getLocalProfile());
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState("");
  const [betSlip, setBetSlip] = useState<{ match: MatchInfo; betType: BetType; odds: number } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [tokenInput, setTokenInput] = useState(getGitHubToken());

  useEffect(() => {
    fetch("/matches.json").then(r => r.json()).then(d => {
      setMatches(d.matches.filter((m: any) => m.status !== "finished").sort((a: any, b: any) => a.datetime.localeCompare(b.datetime)).slice(0, 24));
    }).catch(() => {});
    fetch("/odds.json").then(r => r.json()).then(d => {
      if (d.odds) setOdds(Object.fromEntries(d.odds.map((o: any) => [o.match_id, o])));
    }).catch(() => {});
  }, []);

  const od = (m: MatchInfo): MatchOdds => odds[m.id] || { match_id: m.id, home_win: 2.50, draw: 3.20, away_win: 2.50 };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const name = username.trim();
    if (name.length < 2) { setMsg("昵称至少2个字符"); return; }
    const p = createLocalProfile(name);
    setProfile(p);
    setShowAuth(false);
    setMsg("");
  };

  const handleBet = (match: MatchInfo, betType: BetType, oddsValue: number) => {
    const fresh = getLocalProfile();
    if (!fresh || fresh.beans < 10) { setMsg("余额不足"); return; }
    setBetSlip({ match, betType, odds: oddsValue });
  };

  const confirmBet = async (amount: number) => {
    if (!betSlip || !profile) return;
    const fresh = getLocalProfile();
    if (!fresh || amount > fresh.beans) { setMsg("余额不足"); return; }

    // 1. 立即写入 localStorage
    addLocalBet({
      matchId: betSlip.match.id,
      betType: betSlip.betType,
      matchLabel: `${betSlip.match.home.name} vs ${betSlip.match.away.name}`,
      amount, odds: betSlip.odds, payout: null, status: "pending",
    });
    const updated = updateLocalBeans(-amount);
    if (updated) setProfile(updated);
    setBetSlip(null);

    // 2. 同步到 GitHub
    if (hasGitHubToken()) {
      setMsg("⏳ 投注已提交，同步到排行榜中...");
      const result = await syncBetToGitHub(
        profile.username, betSlip.match.id,
        `${betSlip.match.home.name} vs ${betSlip.match.away.name}`,
        betSlip.betType, amount, betSlip.odds
      );
      setMsg(result.success ? `✅ ${result.message}` : `⚠️ ${result.message}`);
    } else {
      setMsg("✅ 投注成功（本地模式）！配置 GitHub Token 可同步到排行榜");
    }
    setTimeout(() => setMsg(""), 5000);
  };

  const saveToken = () => {
    setGitHubToken(tokenInput.trim());
    setShowToken(false);
    setMsg("✅ Token 已保存");
    setTimeout(() => setMsg(""), 2000);
  };

  const fmtTime = (dt: string) => { const d = new Date(dt); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const isPast = (dt: string) => new Date(dt).getTime() < Date.now() + 300000;

  // 注册
  if (showAuth) return (
    <div style={{ maxWidth: 380, margin: "40px auto", background: "var(--color-bg)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
      <h2 style={{ margin: "0 0 4px" }}>🎯 加入竞猜</h2>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 12, margin: "0 0 20px" }}>输入昵称，立即获取 <b style={{ color: "var(--color-accent)" }}>10000 豆</b></p>
      <form onSubmit={handleRegister}>
        <input autoFocus value={username} onChange={e => setUsername(e.target.value)} placeholder="输入昵称..." maxLength={20}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", outline: "none", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        {msg && <div style={{ color: msg.includes("✅") ? "var(--color-positive)" : "#E53935", fontSize: 11, marginTop: 6 }}>{msg}</div>}
        <button type="submit" style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#0a1628", fontSize: 15, fontWeight: 700 }}>
          🚀 免费领取 10000 豆
        </button>
      </form>
      <p style={{ color: "var(--color-text-muted)", fontSize: 10, marginTop: 14 }}>昵称不可修改，请认真选择</p>
    </div>
  );

  // 竞猜大厅
  return (
    <div>
      {/* 消息 */}
      {msg && <div style={{ textAlign: "center", padding: 8, color: msg.includes("✅") ? "var(--color-positive)" : msg.includes("⏳") ? "var(--color-accent)" : "#FFA000", fontSize: 13, marginBottom: 8 }}>{msg}</div>}

      {/* 顶栏 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 15 }}>
          <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>🫘 {profile?.beans?.toLocaleString() ?? 0}</span>
          <span style={{ color: "var(--color-text-muted)", fontSize: 11, marginLeft: 8 }}>{profile?.username}</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => setShowToken(!showToken)} style={{ background: "none", border: "none", color: hasGitHubToken() ? "var(--color-positive)" : "var(--color-text-muted)", cursor: "pointer", fontSize: 10 }}>
            {hasGitHubToken() ? "🔗 已同步" : "🔓 配置Token"}
          </button>
          <button onClick={() => { clearLocalProfile(); setProfile(null); setShowAuth(true); }} style={{ background: "none", border: "none", color: "var(--color-text-muted)", cursor: "pointer", fontSize: 10 }}>退出</button>
          <a href="/bet/mine/" style={{ color: "var(--color-text-secondary)", fontSize: 11, textDecoration: "none" }}>📋 我的</a>
          <a href="/bet/board/" style={{ color: "var(--color-text-secondary)", fontSize: 11, textDecoration: "none" }}>🏆 排行</a>
        </div>
      </div>

      {/* Token 配置 */}
      {showToken && (
        <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12, fontSize: 11 }}>
          <div style={{ marginBottom: 8, color: "var(--color-text-secondary)" }}>
            配置 GitHub Token 后可同步投注到排行榜。需要 <code style={{ color: "var(--color-accent)" }}>actions:write</code> 权限。
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" type="password"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 11 }} />
            <button onClick={saveToken} style={{ padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: "var(--color-accent)", color: "#0a1628", fontSize: 11, fontWeight: 600 }}>保存</button>
          </div>
          <div style={{ marginTop: 6, color: "var(--color-text-muted)", fontSize: 9 }}>
            创建 Token: GitHub → Settings → Developer settings → PAT → Fine-grained → 仅选此仓库 + actions:write
          </div>
        </div>
      )}

      {/* 比赛列表 */}
      <div style={{ display: "grid", gap: 10 }}>
        {matches.map(m => {
          const o = od(m); const past = isPast(m.datetime);
          return (
            <div key={m.id} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: past ? 0.5 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>{fmtTime(m.datetime)}</span>
                {past && <span style={{ color: "#E53935", fontSize: 10 }}>已截止</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {([
                  { k: "home_win" as BetType, l: m.home.name, fl: F(m.home.name), od: o.home_win },
                  { k: "draw" as BetType, l: "平局", fl: "🤝", od: o.draw },
                  { k: "away_win" as BetType, l: m.away.name, fl: F(m.away.name), od: o.away_win },
                ]).map(b => (
                  <button key={b.k} onClick={() => { if (!past) handleBet(m, b.k, b.od); }} disabled={past}
                    style={{ padding: "10px 6px", borderRadius: 8, border: "1px solid transparent", cursor: past ? "not-allowed" : "pointer", background: "rgba(255,255,255,0.04)" }}>
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
                <button key={a} onClick={() => confirmBet(a)} disabled={a > (profile?.beans ?? 0)}
                  style={{ padding: 10, borderRadius: 8, border: "none", cursor: a > (profile?.beans ?? 0) ? "not-allowed" : "pointer", background: "rgba(255,255,255,0.04)", color: "#fff", opacity: a > (profile?.beans ?? 0) ? 0.4 : 1 }}>
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

// 工具
function updateLocalBeans(delta: number): ReturnType<typeof getLocalProfile> {
  const key = "wc2026_profile";
  try {
    const raw = localStorage.getItem(key); if (!raw) return null;
    const p = JSON.parse(raw);
    p.beans += delta;
    p.totalBets = (p.totalBets || 0) + (delta < 0 ? 1 : 0);
    localStorage.setItem(key, JSON.stringify(p));
    return p;
  } catch { return null; }
}
