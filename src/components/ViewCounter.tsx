import { useState, useEffect, useCallback } from "react";

const COUNTER_API = "https://api.countapi.xyz";
const NAMESPACE = "worldcup2026";

interface Counts {
  today: number;
  total: number;
}

/** 获取今日日期字符串作为 namespace key */
function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 带超时的 fetch */
async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default function ViewCounter() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState(false);
  const [animating, setAnimating] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const todayKey = getTodayKey();
      const sessionKey = `wc-viewed-${todayKey}`;

      // 检查当前会话是否已经计数
      const alreadyCounted = sessionStorage.getItem(sessionKey);

      // 并行获取今日和总计（如果是新会话则触发计数）
      const [todayRes, totalRes] = await Promise.all([
        alreadyCounted
          ? fetchWithTimeout(`${COUNTER_API}/get/${NAMESPACE}/${todayKey}`)
          : fetchWithTimeout(`${COUNTER_API}/hit/${NAMESPACE}/${todayKey}`),
        alreadyCounted
          ? fetchWithTimeout(`${COUNTER_API}/get/${NAMESPACE}/total`)
          : fetchWithTimeout(`${COUNTER_API}/hit/${NAMESPACE}/total`),
      ]);

      if (!todayRes.ok || !totalRes.ok) {
        throw new Error("API response not ok");
      }

      const todayData = await todayRes.json();
      const totalData = await totalRes.json();

      const newCounts = {
        today: todayData.value ?? 0,
        total: totalData.value ?? 0,
      };

      setCounts(newCounts);
      setError(false);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);

      // 标记已计数
      if (!alreadyCounted) {
        sessionStorage.setItem(sessionKey, "1");
      }
    } catch {
      setError(true);
      // 保留上一次成功的计数
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    // 每 60 秒刷新一次计数（比赛期间可能有大量并发访问）
    const interval = setInterval(fetchCounts, 60_000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "16px",
        padding: "8px 20px",
        borderRadius: "24px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(8px)",
        transition: "all 0.3s ease",
      }}
    >
      {/* 今日 */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          👁 今日
        </span>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--color-accent)",
            minWidth: "36px",
            textAlign: "center",
            transition: "transform 0.3s ease, opacity 0.3s ease",
            transform: animating ? "scale(1.15)" : "scale(1)",
            opacity: animating ? 0.8 : 1,
          }}
        >
          {counts ? formatCount(counts.today) : error ? "—" : "···"}
        </span>
      </div>

      {/* 分隔线 */}
      <div
        style={{
          width: "1px",
          height: "20px",
          background: "rgba(255,255,255,0.1)",
        }}
      />

      {/* 累计 */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
          累计
        </span>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            minWidth: "48px",
            textAlign: "center",
            transition: "transform 0.3s ease, opacity 0.3s ease",
            transform: animating ? "scale(1.15)" : "scale(1)",
            opacity: animating ? 0.8 : 1,
          }}
        >
          {counts ? formatCount(counts.total) : error ? "—" : "···"}
        </span>
      </div>
    </div>
  );
}

/** 格式化大数字 */
function formatCount(n: number): string {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1) + "M";
  }
  if (n >= 10_000) {
    return (n / 1_000).toFixed(1) + "K";
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(2) + "K";
  }
  return String(n);
}
