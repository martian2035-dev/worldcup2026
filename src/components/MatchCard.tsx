import { useState } from "react";
import type { Match } from "../types";

interface Props {
  match: Match;
}

export default function MatchCard({ match }: Props) {
  const [expanded, setExpanded] = useState(false);

  function getFlag(code: string) {
    const flags: Record<string, string> = {
      MEX:"🇲🇽",RSA:"🇿🇦",KOR:"🇰🇷",CZE:"🇨🇿",CAN:"🇨🇦",BIH:"🇧🇦",QAT:"🇶🇦",SUI:"🇨🇭",
      BRA:"🇧🇷",MAR:"🇲🇦",HAI:"🇭🇹",SCO:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",USA:"🇺🇸",PAR:"🇵🇾",AUS:"🇦🇺",TUR:"🇹🇷",
      GER:"🇩🇪",CUW:"🇨🇼",CIV:"🇨🇮",ECU:"🇪🇨",NED:"🇳🇱",JPN:"🇯🇵",SWE:"🇸🇪",TUN:"🇹🇳",
      BEL:"🇧🇪",EGY:"🇪🇬",IRN:"🇮🇷",NZL:"🇳🇿",ESP:"🇪🇸",CPV:"🇨🇻",KSA:"🇸🇦",URU:"🇺🇾",
      FRA:"🇫🇷",SEN:"🇸🇳",IRQ:"🇮🇶",NOR:"🇳🇴",ARG:"🇦🇷",ALG:"🇩🇿",AUT:"🇦🇹",JOR:"🇯🇴",
      POR:"🇵🇹",COD:"🇨🇩",UZB:"🇺🇿",COL:"🇨🇴",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",CRO:"🇭🇷",GHA:"🇬🇭",PAN:"🇵🇦"
    };
    return flags[code] || "🏳️";
  }

  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const hasScore = match.score?.home !== null && match.score?.away !== null;
  const timeStr = match.datetime.slice(11, 16);

  const stageLabels: Record<string, string> = {
    group: "小组赛", round32: "1/32决赛", round16: "1/16决赛",
    quarterfinal: "1/4决赛", semifinal: "半决赛", third: "季军赛", final: "🏆决赛"
  };

  return (
    <div>
      <div
        className={`glass-card ${isLive ? "gold-card" : ""}`}
        style={{ padding: "14px 18px", cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Time / Status */}
          <div style={{ minWidth: 48, textAlign: "center" }}>
            {isLive ? (
              <span className="live-indicator" style={{ color: "var(--color-negative)", fontSize: 12, fontWeight: 600 }}>● 直播中</span>
            ) : isFinished ? (
              <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>已结束</span>
            ) : (
              <span style={{ color: "var(--color-accent)", fontSize: 14, fontWeight: 600 }}>{timeStr}</span>
            )}
          </div>

          {/* Teams + Score */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
              <span style={{ color: isFinished ? "var(--color-text-muted)" : "var(--color-text-primary)", fontSize: 14, fontWeight: 600 }}>
                {match.home.name}
              </span>
              <span style={{ fontSize: 20 }}>{getFlag(match.home.code)}</span>
            </div>

            <div style={{ minWidth: 50, textAlign: "center" }}>
              {hasScore ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "var(--color-text-primary)", fontSize: 22, fontWeight: 800 }}>{match.score!.home}</span>
                  <span style={{ color: "var(--color-text-muted)", fontSize: 14 }}>-</span>
                  <span style={{ color: isFinished ? "var(--color-text-muted)" : "var(--color-text-primary)", fontSize: 22, fontWeight: 800 }}>{match.score!.away}</span>
                </div>
              ) : (
                <span style={{ color: "var(--color-text-muted)", fontSize: 16, fontWeight: 700 }}>VS</span>
              )}
            </div>

            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 20 }}>{getFlag(match.away.code)}</span>
              <span style={{ color: isFinished ? "var(--color-text-muted)" : "var(--color-text-primary)", fontSize: 14, fontWeight: 600 }}>
                {match.away.name}
              </span>
            </div>
          </div>

          {/* Badge & Venue */}
          <div style={{ minWidth: 100, textAlign: "right" }}>
            <span style={{ fontSize: 9, color: "var(--color-accent)", background: "var(--color-accent-dim)", padding: "2px 6px", borderRadius: 3 }}>
              {stageLabels[match.stage] || match.stage}
            </span>
            <div style={{ color: "var(--color-text-muted)", fontSize: 10, marginTop: 2 }}>{match.venue.name}</div>
          </div>
        </div>
        {/* Expand icon */}
        <div style={{ textAlign: "center", marginTop: expanded ? 8 : 0 }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: 10 }}>{expanded ? "▲ 收起" : "▼ 展开详情"}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="glass-card" style={{ marginTop: 4, padding: 18 }}>
          {hasScore && match.stats ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", fontSize: 12 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "var(--color-text-secondary)" }}>控球率: {match.stats.home.possession}%</div>
                <div style={{ color: "var(--color-text-secondary)" }}>射门: {match.stats.home.shots} ({match.stats.home.shotsOnTarget})</div>
                <div style={{ color: "var(--color-text-secondary)" }}>角球: {match.stats.home.corners}</div>
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 10 }}>VS</div>
              <div>
                <div style={{ color: "var(--color-text-secondary)" }}>控球率: {match.stats.away.possession}%</div>
                <div style={{ color: "var(--color-text-secondary)" }}>射门: {match.stats.away.shots} ({match.stats.away.shotsOnTarget})</div>
                <div style={{ color: "var(--color-text-secondary)" }}>角球: {match.stats.away.corners}</div>
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--color-text-muted)", fontSize: 12, textAlign: "center" }}>
              比赛尚未开始，数据将在赛后更新
            </div>
          )}
        </div>
      )}
    </div>
  );
}
