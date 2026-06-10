import { useState, useEffect, useCallback } from "react";
import { supabase, type Profile } from "../lib/supabase";

interface Props {
  onClose: () => void;
  onLogin: (profile: Profile) => void;
}

export default function AuthModal({ onClose, onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) { setError("请输入昵称"); return; }
    if (name.length < 2) { setError("昵称至少2个字符"); return; }
    if (name.length > 20) { setError("昵称最多20个字符"); return; }

    setLoading(true);
    setError("");

    try {
      // 生成匿名凭据
      const uid = Math.random().toString(36).slice(2, 10);
      const email = `user_${uid}@wc2026.local`;
      const password = `wc2026_${uid}_${Date.now()}`;

      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: name } },
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error("注册失败");

      // 更新 profile 的 username
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ username: name })
        .eq("id", authData.user.id);

      if (profileErr) throw profileErr;

      // 读取完整 profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (profile) onLogin(profile as Profile);
    } catch (err: any) {
      setError(err.message || "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [username, onLogin]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div style={{
        position: "relative", background: "var(--color-bg, #0a1628)",
        borderRadius: 16, padding: "28px 24px", maxWidth: 380, width: "90%",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>🎯 加入竞猜</h2>
        <p style={{ margin: "0 0 20px", color: "var(--color-text-secondary)", fontSize: 12 }}>
          输入昵称，立即获取 <strong style={{ color: "var(--color-accent)" }}>10000 豆</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(""); }}
            placeholder="输入你的昵称..."
            maxLength={20}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)", outline: "none",
              background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14,
              boxSizing: "border-box",
            }}
          />
          {error && (
            <div style={{ color: "#E53935", fontSize: 11, marginTop: 6 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", marginTop: 14, padding: "12px",
              borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg, #FFD700, #FFA000)",
              color: "#0a1628", fontSize: 15, fontWeight: 700,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "注册中..." : "🚀 免费领取 10000 豆"}
          </button>
        </form>

        <p style={{ color: "var(--color-text-muted)", fontSize: 10, marginTop: 14, textAlign: "center" }}>
          仅用于竞猜统计，不收集个人信息
        </p>
      </div>
    </div>
  );
}
