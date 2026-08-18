import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { AlertTriangle } from "lucide-react";

export default function ClientEvidence() {
  const { entitlement } = useOutletContext();
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.entities.EvidenceItem.list("-created_date", 200);
        const list = Array.isArray(res) ? res : (res?.data || []);
        setEvidence(list.filter(e => e.client_visibility));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const updateStatus = async (item, newStatus) => {
    if (!entitlement?.effective_capabilities?.can_submit_evidence) {
      setActionResult({ error: "You do not have permission to update evidence status." });
      return;
    }
    try {
      await base44.entities.EvidenceItem.update(item.id, { review_status: newStatus, notes: (item.notes || "") + "\n[Client] Status updated to " + newStatus });
      setActionResult({ success: "Evidence status updated." });
      const res = await base44.entities.EvidenceItem.list("-created_date", 200);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setEvidence(list.filter(e => e.client_visibility));
    } catch (e) { setActionResult({ error: e.message }); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Evidence Requests</h1>
      <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-amber-800 dark:text-amber-300">Do not upload or enter resident-identifiable information or protected health information unless Clinical SOS has specifically enabled an approved secure workflow.</p>
      </div>
      {actionResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${actionResult.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`} role="status">{actionResult.error || actionResult.success}</div>
      )}
      {evidence.length === 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No evidence requests</p>
          <p className="mt-1 text-sm text-muted-foreground">Evidence requests will appear here when published.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {evidence.map(item => (
            <div key={item.id} className="bg-white dark:bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.evidence_type}</p>
                  <p className="text-xs text-muted-foreground">{item.description || "—"} · Due: {item.date || "—"}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.review_status === "Accepted" ? "bg-emerald-50 text-emerald-700" : item.review_status === "Insufficient" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{item.review_status}</span>
              </div>
              {entitlement?.effective_capabilities?.can_submit_evidence && item.review_status !== "Accepted" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => updateStatus(item, "Received")} className="btn-secondary text-xs">Mark Prepared</button>
                  <button onClick={() => updateStatus(item, "Under Review")} className="btn-secondary text-xs">Confirm Available</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}