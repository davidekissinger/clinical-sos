import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AccessibleDialog from "@/components/AccessibleDialog";

const CAP_LABELS = {
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
  can_complete_audits: "Complete Audits",
  can_message_consultant: "Message Consultant",
};

const DEFAULT_CAPS = {
  can_view_engagement: true,
  can_view_documents: true,
  can_download_documents: true,
  can_view_poc: true,
  can_review_poc: true,
  can_approve_poc: false,
  can_view_tasks: true,
  can_complete_tasks: false,
  can_view_evidence: true,
  can_submit_evidence: false,
  can_view_audits: true,
  can_complete_audits: false,
  can_message_consultant: true,
};

export default function InviteClientUserDialog({ isOpen, onClose, accounts, onResult, onReload }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedFacilityIds, setSelectedFacilityIds] = useState([]);
  const [selectedEngagementIds, setSelectedEngagementIds] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [caps, setCaps] = useState(DEFAULT_CAPS);
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

  useEffect(() => {
    if (!selectedAccountId) { setFacilities([]); setEngagements([]); return; }
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account || !account.organization_id) { setFacilities([]); setEngagements([]); return; }
    async function loadScope() {
      try {
        const [facRes, engRes] = await Promise.all([
          base44.entities.Facility.list("-facility_name", 200),
          base44.entities.Engagement.list("-created_date", 200),
        ]);
        const facList = Array.isArray(facRes) ? facRes : (facRes?.data || []);
        const engList = Array.isArray(engRes) ? engRes : (engRes?.data || []);
        // Strict: only facilities/engagements matching the account's organization_id
        setFacilities(facList.filter(f => f.operator_id === account.organization_id));
        setEngagements(engList.filter(e => (e.organization_id === account.organization_id) || (e.client_account_id === account.id)));
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
    if (!selectedUser || !selectedAccountId) { onResult({ error: "Select a user and account" }); return; }
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account.organization_id) { onResult({ error: "Client Account must be linked to an Organization before tenant resources can be assigned." }); return; }
    try {
      await base44.functions.invoke("manageClientMembership", {
        action: "create",
        client_user_id: selectedUser.id,
        client_account_id: selectedAccountId,
        authorized_facility_ids: selectedFacilityIds,
        authorized_engagement_ids: selectedEngagementIds,
        capabilities: { can_login: true, ...caps },
        reason: "Admin invitation via Client Accounts"
      });
      onResult({ success: "Membership created — user invited" });
      onClose(); onReload();
    } catch (err) { onResult({ error: err.message }); }
  };

  return (
    <AccessibleDialog isOpen={isOpen} onClose={onClose} title="Invite Client User" titleId="invite-form-title" closeLabel="Close">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Search pending users by email</label>
          <div className="flex gap-2">
            <input type="email" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="user@example.com" className="cc-input flex-1" />
            <button type="button" onClick={searchUsers} className="btn-secondary text-xs">Search</button>
          </div>
          {pendingUsers.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {pendingUsers.map(u => (
                <button key={u.id} type="button" onClick={() => setSelectedUser(u)} className={`block w-full text-left p-2 rounded-lg border text-sm ${selectedUser?.id === u.id ? "border-primary bg-accent" : "border-border hover:border-primary"}`}>
                  <span className="font-medium">{u.email}</span>
                  <span className="text-xs text-muted-foreground ml-2">{u.full_name || "No name"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Client Account *</label>
          <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="cc-input">
            <option value="">— Select Account —</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}{a.organization_name ? ` (${a.organization_name})` : ""}</option>)}
          </select>
          {selectedAccountId && !accounts.find(a => a.id === selectedAccountId)?.organization_id && (
            <p className="mt-1 text-xs text-rose-600">This account has no Organization linked. Tenant resources cannot be assigned.</p>
          )}
        </div>
        {facilities.length > 0 && (
          <ScopeList label="Authorized Facilities" items={facilities.map(f => ({ id: f.id, label: `${f.facility_name} — ${f.city || ""}, ${f.state || ""}` }))} selected={selectedFacilityIds} onToggle={(id) => toggleId(selectedFacilityIds, id, setSelectedFacilityIds)} />
        )}
        {engagements.length > 0 && (
          <ScopeList label="Authorized Engagements" items={engagements.map(e => ({ id: e.id, label: `${e.engagement_name} — ${e.status}` }))} selected={selectedEngagementIds} onToggle={(id) => toggleId(selectedEngagementIds, id, setSelectedEngagementIds)} />
        )}
        <fieldset>
          <legend className="text-xs font-medium text-muted-foreground mb-2">Capabilities</legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CAP_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={caps[key] ?? false} onChange={e => setCaps({ ...caps, [key]: e.target.checked })} className="h-4 w-4 rounded border-border" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" onClick={handleCreate} disabled={!selectedUser || !selectedAccountId} className="btn-primary text-sm w-full disabled:opacity-60">Create Membership & Invite</button>
      </div>
    </AccessibleDialog>
  );
}

function ScopeList({ label, items, selected, onToggle }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
        {items.map(item => (
          <label key={item.id} className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 rounded border-border" />
            {item.label}
          </label>
        ))}
      </div>
    </div>
  );
}