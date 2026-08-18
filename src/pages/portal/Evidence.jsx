import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { AlertTriangle } from "lucide-react";

export default function ClientEvidence() {
  const { entitlement } = useOutletContext();
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState(null);
  const [submitting, setSubmitting] = useState(null);

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

  const respondToEvidence = async (item, responseStatus) => {
    if (!entitlement?.effective_capabilities?.can_submit_evidence) {
      setActionResult({ error: "You do not have permission to respond to evidence requests." });
      return;
    }
    setSubmitting(item.id);
    try {
      await base44.functions.invoke("clientRespondEvidence", {
        evidence_id: item.id,
        response_status: responseStatus
      });
      setActionResult({ success: "Evidence response submitted." });
      const res = await base44.entities.EvidenceItem.list("-created_date", 200);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setEvidence(list.filter(e => e.client_visibility));
    } catch (e) { setActionResult({ error: e.message || "Failed to submit response" }); }
    finally { setSubmitting(null); }
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
        <div className={`mb-4 p-3 rounded-lg text-sm ${actionResult.error ? "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400" : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"}`} role="status">{actionResult.error || actionResult.success}</div>
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
                  <p className="text-xs text-muted-foreground mt-1">Clinical SOS Review: {item.review_status}</p>
                  {item.client_response_status && item.client_response_status !== "Pending" && (
                    <p className="text-xs text-muted-foreground">Your Response: {item.client_response_status} by {item.client_responded_by || "—"}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.review_status === "Accepted" ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400" : item.review_status === "Insufficient" ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400" : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400"}`}>{item.review_status}</span>
              </div>
              {entitlement?.effective_capabilities?.can_submit_evidence && item.review_status !== "Accepted" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => respondToEvidence(item, "Prepared")} disabled={submitting === item.id} className="btn-secondary text-xs disabled:opacity-60">Mark Prepared</button>
                  <button onClick={() => respondToEvidence(item, "Available")} disabled={submitting === item.id} className="btn-secondary text-xs disabled:opacity-60">Confirm Available</button>
                  <button onClick={() => respondToEvidence(item, "Clarification Requested")} disabled={submitting === item.id} className="btn-secondary text-xs disabled:opacity-60">Request Clarification</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}