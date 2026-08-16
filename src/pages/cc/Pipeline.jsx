import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";

const STAGES = [
  "New", "Researching", "Verified", "Qualified", "Outreach Review",
  "Contacted", "Engaged", "Discovery Scheduled", "Discovery Completed",
  "Proposal Draft", "Proposal Sent", "Negotiation", "Won", "Lost", "Nurture", "Suppressed"
];

export default function Pipeline() {
  const opportunities = useEntities("Opportunity", { sort: "-created_date", limit: 300 });
  const [view, setView] = useState("kanban");
  const [dragId, setDragId] = useState(null);

  if (opportunities.loading) return <LoadingState />;

  const byStage = (stage) => opportunities.data.filter((o) => o.stage === stage);
  const onDrop = async (stage) => {
    if (!dragId) return;
    const opp = opportunities.data.find((o) => o.id === dragId);
    if (opp?.stage === stage) { setDragId(null); return; }
    try {
      await base44.entities.Opportunity.update(dragId, { stage });
      opportunities.reload();
    } finally { setDragId(null); }
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
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(stage)}
                className="flex-shrink-0 w-64 bg-secondary/40 rounded-xl border border-border"
              >
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{stage}</span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[60px]">
                  {items.map((o) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={() => setDragId(o.id)}
                      className="bg-white rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition"
                    >
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
        <div className="bg-white rounded-xl border border-border overflow-x-auto">
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
    </div>
  );
}