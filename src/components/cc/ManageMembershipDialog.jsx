import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AccessibleDialog from "@/components/AccessibleDialog";
import { Unlock, Ban, Lock, RotateCcw } from "lucide-react";

const CAP_LABELS = {
  can_login: "Can Login",
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

export default function ManageMembershipDialog({ membership, onClose, onResult, onReload }) {
  const [facilities, setFacilities] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [selectedFacilityIds, setSelectedFacilityIds] = useState([]);
  const [selectedEngagementIds, setSelectedEngagementIds] = useState([]);
  const [caps, setCaps] = useState({});

  useEffect(() => {
    async function loadScope() {
      try {
        // Get the membership's ClientAccount to determine organization scope
        const account = await base44.entities.ClientAccount.get(membership.client_account_id);
        if (!account || !account.organization_id) { setFacilities([]); setEngagements([]); return; }

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
    setSelectedFacilityIds(membership.authorized_facility_ids || []);
    setSelectedEngagementIds(membership.authorized_engagement_ids || []);
    const initialCaps = {};
    Object.keys(CAP_LABELS).forEach(c => { initialCaps[c] = membership[c]; });
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
      onClose(); onReload();
      onResult({ success: "Membership updated" });
    } catch (err) { onResult({ error: err.message }); }
  };

  return (
    <AccessibleDialog isOpen={!!membership} onClose={onClose} title={`Manage Membership — ${membership.client_user_name || membership.client_user_email}`} titleId="mem-form-title" closeLabel="Close">
      <form onSubmit={handleUpdate} className="space-y-3">
        <ScopeSelector
          label="Authorized Facilities"
          items={facilities.map(f => ({ id: f.id, label: `${f.facility_name} — ${f.city || ""}, ${f.state || ""}` }))}
          selected={selectedFacilityIds}
          onToggle={(id) => toggleId(selectedFacilityIds, id, setSelectedFacilityIds)}
        />
        <ScopeSelector
          label="Authorized Engagements"
          items={engagements.map(e => ({ id: e.id, label: `${e.engagement_name} — ${e.status}` }))}
          selected={selectedEngagementIds}
          onToggle={(id) => toggleId(selectedEngagementIds, id, setSelectedEngagementIds)}
        />
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

function ScopeSelector({ label, items, selected, onToggle }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
        {items.length === 0 ? <p className="text-xs text-muted-foreground">None available</p> :
          items.map(item => (
            <label key={item.id} className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 rounded border-border" />
              {item.label}
            </label>
          ))
        }
      </div>
    </div>
  );
}