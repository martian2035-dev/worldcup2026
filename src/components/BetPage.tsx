import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured, type Profile, type MatchOdds } from "../lib/supabase";

interface MatchInfo {
  id: string; datetime: string; home: { name: string }; away: { name: string };
}

interface BetSlipData { match: MatchInfo; betType: "home_win" | "draw" | "away_win"; odds: number; }

const FLAG: Record<string, string> = {
  "墨西哥":"🇲🇽","南非":"🇿🇦","韩国":"🇰🇷","捷克":"🇨🇿","加拿大":"🇨🇦","波黑":"🇧🇦","卡塔尔":"🇶🇦","瑞士":"🇨🇭",
  "巴西":"🇧🇷","摩洛哥":"🇲🇦","海地":"🇭🇹","苏格兰":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","美国":"🇺🇸","巴拉圭":"🇵🇾","澳大利亚":"🇦🇺","土耳其":"🇹🇷",
  "德国":"🇩🇪","库拉索":"🇨🇼","科特迪瓦":"🇨🇮","厄瓜多尔":"🇪🇨","荷兰":"🇳🇱","日本":"🇯🇵","瑞典":"🇸🇪","突尼斯":"🇹🇳",
  "比利时":"🇧🇪","埃及":"🇪🇬","伊朗":"🇮🇷","新西兰":"🇳🇿","西班牙":"🇪🇸","佛得角":"🇨🇻","沙特":"🇸🇦","乌拉圭":"🇺🇾",
  "法国":"🇫🇷","塞内加尔":"🇸🇳","伊拉克":"🇮🇶","挪威":"🇳🇴","阿根廷":"🇦🇷","阿尔及利亚":"🇩🇿","奥地利":"🇦🇹","约旦":"🇯🇴",
  "葡萄牙":"🇵🇹","刚果":"🇨🇩","乌兹别克斯坦":"🇺🇿","哥伦比亚":"🇨🇴","英格兰":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","克罗地亚":"🇭🇷","加纳":"🇬🇭","巴拿马":"🇵🇦",
};
const f = (n: string) => FLAG[n] || "🏳️";

export default function BetPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [odds, setOdds] = useState<Record<string, MatchOdds>>({});
  const [betSlip, setBetSlip] = useState<BetSlipData | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [noSupabase, setNoSupabase] = useState(false);

  const configured = isSupabaseConfigured();

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (data) setProfile(data as Profile);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!configured) {
      setNoSupabase(true);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await loadProfile(data.session.user.id);
        } else {
          setShowAuth(true);
        }
      } catch {
        setShowAuth(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [configured, loadProfile]);

  useEffect(() => {
    fetch("/matches.json").then(r => r.json()).then(d => {
      setMatches(d.matches.filter((m: any) => m.status !== "finished").sort((a: any, b: any) => a.datetime.localeCompare(b.datetime)).slice(0, 24));
    }).catch(() => {});
    if (configured) {
      supabase.from("match_odds").select("*").then(({ data }: any) => {
        if (data) setOdds(Object.fromEntries(data.map((o: any) => [o.match_id, o])));
      }, () => {});
    }
  }, [configured]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg("");
    if (username.trim().length < 2) { setMsg("昵称至少2个字符"); return; }

    try {
      const uid = Math.random().toString(36).slice(2, 10);
      const { data, error } = await supabase.auth.signUp({
        email: `user_${uid}@wc2026.local`,
        password: `wc2026_${uid}_${Date.now()}`,
        options: { data: { username: username.trim() } },
      });
      if (error) { setMsg(error.message); return; }
      if (data.user) {
        await supabase.from("profiles").update({ username: username.trim() }).eq("id", data.user.id);
        await loadProfile(data.user.id);
        setShowAuth(false); setLoading(false);
      }
    } catch (err: any) {
      setMsg(err.message || "注册失败，请重试");
    }
  };

  const confirmBet = async (amount: number) => {
    if (!betSlip || !profile || amount > profile.beans) return;
    try {
      const { error } = await supabase.from("bets").insert({ user_id: profile.id, match_id: betSlip.match.id, bet_type: betSlip.betType, amount, odds: betSlip.odds });
      if (error) { setMsg(error.message); return; }
      await supabase.from("profiles").update({ beans: profile.beans - amount }).eq("id", profile.id);
      setProfile({ ...profile, beans: profile.beans - amount });
      setBetSlip(null); setMsg("✅ 投注成功！"); setTimeout(() => setMsg(""), 3000);
    } catch (err: any) {
      setMsg(err.message || "投注失败");
    }
  };

  const fmtTime = (dt: string) => { const d = new Date(dt); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const isPast = (dt: string) => new Date(dt).getTime() < Date.now() + 300000;
  const od = (m: MatchInfo) => odds[m.id] || { home_win: 2.50, draw: 3.20, away_win: 2.50, match_id: m.id, bookmaker: "default", updated_at: "" };

  // Supabase 未配置时的提示
  if (noSupabase) return (
    <div style={{ maxWidth: 500, margin: "40px auto", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
      <h2 style={{ margin: "0 0 8px" }}>竞猜功能需要配置 Supabase</h2>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
        这是一个免费的后端服务，用于存储用户数据和投注记录。<br />
        配置完成后即可使用完整竞猜功能。
      </p>
      <div style={{ textAlign: "left", background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16, fontSize: 12, lineHeight: 1.8, marginBottom: 20 }}>
        <div style={{ color: "var(--color-accent)", fontWeight: 600, marginBottom: 8 }}>📋 配置步骤（5 分钟）：</div>
        <div>1. 打开 <a href="https://supabase.com" target="_blank" style={{ color: "var(--color-accent)" }}>supabase.com</a> 注册免费账号</div>
        <div>2. 创建新项目，记录 <code style={{ color: "#43A047" }}>Project URL</code> 和 <code style={{ color: "#43A047" }}>anon key</code></div>
        <div>3. 在 SQL Editor 中执行项目根目录的 <code style={{ color: "#FFA000" }}>supabase/schema.sql</code></div>
        <div>4. 在 GitHub 仓库 Settings → Secrets 中添加：</div>
        <div style={{ paddingLeft: 16, color: "var(--color-text-muted)" }}>
          <code>PUBLIC_SUPABASE_URL</code> = 你的 Project URL<br />
          <code>PUBLIC_SUPABASE_ANON_KEY</code> = 你的 anon key
        </div>
        <div>5. 重新部署即可启用竞猜</div>
      </div>
      <p style={{ color: "var(--color-text-muted)", fontSize: 11 }}>
        配置前其他功能（赛程、球队、数据等）不受影响
      </p>
    </div>
  );

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--color-text-muted)" }}>加载中...</div>;

  if (showAuth) return (
    <div style={{ maxWidth: 380, margin: "40px auto", background: "var(--color-bg, #0a1628)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
      <h2 style={{ margin: "0 0 4px" }}>🎯 加入竞猜</h2>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 12, margin: "0 0 16px" }}>输入昵称，立即获取 <b style={{ color: "var(--color-accent)" }}>100 豆</b></p>
      <form onSubmit={handleLogin}>
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="输入昵称..." maxLength={20}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", outline: "none", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        {msg && <div style={{ color: "#E53935", fontSize: 11, marginTop: 6 }}>{msg}</div>}
        <button type="submit" style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 10, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FFD700, #FFA000)", color: "#0a1628", fontSize: 15, fontWeight: 700 }}>
          🚀 免费领取 100 豆
        </button>
      </form>
    </div>
  );

  return (
    <div>
      {msg && <div style={{ textAlign: "center", padding: 8, color: "var(--color-positive)", fontSize: 13 }}>{msg}</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ color: "var(--color-accent)", fontWeight: 700, fontSize: 15 }}>🫘 {profile?.beans ?? 0} 豆</div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/bet/mine/" style={{ color: "var(--color-text-secondary)", fontSize: 11, textDecoration: "none" }}>📋 我的竞猜</a>
          <a href="/bet/board/" style={{ color: "var(--color-text-secondary)", fontSize: 11, textDecoration: "none" }}>🏆 排行榜</a>
        </div>
      </div>

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
                {([{ k: "home_win" as const, l: m.home.name, fl: f(m.home.name), od: o.home_win }, { k: "draw" as const, l: "平局", fl: "🤝", od: o.draw }, { k: "away_win" as const, l: m.away.name, fl: f(m.away.name), od: o.away_win }]).map(b => (
                  <button key={b.k} onClick={() => { if (!past) { setBetSlip({ match: m, betType: b.k, odds: b.od }); } }} disabled={past}
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

      {betSlip && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setBetSlip(null)} style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "relative", background: "var(--color-bg, #0a1628)", borderRadius: 16, padding: "24px 20px", maxWidth: 360, width: "90%", border: "1px solid rgba(255,255,255,0.08)" }}>
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
