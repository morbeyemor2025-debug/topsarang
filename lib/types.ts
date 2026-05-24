export type TicketStatus = "waiting" | "called" | "served" | "cancelled";
export type StaffRole = "owner" | "admin" | "staff";

export interface Salon {
  id: string;
  slug: string;
  name: string;
  phone?: string;
  city?: string;
  country: string;
  brand_color?: string;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface Barber {
  id: string;
  salon_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface QueueTicket {
  id: string;
  salon_id: string;
  barber_id?: string | null;
  customer_id?: string | null;
  ticket_number: number;
  service_requested: string;
  status: TicketStatus;
  estimated_wait_minutes: number;
  live_position: number;
  people_ahead: number;
  priority_level: number;
  alert_triggered: boolean;
  messages_history: unknown[];
  created_at: string;
  completed_at?: string | null;
}

export interface SalonMember {
  id: string;
  salon_id: string;
  user_id: string;
  role: StaffRole;
  created_at: string;
}

export interface Customer {
  id: string;
  salon_id: string;
  name: string;
  phone?: string;
  notes?: string;
  total_visits: number;
  accepts_marketing: boolean;
  last_visit_at?: string;
  created_at: string;
}
