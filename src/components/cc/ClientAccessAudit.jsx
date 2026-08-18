import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge, LoadingState, EmptyState } from "@/components/cc/ui";

export default function ClientAccessAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function load() {
      try {
        const res = await base44.entities.AutomationLog.list("-created_date", 50);
        setLogs(Array.isArray(res) ? res : (res?.data || []));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);
  if (loading) return <LoadingState />;
  const accessLogs = logs.filter(l => l.automation === "Client Access Change");
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-muted-foreground">
          <tr>{["Date", "Account", "Previous", "New", "Reason", "Source", "By", "Override"].map(h => <th key={h} scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {accessLogs.map(l => (
            <tr key={l.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 text-muted-foreground">{l.started ? new Date(l.started).toLocaleString() : "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{l.client_account_id?.slice(-8) || "—"}</td>
              <td className="px-4 py-3"><Badge>{l.previous_access_state || "—"}</Badge></td>
              <td className="px-4 py-3"><Badge tone={l.new_access_state === "Active" ? "green" : l.new_access_state === "Suspended" || l.new_access_state === "Terminated" ? "red" : "amber"}>{l.new_access_state}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{l.reason || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{l.triggering_source || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{l.acting_user_name || "—"}</td>
              <td className="px-4 py-3">{l.manual_override ? <Badge tone="amber">Yes</Badge> : <span className="text-muted-foreground">No</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {accessLogs.length === 0 && <EmptyState title="No access changes recorded" />}
    </div>
  );
}