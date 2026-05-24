"use client";

import { useState, useEffect, useCallback, use } from "react";
import { supabase } from "@/lib/supabase";
import type { Salon, Barber, QueueTicket } from "@/lib/types";

interface Props { params: Promise<{ salon: string }>; }
type Step = "welcome" | "form" | "ticket";

export default function JoinPage({ params }: Props) {
  const { salon: salonSlug } = use(params);

  const [step, setStep] = useState<Step>("welcome");
  const [salon, setSalon] = useState<Salon | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [myTicket, setMyTicket] = useState<QueueTicket | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isReturning, setIsReturning] = useState(false); // client connu

  const [form, setForm] = useState({
    name: "",
    phone: "",
    barber_id: "",
    service: "",
    accepts_marketing: true,
  });

  useEffect(() => {
    const load = async () => {
      const { data: salonData } = await supabase
        .from("salons").select("*").eq("slug", salonSlug).single();
      if (!salonData) { setError("Salon introuvable."); setLoading(false); return; }
      setSalon(salonData);

      const { data: barbersData } = await supabase
        .from("barbers").select("*")
        .eq("salon_id", salonData.id).eq("is_active", true);
      setBarbers(barbersData ?? []);

      const { count } = await supabase
        .from("queue_tickets").select("*", { count: "exact", head: true })
        .eq("salon_id", salonData.id).eq("status", "waiting");
      setQueueCount(count ?? 0);
      setLoading(false);
    };
    load();
  }, [salonSlug]);

  // Quand le téléphone est saisi, on cherche si le client existe déjà
  const handlePhoneBlur = async () => {
    if (!form.phone.trim() || !salon) return;
    const { data } = await supabase
      .from("customers")
      .select("name, accepts_marketing")
      .eq("salon_id", salon.id)
      .eq("phone", form.phone.trim())
      .single();
    if (data) {
      setForm(f => ({
        ...f,
        name: data.name,
        accepts_marketing: data.accepts_marketing,
      }));
      setIsReturning(true);
    } else {
      setIsReturning(false);
    }
  };

  const subscribeToTicket = useCallback((ticketId: string) => {
    const channel = supabase.channel("ticket-" + ticketId)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "queue_tickets", filter: `id=eq.${ticketId}` },
        (payload) => setMyTicket(payload.new as QueueTicket)
      ).subscribe();
    return channel;
  }, []);

  useEffect(() => {
    if (myTicket?.id) {
      const channel = subscribeToTicket(myTicket.id);
      return () => { supabase.removeChannel(channel); };
    }
  }, [myTicket?.id, subscribeToTicket]);

  useEffect(() => {
    if (myTicket?.status === "called") {
      document.title = "🔔 C'EST TON TOUR ! — RANGPRO SN";
    }
  }, [myTicket?.status]);

  const handleJoin = async () => {
    setError("");
    if (!form.name.trim()) { setError("Entre ton prénom."); return; }
    if (!form.phone.trim()) { setError("Le numéro de téléphone est obligatoire."); return; }
    if (!/^\+?[\d\s]{8,15}$/.test(form.phone.trim())) {
      setError("Numéro de téléphone invalide."); return;
    }
    if (!salon) return;
    setSubmitting(true);

    // Upsert client — crée ou met à jour
    let customerId: string | null = null;
    const { data: existing } = await supabase
      .from("customers").select("id, total_visits")
      .eq("salon_id", salon.id).eq("phone", form.phone.trim()).single();

    if (existing) {
      await supabase.from("customers").update({
        name: form.name.trim(),
        total_visits: existing.total_visits + 1,
        last_visit_at: new Date().toISOString(),
        accepts_marketing: form.accepts_marketing,
        marketing_opt_in_at: form.accepts_marketing ? new Date().toISOString() : null,
      }).eq("id", existing.id);
      customerId = existing.id;
    } else {
      const { data: newC } = await supabase.from("customers").insert({
        salon_id: salon.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        accepts_marketing: form.accepts_marketing,
        marketing_opt_in_at: form.accepts_marketing ? new Date().toISOString() : null,
      }).select("id").single();
      customerId = newC?.id ?? null;
    }

    // Numéro de ticket
    const { count } = await supabase
      .from("queue_tickets").select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id);
    const ticketNumber = (count ?? 0) + 1;
    const waitMinutes = queueCount * 20;

    const { data, error: insertError } = await supabase
      .from("queue_tickets").insert({
        salon_id: salon.id,
        barber_id: form.barber_id || null,
        customer_id: customerId,
        ticket_number: ticketNumber,
        service_requested: form.service.trim() || "Coupe",
        status: "waiting",
        estimated_wait_minutes: waitMinutes,
        live_position: queueCount + 1,
        people_ahead: queueCount,
      }).select().single();

    if (insertError) {
      setError("Erreur lors de l'inscription. Réessaie.");
      setSubmitting(false);
      return;
    }

    setMyTicket(data);
    setQueueCount(c => c + 1);
    setStep("ticket");
    setSubmitting(false);
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, background:"#0d0d0d", fontFamily:"Georgia,serif", color:"#888" }}>
      <div style={{ width:32, height:32, border:"3px solid #2a2a2a", borderTopColor:"#ba7a2b", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <p>Chargement...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  if (error && !salon) return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, background:"#0d0d0d", fontFamily:"Georgia,serif" }}>
      <span style={{ fontSize:40 }}>🇸🇳</span>
      <h2 style={{ color:"#dc5750" }}>{error}</h2>
    </div>
  );

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#0d0d0d;font-family:'Georgia',serif;min-height:100vh;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:translateY(0);}}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(15,143,100,0.4);}50%{box-shadow:0 0 0 8px rgba(15,143,100,0);}}
        .page{min-height:100vh;background:linear-gradient(135deg,#0d0d0d 0%,#1a1208 50%,#0d0d0d 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;}
        .card{background:#141414;border:1px solid #2a2010;border-radius:24px;padding:40px 32px;width:100%;max-width:420px;box-shadow:0 40px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(186,122,43,0.1);animation:fadeUp 0.5s ease;}
        .logo{display:flex;align-items:center;gap:8px;margin-bottom:24px;}
        .logo-text{font-size:13px;font-weight:700;color:#ba7a2b;letter-spacing:0.12em;text-transform:uppercase;}
        .badge{display:inline-flex;align-items:center;gap:6px;background:rgba(186,122,43,0.15);border:1px solid rgba(186,122,43,0.3);border-radius:100px;padding:4px 14px;font-size:12px;color:#f4b23f;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:20px;}
        .salon-name{font-size:28px;font-weight:700;color:#f7f5ef;line-height:1.2;margin-bottom:8px;}
        .salon-sub{color:#666;font-size:14px;margin-bottom:32px;}
        .queue-pill{display:flex;align-items:center;gap:12px;background:#1e1e1e;border:1px solid #2a2a2a;border-radius:16px;padding:16px 20px;margin-bottom:32px;}
        .queue-num{font-size:36px;font-weight:800;color:#ba7a2b;line-height:1;}
        .queue-label{color:#888;font-size:13px;line-height:1.4;}
        .queue-wait{color:#f4b23f;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;}
        .btn-primary{width:100%;background:linear-gradient(135deg,#ba7a2b,#f4b23f);color:#0d0d0d;border:none;border-radius:14px;padding:16px;font-size:16px;font-weight:700;cursor:pointer;transition:all 0.2s;font-family:inherit;}
        .btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(186,122,43,0.4);}
        .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
        .label{display:block;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;margin-top:18px;}
        .input{width:100%;background:#1e1e1e;border:1px solid #2a2a2a;border-radius:12px;padding:14px 16px;color:#f7f5ef;font-size:15px;font-family:inherit;transition:border-color 0.2s;outline:none;}
        .input:focus{border-color:#ba7a2b;}
        .input::placeholder{color:#444;}
        select.input option{background:#1e1e1e;}
        .input-hint{color:#555;font-size:11px;margin-top:6px;}
        .returning-banner{background:rgba(186,122,43,0.08);border:1px solid rgba(186,122,43,0.2);border-radius:12px;padding:12px 16px;margin-top:12px;color:#f4b23f;font-size:13px;display:flex;align-items:center;gap:8px;}
        .error-msg{color:#dc5750;font-size:13px;margin-top:12px;text-align:center;}
        .marketing-check{display:flex;align-items:flex-start;gap:12px;margin-top:20px;cursor:pointer;}
        .marketing-check input[type=checkbox]{width:18px;height:18px;accent-color:#ba7a2b;cursor:pointer;flex-shrink:0;margin-top:2px;}
        .marketing-check-label{color:#666;font-size:12px;line-height:1.5;cursor:pointer;}
        .marketing-check-label span{color:#f4b23f;}
        .divider{height:1px;background:#1e1e1e;margin:24px 0;}
        .back-btn{background:none;border:none;color:#666;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px;margin-bottom:20px;padding:0;font-family:inherit;}
        .back-btn:hover{color:#f4b23f;}
        .ticket-number{font-size:96px;font-weight:900;color:#ba7a2b;line-height:1;text-align:center;margin:16px 0;text-shadow:0 0 60px rgba(186,122,43,0.3);}
        .ticket-label{text-align:center;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;}
        .status-badge{display:inline-flex;align-items:center;gap:8px;border-radius:100px;padding:8px 20px;font-size:13px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin:16px auto;}
        .s-waiting{background:rgba(186,122,43,0.15);border:1px solid rgba(186,122,43,0.3);color:#f4b23f;}
        .s-called{background:rgba(15,143,100,0.15);border:1px solid rgba(15,143,100,0.4);color:#0f8f64;animation:pulse 1.5s infinite;}
        .s-served{background:rgba(247,245,239,0.08);border:1px solid #333;color:#888;}
        .info-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #1e1e1e;color:#666;font-size:13px;}
        .info-row span:last-child{color:#f7f5ef;font-weight:500;}
        .called-banner{background:linear-gradient(135deg,rgba(15,143,100,0.2),rgba(15,143,100,0.05));border:1px solid rgba(15,143,100,0.3);border-radius:16px;padding:20px;text-align:center;margin-top:20px;}
        .called-banner h3{color:#0f8f64;font-size:18px;margin-bottom:4px;}
        .called-banner p{color:#666;font-size:13px;}
        .status-center{display:flex;flex-direction:column;align-items:center;}
        .promo-banner{background:rgba(186,122,43,0.08);border:1px solid rgba(186,122,43,0.2);border-radius:12px;padding:12px 16px;margin-top:16px;color:#888;font-size:12px;line-height:1.5;text-align:center;}
        .promo-banner span{color:#f4b23f;font-weight:600;}
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo">
            <span>🇸🇳</span>
            <span className="logo-text">Rangpro SN</span>
          </div>

          {/* ── WELCOME ── */}
          {step === "welcome" && (
            <>
              <div className="badge">✂️ File d&apos;attente</div>
              <h1 className="salon-name">{salon?.name ?? salonSlug}</h1>
              {salon?.city && <p className="salon-sub">📍 {salon.city}</p>}
              <div className="queue-pill">
                <div><div className="queue-num">{queueCount}</div></div>
                <div>
                  <div className="queue-label">personnes en attente</div>
                  <div className="queue-wait">≈ {queueCount * 20} min d&apos;attente</div>
                </div>
              </div>
              <button className="btn-primary" onClick={() => setStep("form")}>
                Rejoindre la file →
              </button>
            </>
          )}

          {/* ── FORM ── */}
          {step === "form" && (
            <>
              <button className="back-btn" onClick={() => { setStep("welcome"); setError(""); setIsReturning(false); }}>
                ← Retour
              </button>
              <div className="badge">✍️ Tes infos</div>
              <h2 className="salon-name" style={{ fontSize:22 }}>
                {isReturning ? "Bon retour ! 👋" : "Rejoindre la file"}
              </h2>

              {/* TÉLÉPHONE EN PREMIER — identifiant principal */}
              <label className="label">Téléphone *</label>
              <input
                className="input"
                type="tel"
                placeholder="+221 77 000 00 00"
                value={form.phone}
                onChange={e => { setForm({ ...form, phone: e.target.value }); setIsReturning(false); }}
                onBlur={handlePhoneBlur}
                autoFocus
              />
              <p className="input-hint">Utilisé pour t&apos;alerter et recevoir des offres exclusives</p>

              {isReturning && (
                <div className="returning-banner">
                  ✨ Client fidèle détecté — tes infos ont été pré-remplies !
                </div>
              )}

              <label className="label">Prénom *</label>
              <input
                className="input"
                placeholder="Modou, Fatou..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />

              <label className="label">Service souhaité</label>
              <input
                className="input"
                placeholder="Coupe, barbe, dégradé..."
                value={form.service}
                onChange={e => setForm({ ...form, service: e.target.value })}
              />

              {barbers.length > 0 && (
                <>
                  <label className="label">Coiffeur (optionnel)</label>
                  <select className="input" value={form.barber_id}
                    onChange={e => setForm({ ...form, barber_id: e.target.value })}>
                    <option value="">— Peu importe —</option>
                    {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </>
              )}

              {/* CONSENTEMENT MARKETING */}
              <label className="marketing-check">
                <input
                  type="checkbox"
                  checked={form.accepts_marketing}
                  onChange={e => setForm({ ...form, accepts_marketing: e.target.checked })}
                />
                <span className="marketing-check-label">
                  J&apos;accepte de recevoir des <span>offres et promos</span> de {salon?.name ?? "ce salon"} par SMS. Tu peux te désabonner à tout moment.
                </span>
              </label>

              {error && <p className="error-msg">{error}</p>}

              <div style={{ marginTop:24 }}>
                <button className="btn-primary" onClick={handleJoin} disabled={submitting}>
                  {submitting ? "Inscription..." : "Prendre mon ticket →"}
                </button>
              </div>
            </>
          )}

          {/* ── TICKET ── */}
          {step === "ticket" && myTicket && (
            <>
              <div className="badge">🎟️ Ton ticket</div>
              <div className="status-center">
                <p className="ticket-label">Numéro</p>
                <div className="ticket-number">#{myTicket.ticket_number}</div>
                <div className={`status-badge ${
                  myTicket.status === "called" ? "s-called"
                  : myTicket.status === "served" ? "s-served"
                  : "s-waiting"
                }`}>
                  <span>{myTicket.status === "called" ? "🔔" : myTicket.status === "served" ? "✅" : "⏳"}</span>
                  {myTicket.status === "called" ? "C'est ton tour !"
                    : myTicket.status === "served" ? "Servi"
                    : "En attente"}
                </div>
              </div>

              <div className="divider" />

              <div className="info-row"><span>Nom</span><span>{form.name}</span></div>
              <div className="info-row"><span>Service</span><span>{myTicket.service_requested}</span></div>
              <div className="info-row">
                <span>Position</span>
                <span>{myTicket.people_ahead} personne(s) avant toi</span>
              </div>
              {myTicket.estimated_wait_minutes > 0 && (
                <div className="info-row">
                  <span>Attente estimée</span>
                  <span>≈ {myTicket.estimated_wait_minutes} min</span>
                </div>
              )}
              {myTicket.barber_id && (
                <div className="info-row">
                  <span>Coiffeur</span>
                  <span>{barbers.find(b => b.id === myTicket.barber_id)?.name ?? "—"}</span>
                </div>
              )}

              {myTicket.status === "called" && (
                <div className="called-banner">
                  <h3>🔔 C&apos;est ton tour !</h3>
                  <p>Présente-toi au comptoir maintenant.</p>
                </div>
              )}

              {myTicket.status === "waiting" && (
                <p style={{ color:"#555", fontSize:12, textAlign:"center", marginTop:20, lineHeight:1.6 }}>
                  Reste sur cette page. Tu seras alerté quand c&apos;est ton tour.
                </p>
              )}

              {form.accepts_marketing && myTicket.status !== "called" && (
                <div className="promo-banner">
                  <span>✅ Inscrit aux promos</span><br />
                  Tu recevras les offres exclusives de {salon?.name} sur le <strong>{form.phone}</strong>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
