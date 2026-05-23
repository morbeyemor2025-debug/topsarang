"use client";

import { useState, useEffect, useCallback, use } from "react";
import { supabase } from "@/lib/supabase";
import type { Salon, Barber, QueueTicket } from "@/lib/types";

interface Props {
  params: Promise<{ salon: string }>;
}

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

  const [form, setForm] = useState({ name: "", phone: "", barber_id: "" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: salonData } = await supabase
        .from("salons")
        .select("*")
        .eq("slug", salonSlug)
        .single();

      if (!salonData) {
        setError("Salon introuvable.");
        setLoading(false);
        return;
      }
      setSalon(salonData);

      const { data: barbersData } = await supabase
        .from("barbers")
        .select("*")
        .eq("salon_id", salonData.id)
        .eq("is_active", true);

      setBarbers(barbersData ?? []);

      const { count } = await supabase
        .from("queue_tickets")
        .select("*", { count: "exact", head: true })
        .eq("salon_id", salonData.id)
        .eq("status", "waiting");

      setQueueCount(count ?? 0);
      setLoading(false);
    };
    load();
  }, [salonSlug]);

  const subscribeToTicket = useCallback((ticketId: string) => {
    const channel = supabase
      .channel("ticket-" + ticketId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "queue_tickets",
          filter: `id=eq.${ticketId}`,
        },
        (payload) => {
          setMyTicket(payload.new as QueueTicket);
        }
      )
      .subscribe();
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
    if (!form.name.trim()) {
      setError("Entre ton prénom.");
      return;
    }
    if (!salon) return;
    setSubmitting(true);
    setError("");

    const { count } = await supabase
      .from("queue_tickets")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id);

    const ticketNumber = (count ?? 0) + 1;
    const waitMinutes = queueCount * 20;

    const { data, error: insertError } = await supabase
      .from("queue_tickets")
      .insert({
        salon_id: salon.id,
        barber_id: form.barber_id || null,
        ticket_number: ticketNumber,
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim() || null,
        status: "waiting",
        estimated_wait_minutes: waitMinutes,
      })
      .select()
      .single();

    if (insertError) {
      setError("Erreur lors de l'inscription. Réessaie.");
      setSubmitting(false);
      return;
    }

    setMyTicket(data);
    setQueueCount((c) => c + 1);
    setStep("ticket");
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="rangpro-loading">
        <div className="spinner" />
        <p>Chargement...</p>
      </div>
    );
  }

  if (error && !salon) {
    return (
      <div className="rangpro-error">
        <span>🇸🇳</span>
        <h2>{error}</h2>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d0d; font-family: 'Georgia', serif; min-height: 100vh; }
        .page { min-height: 100vh; background: linear-gradient(135deg, #0d0d0d 0%, #1a1208 50%, #0d0d0d 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; }
        .card { background: #141414; border: 1px solid #2a2010; border-radius: 24px; padding: 40px 32px; width: 100%; max-width: 420px; box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(186,122,43,0.1); animation: fadeUp 0.5s ease; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(186,122,43,0.15); border: 1px solid rgba(186,122,43,0.3); border-radius: 100px; padding: 4px 14px; font-size: 12px; color: #f4b23f; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 20px; }
        .salon-name { font-size: 28px; font-weight: 700; color: #f7f5ef; line-height: 1.2; margin-bottom: 8px; }
        .salon-sub { color: #666; font-size: 14px; margin-bottom: 32px; }
        .queue-pill { display: flex; align-items: center; gap: 12px; background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 16px; padding: 16px 20px; margin-bottom: 32px; }
        .queue-num { font-size: 36px; font-weight: 800; color: #ba7a2b; line-height: 1; }
        .queue-label { color: #888; font-size: 13px; line-height: 1.4; }
        .queue-wait { color: #f4b23f; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .btn-primary { width: 100%; background: linear-gradient(135deg, #ba7a2b, #f4b23f); color: #0d0d0d; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.2s; letter-spacing: 0.02em; font-family: inherit; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(186,122,43,0.4); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .label { display: block; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; margin-top: 20px; }
        .input { width: 100%; background: #1e1e1e; border: 1px solid #2a2a2a; border-radius: 12px; padding: 14px 16px; color: #f7f5ef; font-size: 15px; font-family: inherit; transition: border-color 0.2s; outline: none; }
        .input:focus { border-color: #ba7a2b; }
        .input::placeholder { color: #444; }
        select.input option { background: #1e1e1e; }
        .error-msg { color: #dc5750; font-size: 13px; margin-top: 12px; text-align: center; }
        .ticket-number { font-size: 96px; font-weight: 900; color: #ba7a2b; line-height: 1; text-align: center; margin: 16px 0; text-shadow: 0 0 60px rgba(186,122,43,0.3); }
        .ticket-label { text-align: center; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 4px; }
        .status-badge { display: inline-flex; align-items: center; gap: 8px; border-radius: 100px; padding: 8px 20px; font-size: 13px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin: 16px auto; }
        .status-waiting { background: rgba(186,122,43,0.15); border: 1px solid rgba(186,122,43,0.3); color: #f4b23f; }
        .status-called { background: rgba(15,143,100,0.15); border: 1px solid rgba(15,143,100,0.4); color: #0f8f64; animation: pulse 1.5s infinite; }
        .status-served { background: rgba(247,245,239,0.08); border: 1px solid #333; color: #888; }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(15,143,100,0.4); } 50% { box-shadow: 0 0 0 8px rgba(15,143,100,0); } }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #1e1e1e; color: #666; font-size: 13px; }
        .info-row span:last-child { color: #f7f5ef; font-weight: 500; }
        .called-banner { background: linear-gradient(135deg, rgba(15,143,100,0.2), rgba(15,143,100,0.05)); border: 1px solid rgba(15,143,100,0.3); border-radius: 16px; padding: 20px; text-align: center; margin-top: 20px; }
        .called-banner h3 { color: #0f8f64; font-size: 18px; margin-bottom: 4px; }
        .called-banner p { color: #666; font-size: 13px; }
        .rangpro-loading, .rangpro-error { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: #0d0d0d; color: #888; }
        .spinner { width: 32px; height: 32px; border: 3px solid #2a2a2a; border-top-color: #ba7a2b; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .logo { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
        .logo-text { font-size: 13px; font-weight: 700; color: #ba7a2b; letter-spacing: 0.12em; text-transform: uppercase; }
        .divider { height: 1px; background: #1e1e1e; margin: 24px 0; }
        .back-btn { background: none; border: none; color: #666; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; margin-bottom: 20px; padding: 0; font-family: inherit; }
        .back-btn:hover { color: #f4b23f; }
        .status-center { display: flex; flex-direction: column; align-items: center; }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo">
            <span>🇸🇳</span>
            <span className="logo-text">Rangpro SN</span>
          </div>

          {step === "welcome" && (
            <>
              <div className="badge">✂️ File d&apos;attente</div>
              <h1 className="salon-name">{salon?.name ?? salonSlug}</h1>
              {salon?.address && <p className="salon-sub">📍 {salon.address}</p>}
              <div className="queue-pill">
                <div>
                  <div className="queue-num">{queueCount}</div>
                </div>
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

          {step === "form" && (
            <>
              <button className="back-btn" onClick={() => setStep("welcome")}>← Retour</button>
              <div className="badge">✍️ Inscription</div>
              <h2 className="salon-name" style={{ fontSize: 22 }}>Tes infos</h2>

              <label className="label">Prénom *</label>
              <input
                className="input"
                placeholder="Modou, Fatou..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
              />

              <label className="label">Téléphone (optionnel)</label>
              <input
                className="input"
                placeholder="+221 77 000 00 00"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />

              {barbers.length > 0 && (
                <>
                  <label className="label">Coiffeur (optionnel)</label>
                  <select
                    className="input"
                    value={form.barber_id}
                    onChange={(e) => setForm({ ...form, barber_id: e.target.value })}
                  >
                    <option value="">— Peu importe —</option>
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </>
              )}

              {error && <p className="error-msg">{error}</p>}

              <div style={{ marginTop: 28 }}>
                <button className="btn-primary" onClick={handleJoin} disabled={submitting}>
                  {submitting ? "Inscription..." : "Prendre mon ticket →"}
                </button>
              </div>
            </>
          )}

          {step === "ticket" && myTicket && (
            <>
              <div className="badge">🎟️ Ton ticket</div>
              <div className="status-center">
                <p className="ticket-label">Numéro</p>
                <div className="ticket-number">#{myTicket.ticket_number}</div>
                <div
                  className={`status-badge ${
                    myTicket.status === "called"
                      ? "status-called"
                      : myTicket.status === "served"
                      ? "status-served"
                      : "status-waiting"
                  }`}
                >
                  <span>
                    {myTicket.status === "called" ? "🔔" : myTicket.status === "served" ? "✅" : "⏳"}
                  </span>
                  {myTicket.status === "called"
                    ? "C'est ton tour !"
                    : myTicket.status === "served"
                    ? "Servi"
                    : "En attente"}
                </div>
              </div>

              <div className="divider" />

              <div className="info-row">
                <span>Nom</span>
                <span>{myTicket.customer_name}</span>
              </div>
              <div className="info-row">
                <span>Position</span>
                <span>{queueCount} personne(s) avant toi</span>
              </div>
              {myTicket.estimated_wait_minutes != null && (
                <div className="info-row">
                  <span>Attente estimée</span>
                  <span>≈ {myTicket.estimated_wait_minutes} min</span>
                </div>
              )}
              {myTicket.barber_id && (
                <div className="info-row">
                  <span>Coiffeur</span>
                  <span>{barbers.find((b) => b.id === myTicket.barber_id)?.name ?? "—"}</span>
                </div>
              )}

              {myTicket.status === "called" && (
                <div className="called-banner">
                  <h3>🔔 C&apos;est ton tour !</h3>
                  <p>Présente-toi au comptoir maintenant.</p>
                </div>
              )}

              {myTicket.status === "waiting" && (
                <p style={{ color: "#555", fontSize: 12, textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
                  Reste sur cette page. Tu seras alerté quand c&apos;est ton tour.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
