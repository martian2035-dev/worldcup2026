import { useState, useEffect } from "react";

interface Props {
  target: string;
  label: string;
}

export default function CountdownTimer({ target, label }: Props) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const targetDate = new Date(target).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = targetDate - now;

      if (diff <= 0) {
        setIsLive(true);
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (isLive) {
    return (
      <div className="glass-card" style={{ display: "inline-block", padding: "18px 36px" }}>
        <div style={{ color: "var(--color-accent)", fontSize: "24px", fontWeight: 700 }}>
          ⚽ 比赛进行中！
        </div>
      </div>
    );
  }

  const digits = [
    { value: timeLeft.days, label: "天" },
    { value: timeLeft.hours, label: "时" },
    { value: timeLeft.minutes, label: "分" },
    { value: timeLeft.seconds, label: "秒" },
  ];

  return (
    <div className="glass-card" style={{ display: "inline-block", padding: "18px 36px" }}>
      <div style={{ color: "var(--color-text-muted)", fontSize: "10px", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "baseline" }}>
        {digits.map((d, i) => (
          <div key={i} style={{ textAlign: "center", minWidth: 48 }}>
            <div style={{ color: "var(--color-accent)", fontSize: "clamp(22px,4vw,32px)", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {String(d.value).padStart(2, "0")}
            </div>
            <div style={{ color: "var(--color-text-muted)", fontSize: "10px" }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
