import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/cc/ui";
import { X, ShieldCheck, UserPlus, Check, Ban, FileText, Lock, RotateCcw, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const STATUS_TONES = {
  "Verified": "green",
  "Pending Verification": "amber",
  "Correction Requested": "amber",
  "Suspended": "red",
  "Retired": "default",
};

export default function IdentityDetailDialog({ user, profile, pendingRequest, onClose, onChanged }) {
  const { toast } = useToast();
  const [auditEvents, setAuditEvents] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [actionMode, setActionMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (profile) loadAudit();
  }, [profile?.id]);

  const loadAudit = async () => {
    if (!profile) return;
    setLoadingAudit(true);
    try {
      const events = await base44.entities.UserIdentityAuditEvent.filter({ subject_user_id: user.id });
      setAuditEvents((events || []).sort((a, b) => new Date(b.event_timestamp || 0) - new Date(a.event_timestamp || 0)));
    } catch (err) {
      console.error("Failed to load audit events:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const startAction = (mode) => {
    setActionMode(mode);
    if (mode === "verify" && profile?.verified_display_name) {
      setForm({ verified_display_name: profile.verified_display_name, verified_credentials: profile.verified_credentials || "", internal_notes: "" });
    } else if (mode === "change_credentials") {
      setForm({ verified_credentials: profile?.verified_credentials || "", reason: "" });
    } else {
      setForm({ reason: "", decision_notes: "", verified_display_name: "", verified_credentials: "", internal_notes: "" });
    }
  };

  const callManage = async (action, payload) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageUserIdentity", { action, ...payload });
      if (res.data?.error) {
        toast({ title: "Action failed", description: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: res.data?.duplicate_warning || "Action completed successfully." });
        setActionMode(null);
        onChanged();
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const callApprove = async (requestId, decisionNotes) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageUserIdentity", { action: "approve_request", request_id: requestId, decision_notes: decisionNotes });
      if (res.data?.error) {
        toast({ title: "Approval failed", description: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Request approved", description: res.data?.duplicate_warning || "Name change approved and applied." });
        setActionMode(null);
        onChanged();
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const callDeny = async (requestId, decisionNotes) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("manageUserIdentity", { action: "deny_request", request_id: requestId, decision_notes: decisionNotes });
      if (res.data?.error) {
        toast({ title: "Denial failed", description: res.data.error, variant: "destructive" });
      } else {
        toast({ title: "Request denied", description: "The name-change request has been denied." });
        setActionMode(null);
        onChanged();
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    if (actionMode === "init") {
      callManage("init", { target_user_id: user.id, internal_notes: form.internal_notes || "" });
    } else if (actionMode === "verify") {
      callManage("verify", { target_user_id: user.id, verified_display_name: form.verified_display_name, verified_credentials: form.verified_credentials, internal_notes: form.internal_notes });
    } else if (actionMode === "change_credentials") {
      callManage("change_credentials", { target_user_id: user.id, verified_credentials: form.verified_credentials, reason: form.reason });
    } else if (actionMode === "suspend") {
      callManage("suspend", { target_user_id: user.id, reason: form.reason });
    } else if (actionMode === "retire") {
      callManage("retire", { target_user_id: user.id, reason: form.reason });
    } else if (actionMode === "reactivate") {
      callManage("reactivate", { target_user_id: user.id, reason: form.reason });
    } else if (actionMode === "approve") {
      callApprove(pendingRequest.id, form.decision_notes);
    } else if (actionMode === "deny") {
      callDeny(pendingRequest.id, form.decision_notes);
    }
  };

  const requiresReason = ["suspend", "retire", "reactivate", "change_credentials", "approve", "deny"].includes(actionMode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white dark:bg-card z-10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Identity Detail</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* User info */}
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">Base44 Account</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="User ID" value={user.id} />
              <Field label="Email" value={user.email} />
              <Field label="Provider Name" value={user.full_name || "(none)"} />
              <Field label="Role" value={<Badge tone="default">{user.role}</Badge>} />
            </div>
          </section>

          {/* Identity profile */}
          {profile ? (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">Verified Identity</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Verified Display Name" value={profile.verified_display_name || "(not set)"} />
                <Field label="Verified Credentials" value={profile.verified_credentials || "(none)"} />
                <Field label="Identity Status" value={<Badge tone={STATUS_TONES[profile.identity_status] || "default"}>{profile.identity_status}</Badge>} />
                <Field label="Active" value={profile.active ? "Yes" : "No"} />
                <Field label="Verified By" value={profile.verified_by_name_snapshot || "(not verified)"} />
                <Field label="Verified At" value={profile.verified_at ? new Date(profile.verified_at).toLocaleString() : "—"} />
                <Field label="Last Changed" value={profile.last_changed_at ? new Date(profile.last_changed_at).toLocaleString() : "—"} />
                <Field label="Email Snapshot" value={profile.email_snapshot || "—"} />
              </div>
            </section>
          ) : (
            <div className="rounded-xl border border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">No identity profile has been created for this user.</p>
            </div>
          )}

          {/* Pending request */}
          {pendingRequest && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">Pending Name-Change Request</h3>
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Requested Name:</span><span className="font-medium">{pendingRequest.requested_display_name}</span></div>
                {pendingRequest.requested_credentials && <div className="flex justify-between"><span className="text-muted-foreground">Requested Credentials:</span><span>{pendingRequest.requested_credentials}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Reason:</span><span className="text-right max-w-xs">{pendingRequest.reason_for_request}</span></div>
                {pendingRequest.supporting_information && <div className="flex justify-between"><span className="text-muted-foreground">Supporting Info:</span><span className="text-right max-w-xs">{pendingRequest.supporting_information}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Requested At:</span><span>{pendingRequest.requested_at ? new Date(pendingRequest.requested_at).toLocaleString() : "—"}</span></div>
              </div>
            </section>
          )}

          {/* Action form */}
          {actionMode && (
            <section className="rounded-xl border border-primary/30 bg-accent/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground capitalize">{actionMode.replace(/_/g, " ")}</h3>
              {(actionMode === "verify" || actionMode === "init") && (
                <>
                  <InputField label="Verified Display Name" value={form.verified_display_name || ""} onChange={(v) => setForm(f => ({ ...f, verified_display_name: v }))} />
                  <InputField label="Verified Credentials (optional)" value={form.verified_credentials || ""} onChange={(v) => setForm(f => ({ ...f, verified_credentials: v }))} placeholder="e.g. RN, BSN, LNHA" />
                </>
              )}
              {actionMode === "change_credentials" && (
                <InputField label="New Verified Credentials" value={form.verified_credentials || ""} onChange={(v) => setForm(f => ({ ...f, verified_credentials: v }))} placeholder="e.g. RN, BSN, LNHA" />
              )}
              {requiresReason && (
                <InputField
                  label={actionMode === "approve" || actionMode === "deny" ? "Decision Notes (required)" : "Reason (required)"}
                  value={form.reason || form.decision_notes || ""}
                  onChange={(v) => setForm(f => ({ ...f, reason: v, decision_notes: v }))}
                  textarea
                />
              )}
              {actionMode === "init" && (
                <InputField label="Internal Notes (optional)" value={form.internal_notes || ""} onChange={(v) => setForm(f => ({ ...f, internal_notes: v }))} textarea />
              )}
              {actionMode === "verify" && (
                <InputField label="Internal Notes (optional)" value={form.internal_notes || ""} onChange={(v) => setForm(f => ({ ...f, internal_notes: v }))} textarea />
              )}
              <div className="flex gap-2">
                <button onClick={submit} disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? "Saving..." : "Confirm"}</button>
                <button onClick={() => setActionMode(null)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </section>
          )}

          {/* Action buttons */}
          {!actionMode && (
            <section className="flex flex-wrap gap-2">
              {!profile && <ActionButton icon={UserPlus} label="Initialize Profile" onClick={() => startAction("init")} />}
              {profile && <ActionButton icon={ShieldCheck} label="Verify / Set Name" onClick={() => startAction("verify")} />}
              {profile && <ActionButton icon={FileText} label="Change Credentials" onClick={() => startAction("change_credentials")} />}
              {pendingRequest && <ActionButton icon={Check} label="Approve Request" tone="green" onClick={() => startAction("approve")} />}
              {pendingRequest && <ActionButton icon={Ban} label="Deny Request" tone="red" onClick={() => startAction("deny")} />}
              {profile?.identity_status === "Suspended" && <ActionButton icon={RotateCcw} label="Reactivate" onClick={() => startAction("reactivate")} />}
              {profile && !["Suspended", "Retired"].includes(profile.identity_status) && <ActionButton icon={Lock} label="Suspend" tone="amber" onClick={() => startAction("suspend")} />}
              {profile && profile.identity_status !== "Retired" && <ActionButton icon={Trash2} label="Retire" tone="red" onClick={() => startAction("retire")} />}
            </section>
          )}

          {/* Audit history */}
          {profile && (
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">Identity Audit History</h3>
              {loadingAudit ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : auditEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit events recorded.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditEvents.map((e, i) => (
                    <div key={i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">{e.event_type}</span>
                        <span className="text-xs text-muted-foreground">{e.event_timestamp ? new Date(e.event_timestamp).toLocaleString() : "—"}</span>
                      </div>
                      {e.old_display_name && <p className="text-xs text-muted-foreground mt-1">Old: {e.old_display_name}</p>}
                      {e.new_display_name && <p className="text-xs text-muted-foreground">New: {e.new_display_name}</p>}
                      {e.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {e.reason}</p>}
                      {e.performed_by_name_snapshot && <p className="text-xs text-muted-foreground">By: {e.performed_by_name_snapshot}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-foreground break-all">{value}</p>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, textarea }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="cc-input resize-y" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="cc-input" />
      )}
    </label>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone = "default" }) {
  const tones = {
    default: "border-border text-foreground hover:border-primary hover:text-primary",
    green: "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950",
    red: "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950",
    amber: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950",
  };
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition min-h-[44px] ${tones[tone]}`}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}