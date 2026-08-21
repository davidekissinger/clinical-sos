import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Trash2, AlertCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AccessibleDialog from "@/components/AccessibleDialog";

export default function ClientAccount() {
  const outletContext = useOutletContext();
  const entitlement = outletContext?.entitlement;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const facilities = entitlement?.authorized_facilities || [];
  const engagements = entitlement?.authorized_engagements || [];

  const isSuspended = entitlement?.access_status === "Suspended";
  const isTerminated = entitlement?.access_status === "Terminated";
  const isRestricted = entitlement?.access_status === "Restricted";
  const isGrace = entitlement?.access_status === "Grace Period";

  const caps = entitlement?.effective_capabilities || {};
  const capLabels = {
    can_view_engagement: "View Engagements",
    can_view_documents: "View Documents",
    can_download_documents: "Download Documents",
    can_view_poc: "View POCs",
    can_review_poc: "Review POCs",
    can_approve_poc: "Approve POCs",
    can_view_tasks: "View Tasks",
    can_complete_tasks: "Complete Tasks",
    can_view_evidence: "View Evidence",
    can_submit_evidence: "Submit Evidence",
    can_view_audits: "View Audits",
    can_message_consultant: "Message Consultant",
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await base44.auth.deleteAccount();
      window.location.href = "/";
    } catch (e) {
      setDeleteError(e.message || "Unable to delete account. Please contact Clinical SOS support.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">Account</h1>

      {isSuspended && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-6 mb-6" role="alert">
          <h2 className="text-lg font-semibold text-rose-800 dark:text-rose-300">Portal Access Suspended</h2>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{entitlement?.portal_message || "Portal access is temporarily suspended. Please contact Clinical SOS regarding your account."}</p>
        </div>
      )}

      {isTerminated && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-6 mb-6" role="alert">
          <h2 className="text-lg font-semibold text-rose-800 dark:text-rose-300">Portal Access Unavailable</h2>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">{entitlement?.portal_message || "Portal access is no longer available. Please contact Clinical SOS if you have questions."}</p>
        </div>
      )}

      {entitlement?.subscription_status && entitlement.subscription_status !== "Not Applicable" && (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-4">
          <h2 className="font-semibold text-foreground mb-3">Subscription</h2>
          <dl className="grid sm:grid-cols-2 gap-4">
            <div><dt className="text-xs font-medium text-muted-foreground">Plan</dt><dd className="text-sm text-foreground mt-1">{entitlement.subscription_plan || "—"}</dd></div>
            <div><dt className="text-xs font-medium text-muted-foreground">Status</dt><dd className="text-sm text-foreground mt-1">{entitlement.subscription_status}</dd></div>
            {entitlement.subscription_renewal_date && <div><dt className="text-xs font-medium text-muted-foreground">Renewal Date</dt><dd className="text-sm text-foreground mt-1">{new Date(entitlement.subscription_renewal_date).toLocaleDateString()}</dd></div>}
            {entitlement.subscription_end_date && <div><dt className="text-xs font-medium text-muted-foreground">End Date</dt><dd className="text-sm text-foreground mt-1">{new Date(entitlement.subscription_end_date).toLocaleDateString()}</dd></div>}
          </dl>
          <Link to="/client/subscription" className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:underline">
            View Plans <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-4">
        <h2 className="font-semibold text-foreground mb-4">Account Information</h2>
        <dl className="grid sm:grid-cols-2 gap-4">
          <div><dt className="text-xs font-medium text-muted-foreground">Account Name</dt><dd className="text-sm text-foreground mt-1">{entitlement?.account_name || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Membership Status</dt><dd className="text-sm text-foreground mt-1">{entitlement?.membership_status || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Access Status</dt><dd className="text-sm text-foreground mt-1">{entitlement?.access_status || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Authorized Facilities</dt><dd className="text-sm text-foreground mt-1">{facilities.length}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Authorized Engagements</dt><dd className="text-sm text-foreground mt-1">{engagements.length}</dd></div>
        </dl>
      </div>

      {facilities.length > 0 && !isSuspended && !isTerminated && (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-4">
          <h2 className="font-semibold text-foreground mb-3">Authorized Facilities</h2>
          <ul className="space-y-2">
            {facilities.map(f => <li key={f.id} className="text-sm text-foreground">{f.facility_name} — {f.city || ""}, {f.state || ""}</li>)}
          </ul>
        </div>
      )}

      {engagements.length > 0 && !isSuspended && !isTerminated && (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-4">
          <h2 className="font-semibold text-foreground mb-3">Authorized Engagements</h2>
          <ul className="space-y-2">
            {engagements.map(e => <li key={e.id} className="text-sm text-foreground">{e.engagement_name} — {e.phase || "—"}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-card rounded-xl border border-border p-6">
        <h2 className="font-semibold text-foreground mb-3">Your Capabilities</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {Object.entries(capLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              {caps[key] ? <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />}
              <span className={`text-sm ${caps[key] ? "text-foreground" : "text-muted-foreground line-through"}`}>{label}</span>
              <span className="sr-only">{caps[key] ? "Granted" : "Not granted"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-rose-200 dark:border-rose-900 p-6 mt-4">
        <h2 className="font-semibold text-rose-700 dark:text-rose-400 mb-2 flex items-center gap-2">
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete Account
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="inline-flex items-center gap-2 rounded-full border-2 border-rose-500 text-rose-600 dark:text-rose-400 px-6 py-2.5 text-sm font-semibold transition hover:bg-rose-50 dark:hover:bg-rose-950/40 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete Account
        </button>
      </div>

      <AccessibleDialog
        isOpen={showDeleteDialog}
        onClose={() => { setShowDeleteDialog(false); setDeleteError(null); }}
        title="Delete Account?"
        titleId="delete-account-dialog-title"
        closeLabel="Cancel"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg p-4">
            <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-rose-800 dark:text-rose-300">
              This will permanently delete your account and revoke all portal access. This action cannot be undone.
            </p>
          </div>
          {deleteError && (
            <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{deleteError}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setShowDeleteDialog(false); setDeleteError(null); }}
              className="btn-secondary text-sm"
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {deleting ? "Deleting…" : "Yes, Delete My Account"}
            </button>
          </div>
        </div>
      </AccessibleDialog>
    </div>
  );
}