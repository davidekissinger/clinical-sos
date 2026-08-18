import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ClientPOCs() {
  const { entitlement } = useOutletContext();
  const [pocs, setPocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.entities.POC.list("-created_date", 200);
        const list = Array.isArray(res) ? res : (res?.data || []);
        setPocs(list.filter(p => p.client_visibility && p.status !== "AI Draft" && p.status !== "Clinical Review"));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const submitReview = async (poc, action) => {
    if (!entitlement?.effective_capabilities?.can_review_poc) {
      setActionResult({ error: "You do not have permission to review POCs." });
      return;
    }
    setReviewing(poc.id);
    try {
      const update = { client_reviewed_by: entitlement?.account_name || "Client" };
      if (action === "acknowledge") update.status = "Accepted";
      if (action === "request_revision") { update.status = "Revision Requested"; update.revision_notes = comment; }
      await base44.entities.POC.update(poc.id, update);
      setActionResult({ success: "POC review submitted." });
      setComment("");
      const res = await base44.entities.POC.list("-created_date", 200);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setPocs(list.filter(p => p.client_visibility && p.status !== "AI Draft" && p.status !== "Clinical Review"));
    } catch (e) { setActionResult({ error: e.message }); }
    finally { setReviewing(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Plans of Correction</h1>
      {actionResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${actionResult.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`} role="status">{actionResult.error || actionResult.success}</div>
      )}
      {pocs.length === 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No POCs available</p>
          <p className="mt-1 text-sm text-muted-foreground">Plans of Correction will appear here when published for your review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pocs.map(poc => (
            <div key={poc.id} className="bg-white dark:bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-foreground">{poc.f_tag} — Version {poc.version}</p>
                  <p className="text-sm text-muted-foreground">Status: {poc.status}</p>
                </div>
                {poc.status === "Client Review" && entitlement?.effective_capabilities?.can_review_poc && (
                  <span className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full font-medium">Action Required</span>
                )}
              </div>
              {poc.generated_narrative && <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{poc.generated_narrative}</p>}
              {poc.status === "Client Review" && entitlement?.effective_capabilities?.can_review_poc && (
                <div className="border-t border-border pt-3">
                  <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor={`comment-${poc.id}`}>Comment (optional)</label>
                  <textarea id={`comment-${poc.id}`} value={comment} onChange={e => setComment(e.target.value)} rows={2} className="cc-input mb-2" placeholder="Add a comment for your consultant…" />
                  <div className="flex gap-2">
                    <button onClick={() => submitReview(poc, "acknowledge")} disabled={reviewing === poc.id} className="btn-primary text-sm disabled:opacity-60">Acknowledge Review</button>
                    <button onClick={() => submitReview(poc, "request_revision")} disabled={reviewing === poc.id || !comment} className="btn-secondary text-sm disabled:opacity-60">Request Revision</button>
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
                Client approval/acknowledgement is distinct from submission to or acceptance by a regulator.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}