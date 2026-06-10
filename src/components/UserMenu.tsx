import { useState, useEffect, useCallback } from "react";
import { supabase, type Profile } from "../lib/supabase";

interface Props {
  profile: Profile | null;
  onLogout: () => void;
}

export default function UserMenu({ profile, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [beans, setBeans] = useState(profile?.beans ?? 0);

  // 实时同步余额
  useEffect(() => {
    if (!profile) return;
    setBeans(profile.beans);

    const channel = supabase
      .channel("profile-changes")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` },
        (payload) => { setBeans((payload.new as Profile).beans); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    onLogout();
    setOpen(false);
  }, [onLogout]);

  if (!profile) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)", color: "#fff",
          cursor: "pointer", fontSize: 12,
        }}
      >
        <span style={{ color: "var(--color-accent)", fontWeight: 700 }}>🫘 {beans}</span>
        <span style={{ color: "var(--color-text-secondary)" }}>{profile.username}</span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 50 }}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0,
            minWidth: 180, borderRadius: 12, zIndex: 51,
            background: "var(--color-bg, #0a1628)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
            padding: 8,
          }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{profile.username}</div>
              <div style={{ fontSize: 11, color: "var(--color-accent)" }}>🫘 {beans} 豆</div>
            </div>
            <a href="/bet/mine/" style={{
              display: "block", padding: "8px 12px", fontSize: 12,
              color: "var(--color-text-secondary)", textDecoration: "none",
              borderRadius: 6,
            }}>📋 我的竞猜</a>
            <button onClick={handleLogout} style={{
              width: "100%", textAlign: "left", padding: "8px 12px",
              fontSize: 12, color: "var(--color-text-muted)",
              background: "none", border: "none", cursor: "pointer",
              borderRadius: 6,
            }}>退出登录</button>
          </div>
        </>
      )}
    </div>
  );
}
