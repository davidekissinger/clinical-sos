import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Briefcase, ClipboardList, ClipboardCheck, FolderCheck, ListChecks, AlertTriangle } from "lucide-react";
import PullToRefresh from "@/components/PullToRefresh";

export default function ClientDashboard() {
  const outletContext = useOutletContext();
  const entitlement = outletContext?.entitlement;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const res = await base44.functions.invoke("getClientPortalData", { resource: "dashboard" });
      setData(res.data || res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  const summary = data?.summary || {};
  const engagements = data?.engagements || [];

  const stats = [
    { label: "Active Engagements", value: summary.active_engagements || 0, icon: Briefcase },
    { label: "Active Regulatory Cases", value: summary.open_cases || 0, icon: ClipboardList },
    { label: "POCs in Client Review", value: summary.pocs_in_review || 0, icon: ClipboardCheck },
    { label: "Open Evidence Requests", value: summary.pending_evidence || 0, icon: FolderCheck },
    { label: "Tasks Due", value: summary.open_tasks || 0, icon: ListChecks },
  ];

  return (
    <PullToRefresh onRefresh={loadData}>
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Welcome, {entitlement?.account_name || "Client"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your engagement overview and regulatory recovery status.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {engagements.length > 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Your Engagements</h2>
          <div className="space-y-3">
            {engagements.map(eng => (
              <Link key={eng.id} to={`/client/engagements/${eng.id}`} className="block p-4 rounded-lg border border-border hover:border-primary transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{eng.engagement_name}</p>
                    <p className="text-sm text-muted-foreground">{eng.service_type || "Consulting"} · {eng.status}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{eng.phase || "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No engagements available</p>
          <p className="mt-1 text-sm text-muted-foreground">Your authorized engagements will appear here once published.</p>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}