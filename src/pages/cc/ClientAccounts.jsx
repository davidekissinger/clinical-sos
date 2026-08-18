import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { Users, UserPlus, Settings } from "lucide-react";
import AccessibleDialog from "@/components/AccessibleDialog";
import InviteClientUserDialog from "@/components/cc/InviteClientUserDialog";
import ManageMembershipDialog from "@/components/cc/ManageMembershipDialog";
import ClientAccessAudit from "@/components/cc/ClientAccessAudit";

export default function ClientAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("accounts");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showAccessForm, setShowAccessForm] = useState(null);
  const [result, setResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [accRes, memRes] = await Promise.all([
        base44.entities.ClientAccount.list("-created_date", 200),
        base44.entities.ClientMembership.list("-created_date", 200),
      ]);
      setAccounts(Array.isArray(accRes) ? accRes : (accRes?.data || []));
      setMemberships(Array.isArray(memRes) ? memRes : (memRes?.data || []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const accessTone = (s) => s === "Active" ? "green" : s === "Grace Period" ? "blue" : s === "Restricted" ? "amber" : "red";
  const memTone = (s) => s === "Active" ? "green" : s === "Invited" ? "blue" : s === "Suspended" ? "amber" : "red";

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Client Accounts"
        subtitle={`${accounts.length} accounts · ${memberships.length} memberships`}
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowInviteForm(true)} className="btn-primary text-sm"><UserPlus className="h-4 w-4" /> Invite Client User</button>
            <button onClick={() => setShowAccountForm(true)} className="btn-secondary text-sm"><Users className="h-4 w-4" /> New Account</button>
          </div>
        }
      />

      <div className="flex gap-1 mb-5 border-b border-border">
        {["accounts", "memberships", "audit"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "accounts" && (
        <div className="bg-white dark:bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>{["Account", "Organization", "Access", "Billing", "Subscription", "Plan", "Override", "Actions"].map(h => <th key={h} scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map(a => (
                <tr key={a.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium text-foreground">{a.account_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.organization_name || "—"}</td>
                  <td className="px-4 py-3"><Badge tone={accessTone(a.access_status)}>{a.access_status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{a.billing_status}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.subscription_status}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.subscription_plan || "—"}</td>
                  <td className="px-4 py-3">{a.manual_access_override && a.manual_access_override !== "None" ? <Badge tone="amber">{a.manual_access_override}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3"><button onClick={() => setShowAccessForm(a)} className="btn-ghost text-xs"><Settings className="h-3 w-3" /> Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {accounts.length === 0 && <EmptyState title="No client accounts" subtitle="Create a client account to get started." />}
        </div>
      )}

      {tab === "memberships" && (
        <div className="bg-white dark:bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>{["User", "Account", "Status", "Facilities", "Engagements", "Actions"].map(h => <th key={h} scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {memberships.map(m => (
                <tr key={m.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium text-foreground">{m.client_user_name || m.client_user_email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.organization_name || "—"}</td>
                  <td className="px-4 py-3"><Badge tone={memTone(m.membership_status)}>{m.membership_status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{m.authorized_facility_ids?.length || 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.authorized_engagement_ids?.length || 0}</td>
                  <td className="px-4 py-3"><button onClick={() => setShowMemberForm(m)} className="btn-ghost text-xs"><Settings className="h-3 w-3" /> Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {memberships.length === 0 && <EmptyState title="No memberships" subtitle="Invite a client user to get started." />}
        </div>
      )}

      {tab === "audit" && <ClientAccessAudit />}

      <NewAccountDialog isOpen={showAccountForm} onClose={() => setShowAccountForm(false)} onResult={setResult} onReload={load} />
      <InviteClientUserDialog isOpen={showInviteForm} onClose={() => setShowInviteForm(false)} accounts={accounts} onResult={setResult} onReload={load} />
      {showMemberForm && <ManageMembershipDialog membership={showMemberForm} onClose={() => setShowMemberForm(null)} onResult={setResult} onReload={load} />}

      {showAccessForm && (
        <AccessibleDialog isOpen={!!showAccessForm} onClose={() => setShowAccessForm(null)} title={`Manage Access — ${showAccessForm.account_name}`} titleId="access-form-title" closeLabel="Close">
          <form onSubmit={async (e) => { e.preventDefault(); const f = e.target; const isOverride = f.manual_override.checked; try { await base44.functions.invoke("transitionClientAccess", { client_account_id: showAccessForm.id, new_access_status: f.new_access_status.value, reason: f.reason.value, manual_override: isOverride, manual_override_type: isOverride ? f.override_type.value : null, override_expiration: isOverride ? f.override_expiration.value || null : null }); setShowAccessForm(null); load(); setResult({ success: "Access updated" }); } catch (err) { setResult({ error: err.message }); } }} className="space-y-3">
            <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Current Status</span><p className="text-sm text-foreground">{showAccessForm.access_status}</p></label>
            <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">New Access Status *</span><select name="new_access_status" required className="cc-input"><option>Active</option><option>Grace Period</option><option>Restricted</option><option>Suspended</option><option>Terminated</option></select></label>
            <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Reason *</span><textarea name="reason" required rows={2} className="cc-input" /></label>
            <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" name="manual_override" className="h-4 w-4 rounded border-border" /> Apply as manual override</label>
            <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Override Type</span><select name="override_type" className="cc-input"><option>Extend Access</option><option>Maintain Access</option><option>Reactivate</option><option>Suspend</option><option>Terminate</option></select></label>
            <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Override Expiration (optional)</span><input name="override_expiration" type="datetime-local" className="cc-input" /></label>
            <button type="submit" className="btn-primary text-sm w-full">Update Access</button>
          </form>
        </AccessibleDialog>
      )}

      {result && (
        <div className={`fixed bottom-4 right-4 rounded-xl border p-4 shadow-lg z-50 max-w-sm ${result.error ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`} role="status" aria-live="polite">
          <p className="text-sm font-medium">{result.error || result.success}</p>
          <button onClick={() => setResult(null)} className="mt-1 text-xs underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}

function NewAccountDialog({ isOpen, onClose, onResult, onReload }) {
  return (
    <AccessibleDialog isOpen={isOpen} onClose={onClose} title="New Client Account" titleId="acc-form-title" closeLabel="Close">
      <form onSubmit={async (e) => { e.preventDefault(); const f = e.target; try { await base44.entities.ClientAccount.create({ account_name: f.account_name.value, organization_name: f.organization_name.value || null, access_status: f.access_status.value, billing_status: f.billing_status.value, subscription_status: f.subscription_status.value, subscription_plan: f.subscription_plan.value || null, subscription_start_date: f.subscription_start_date.value || null }); onClose(); onReload(); onResult({ success: "Account created" }); } catch (err) { onResult({ error: err.message }); } }} className="space-y-3">
        <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Account Name *</span><input name="account_name" required className="cc-input" /></label>
        <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Organization Name</span><input name="organization_name" className="cc-input" /></label>
        <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Access Status *</span><select name="access_status" required className="cc-input"><option>Active</option><option>Grace Period</option><option>Restricted</option><option>Suspended</option><option>Terminated</option></select></label>
        <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Billing Status</span><select name="billing_status" className="cc-input"><option>Unknown</option><option>Current</option><option>Invoice Due</option><option>Past Due</option><option>Payment Arrangement</option><option>Paid</option><option>Disputed</option></select></label>
        <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Subscription Status</span><select name="subscription_status" className="cc-input"><option>Not Applicable</option><option>Active</option><option>Trial</option><option>Grace Period</option><option>Past Due</option><option>Cancelled</option><option>Expired</option></select></label>
        <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Subscription Plan</span><input name="subscription_plan" className="cc-input" /></label>
        <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">Subscription Start Date</span><input name="subscription_start_date" type="date" className="cc-input" /></label>
        <button type="submit" className="btn-primary text-sm w-full">Create Account</button>
      </form>
    </AccessibleDialog>
  );
}