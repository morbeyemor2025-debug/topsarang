export type TicketStatus = "waiting" | "called" | "served" | "cancelled";

export interface Salon {
  id: string;
  slug: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface Barber {
  id: string;
  salon_id: string;
  name: string;
  is_active: boolean;
  current_ticket?: number | null;
}

export interface QueueTicket {
  id: string;
  salon_id: string;
  barber_id?: string | null;
  ticket_number: number;
  customer_name: string;
  customer_phone?: string;
  status: TicketStatus;
  estimated_wait_minutes?: number;
  created_at: string;
  called_at?: string | null;
  served_at?: string | null;
}
