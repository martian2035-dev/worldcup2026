import { useState, useEffect } from "react";
import { fetchRemoteLeaderboard, getLocalProfile, type RemoteUser } from "../lib/store";

export default function LeaderboardTable() {
  const [rows, setRows] = useState<RemoteUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromGitHub, setFromGitHub] = useState(false);
  const localProfile = getLocalProfile();

  useEffect(() => {
    (async () => {
      // 优先从 GitHub 加载
      const remote = await fetchRemoteLeaderboard();
      if (remote.length > 0) {
        setFromGitHub(true);
        setRows(remote);
      } else {
        // fallback: 仅显示本地
        setFromGitHub(false);
      }
      setLoading(false);
    })();
  }, []);

  // 本地数据合并到排行榜（如果远程数据中没有本地用户）
  useEffect(() => {
    if (loading || !localProfile) return;
    if (fromGitHub) {
      // 检查远程数据是否包含本地用户
      const found = rows.find(r => r.username === localProfile.username);
      if (!found) {
        // 本地用户尚未同步，追加到排行榜末尾
        const localUser: RemoteUser = {
          username: localProfile.username,
          beans: localProfile.beans,
          totalBets: localProfile.totalBets,
          wonBets: localProfile.wonBets,
          createdAt: localProfile.createdAt,
          bets: [],
        };
        setRows(prev => [...prev, localUser].sort((a, b) => b.beans - a.beans));
      }
    } else if (localProfile && rows.length === 0) {
      // 纯本地模式
      setRows([{
        username: localProfile.username,
        beans: localProfile.beans,
        totalBets: localProfile.totalBets,
        wonBets: localProfile.wonBets,
        createdAt: localProfile.createdAt,
        bets: [],
      }]);
    }
  }, [loading, fromGitHub, localProfile]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>加载排行榜...</div>;

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
              fontWeight: r.username === localProfile?.username ? 700 : 400,
            }}>
              <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </td>
              <td style={{ padding: "10px 12px" }}>
                {r.username}
                {r.username === localProfile?.username && <span style={{ color: "var(--color-accent)", marginLeft: 4, fontSize: 10 }}>👈 你</span>}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-accent)", fontWeight: 700 }}>🫘 {r.beans.toLocaleString()}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--color-text-secondary)" }}>{r.totalBets}</td>
              <td style={{ padding: "10px 12px", textAlign: "right", color: (r.totalBets > 0 && (r.wonBets / r.totalBets) >= 0.5) ? "var(--color-positive)" : "var(--color-text-secondary)" }}>
                {r.totalBets > 0 ? Math.round((r.wonBets / r.totalBets) * 1000) / 10 : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ color: "var(--color-text-muted)", fontSize: 9, textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
        {fromGitHub
          ? "数据来源: GitHub 仓库 · 每笔投注经 workflow_dispatch 提交"
          : "当前为本地模式 · 配置 GitHub Token 可参与真实排名"}
      </p>
    </div>
  );
}
