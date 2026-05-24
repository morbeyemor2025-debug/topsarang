"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Salon, Barber, QueueTicket } from "@/lib/types";
import QRCode from "qrcode";

interface Props { params: Promise<{ salon: string }>; }

export default function DashboardPage({ params }: Props) {
  const { salon: salonSlug } = use(params);
  const router = useRouter();

  const [salon, setSalon] = useState<Salon | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"queue" | "barbers" | "qr">("queue");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [newBarberName, setNewBarberName] = useState("");
  const [addingBarber, setAddingBarber] = useState(false);

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }

      const { data } = await supabase
        .from("salon_members")
        .select("salon_id, salons(slug)")
        .eq("user_id", session.user.id)
        .single();

      if (!data) { router.replace("/setup"); return; }
      const s = (data as unknown as { salons: { slug: string } }).salons;
      if (s.slug !== salonSlug) { router.replace(`/dashboard/${s.slug}`); }
    };
    checkAuth();
  }, [salonSlug, router]);

  const loadData = useCallback(async () => {
    const { data: salonData } = await supabase
      .from("salons").select("*").eq("slug", salonSlug).single();

    if (!salonData) { setError("Salon introuvable."); setLoading(false); return; }
    setSalon(salonData);

    const { data: barbersData } = await supabase
      .from("barbers").select("*").eq("salon_id", salonData.id).order("name");
    setBarbers(barbersData ?? []);

    const { data: ticketsData, error: ticketsErr } = await supabase
      .from("queue_tickets").select("*")
      .eq("salon_id", salonData.id)
      .neq("status", "served")
      .neq("status", "cancelled")
      .order("ticket_number", { ascending: true });
    if (ticketsErr) console.error("tickets error:", ticketsErr);
    setTickets(ticketsData ?? []);
    setLoading(false);

    // Generate QR
    const joinUrl = `${window.location.origin}/join/${salonData.slug}`;
    const url = await QRCode.toDataURL(joinUrl, { width: 400, margin: 2, color: { dark: "#0a0a0a", light: "#f7f5ef" } });
    setQrDataUrl(url);
  }, [salonSlug]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!salon) return;
    const channel = supabase.channel("dash-" + salon.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets", filter: `salon_id=eq.${salon.id}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "barbers", filter: `salon_id=eq.${salon.id}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [salon, loadData]);

  const callNext = async (barberId?: string) => {
    const waiting = tickets.filter(t => t.status === "waiting" && (!barberId || t.barber_id === barberId || !t.barber_id));
    if (!waiting.length) return;
    const next = waiting[0];
    setActionLoading(next.id);
    await supabase.from("queue_tickets")
      .update({ status: "called", alert_triggered: true })
      .eq("id", next.id);
    setActionLoading(null);
  };

  const markServed = async (ticketId: string) => {
    setActionLoading(ticketId);
    await supabase.from("queue_tickets")
      .update({ status: "served", completed_at: new Date().toISOString() })
      .eq("id", ticketId);
    setActionLoading(null);
  };

  const cancelTicket = async (ticketId: string) => {
    setActionLoading(ticketId);
    await supabase.from("queue_tickets").update({ status: "cancelled" }).eq("id", ticketId);
    setActionLoading(null);
  };

  const toggleBarber = async (barber: Barber) => {
    await supabase.from("barbers").update({ is_active: !barber.is_active }).eq("id", barber.id);
  };

  const addBarber = async () => {
    if (!newBarberName.trim() || !salon) return;
    setAddingBarber(true);
    await supabase.from("barbers").insert({ salon_id: salon.id, name: newBarberName.trim() });
    setNewBarberName("");
    setAddingBarber(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const waitingCount = tickets.filter(t => t.status === "waiting").length;
  const calledCount = tickets.filter(t => t.status === "called").length;

  if (loading) return (
    <div className="db-loading">
      <div className="spinner" />
      <style>{`
        .db-loading { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0a0a0a; }
        .spinner { width:32px; height:32px; border:3px solid #1e1e1e; border-top-color:#ba7a2b; border-radius:50%; animation:spin 0.8s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0a0a" }}>
      <p style={{ color:"#dc5750" }}>{error}</p>
    </div>
  );

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${salonSlug}` : "";

  return (
    <>
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#0a0a0a; font-family:'Georgia',serif; color:#f7f5ef; min-height:100vh; }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(15,143,100,0.4); } 50% { box-shadow:0 0 0 6px rgba(15,143,100,0); } }
        .dashboard { max-width:900px; margin:0 auto; padding:0 16px 80px; animation:fadeUp 0.4s ease; }
        .header { display:flex; align-items:center; justify-content:space-between; padding:20px 0 18px; border-bottom:1px solid #1a1a1a; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
        .header-left { display:flex; align-items:center; gap:12px; }
        .salon-name { font-size:20px; font-weight:700; color:#f7f5ef; }
        .salon-badge { background:rgba(186,122,43,0.15); border:1px solid rgba(186,122,43,0.25); color:#f4b23f; font-size:11px; padding:3px 10px; border-radius:100px; text-transform:uppercase; letter-spacing:0.08em; }
        .live-dot { width:8px; height:8px; background:#0f8f64; border-radius:50%; animation:pulse 2s infinite; }
        .signout-btn { background:none; border:1px solid #222; color:#555; font-family:inherit; font-size:12px; padding:6px 14px; border-radius:8px; cursor:pointer; transition:all 0.2s; }
        .signout-btn:hover { border-color:#444; color:#f7f5ef; }
        .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
        .stat-card { background:#111; border:1px solid #1e1e1e; border-radius:16px; padding:20px 16px; text-align:center; }
        .stat-num { font-size:40px; font-weight:800; color:#ba7a2b; line-height:1; }
        .stat-num.green { color:#0f8f64; }
        .stat-num.white { color:#f7f5ef; }
        .stat-label { color:#555; font-size:11px; text-transform:uppercase; letter-spacing:0.08em; margin-top:6px; }
        .call-btn { width:100%; background:linear-gradient(135deg,#ba7a2b,#f4b23f); color:#0a0a0a; border:none; border-radius:14px; padding:18px; font-size:16px; font-weight:800; cursor:pointer; margin-bottom:24px; font-family:inherit; transition:all 0.2s; }
        .call-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 32px rgba(186,122,43,0.4); }
        .call-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .tabs { display:flex; gap:4px; background:#111; border:1px solid #1e1e1e; border-radius:12px; padding:4px; margin-bottom:20px; width:fit-content; }
        .tab { background:none; border:none; color:#555; padding:8px 18px; border-radius:9px; cursor:pointer; font-size:13px; font-family:inherit; font-weight:600; transition:all 0.2s; white-space:nowrap; }
        .tab.active { background:#1e1e1e; color:#f7f5ef; }
        .section-title { font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:#444; margin-bottom:14px; }
        .ticket-list { display:flex; flex-direction:column; gap:10px; }
        .ticket-card { background:#111; border:1px solid #1e1e1e; border-radius:16px; padding:16px 20px; display:flex; align-items:center; gap:14px; }
        .ticket-card.called { border-color:rgba(15,143,100,0.4); background:rgba(15,143,100,0.05); }
        .ticket-num { font-size:22px; font-weight:800; color:#ba7a2b; min-width:48px; text-align:center; }
        .ticket-info { flex:1; min-width:0; }
        .ticket-service { font-size:15px; font-weight:600; color:#f7f5ef; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .ticket-meta { color:#555; font-size:12px; margin-top:2px; }
        .status-pill { font-size:11px; padding:3px 10px; border-radius:100px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; white-space:nowrap; }
        .s-waiting { background:rgba(186,122,43,0.12); color:#f4b23f; border:1px solid rgba(186,122,43,0.25); }
        .s-called { background:rgba(15,143,100,0.12); color:#0f8f64; border:1px solid rgba(15,143,100,0.3); animation:pulse 2s infinite; }
        .ticket-actions { display:flex; gap:6px; flex-shrink:0; }
        .action-btn { border:none; border-radius:10px; padding:8px 12px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.15s; white-space:nowrap; }
        .action-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .btn-call { background:rgba(186,122,43,0.15); color:#f4b23f; border:1px solid rgba(186,122,43,0.3); }
        .btn-serve { background:rgba(15,143,100,0.15); color:#0f8f64; border:1px solid rgba(15,143,100,0.3); }
        .btn-cancel { background:rgba(220,87,80,0.1); color:#dc5750; border:1px solid rgba(220,87,80,0.2); }
        .empty-state { text-align:center; padding:60px 20px; color:#444; }
        .empty-state span { font-size:48px; display:block; margin-bottom:12px; }
        .barber-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:12px; }
        .barber-card { background:#111; border:1px solid #1e1e1e; border-radius:16px; padding:20px 16px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; }
        .barber-avatar { width:44px; height:44px; background:linear-gradient(135deg,#ba7a2b,#f4b23f); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:18px; }
        .barber-name { font-size:14px; font-weight:600; color:#f7f5ef; }
        .toggle-btn { width:100%; padding:7px; border-radius:9px; border:1px solid; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.2s; }
        .t-active { background:rgba(15,143,100,0.12); border-color:rgba(15,143,100,0.3); color:#0f8f64; }
        .t-inactive { background:rgba(220,87,80,0.08); border-color:rgba(220,87,80,0.2); color:#dc5750; }
        .add-barber { display:flex; gap:10px; margin-top:16px; }
        .add-input { flex:1; background:#1a1a1a; border:1px solid #2a2a2a; border-radius:10px; padding:10px 14px; color:#f7f5ef; font-size:14px; font-family:inherit; outline:none; }
        .add-input:focus { border-color:#ba7a2b; }
        .add-input::placeholder { color:#444; }
        .add-btn { background:rgba(186,122,43,0.2); border:1px solid rgba(186,122,43,0.3); color:#f4b23f; border-radius:10px; padding:10px 16px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; }
        .add-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .qr-section { display:flex; flex-direction:column; align-items:center; gap:20px; padding:20px 0; }
        .qr-box { background:#f7f5ef; border-radius:20px; padding:20px; box-shadow:0 20px 60px rgba(0,0,0,0.4); }
        .qr-box img { display:block; width:200px; height:200px; }
        .qr-url { background:#111; border:1px solid #1e1e1e; border-radius:12px; padding:12px 16px; color:#ba7a2b; font-size:13px; word-break:break-all; text-align:center; max-width:360px; }
        .qr-hint { color:#555; font-size:12px; text-align:center; line-height:1.6; max-width:300px; }
        .download-btn { background:linear-gradient(135deg,#ba7a2b,#f4b23f); color:#0a0a0a; border:none; border-radius:12px; padding:12px 24px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; transition:all 0.2s; }
        .download-btn:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(186,122,43,0.4); }
        @media (max-width:600px) { .ticket-actions { flex-direction:column; gap:4px; } .action-btn { padding:6px 10px; font-size:11px; } }
      `}</style>

      <div className="dashboard">
        {/* HEADER */}
        <div className="header">
          <div className="header-left">
            <span>🇸🇳</span>
            <div>
              <div className="salon-name">{salon?.name ?? salonSlug}</div>
              <span className="salon-badge">Dashboard</span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div className="live-dot" />
            <span style={{ color:"#555", fontSize:12 }}>Live</span>
            <button className="signout-btn" onClick={handleSignOut}>Déconnexion</button>
          </div>
        </div>

        {/* STATS */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-num">{waitingCount}</div>
            <div className="stat-label">En attente</div>
          </div>
          <div className="stat-card">
            <div className="stat-num green">{calledCount}</div>
            <div className="stat-label">Appelés</div>
          </div>
          <div className="stat-card">
            <div className="stat-num white">{barbers.filter(b => b.is_active).length}</div>
            <div className="stat-label">Coiffeurs actifs</div>
          </div>
        </div>

        {/* CALL NEXT */}
        <button className="call-btn" onClick={() => callNext()} disabled={waitingCount === 0 || !!actionLoading}>
          {waitingCount === 0
            ? "Aucun client en attente"
            : `🔔 Appeler le prochain — N°${tickets.find(t => t.status === "waiting")?.ticket_number ?? "?"}`}
        </button>

        {/* TABS */}
        <div className="tabs">
          <button className={`tab ${activeTab === "queue" ? "active" : ""}`} onClick={() => setActiveTab("queue")}>
            File ({tickets.length})
          </button>
          <button className={`tab ${activeTab === "barbers" ? "active" : ""}`} onClick={() => setActiveTab("barbers")}>
            Coiffeurs ({barbers.length})
          </button>
          <button className={`tab ${activeTab === "qr" ? "active" : ""}`} onClick={() => setActiveTab("qr")}>
            QR Code
          </button>
        </div>

        {/* QUEUE TAB */}
        {activeTab === "queue" && (
          <>
            <p className="section-title">Clients en cours</p>
            {tickets.length === 0 ? (
              <div className="empty-state"><span>✂️</span><p>Aucun client dans la file</p></div>
            ) : (
              <div className="ticket-list">
                {tickets.map(ticket => (
                  <div key={ticket.id} className={`ticket-card ${ticket.status === "called" ? "called" : ""}`}>
                    <div className="ticket-num">#{ticket.ticket_number}</div>
                    <div className="ticket-info">
                      <div className="ticket-service">{ticket.service_requested}</div>
                      <div className="ticket-meta">
                        {ticket.barber_id ? `✂️ ${barbers.find(b => b.id === ticket.barber_id)?.name ?? "?"}` : "Peu importe"}
                        {" · "}⏱ {ticket.estimated_wait_minutes} min
                      </div>
                    </div>
                    <div className={`status-pill ${ticket.status === "called" ? "s-called" : "s-waiting"}`}>
                      {ticket.status === "called" ? "Appelé" : "Attente"}
                    </div>
                    <div className="ticket-actions">
                      {ticket.status === "waiting" && (
                        <button className="action-btn btn-call" onClick={() => callNext(ticket.barber_id ?? undefined)} disabled={!!actionLoading}>
                          Appeler
                        </button>
                      )}
                      {ticket.status === "called" && (
                        <button className="action-btn btn-serve" onClick={() => markServed(ticket.id)} disabled={actionLoading === ticket.id}>
                          ✓ Servi
                        </button>
                      )}
                      <button className="action-btn btn-cancel" onClick={() => cancelTicket(ticket.id)} disabled={actionLoading === ticket.id}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* BARBERS TAB */}
        {activeTab === "barbers" && (
          <>
            <p className="section-title">Gestion des coiffeurs</p>
            {barbers.length === 0 ? (
              <div className="empty-state"><span>👤</span><p>Aucun coiffeur configuré</p></div>
            ) : (
              <div className="barber-grid">
                {barbers.map(barber => (
                  <div key={barber.id} className="barber-card">
                    <div className="barber-avatar">✂️</div>
                    <div className="barber-name">{barber.name}</div>
                    <button className={`toggle-btn ${barber.is_active ? "t-active" : "t-inactive"}`} onClick={() => toggleBarber(barber)}>
                      {barber.is_active ? "✓ Actif" : "✕ Inactif"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="add-barber">
              <input className="add-input" placeholder="Nom du coiffeur..." value={newBarberName}
                onChange={e => setNewBarberName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addBarber()} />
              <button className="add-btn" onClick={addBarber} disabled={addingBarber || !newBarberName.trim()}>
                + Ajouter
              </button>
            </div>
          </>
        )}

        {/* QR CODE TAB */}
        {activeTab === "qr" && (
          <div className="qr-section">
            <p className="section-title" style={{ alignSelf:"flex-start" }}>QR Code client</p>
            {qrDataUrl ? (
              <>
                <div className="qr-box">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR Code" />
                </div>
                <div className="qr-url">{joinUrl}</div>
                <p className="qr-hint">
                  Imprime ce QR code et affiche-le dans ton salon. Les clients le scannent pour rejoindre la file sans se lever.
                </p>
                <a href={qrDataUrl} download={`qr-${salonSlug}.png`}>
                  <button className="download-btn">⬇ Télécharger le QR Code</button>
                </a>
              </>
            ) : (
              <div className="empty-state"><span>📱</span><p>Génération du QR code...</p></div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
