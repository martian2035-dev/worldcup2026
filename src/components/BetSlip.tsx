import { useState } from "react";

interface Props {
  matchLabel: string;
  betType: "home_win" | "draw" | "away_win";
  betLabel: string;
  odds: number;
  balance: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}

const AMOUNTS = [10, 20, 50, 100];

export default function BetSlip({ matchLabel, betLabel, odds, balance, onConfirm, onCancel }: Props) {
  const [amount, setAmount] = useState(20);
  const potentialWin = Math.round(amount * odds);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0 }} />
      <div style={{
        position: "relative", background: "var(--color-bg, #0a1628)",
        borderRadius: 16, padding: "24px 20px", maxWidth: 360, width: "90%",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700 }}>📝 确认投注</h3>

        <div style={{ color: "var(--color-text-secondary)", fontSize: 12, marginBottom: 4 }}>{matchLabel}</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
          投注: {betLabel} <span style={{ color: "var(--color-accent)" }}>@ {odds.toFixed(2)}</span>
        </div>

        {/* 金额选择 */}
        <div style={{ color: "var(--color-text-muted)", fontSize: 10, marginBottom: 6 }}>投注金额</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
          {AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              disabled={a > balance}
              style={{
                padding: "10px", borderRadius: 8, border: "none", cursor: a > balance ? "not-allowed" : "pointer",
                background: amount === a ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05))" : "rgba(255,255,255,0.04)",
                color: a > balance ? "var(--color-text-muted)" : "#fff",
                fontWeight: amount === a ? 700 : 400,
                opacity: a > balance ? 0.4 : 1,
              }}
            >
              🫘 {a}
            </button>
          ))}
        </div>

        {/* 预期收益 */}
        <div style={{
          padding: 12, borderRadius: 10,
          background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.1)",
          marginBottom: 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--color-text-secondary)" }}>投注金额</span>
            <span>🫘 {amount}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
            <span style={{ color: "var(--color-text-secondary)" }}>预计获得</span>
            <span style={{ color: "var(--color-positive)", fontWeight: 700 }}>🫘 {potentialWin}</span>
          </div>
          <div style={{ color: "var(--color-text-muted)", fontSize: 9, marginTop: 6 }}>
            余额: 🫘 {balance} → 🫘 {balance - amount}（投注后）
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
            background: "none", color: "var(--color-text-secondary)", cursor: "pointer", fontSize: 13,
          }}>取消</button>
          <button onClick={() => onConfirm(amount)} style={{
            flex: 1, padding: 10, borderRadius: 10, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #FFD700, #FFA000)",
            color: "#0a1628", fontSize: 13, fontWeight: 700,
          }}>确认投注 🫘{amount}</button>
        </div>
      </div>
    </div>
  );
}
