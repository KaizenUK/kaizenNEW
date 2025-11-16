import { useState, useEffect } from "react";
import AdminDashboard from "@/pages/admin/AdminDashboard";

export default function AdminDashboardWrapper() {
  const [crispUnread, setCrispUnread] = useState<number | null>(null);
  const [crispOpen, setCrispOpen] = useState<number | null>(null);
  const [crispLatest, setCrispLatest] = useState<string | null>(null);

  // Fetch Crisp summary data
  useEffect(() => {
    let cancelled = false;

    const loadCrispData = async () => {
      try {
        const res = await fetch("/api/admin/crisp/summary");
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled || !json || json.ok !== true) return;

        if (typeof json.unreadCount === "number") {
          setCrispUnread(json.unreadCount);
        }
        if (typeof json.openConversations === "number") {
          setCrispOpen(json.openConversations);
        }

        // Derive latest message snippet from raw.data[0]
        const data =
          json.raw && Array.isArray(json.raw.data) ? json.raw.data : null;
        if (data && data.length > 0) {
          const first = data[0];
          const excerpt =
            first?.preview_message?.excerpt || first?.last_message || null;
          if (typeof excerpt === "string" && excerpt.length > 0) {
            setCrispLatest(excerpt);
          }
        }
      } catch {
        // Silently ignore errors
      }
    };

    loadCrispData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminDashboard
      crispUnread={crispUnread}
      crispOpen={crispOpen}
      crispLatest={crispLatest}
    />
  );
}
