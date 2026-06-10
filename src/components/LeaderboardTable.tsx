import { useState, useEffect } from "react";
import { getProfile, type LocalProfile } from "../lib/store";

interface Row {
  username: string;
  beans: number;
  totalBets: number;
  wonBets: number;
  winRate: number;
}

export default function LeaderboardTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 本地用户数据
    const localProfile = getProfile();
    const list: Row[] = [];

    if (localProfile) {
      list.push({
        username: localProfile.username,
        beans: localProfile.beans,
        totalBets: localProfile.totalBets,
        wonBets: localProfile.wonBets,
        winRate: localProfile.totalBets > 0
          ? Math.round((localProfile.wonBets / localProfile.totalBets) * 1000) / 10
          : 0,
      });
    }

    // 模拟排行榜数据（纯娱乐展示）
    const mockNames = [
      "⚽ 球王贝贝", "🌟 世界杯预言家", "🎯 百发百中", "🏆 冠军相", "🔮 预测大师",
      "💫 足球精灵", "🎪 绿茵先知", "🧿 章鱼保罗", "🦅 雄鹰之眼", "🌪 飓风下注",
    ];
    const baseBeans = localProfile?.beans ?? 10000;

    for (let i = 0; i < mockNames.length; i++) {
      // 使用 pseudo-random 基于名字生成稳定数据
      const seed = mockNames[i].split("").reduce((s, c) => s + c.charCodeAt(0), 0);
      const beans = baseBeans + Math.round((Math.sin(seed * 127.1) + 1) * 5000);
      const total = 10 + (seed % 30);
      const won = 3 + (seed % total);
      list.push({
        username: mockNames[i],
        beans: Math.max(1000, beans),
        totalBets: total,
        wonBets: won,
        winRate: Math.round((won / total) * 1000) / 10,
      });
    }

    list.sort((a, b) => b.beans - a.beans);
    setRows(list);
    setLoading(false);
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>加载中...</div>;

  if (rows.length === 0) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
      暂无数据，<a href="/bet/" style={{ color: "var(--color-accent)" }}>去竞猜</a> 成为第一名！
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
              fontWeight: r.username === getProfile()?.username ? 700 : 400,
            }}>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </td>
              <td style={{ padding: "10px 12px" }}>{r.username}{r.username === getProfile()?.username ? " 👈" : ""}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-accent)", fontWeight: 700 }}>🫘 {r.beans.toLocaleString()}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-text-secondary)" }}>{r.totalBets}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: r.winRate >= 50 ? "var(--color-positive)" : "var(--color-text-secondary)" }}>
                {r.winRate}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ color: "var(--color-text-muted)", fontSize: 9, textAlign: "center", marginTop: 12 }}>
        * 排行榜为本地数据 + 模拟展示，不代表真实排名
      </p>
    </div>
  );
}
