"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setError("");
    setSuccess("");
    if (!email.trim() || !password.trim()) {
      setError("Remplis tous les champs.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Entre ton prénom.");
      return;
    }
    setLoading(true);

    if (mode === "login") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }
      // Check if user has a salon
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from("salon_members")
        .select("salon_id, salons(slug)")
        .eq("user_id", session.user.id)
        .single();

      if (!data) {
        router.replace("/setup");
      } else {
        const salon = (data as unknown as { salons: { slug: string } }).salons;
        router.replace(`/dashboard/${salon.slug}`);
      }
    } else {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setSuccess("Vérifie ton email pour confirmer ton compte, puis connecte-toi.");
      setMode("login");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; font-family: 'Georgia', serif; }
        .page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; background: radial-gradient(ellipse at top, #1a1208 0%, #0a0a0a 60%); }
        .card { background: #111; border: 1px solid #222; border-radius: 24px; padding: 40px 32px; width: 100%; max-width: 400px; box-shadow: 0 40px 80px rgba(0,0,0,0.5); }
        .logo { text-align: center; margin-bottom: 32px; }
        .logo-flag { font-size: 36px; display: block; margin-bottom: 8px; }
        .logo-name { font-size: 20px; font-weight: 800; color: #ba7a2b; letter-spacing: 0.12em; text-transform: uppercase; }
        .logo-sub { font-size: 12px; color: #555; margin-top: 4px; }
        .tabs { display: flex; background: #1a1a1a; border-radius: 12px; padding: 4px; margin-bottom: 28px; }
        .tab { flex: 1; padding: 10px; border: none; background: none; color: #555; font-family: inherit; font-size: 14px; font-weight: 600; border-radius: 9px; cursor: pointer; transition: all 0.2s; }
        .tab.active { background: #2a2a2a; color: #f7f5ef; }
        .label { display: block; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; margin-top: 18px; }
        .input { width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 14px 16px; color: #f7f5ef; font-size: 15px; font-family: inherit; outline: none; transition: border-color 0.2s; }
        .input:focus { border-color: #ba7a2b; }
        .input::placeholder { color: #444; }
        .btn { width: 100%; margin-top: 24px; background: linear-gradient(135deg, #ba7a2b, #f4b23f); color: #0a0a0a; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; transition: all 0.2s; letter-spacing: 0.02em; }
        .btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(186,122,43,0.4); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error { color: #dc5750; font-size: 13px; margin-top: 14px; text-align: center; }
        .success { color: #0f8f64; font-size: 13px; margin-top: 14px; text-align: center; line-height: 1.5; }
        .divider { height: 1px; background: #1e1e1e; margin: 24px 0; }
        .hint { color: #444; font-size: 12px; text-align: center; line-height: 1.6; }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo">
            <span className="logo-flag">🇸🇳</span>
            <div className="logo-name">RangPro SN</div>
            <div className="logo-sub">Gestion de file d&apos;attente</div>
          </div>

          <div className="tabs">
            <button className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>
              Connexion
            </button>
            <button className={`tab ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>
              Inscription
            </button>
          </div>

          {mode === "signup" && (
            <>
              <label className="label">Prénom</label>
              <input className="input" placeholder="Modou" value={name} onChange={e => setName(e.target.value)} />
            </>
          )}

          <label className="label">Email</label>
          <input className="input" type="email" placeholder="modou@example.com" value={email} onChange={e => setEmail(e.target.value)} />

          <label className="label">Mot de passe</label>
          <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />

          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}

          <button className="btn" onClick={handleSubmit} disabled={loading}>
            {loading ? "..." : mode === "login" ? "Se connecter →" : "Créer mon compte →"}
          </button>

          {mode === "signup" && (
            <>
              <div className="divider" />
              <p className="hint">Après inscription, tu pourras créer ton salon et générer ton QR code client.</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
