import { useState, useEffect, useCallback } from "react";

const COUNTER_API = "https://api.counterapi.dev/v1/worldcup2026";

interface Counts {
  today: number;
  total: number;
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
      const alreadyCounted = sessionStorage.getItem(sessionKey);

      // 首次访问用 /up 递增，后续访问用 trailing slash 读取
      const [todayRes, totalRes] = await Promise.all([
        alreadyCounted
          ? fetchWithTimeout(`${COUNTER_API}/${todayKey}/`)
          : fetchWithTimeout(`${COUNTER_API}/${todayKey}/up`),
        alreadyCounted
          ? fetchWithTimeout(`${COUNTER_API}/total/`)
          : fetchWithTimeout(`${COUNTER_API}/total/up`),
      ]);

      if (!todayRes.ok || !totalRes.ok) throw new Error("API not ok");

      const todayData = await todayRes.json();
      const totalData = await totalRes.json();

      setCounts({
        today: todayData.count ?? 0,
        total: totalData.count ?? 0,
      });
      setError(false);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 600);

      if (!alreadyCounted) {
        sessionStorage.setItem(sessionKey, "1");
      }
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
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
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>👁 今日</span>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--color-accent)",
            minWidth: "36px",
            textAlign: "center",
            transition: "transform 0.3s ease",
            transform: animating ? "scale(1.15)" : "scale(1)",
          }}
        >
          {counts ? formatCount(counts.today) : error ? "—" : "···"}
        </span>
      </div>

      <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />

      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>累计</span>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--color-text-primary)",
            minWidth: "48px",
            textAlign: "center",
            transition: "transform 0.3s ease",
            transform: animating ? "scale(1.15)" : "scale(1)",
          }}
        >
          {counts ? formatCount(counts.total) : error ? "—" : "···"}
        </span>
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1) + "K";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return String(n);
}
