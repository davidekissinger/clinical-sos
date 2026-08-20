import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import PullToRefresh from "@/components/PullToRefresh";

export default function ClientEngagements() {
  const outletContext = useOutletContext();
  const entitlement = outletContext?.entitlement;
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("getClientPortalData", { resource: "engagements" });
      setEngagements(Array.isArray(res) ? res : (res?.data || []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">My Engagements</h1>
      <PullToRefresh onRefresh={load}>
        {engagements.length === 0 ? (
          <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
            <p className="font-medium text-foreground">No engagements available</p>
            <p className="mt-1 text-sm text-muted-foreground">Your authorized engagements will appear here once published.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {engagements.map(eng => (
              <Link key={eng.id} to={`/client/engagements/${eng.id}`} className="block p-5 bg-white dark:bg-card rounded-xl border border-border hover:border-primary transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{eng.engagement_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{eng.service_type || "Consulting"} · {eng.status} · {eng.phase || "—"}</p>
                  </div>
                  <span className="text-primary text-sm font-medium">View →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}