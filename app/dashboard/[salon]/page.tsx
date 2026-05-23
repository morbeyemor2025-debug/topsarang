"use client";

import { useState, useEffect, useCallback, use } from "react";
import { supabase } from "@/lib/supabase";
import type { Salon, Barber, QueueTicket } from "@/lib/types";

interface Props {
  params: Promise<{ salon: string }>;
}

export default function DashboardPage({ params }: Props) {
  const { salon: salonSlug } = use(params);

  const [salon, setSalon] = useState<Salon | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"queue" | "barbers">("queue");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
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
      .order("name");

    setBarbers(barbersData ?? []);

    const { data: ticketsData } = await supabase
      .from("queue_tickets")
      .select("*")
      .eq("salon_id", salonData.id)
      .in("status", ["waiting", "called"])
      .order("ticket_number", { ascending: true });

    setTickets(ticketsData ?? []);
    setLoading(false);
  }, [salonSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!salon) return;

    const channel = supabase
      .channel("dashboard-" + salon.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_tickets",
          filter: `salon_id=eq.${salon.id}`,
        },
        () => loadData()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "barbers",
          filter: `salon_id=eq.${salon.id}`,
        },
        () => loadData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [salon, loadData]);

  const callNext = async (barberId?: string) => {
    const waiting = tickets.filter(
      (t) =>
        t.status === "waiting" &&
        (!barberId || t.barber_id === barberId || !t.barber_id)
    );
    if (!waiting.length) return;

    const next = waiting[0];
    setActionLoading(next.id);

    await supabase
      .from("queue_tickets")
      .update({ status: "called", called_at: new Date().toISOString() })
      .eq("id", next.id);

    if (barberId) {
      await supabase
        .from("barbers")
        .update({ current_ticket: next.ticket_number })
        .eq("id", barberId);
    }

    setActionLoading(null);
  };

  const markServed = async (ticketId: string, barberId?: string | null) => {
    setActionLoading(ticketId);

    await supabase
      .from("queue_tickets")
      .update({ status: "served", served_at: new Date().toISOString() })
      .eq("id", ticketId);

    if (barberId) {
      await supabase
        .from("barbers")
        .update({ current_ticket: null })
        .eq("id", barberId);
    }

    setActionLoading(null);
  };

  const cancelTicket = async (ticketId: string) => {
    setActionLoading(ticketId);
    await supabase
      .from("queue_tickets")
      .update({ status: "cancelled" })
      .eq("id", ticketId);
    setActionLoading(null);
  };

  const toggleBarber = async (barber: Barber) => {
    await supabase
      .from("barbers")
      .update({ is_active: !barber.is_active })
      .eq("id", barber.id);
  };

  const waitingCount = tickets.filter((t) => t.status === "waiting").length;
  const calledCount = tickets.filter((t) => t.status === "called").length;

  if (loading) {
    return (
      <div className="db-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="db-loading">
        <p style={{ color: "#dc5750" }}>{error}</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; font-family: 'Georgia', serif; color: #f7f5ef; min-height: 100vh; }
        .db-loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0a; }
        .spinner { width: 32px; height: 32px; border: 3px solid #1e1e1e; border-top-color: #ba7a2b; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .dashboard { max-width: 900px; margin: 0 auto; padding: 0 16px 80px; animation: fadeUp 0.4s ease; }
        .header { display: flex; align-items: center; justify-content: space-between; padding: 24px 0 20px; border-bottom: 1px solid #1a1a1a; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .salon-name { font-size: 22px; font-weight: 700; color: #f7f5ef; }
        .salon-badge { background: rgba(186,122,43,0.15); border: 1px solid rgba(186,122,43,0.25); color: #f4b23f; font-size: 11px; padding: 3px 10px; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.08em; }
        .live-dot { width: 8px; height: 8px; background: #0f8f64; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(15,143,100,0.4); } 50% { box-shadow: 0 0 0 6px rgba(15,143,100,0); } }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-card { background: #111; border: 1px solid #1e1e1e; border-radius: 16px; padding: 20px 16px; text-align: center; }
        .stat-num { font-size: 40px; font-weight: 800; color: #ba7a2b; line-height: 1; }
        .stat-num.green { color: #0f8f64; }
        .stat-num.barbers { color: #f7f5ef; }
        .stat-label { color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; }
        .call-next-btn { width: 100%; background: linear-gradient(135deg, #ba7a2b, #f4b23f); color: #0a0a0a; border: none; border-radius: 14px; padding: 18px; font-size: 16px; font-weight: 800; cursor: pointer; letter-spacing: 0.03em; transition: all 0.2s; margin-bottom: 24px; font-family: inherit; }
        .call-next-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(186,122,43,0.4); }
        .call-next-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }
        .tabs { display: flex; gap: 4px; background: #111; border: 1px solid #1e1e1e; border-radius: 12px; padding: 4px; margin-bottom: 20px; width: fit-content; }
        .tab { background: none; border: none; color: #555; padding: 8px 20px; border-radius: 9px; cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 600; transition: all 0.2s; }
        .tab.active { background: #1e1e1e; color: #f7f5ef; }
        .ticket-list { display: flex; flex-direction: column; gap: 10px; }
        .ticket-card { background: #111; border: 1px solid #1e1e1e; border-radius: 16px; padding: 16px 20px; display: flex; align-items: center; gap: 16px; transition: border-color 0.2s; }
        .ticket-card.called { border-color: rgba(15,143,100,0.4); background: rgba(15,143,100,0.05); }
        .ticket-num-badge { font-size: 24px; font-weight: 800; color: #ba7a2b; min-width: 52px; text-align: center; }
        .ticket-info { flex: 1; min-width: 0; }
        .ticket-name { font-size: 15px; font-weight: 600; color: #f7f5ef; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ticket-meta { color: #555; font-size: 12px; margin-top: 2px; }
        .ticket-status { font-size: 11px; padding: 3px 10px; border-radius: 100px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
        .status-waiting { background: rgba(186,122,43,0.12); color: #f4b23f; border: 1px solid rgba(186,122,43,0.25); }
        .status-called { background: rgba(15,143,100,0.12); color: #0f8f64; border: 1px solid rgba(15,143,100,0.3); animation: pulse 2s infinite; }
        .ticket-actions { display: flex; gap: 8px; flex-shrink: 0; }
        .action-btn { border: none; border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; white-space: nowrap; }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-call { background: rgba(186,122,43,0.15); color: #f4b23f; border: 1px solid rgba(186,122,43,0.3); }
        .btn-call:hover:not(:disabled) { background: rgba(186,122,43,0.25); }
        .btn-serve { background: rgba(15,143,100,0.15); color: #0f8f64; border: 1px solid rgba(15,143,100,0.3); }
        .btn-serve:hover:not(:disabled) { background: rgba(15,143,100,0.25); }
        .btn-cancel { background: rgba(220,87,80,0.1); color: #dc5750; border: 1px solid rgba(220,87,80,0.2); }
        .btn-cancel:hover:not(:disabled) { background: rgba(220,87,80,0.2); }
        .empty-state { text-align: center; padding: 60px 20px; color: #444; }
        .empty-state span { font-size: 48px; display: block; margin-bottom: 12px; }
        .barber-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .barber-card { background: #111; border: 1px solid #1e1e1e; border-radius: 16px; padding: 20px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
        .barber-avatar { width: 48px; height: 48px; background: linear-gradient(135deg, #ba7a2b, #f4b23f); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .barber-name { font-size: 15px; font-weight: 600; color: #f7f5ef; }
        .barber-current { font-size: 11px; color: #555; }
        .toggle-btn { width: 100%; padding: 8px; border-radius: 10px; border: 1px solid; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .toggle-active { background: rgba(15,143,100,0.12); border-color: rgba(15,143,100,0.3); color: #0f8f64; }
        .toggle-inactive { background: rgba(220,87,80,0.08); border-color: rgba(220,87,80,0.2); color: #dc5750; }
        .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #444; margin-bottom: 14px; }
        @media (max-width: 600px) { .stats { grid-template-columns: repeat(3, 1fr); } .ticket-actions { flex-direction: column; gap: 4px; } .action-btn { padding: 6px 10px; font-size: 11px; } }
      `}</style>

      <div className="dashboard">
        <div className="header">
          <div className="header-left">
            <span>🇸🇳</span>
            <div>
              <div className="salon-name">{salon?.name ?? salonSlug}</div>
              <div style={{ marginTop: 4 }}>
                <span className="salon-badge">Dashboard</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="live-dot" />
            <span style={{ color: "#555", fontSize: 12 }}>Live</span>
          </div>
        </div>

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
            <div className="stat-num barbers">
              {barbers.filter((b) => b.is_active).length}
            </div>
            <div className="stat-label">Coiffeurs actifs</div>
          </div>
        </div>

        <button
          className="call-next-btn"
          onClick={() => callNext()}
          disabled={waitingCount === 0 || !!actionLoading}
        >
          {waitingCount === 0
            ? "Aucun client en attente"
            : `🔔 Appeler le prochain — N°${tickets.find((t) => t.status === "waiting")?.ticket_number ?? "?"}`}
        </button>

        <div className="tabs">
          <button
            className={`tab ${activeTab === "queue" ? "active" : ""}`}
            onClick={() => setActiveTab("queue")}
          >
            File ({tickets.length})
          </button>
          <button
            className={`tab ${activeTab === "barbers" ? "active" : ""}`}
            onClick={() => setActiveTab("barbers")}
          >
            Coiffeurs ({barbers.length})
          </button>
        </div>

        {activeTab === "queue" && (
          <>
            <p className="section-title">Clients en cours</p>
            {tickets.length === 0 ? (
              <div className="empty-state">
                <span>✂️</span>
                <p>Aucun client dans la file</p>
              </div>
            ) : (
              <div className="ticket-list">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`ticket-card ${ticket.status === "called" ? "called" : ""}`}
                  >
                    <div className="ticket-num-badge">#{ticket.ticket_number}</div>
                    <div className="ticket-info">
                      <div className="ticket-name">{ticket.customer_name}</div>
                      <div className="ticket-meta">
                        {ticket.customer_phone && `📱 ${ticket.customer_phone} · `}
                        {ticket.barber_id
                          ? `✂️ ${barbers.find((b) => b.id === ticket.barber_id)?.name ?? "?"}`
                          : "Peu importe"}
                      </div>
                    </div>
                    <div className={`ticket-status ${ticket.status === "called" ? "status-called" : "status-waiting"}`}>
                      {ticket.status === "called" ? "Appelé" : "Attente"}
                    </div>
                    <div className="ticket-actions">
                      {ticket.status === "waiting" && (
                        <button
                          className="action-btn btn-call"
                          onClick={() => callNext(ticket.barber_id ?? undefined)}
                          disabled={!!actionLoading}
                        >
                          Appeler
                        </button>
                      )}
                      {ticket.status === "called" && (
                        <button
                          className="action-btn btn-serve"
                          onClick={() => markServed(ticket.id, ticket.barber_id)}
                          disabled={actionLoading === ticket.id}
                        >
                          ✓ Servi
                        </button>
                      )}
                      <button
                        className="action-btn btn-cancel"
                        onClick={() => cancelTicket(ticket.id)}
                        disabled={actionLoading === ticket.id}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "barbers" && (
          <>
            <p className="section-title">Gestion des coiffeurs</p>
            {barbers.length === 0 ? (
              <div className="empty-state">
                <span>👤</span>
                <p>Aucun coiffeur configuré</p>
              </div>
            ) : (
              <div className="barber-grid">
                {barbers.map((barber) => (
                  <div key={barber.id} className="barber-card">
                    <div className="barber-avatar">✂️</div>
                    <div>
                      <div className="barber-name">{barber.name}</div>
                      <div className="barber-current">
                        {barber.current_ticket ? `Ticket #${barber.current_ticket}` : "Disponible"}
                      </div>
                    </div>
                    <button
                      className={`toggle-btn ${barber.is_active ? "toggle-active" : "toggle-inactive"}`}
                      onClick={() => toggleBarber(barber)}
                    >
                      {barber.is_active ? "✓ Actif" : "✕ Inactif"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
