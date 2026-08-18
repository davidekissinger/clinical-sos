import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { X, CheckCircle2 } from "lucide-react";

const STAGES = [
  "New", "Researching", "Verified", "Qualified", "Outreach Review",
  "Contacted", "Engaged", "Discovery Scheduled", "Discovery Completed",
  "Proposal Draft", "Proposal Sent", "Negotiation", "Won", "Lost", "Nurture", "Suppressed"
];

export default function Pipeline() {
  const opportunities = useEntities("Opportunity", { sort: "-created_date", limit: 300, excludeTestData: true });
  const engagements = useEntities("Engagement", { sort: "-created_date", limit: 100, excludeTestData: true });
  const [view, setView] = useState("kanban");
  const [dragId, setDragId] = useState(null);
  const [wonModal, setWonModal] = useState(null);
  const [engagementResult, setEngagementResult] = useState(null);

  if (opportunities.loading) return <LoadingState />;

  const byStage = (stage) => opportunities.data.filter((o) => o.stage === stage);

  const onDrop = async (stage) => {
    if (!dragId) return;
    const opp = opportunities.data.find((o) => o.id === dragId);
    if (opp?.stage === stage) { setDragId(null); return; }

    // If moving to Won, open the engagement creation modal — backend handles the Won transition atomically
    if (stage === "Won") {
      setWonModal({ opportunity_id: dragId, opportunity: opp });
      setDragId(null);
      return;
    }

    try {
      await base44.entities.Opportunity.update(dragId, { stage });
      opportunities.reload();
    } finally { setDragId(null); }
  };

  const createEngagement = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      opportunity_id: wonModal.opportunity_id,
      service_type: form.service_type.value,
      start_date: form.start_date.value,
      clinical_lead_name: form.clinical_lead_name.value || "To be assigned",
      engagement_model: form.engagement_model.value,
      accepted_proposal_id: form.accepted_proposal_id?.value || null,
    };
    try {
      const res = await base44.functions.invoke("createEngagementFromOpportunity", payload);
      const data = res.data || res;
      if (data?.error) {
        setEngagementResult({ error: data.error });
      } else {
        setEngagementResult(data);
        setWonModal(null);
        // Backend has already marked the Opportunity as Won and created the Engagement
        opportunities.reload();
        engagements.reload();
      }
    } catch (err) {
      setEngagementResult({ error: err?.message || "Engagement creation failed" });
      console.error(err);
    }
  };

  const totalValue = opportunities.data.filter((o) => o.stage !== "Won" && o.stage !== "Lost" && o.stage !== "Suppressed").reduce((s, o) => s + (o.estimated_value || 0), 0);

  return (
    <div>
      <PageHeader
        title="Sales Pipeline"
        subtitle={`${opportunities.data.length} opportunities · $${totalValue.toLocaleString()} open pipeline value`}
        action={
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-sm font-medium ${view === "kanban" ? "bg-primary text-white" : "bg-white text-muted-foreground"}`}>Kanban</button>
            <button onClick={() => setView("table")} className={`px-3 py-1.5 text-sm font-medium ${view === "table" ? "bg-primary text-white" : "bg-white text-muted-foreground"}`}>Table</button>
          </div>
        }
      />

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const items = byStage(stage);
            const stageValue = items.reduce((s, o) => s + (o.estimated_value || 0), 0);
            return (
              <div key={stage} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(stage)} className="flex-shrink-0 w-64 bg-secondary/40 rounded-xl border border-border">
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{stage}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[60px]">
                  {items.map((o) => (
                    <div key={o.id} draggable onDragStart={() => setDragId(o.id)} className="bg-white dark:bg-card rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition">
                      <p className="text-sm font-medium text-foreground leading-snug">{o.opportunity_name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge tone={o.lead_tier === "Tier 1" ? "red" : o.lead_tier === "Tier 2" ? "amber" : "default"}>{o.lead_tier || "—"}</Badge>
                        <span className="text-xs font-medium text-foreground">{o.estimated_value ? `$${o.estimated_value.toLocaleString()}` : "—"}</span>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Drop here</p>}
                </div>
                {stageValue > 0 && <p className="px-3 pb-2 text-xs text-muted-foreground">${stageValue.toLocaleString()}</p>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-card rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>{["Opportunity", "Stage", "Tier", "Value", "Probability", "Owner", "Expected Close"].map((h) => <th key={h} className="text-left font-medium px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {opportunities.data.map((o) => (
                <tr key={o.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium text-foreground">{o.opportunity_name}</td>
                  <td className="px-4 py-3"><Badge>{o.stage}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={o.lead_tier === "Tier 1" ? "red" : o.lead_tier === "Tier 2" ? "amber" : "default"}>{o.lead_tier || "—"}</Badge></td>
                  <td className="px-4 py-3">{o.estimated_value ? `$${o.estimated_value.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.probability != null ? `${o.probability}%` : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.owner_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{o.expected_close || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Won → Engagement Modal */}
      {wonModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-card rounded-xl border border-border p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Create Engagement — Won Opportunity</h3>
              <button onClick={() => { setWonModal(null); setDragId(null); }} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Opportunity: <span className="font-medium text-foreground">{wonModal.opportunity?.opportunity_name}</span></p>
            <form onSubmit={createEngagement} className="space-y-3">
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">Service Type *</span>
                <input name="service_type" required placeholder="e.g. Rapid Survey Recovery" className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">Start Date *</span>
                <input name="start_date" type="date" required className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">Clinical Lead</span>
                <input name="clinical_lead_name" placeholder="Clinical lead name" className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">Engagement Model *</span>
                <select name="engagement_model" required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="Fixed Fee">Fixed Fee</option>
                  <option value="Hourly">Hourly</option>
                  <option value="Time and Expense">Time and Expense</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">Accepted Proposal ID (optional)</span>
                <input name="accepted_proposal_id" placeholder="Proposal ID if applicable" className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm flex-1">Create Engagement & Mark Won</button>
                <button type="button" onClick={() => { setWonModal(null); setDragId(null); }} className="btn-ghost text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Engagement Result */}
      {engagementResult && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-card rounded-xl border border-border p-4 shadow-lg z-50 max-w-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{engagementResult.duplicate ? "Engagement already exists" : "Engagement created"}</p>
              {engagementResult.engagement_name && <p className="text-xs text-muted-foreground mt-0.5">{engagementResult.engagement_name}</p>}
            </div>
            <button onClick={() => setEngagementResult(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}