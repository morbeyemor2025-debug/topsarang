"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SetupPage() {
  const router = useRouter();
  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Dakar");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const { data } = await supabase
        .from("salon_members")
        .select("salon_id, salons(slug)")
        .eq("user_id", session.user.id)
        .single();

      if (data) {
        const salon = (data as unknown as { salons: { slug: string } }).salons;
        router.replace(`/dashboard/${salon.slug}`);
        return;
      }
      setChecking(false);
    };
    check();
  }, [router]);

  const slugify = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleCreate = async () => {
    setError("");
    if (!salonName.trim()) { setError("Entre le nom de ton salon."); return; }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/login"); return; }

    // Generate unique slug
    let slug = slugify(salonName);
    const { data: existing } = await supabase
      .from("salons").select("slug").eq("slug", slug).single();
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    // Create salon
    const { data: salon, error: salonErr } = await supabase
      .from("salons")
      .insert({ name: salonName.trim(), slug, phone: phone.trim() || null, city: city.trim() || "Dakar", country: "Senegal" })
      .select()
      .single();

    if (salonErr || !salon) {
      setError("Erreur lors de la création du salon.");
      setLoading(false);
      return;
    }

    // Add user as owner
    const { error: memberErr } = await supabase
      .from("salon_members")
      .insert({ salon_id: salon.id, user_id: session.user.id, role: "owner" });

    if (memberErr) {
      setError("Erreur lors de la configuration.");
      setLoading(false);
      return;
    }

    router.replace(`/dashboard/${salon.slug}`);
  };

  if (checking) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #1e1e1e", borderTopColor: "#ba7a2b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; font-family: 'Georgia', serif; }
        .page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; background: radial-gradient(ellipse at top, #1a1208 0%, #0a0a0a 60%); }
        .card { background: #111; border: 1px solid #222; border-radius: 24px; padding: 40px 32px; width: 100%; max-width: 420px; }
        .step-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(186,122,43,0.15); border: 1px solid rgba(186,122,43,0.3); border-radius: 100px; padding: 4px 14px; font-size: 11px; color: #f4b23f; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 20px; }
        h1 { font-size: 26px; font-weight: 800; color: #f7f5ef; margin-bottom: 8px; }
        .sub { color: #555; font-size: 14px; margin-bottom: 32px; line-height: 1.5; }
        .label { display: block; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; margin-top: 18px; }
        .input { width: 100%; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 14px 16px; color: #f7f5ef; font-size: 15px; font-family: inherit; outline: none; transition: border-color 0.2s; }
        .input:focus { border-color: #ba7a2b; }
        .input::placeholder { color: #444; }
        .btn { width: 100%; margin-top: 28px; background: linear-gradient(135deg, #ba7a2b, #f4b23f); color: #0a0a0a; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(186,122,43,0.4); }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error { color: #dc5750; font-size: 13px; margin-top: 14px; text-align: center; }
        .preview { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 10px 14px; margin-top: 8px; color: #555; font-size: 12px; }
        .preview span { color: #ba7a2b; }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="step-badge">✂️ Configuration</div>
          <h1>Crée ton salon</h1>
          <p className="sub">Configure ton espace en 30 secondes. Tu pourras ensuite générer ton QR code et gérer ta file.</p>

          <label className="label">Nom du salon *</label>
          <input className="input" placeholder="Coiffure Excellence Dakar" value={salonName}
            onChange={e => setSalonName(e.target.value)} autoFocus />
          {salonName && (
            <div className="preview">
              Lien client : rangbi.vercel.app/join/<span>{slugify(salonName)}</span>
            </div>
          )}

          <label className="label">Téléphone (optionnel)</label>
          <input className="input" placeholder="+221 77 000 00 00" value={phone}
            onChange={e => setPhone(e.target.value)} />

          <label className="label">Ville</label>
          <input className="input" placeholder="Dakar" value={city}
            onChange={e => setCity(e.target.value)} />

          {error && <p className="error">{error}</p>}

          <button className="btn" onClick={handleCreate} disabled={loading}>
            {loading ? "Création..." : "Créer mon salon →"}
          </button>
        </div>
      </div>
    </>
  );
}
