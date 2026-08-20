import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import PullToRefresh from "@/components/PullToRefresh";

export default function ClientPOCs() {
  const outletContext = useOutletContext();
  const entitlement = outletContext?.entitlement;
  const [pocs, setPocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [comment, setComment] = useState("");
  const [commentPocId, setCommentPocId] = useState(null);

  const loadPocs = async () => {
    try {
      const res = await base44.functions.invoke("getClientPortalData", { resource: "pocs" });
      setPocs(Array.isArray(res) ? res : (res?.data || []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadPocs(); }, []);

  const submitReview = async (poc, action) => {
    const requiredCap = action === "client_approve" ? "can_approve_poc" : "can_review_poc";
    if (!entitlement?.effective_capabilities?.[requiredCap]) {
      setActionResult({ error: `You do not have permission to ${action === "client_approve" ? "approve" : "review"} POCs.` });
      return;
    }
    setReviewing(poc.id);
    const prevPocs = pocs;
    const optimisticStatus = action === "client_approve" ? "Client Approved" : action === "request_revision" ? "Revision Requested" : "Acknowledged";
    setPocs(pocs.map(p => p.id === poc.id ? { ...p, client_review_status: optimisticStatus } : p));
    try {
      await base44.functions.invoke("clientReviewPOC", {
        poc_id: poc.id, action, comment: commentPocId === poc.id ? comment : null
      });
      setActionResult({ success: "POC review submitted. Regulatory status unchanged." });
      setComment(""); setCommentPocId(null);
      await loadPocs();
    } catch (e) {
      setPocs(prevPocs);
      setActionResult({ error: e.message || "Failed to submit review" });
    }
    finally { setReviewing(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Plans of Correction</h1>
      {actionResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${actionResult.error ? "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400" : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"}`} role="status">{actionResult.error || actionResult.success}</div>
      )}
      <PullToRefresh onRefresh={loadPocs}>
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
                    <p className="text-sm text-muted-foreground">Regulatory Status: {poc.status}</p>
                    <p className="text-xs text-muted-foreground">Client Review Status: {poc.client_review_status || "Pending"}</p>
                  </div>
                  {poc.status === "Client Review" && (entitlement?.effective_capabilities?.can_review_poc || entitlement?.effective_capabilities?.can_approve_poc) && (
                    <span className="text-xs bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full font-medium">Action Required</span>
                  )}
                </div>
                {poc.generated_narrative && <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{poc.generated_narrative}</p>}
                {poc.status === "Client Review" && (entitlement?.effective_capabilities?.can_review_poc || entitlement?.effective_capabilities?.can_approve_poc) && (
                  <div className="border-t border-border pt-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1" htmlFor={`comment-${poc.id}`}>Comment (optional)</label>
                    <textarea id={`comment-${poc.id}`} value={commentPocId === poc.id ? comment : ""} onChange={e => { setComment(e.target.value); setCommentPocId(poc.id); }} rows={2} className="cc-input mb-2" placeholder="Add a comment for your consultant…" />
                    <div className="flex gap-2 flex-wrap">
                      {entitlement?.effective_capabilities?.can_review_poc && (
                        <>
                          <button onClick={() => submitReview(poc, "acknowledge")} disabled={reviewing === poc.id} className="btn-primary text-sm disabled:opacity-60">Acknowledge Review</button>
                          <button onClick={() => submitReview(poc, "request_revision")} disabled={reviewing === poc.id || (commentPocId === poc.id && !comment)} className="btn-secondary text-sm disabled:opacity-60">Request Revision</button>
                        </>
                      )}
                      {entitlement?.effective_capabilities?.can_approve_poc && (
                        <button onClick={() => submitReview(poc, "client_approve")} disabled={reviewing === poc.id} className="btn-primary text-sm disabled:opacity-60">Client Approve</button>
                      )}
                    </div>
                  </div>
                )}
                {poc.client_reviewed_by && (
                  <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
                    Reviewed by {poc.client_reviewed_by} on {poc.client_reviewed_date ? new Date(poc.client_reviewed_date).toLocaleDateString() : "—"} — Status: {poc.client_review_status || "Pending"}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
                  Client acknowledgement or approval is distinct from submission to or acceptance by a regulator. Only Clinical SOS staff may record regulatory submission or acceptance.
                </p>
              </div>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}