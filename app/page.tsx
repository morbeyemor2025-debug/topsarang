"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      // Check if user has a salon
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
    };
    check();
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{
        width: 32, height: 32,
        border: "3px solid #1e1e1e",
        borderTopColor: "#ba7a2b",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
