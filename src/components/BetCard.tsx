import { useState } from "react";
import type { MatchOdds } from "../lib/supabase";

interface MatchInfo {
  id: string;
  datetime: string;
  home: { name: string };
  away: { name: string };
}

interface Props {
  match: MatchInfo;
  odds: MatchOdds | null;
  disabled: boolean;
  onBet: (betType: "home_win" | "draw" | "away_win", oddsValue: number) => void;
}

function getFlag(name: string): string {
  const map: Record<string, string> = {
    "墨西哥":"🇲🇽","南非":"🇿🇦","韩国":"🇰🇷","捷克":"🇨🇿","加拿大":"🇨🇦","波黑":"🇧🇦",
    "卡塔尔":"🇶🇦","瑞士":"🇨🇭","巴西":"🇧🇷","摩洛哥":"🇲🇦","海地":"🇭🇹","苏格兰":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    "美国":"🇺🇸","巴拉圭":"🇵🇾","澳大利亚":"🇦🇺","土耳其":"🇹🇷","德国":"🇩🇪","库拉索":"🇨🇼",
    "科特迪瓦":"🇨🇮","厄瓜多尔":"🇪🇨","荷兰":"🇳🇱","日本":"🇯🇵","瑞典":"🇸🇪","突尼斯":"🇹🇳",
    "比利时":"🇧🇪","埃及":"🇪🇬","伊朗":"🇮🇷","新西兰":"🇳🇿","西班牙":"🇪🇸","佛得角":"🇨🇻",
    "沙特":"🇸🇦","乌拉圭":"🇺🇾","法国":"🇫🇷","塞内加尔":"🇸🇳","伊拉克":"🇮🇶","挪威":"🇳🇴",
    "阿根廷":"🇦🇷","阿尔及利亚":"🇩🇿","奥地利":"🇦🇹","约旦":"🇯🇴","葡萄牙":"🇵🇹","刚果":"🇨🇩",
    "乌兹别克斯坦":"🇺🇿","哥伦比亚":"🇨🇴","英格兰":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","克罗地亚":"🇭🇷","加纳":"🇬🇭","巴拿马":"🇵🇦",
  };
  return map[name] || "🏳️";
}

export default function BetCard({ match, odds, disabled, onBet }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const kickoff = new Date(match.datetime);
  const isPast = kickoff.getTime() < Date.now() + 5 * 60 * 1000; // 开赛前5分钟截止
  const blocked = disabled || isPast;

  const oddsData = odds || { home_win: 2.50, draw: 3.20, away_win: 2.50 };

  const buttons = [
    { key: "home_win", label: match.home.name, odds: oddsData.home_win, flag: getFlag(match.home.name) },
    { key: "draw", label: "平局", odds: oddsData.draw, flag: "🤝" },
    { key: "away_win", label: match.away.name, odds: oddsData.away_win, flag: getFlag(match.away.name) },
  ];

  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      opacity: blocked ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>
          {kickoff.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
          {" "}{kickoff.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </span>
        {isPast && <span style={{ color: "#E53935", fontSize: 10 }}>已截止</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {buttons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => {
              if (blocked) return;
              setSelected(btn.key);
              onBet(btn.key as "home_win" | "draw" | "away_win", btn.odds);
            }}
            disabled={blocked}
            style={{
              padding: "10px 6px", borderRadius: 8, border: "none", cursor: blocked ? "not-allowed" : "pointer",
              background: selected === btn.key
                ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05))"
                : "rgba(255,255,255,0.04)",
              borderColor: selected === btn.key ? "rgba(255,215,0,0.3)" : "transparent",
              border: selected === btn.key ? "1px solid rgba(255,215,0,0.3)" : "1px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 2 }}>{btn.flag}</div>
            <div style={{ color: "#fff", fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{btn.label}</div>
            <div style={{ color: "var(--color-accent)", fontSize: 14, fontWeight: 700 }}>{btn.odds.toFixed(2)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
