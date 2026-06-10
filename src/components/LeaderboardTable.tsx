import { useState, useEffect } from "react";
import { fetchLeaderboard, getSavedUsername, type UserRecord } from "../lib/store";

const BASE = import.meta.env.BASE_URL || "";

export default function LeaderboardTable() {
  const [rows, setRows] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard().then(data => {
      setRows(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const localName = getSavedUsername();

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>加载排行榜...</div>;

  if (rows.length === 0) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
      暂无数据，<a href={`${BASE}/bet/`} style={{ color: "var(--color-accent)" }}>去竞猜</a> 成为第一名！
      <br /><br />
      <span style={{ fontSize: 11 }}>
        排行榜数据来自 <code style={{ color: "var(--color-text-muted)" }}>src/data/bets/index.json</code>
      </span>
    </div>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase" }}>
            <th style={{ padding: "8px 12px", textAlign: "left" }}>排名</th>
            <th style={{ padding: "8px 12px", textAlign: "left" }}>玩家</th>
            <th style={{ padding: "8px 12px", textAlign: "right" }}>豆子</th>
            <th style={{ padding: "8px 12px", textAlign: "right" }}>投注</th>
            <th style={{ padding: "8px 12px", textAlign: "right" }}>胜率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.username} style={{
              borderTop: "1px solid rgba(255,255,255,0.04)",
              background: i < 3 ? "rgba(255,215,0,0.03)" : undefined,
              fontWeight: r.username === localName ? 700 : 400,
            }}>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </td>
              <td style={{ padding: "10px 12px" }}>
                {r.username}
                {r.username === localName && <span style={{ color: "var(--color-accent)", marginLeft: 4, fontSize: 10 }}>👈 你</span>}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-accent)", fontWeight: 700 }}>🫘 {r.beans.toLocaleString()}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-text-secondary)" }}>{r.totalBets}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: r.totalBets > 0 && (r.wonBets / r.totalBets) >= 0.5 ? "var(--color-positive)" : "var(--color-text-secondary)" }}>
                {r.totalBets > 0 ? Math.round((r.wonBets / r.totalBets) * 1000) / 10 : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ color: "var(--color-text-muted)", fontSize: 9, textAlign: "center", marginTop: 12 }}>
        数据来源: GitHub 仓库 bets/index.json · 实时排名
      </p>
    </div>
  );
}
