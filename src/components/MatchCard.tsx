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
  const platforms = getBroadcastPlatforms(match);

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
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {platforms.map((platform) => (
                <span key={platform} style={{ color: "var(--color-text-secondary)", fontSize: 9, background: "rgba(255,255,255,0.04)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "1px 5px" }}>
                  {platform}
                </span>
              ))}
            </div>
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
          {hasScore || match.stats || match.lineups ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {match.stats && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center", fontSize: 12 }}>
                  <TeamStatsColumn align="right" stats={match.stats.home} />
                  <div style={{ color: "var(--color-text-muted)", fontSize: 10, textAlign: "center" }}>
                    <div>比赛数据</div>
                    {match.attendance ? <div style={{ marginTop: 4 }}>{match.attendance.toLocaleString()} 人</div> : null}
                  </div>
                  <TeamStatsColumn align="left" stats={match.stats.away} />
                </div>
              )}

              {match.lineups && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <LineupPanel title={match.home.name} lineup={match.lineups.home} />
                  <LineupPanel title={match.away.name} lineup={match.lineups.away} />
                </div>
              )}

              {!match.stats && !match.lineups && (
                <div style={{ color: "var(--color-text-muted)", fontSize: 12, textAlign: "center" }}>
                  比赛详情正在更新
                </div>
              )}
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

function TeamStatsColumn({ stats, align }: { stats: NonNullable<Match["stats"]>["home"]; align: "left" | "right" }) {
  const items = [
    ["控球率", stats.possession === null ? "-" : `${stats.possession}%`],
    ["射门", `${stats.shots} (${stats.shotsOnTarget})`],
    ["角球", stats.corners],
    ["犯规", stats.fouls],
    ["黄/红牌", `${stats.yellowCards}/${stats.redCards}`],
  ];

  return (
    <div style={{ textAlign: align }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
          {label}: {value}
        </div>
      ))}
    </div>
  );
}

function LineupPanel({ title, lineup }: { title: string; lineup: NonNullable<Match["lineups"]>["home"] }) {
  const rows = groupStartingByPosition(lineup.starting);
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 8, padding: 10, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "var(--color-text-primary)", fontSize: 12, fontWeight: 700 }}>{title}</span>
        <span style={{ color: "var(--color-accent)", fontSize: 11 }}>{lineup.formation || "阵型待定"}</span>
      </div>
      <div style={{ background: "linear-gradient(180deg, rgba(67,160,71,0.14), rgba(67,160,71,0.06))", border: "1px solid rgba(67,160,71,0.16)", borderRadius: 8, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row, index) => (
          <div key={index} style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
            {row.map((player) => (
              <span key={player.id} style={{ maxWidth: 92, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-primary)", fontSize: 10, background: "rgba(0,0,0,0.18)", borderRadius: 4, padding: "3px 5px" }}>
                {player.number} {player.name}{player.captain ? " C" : ""}
              </span>
            ))}
          </div>
        ))}
      </div>
      {lineup.substitutions.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
          {lineup.substitutions.slice(0, 5).map((sub, index) => (
            <div key={`${sub.playerOnId}-${index}`} style={{ color: "var(--color-text-secondary)", fontSize: 10 }}>
              {sub.minute} {sub.playerOnName || "替补"} ← {sub.playerOffName || "下场"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupStartingByPosition(players: NonNullable<Match["lineups"]>["home"]["starting"]) {
  const orderedCodes = [3, 2, 1, 0];
  return orderedCodes
    .map((code) => players.filter((player) => player.positionCode === code))
    .filter((row) => row.length > 0);
}

function getBroadcastPlatforms(match: Match) {
  if (match.stage === "group") return ["CCTV5", "咪咕", "抖音"];
  if (match.stage === "final" || match.stage === "semifinal") return ["CCTV5", "咪咕"];
  return ["CCTV5+"];
}
