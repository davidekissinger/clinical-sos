import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, AlertCircle, Send, X, Clock, Check, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STATUS_TONES = {
  "Verified": "green",
  "Pending Verification": "amber",
  "Correction Requested": "amber",
  "Suspended": "red",
  "Retired": "default",
};

export default function MyProfile() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null);
  const [form, setForm] = useState({
    requested_display_name: "",
    requested_credentials: "",
    reason_for_request: "",
    supporting_information: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getMyIdentityProfile", {});
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load identity profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!form.requested_display_name.trim()) {
      toast({ title: "Name required", description: "Please enter the requested display name.", variant: "destructive" });
      return;
    }
    if (!form.reason_for_request.trim()) {
      toast({ title: "Reason required", description: "Please explain the reason for your request.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("submitNameChangeRequest", {
        requested_display_name: form.requested_display_name,
        requested_credentials: form.requested_credentials || null,
        reason_for_request: form.reason_for_request,
        supporting_information: form.supporting_information || null,
      });
      if (res.data?.error) {
        toast({ title: "Request failed", description: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Request submitted", description: "Your name-change request has been submitted for administrator review." });
        setShowForm(false);
        setForm({ requested_display_name: "", requested_credentials: "", reason_for_request: "", supporting_information: "" });
        load();
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const withdrawRequest = async (requestId) => {
    setWithdrawing(requestId);
    try {
      const res = await base44.functions.invoke("withdrawNameChangeRequest", { request_id: requestId });
      if (res.data?.error) {
        toast({ title: "Withdrawal failed", description: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Request withdrawn", description: "Your name-change request has been withdrawn." });
        load();
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setWithdrawing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const profile = data?.profile;
  const requests = data?.requests || [];
  const providerName = data?.provider_full_name;
  const email = data?.email;
  const role = data?.role;
  const pendingRequest = requests.find(r => r.request_status === "Pending");

  return (
    <div className="min-h-screen bg-secondary/40">
      <div className="max-w-3xl mx-auto p-5 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
            <p className="text-sm text-muted-foreground mt-1">Your identity and display information in Clinical SOS</p>
          </div>
          <a href="/command-center" className="text-sm text-muted-foreground hover:text-primary hidden sm:inline">Back to Command Center →</a>
        </div>

        {/* Security notice */}
        <div className="rounded-xl border border-border bg-accent/30 p-4 mb-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Name and credential changes require administrator review to protect account security, work-product attribution, and audit-record integrity.
            </p>
          </div>
        </div>

        {/* Identity info */}
        <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Account Information</h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <InfoField label="Login Email" value={email} />
            <InfoField label="Role" value={role} />
            <InfoField label="Provider-Supplied Name" value={providerName || "(none)"} />
            <InfoField label="Identity Status" value={
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                profile?.identity_status === "Verified" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" :
                profile?.identity_status === "Suspended" ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400" :
                "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              }`}>{profile?.identity_status || "No Profile"}</span>
            } />
          </div>
        </div>

        {/* Verified identity */}
        {profile ? (
          <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-6">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Verified Identity</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <InfoField label="Verified Display Name" value={profile.verified_display_name || "(not yet verified)"} />
              <InfoField label="Verified Credentials" value={profile.verified_credentials || "(none)"} />
            </div>
            {profile.identity_status !== "Verified" && (
              <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
                Your identity has not been verified. An administrator must verify your identity before your name is used in approvals, work products, and client-facing displays.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-6">
            <p className="text-sm text-muted-foreground">
              No identity profile has been created for your account yet. An administrator must initialize your identity profile.
            </p>
          </div>
        )}

        {/* Pending request */}
        {pendingRequest && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Pending Name-Change Request</p>
                <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">Requested: {pendingRequest.requested_display_name}</p>
                {pendingRequest.requested_credentials && <p className="text-sm text-amber-700 dark:text-amber-500">Requested credentials: {pendingRequest.requested_credentials}</p>}
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Submitted: {pendingRequest.requested_at ? new Date(pendingRequest.requested_at).toLocaleString() : "—"}</p>
              </div>
              <button
                onClick={() => withdrawRequest(pendingRequest.id)}
                disabled={withdrawing === pendingRequest.id}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-400 px-3 py-2 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900 disabled:opacity-60 min-h-[44px]"
              >
                <X className="h-4 w-4" /> {withdrawing === pendingRequest.id ? "Withdrawing..." : "Withdraw"}
              </button>
            </div>
          </div>
        )}

        {/* Correction request form */}
        {!showForm && profile && !pendingRequest && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm mb-6">
            <Send className="h-4 w-4" /> Request Name or Credential Correction
          </button>
        )}

        {showForm && (
          <form onSubmit={submitRequest} className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Request Correction</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground" aria-label="Close form"><X className="h-4 w-4" /></button>
            </div>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Requested Display Name *</span>
              <input
                value={form.requested_display_name}
                onChange={(e) => setForm(f => ({ ...f, requested_display_name: e.target.value }))}
                className="cc-input"
                placeholder="Enter your correct name"
                required
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Requested Credentials (optional)</span>
              <input
                value={form.requested_credentials}
                onChange={(e) => setForm(f => ({ ...f, requested_credentials: e.target.value }))}
                className="cc-input"
                placeholder="e.g. RN, BSN, LNHA"
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Reason for Request *</span>
              <textarea
                value={form.reason_for_request}
                onChange={(e) => setForm(f => ({ ...f, reason_for_request: e.target.value }))}
                className="cc-input resize-y"
                rows={3}
                placeholder="Explain why this correction is needed"
                required
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Supporting Information (optional)</span>
              <textarea
                value={form.supporting_information}
                onChange={(e) => setForm(f => ({ ...f, supporting_information: e.target.value }))}
                className="cc-input resize-y"
                rows={2}
                placeholder="Any additional context for the administrator"
              />
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? "Submitting..." : "Submit Request"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </form>
        )}

        {/* Request history */}
        {requests.length > 0 && (
          <div className="bg-white dark:bg-card rounded-xl border border-border p-6">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Request History</h2>
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{r.requested_display_name}</span>
                    <RequestStatusBadge status={r.request_status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Requested: {r.requested_at ? new Date(r.requested_at).toLocaleString() : "—"}</p>
                  {r.reviewed_at && <p className="text-xs text-muted-foreground">Reviewed: {new Date(r.reviewed_at).toLocaleString()}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-foreground break-all">{value}</p>
    </div>
  );
}

function RequestStatusBadge({ status }) {
  const config = {
    Pending: { icon: Clock, tone: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
    Approved: { icon: Check, tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
    Denied: { icon: XCircle, tone: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400" },
    Withdrawn: { icon: X, tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
    Superseded: { icon: X, tone: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  };
  const c = config[status] || config.Pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.tone}`}>
      <Icon className="h-3 w-3" /> {status}
    </span>
  );
}