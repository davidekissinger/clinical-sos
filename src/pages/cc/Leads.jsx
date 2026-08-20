import React, { useState } from "react";
import { Target, Plus, Filter } from "lucide-react";
import { PageHeader, Badge, Table, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { base44 } from "@/api/base44Client";
import PullToRefresh from "@/components/PullToRefresh";

const TIERS = ["All", "Tier 1", "Tier 2", "Tier 3", "Nurture"];

export default function Leads() {
  const leads = useEntities("Lead", { sort: "-lead_score", limit: 200, excludeTestData: true });
  const [tier, setTier] = useState("All");
  const [updating, setUpdating] = useState(null);

  const filtered = leads.data.filter((l) => tier === "All" || l.lead_tier === tier);

  const advance = async (lead) => {
    setUpdating(lead.id);
    try {
      const next = { Unverified: "Verified", Verified: "Qualified", Qualified: "Qualified" }[lead.verification_status] || "Verified";
      await base44.entities.Lead.update(lead.id, { verification_status: next });
      leads.reload();
    } finally { setUpdating(null); }
  };

  if (leads.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Verified and unverified prospects from the regulatory lead engine and inbound forms"
        action={<button className="btn-primary"><Plus className="h-4 w-4" /> Add Lead</button>}
      />
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        {TIERS.map((t) => (
          <button key={t} onClick={() => setTier(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${tier === t ? "bg-primary text-white" : "bg-white dark:bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      <PullToRefresh onRefresh={leads.reload}>
        {filtered.length === 0 ? (
          <EmptyState title="No leads in this tier" subtitle="Leads appear here once the regulatory engine or inbound forms create them." />
        ) : (
          <Table headers={["Facility / Operator", "Tier", "Score", "Urgency", "Verification", "Recommended Service", "Next Action", ""]}>
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{l.facility_name}</p>
                  <p className="text-xs text-muted-foreground">{l.organization_name || "—"}</p>
                </td>
                <td className="px-4 py-3"><Badge tone={l.lead_tier === "Tier 1" ? "red" : l.lead_tier === "Tier 2" ? "amber" : l.lead_tier === "Tier 3" ? "blue" : "default"}>{l.lead_tier || "—"}</Badge></td>
                <td className="px-4 py-3 font-medium">{l.lead_score ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.potential_urgency || "—"}</td>
                <td className="px-4 py-3"><Badge tone={l.verification_status === "Verified" ? "green" : l.verification_status === "Unverified" ? "amber" : "default"}>{l.verification_status || "—"}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{l.recommended_service || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.next_action || "—"}</td>
                <td className="px-4 py-3">
                  <button onClick={() => advance(l)} disabled={updating === l.id} className="text-xs font-medium text-primary hover:underline disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    {updating === l.id ? "…" : "Advance →"}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </PullToRefresh>
      <p className="mt-4 text-xs text-muted-foreground flex items-start gap-2">
        <Target className="h-4 w-4 flex-shrink-0 mt-0.5" />
        Every lead must pass verification before outreach. Unverified records are marked "Research Required" and must not be contacted based on unverified claims.
      </p>
    </div>
  );
}