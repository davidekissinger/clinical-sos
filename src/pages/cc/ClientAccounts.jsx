import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { Users, UserPlus, Lock, Unlock, Ban, RotateCcw, Settings } from "lucide-react";
import AccessibleDialog from "@/components/AccessibleDialog";

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
                  <td className="px-4 py-3">
                    <button onClick={() => setShowAccessForm(a)} className="btn-ghost text-xs"><Settings className="h-3 w-3" /> Manage</button>
                  </td>
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
                  <td className="px-4 py-3">
                    <button onClick={() => setShowMemberForm(m)} className="btn-ghost text-xs"><Settings className="h-3 w-3" /> Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {memberships.length === 0 && <EmptyState title="No memberships" subtitle="Invite a client user to get started." />}
        </div>
      )}

      {tab === "audit" && <AuditLog />}

      {/* New Account Form */}
      <AccessibleDialog isOpen={showAccountForm} onClose={() => setShowAccountForm(false)} title="New Client Account" titleId="acc-form-title" closeLabel="Close">
        <form onSubmit={async (e) => { e.preventDefault(); const f = e.target; try { await base44.entities.ClientAccount.create({ account_name: f.account_name.value, organization_id: f.organization_id.value || null, organization_name: f.organization_name.value || null, access_status: f.access_status.value, billing_status: f.billing_status.value, subscription_status: f.subscription_status.value, subscription_plan: f.subscription_plan.value || null, subscription_start_date: f.subscription_start_date.value || null }); setShowAccountForm(false); load(); setResult({ success: "Account created" }); } catch (err) { setResult({ error: err.message }); } }} className="space-y-3">
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

      {/* Invite Client User Form */}
      <InviteClientUserDialog
        isOpen={showInviteForm}
        onClose={() => setShowInviteForm(false)}
        accounts={accounts}
        onResult={setResult}
        onReload={load}
      />

      {/* Manage Membership Form */}
      {showMemberForm && (
        <ManageMembershipDialog
          membership={showMemberForm}
          onClose={() => setShowMemberForm(null)}
          onResult={setResult}
          onReload={load}
        />
      )}

      {/* Manage Access Form */}
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

function InviteClientUserDialog({ isOpen, onClose, accounts, onResult, onReload }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFacilityIds, setSelectedFacilityIds] = useState([]);
  const [selectedEngagementIds, setSelectedEngagementIds] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [caps, setCaps] = useState({});
  const [loading, setLoading] = useState(false);

  const searchUsers = async () => {
    if (!searchEmail || searchEmail.length < 3) return;
    setLoading(true);
    try {
      const res = await base44.entities.User.list("-created_date", 50);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setPendingUsers(list.filter(u => u.email?.toLowerCase().includes(searchEmail.toLowerCase()) && u.role === "pending"));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Load facilities and engagements when account is selected
  useEffect(() => {
    if (!selectedAccountId) { setFacilities([]); setEngagements([]); return; }
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) return;
    async function loadScope() {
      try {
        const [facRes, engRes] = await Promise.all([
          base44.entities.Facility.list("-facility_name", 200),
          base44.entities.Engagement.list("-created_date", 200),
        ]);
        const facList = Array.isArray(facRes) ? facRes : (facRes?.data || []);
        const engList = Array.isArray(engRes) ? engRes : (engRes?.data || []);
        // Filter to facilities/engagements belonging to this account's organization
        setFacilities(facList.filter(f => !account.organization_id || f.operator_id === account.organization_id || !f.operator_id));
        setEngagements(engList.filter(e => !account.organization_id || e.organization_id === account.organization_id || !e.organization_id));
      } catch (e) { console.error(e); }
    }
    loadScope();
  }, [selectedAccountId, accounts]);

  const toggleId = (list, id, setter) => {
    if (list.includes(id)) setter(list.filter(x => x !== id));
    else setter([...list, id]);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedUser || !selectedAccountId) {
      onResult({ error: "Select a user and account" });
      return;
    }
    try {
      const account = accounts.find(a => a.id === selectedAccountId);
      await base44.functions.invoke("manageClientMembership", {
        action: "create",
        client_user_id: selectedUser.id,
        client_account_id: selectedAccountId,
        organization_id: account?.organization_id || null,
        organization_name: account?.organization_name || null,
        authorized_facility_ids: selectedFacilityIds,
        authorized_engagement_ids: selectedEngagementIds,
        capabilities: {
          can_login: true,
          can_view_engagement: caps.can_view_engagement ?? true,
          can_view_documents: caps.can_view_documents ?? true,
          can_download_documents: caps.can_download_documents ?? true,
          can_review_poc: caps.can_review_poc ?? true,
          can_approve_poc: caps.can_approve_poc ?? false,
          can_view_tasks: caps.can_view_tasks ?? true,
          can_complete_tasks: caps.can_complete_tasks ?? false,
          can_submit_evidence: caps.can_submit_evidence ?? false,
          can_view_audits: caps.can_view_audits ?? true,
          can_complete_audits: caps.can_complete_audits ?? false,
          can_message_consultant: caps.can_message_consultant ?? true
        },
        reason: "Admin invitation via Client Accounts"
      });
      onResult({ success: "Membership created — user invited" });
      onClose();
      onReload();
    } catch (err) { onResult({ error: err.message }); }
  };

  const capLabels = {
    can_view_engagement: "View Engagements",
    can_view_documents: "View Documents",
    can_download_documents: "Download Documents",
    can_review_poc: "Review POCs",
    can_approve_poc: "Approve POCs",
    can_view_tasks: "View Tasks",
    can_complete_tasks: "Complete Tasks",
    can_submit_evidence: "Submit Evidence",
    can_view_audits: "View Audits",
    can_complete_audits: "Complete Audits",
    can_message_consultant: "Message Consultant",
  };

  return (
    <AccessibleDialog isOpen={isOpen} onClose={onClose} title="Invite Client User" titleId="invite-form-title" closeLabel="Close">
      <div className="space-y-4">
        {/* Step 1: Search pending users */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Search pending users by email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              placeholder="user@example.com"
              className="cc-input flex-1"
            />
            <button type="button" onClick={searchUsers} className="btn-secondary text-xs">Search</button>
          </div>
          {pendingUsers.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {pendingUsers.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  className={`block w-full text-left p-2 rounded-lg border text-sm ${selectedUser?.id === u.id ? "border-primary bg-accent" : "border-border hover:border-primary"}`}
                >
                  <span className="font-medium">{u.email}</span>
                  <span className="text-xs text-muted-foreground ml-2">{u.full_name || "No name"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Select account */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Client Account *</label>
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="cc-input">
            <option value="">— Select Account —</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
          </select>
        </div>

        {/* Step 3: Select facilities */}
        {facilities.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Authorized Facilities</label>
            <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {facilities.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedFacilityIds.includes(f.id)}
                    onChange={() => toggleId(selectedFacilityIds, f.id, setSelectedFacilityIds)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {f.facility_name} — {f.city || ""}, {f.state || ""}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Select engagements */}
        {engagements.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Authorized Engagements</label>
            <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {engagements.map(e => (
                <label key={e.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={selectedEngagementIds.includes(e.id)}
                    onChange={() => toggleId(selectedEngagementIds, e.id, setSelectedEngagementIds)}
                    className="h-4 w-4 rounded border-border"
                  />
                  {e.engagement_name} — {e.status}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Capabilities */}
        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground mb-2">Capabilities</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(capLabels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={caps[key] ?? (key === "can_approve_poc" ? false : key === "can_complete_tasks" ? false : key === "can_submit_evidence" ? false : key === "can_complete_audits" ? false : true)}
                  onChange={e => setCaps({ ...caps, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="button" onClick={handleCreate} disabled={!selectedUser || !selectedAccountId} className="btn-primary text-sm w-full disabled:opacity-60">
          Create Membership & Invite
        </button>
      </div>
    </AccessibleDialog>
  );
}

function ManageMembershipDialog({ membership, onClose, onResult, onReload }) {
  const [facilities, setFacilities] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [selectedFacilityIds, setSelectedFacilityIds] = useState([]);
  const [selectedEngagementIds, setSelectedEngagementIds] = useState([]);
  const [caps, setCaps] = useState({});

  useEffect(() => {
    async function loadScope() {
      try {
        const [facRes, engRes] = await Promise.all([
          base44.entities.Facility.list("-facility_name", 200),
          base44.entities.Engagement.list("-created_date", 200),
        ]);
        setFacilities(Array.isArray(facRes) ? facRes : (facRes?.data || []));
        setEngagements(Array.isArray(engRes) ? engRes : (engRes?.data || []));
      } catch (e) { console.error(e); }
    }
    loadScope();
    setSelectedFacilityIds(membership.authorized_facility_ids || []);
    setSelectedEngagementIds(membership.authorized_engagement_ids || []);
    const initialCaps = {};
    ["can_login","can_view_engagement","can_view_documents","can_download_documents","can_review_poc","can_approve_poc","can_view_tasks","can_complete_tasks","can_submit_evidence","can_view_audits","can_complete_audits","can_message_consultant"].forEach(c => {
      initialCaps[c] = membership[c];
    });
    setCaps(initialCaps);
  }, [membership]);

  const toggleId = (list, id, setter) => {
    if (list.includes(id)) setter(list.filter(x => x !== id));
    else setter([...list, id]);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await base44.functions.invoke("manageClientMembership", {
        action: "update_capabilities",
        membership_id: membership.id,
        authorized_facility_ids: selectedFacilityIds,
        authorized_engagement_ids: selectedEngagementIds,
        capabilities: caps
      });
      onClose();
      onReload();
      onResult({ success: "Membership updated" });
    } catch (err) { onResult({ error: err.message }); }
  };

  const capLabels = {
    can_login: "Can Login",
    can_view_engagement: "View Engagements",
    can_view_documents: "View Documents",
    can_download_documents: "Download Documents",
    can_review_poc: "Review POCs",
    can_approve_poc: "Approve POCs",
    can_view_tasks: "View Tasks",
    can_complete_tasks: "Complete Tasks",
    can_submit_evidence: "Submit Evidence",
    can_view_audits: "View Audits",
    can_complete_audits: "Complete Audits",
    can_message_consultant: "Message Consultant",
  };

  return (
    <AccessibleDialog isOpen={!!membership} onClose={onClose} title={`Manage Membership — ${membership.client_user_name || membership.client_user_email}`} titleId="mem-form-title" closeLabel="Close">
      <form onSubmit={handleUpdate} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Authorized Facilities</label>
          <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
            {facilities.length === 0 ? <p className="text-xs text-muted-foreground">No facilities available</p> :
              facilities.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={selectedFacilityIds.includes(f.id)} onChange={() => toggleId(selectedFacilityIds, f.id, setSelectedFacilityIds)} className="h-4 w-4 rounded border-border" />
                  {f.facility_name} — {f.city || ""}, {f.state || ""}
                </label>
              ))
            }
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Authorized Engagements</label>
          <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
            {engagements.length === 0 ? <p className="text-xs text-muted-foreground">No engagements available</p> :
              engagements.map(e => (
                <label key={e.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={selectedEngagementIds.includes(e.id)} onChange={() => toggleId(selectedEngagementIds, e.id, setSelectedEngagementIds)} className="h-4 w-4 rounded border-border" />
                  {e.engagement_name} — {e.status}
                </label>
              ))
            }
          </div>
        </div>
        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground mb-2">Capabilities</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(capLabels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={caps[key] ?? false} onChange={e => setCaps({ ...caps, [key]: e.target.checked })} className="h-4 w-4 rounded border-border" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn-primary text-sm w-full">Update Membership</button>
        <div className="flex gap-2 pt-2 border-t border-border">
          {membership.membership_status !== "Active" && <button type="button" onClick={async () => { await base44.functions.invoke("manageClientMembership", { action: "activate", membership_id: membership.id }); onClose(); onReload(); onResult({ success: "Membership activated & access synced" }); }} className="btn-secondary text-xs flex-1"><Unlock className="h-3 w-3" /> Activate</button>}
          {membership.membership_status === "Active" && <button type="button" onClick={async () => { await base44.functions.invoke("manageClientMembership", { action: "suspend", membership_id: membership.id, reason: "Admin suspension" }); onClose(); onReload(); onResult({ success: "Membership suspended" }); }} className="btn-secondary text-xs flex-1"><Ban className="h-3 w-3" /> Suspend</button>}
          <button type="button" onClick={async () => { await base44.functions.invoke("manageClientMembership", { action: "revoke", membership_id: membership.id, reason: "Admin revocation" }); onClose(); onReload(); onResult({ success: "Membership revoked" }); }} className="btn-secondary text-xs flex-1"><Lock className="h-3 w-3" /> Revoke</button>
          <button type="button" onClick={async () => { await base44.functions.invoke("syncClientMembershipAccess", { membership_id: membership.id }); onResult({ success: "Access synced" }); }} className="btn-secondary text-xs flex-1"><RotateCcw className="h-3 w-3" /> Sync</button>
        </div>
      </form>
    </AccessibleDialog>
  );
}

function AuditLog() {
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