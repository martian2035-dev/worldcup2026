import { useState, useEffect } from "react";
import { supabase, type LeaderboardRow } from "../lib/supabase";

export default function LeaderboardTable() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("username, beans, total_bets, won_bets")
      .order("beans", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) {
          setRows(data.map((r: any) => ({
            ...r,
            win_rate: r.total_bets > 0 ? Math.round((r.won_bets / r.total_bets) * 1000) / 10 : 0,
          })));
        }
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>加载中...</div>;
  }

  if (rows.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
        暂无数据，快来成为第一个竞猜玩家吧！🎯
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "var(--color-text-muted)", fontSize: 10, textTransform: "uppercase" }}>
            <th style={{ padding: "8px 12px", textAlign: "left" }}>排名</th>
            <th style={{ padding: "8px 12px", textAlign: "left" }}>玩家</th>
            <th style={{ padding: "8px 12px", textAlign: "right" }}>豆子</th>
            <th style={{ padding: "8px 12px", textAlign: "right" }}>投注数</th>
            <th style={{ padding: "8px 12px", textAlign: "right" }}>胜率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.username} style={{
              borderTop: "1px solid rgba(255,255,255,0.04)",
              background: i < 3 ? "rgba(255,215,0,0.03)" : undefined,
            }}>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </td>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.username}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-accent)", fontWeight: 700 }}>🫘 {row.beans}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-text-secondary)" }}>{row.total_bets}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: row.win_rate >= 50 ? "var(--color-positive)" : "var(--color-text-secondary)" }}>
                {row.win_rate}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
