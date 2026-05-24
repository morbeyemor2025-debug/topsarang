import { supabase } from "./supabase";
import type { Salon } from "./types";

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUserSalon(): Promise<Salon | null> {
  const session = await getSession();
  if (!session) return null;

  const { data } = await supabase
    .from("salon_members")
    .select("salon_id, salons(*)")
    .eq("user_id", session.user.id)
    .single();

  if (!data) return null;
  return (data as unknown as { salons: Salon }).salons ?? null;
}

export async function signOut() {
  await supabase.auth.signOut();
}
