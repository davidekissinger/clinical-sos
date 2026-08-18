import React from "react";
import { Link } from "react-router-dom";
import { Target, Briefcase, Activity, ListChecks, FileText, ShieldCheck, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { PageHeader, StatCard, Badge, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";

export default function Dashboard() {
  const leads = useEntities("Lead", { sort: "-created_date", limit: 100, excludeTestData: true });
  const opportunities = useEntities("Opportunity", { sort: "-created_date", limit: 200, excludeTestData: true });
  const signals = useEntities("RegulatorySignal", { sort: "-created_date", limit: 100, excludeTestData: true });
  const tasks = useEntities("Task", { sort: "-due_date", limit: 100, excludeTestData: true });
  const proposals = useEntities("Proposal", { sort: "-created_date", limit: 100, excludeTestData: true });
  const engagements = useEntities("Engagement", { sort: "-created_date", limit: 100, excludeTestData: true });

  const loading = leads.loading || opportunities.loading || signals.loading || tasks.loading;

  const tier1 = leads.data.filter((l) => l.lead_tier === "Tier 1").length;
  const tier2 = leads.data.filter((l) => l.lead_tier === "Tier 2").length;
  const tier3 = leads.data.filter((l) => l.lead_tier === "Tier 3").length;
  const unverified = leads.data.filter((l) => l.verification_status === "Unverified" || l.verification_status === "Research Required").length;
  const newSignals = signals.data.length;
  const highSignals = signals.data.filter((s) => s.severity === "High").length;
  const overdueTasks = tasks.data.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "Complete").length;
  const openProposals = proposals.data.filter((p) => p.status === "Sent" || p.status === "Approved").length;
  const activeEngagements = engagements.data.filter((e) => e.status === "Active").length;

  const won = opportunities.data.filter((o) => o.stage === "Won");
  const pipelineValue = opportunities.data
    .filter((o) => o.stage !== "Won" && o.stage !== "Lost" && o.stage !== "Suppressed")
    .reduce((sum, o) => sum + (o.estimated_value || 0), 0);
  const weightedPipeline = opportunities.data
    .filter((o) => o.stage !== "Won" && o.stage !== "Lost" && o.stage !== "Suppressed")
    .reduce((sum, o) => sum + (o.estimated_value || 0) * ((o.probability || 0) / 100), 0);
  const wonValue = won.reduce((sum, o) => sum + (o.estimated_value || 0), 0);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Executive Dashboard" subtitle="Pipeline, regulatory intelligence, and operations at a glance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={leads.data.length} sub={`${tier1} Tier 1 · ${tier2} Tier 2 · ${tier3} Tier 3`} icon={Target} />
        <StatCard label="New Regulatory Signals" value={newSignals} sub={`${highSignals} high severity`} icon={Activity} tone={highSignals ? "red" : "default"} />
        <StatCard label="Pipeline Value" value={`$${pipelineValue.toLocaleString()}`} sub={`Weighted $${Math.round(weightedPipeline).toLocaleString()}`} icon={DollarSign} tone="blue" />
        <StatCard label="Won Value" value={`$${wonValue.toLocaleString()}`} sub={`${won.length} won · ${activeEngagements} active`} icon={TrendingUp} tone="green" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <StatCard label="Unverified Leads" value={unverified} sub="Awaiting verification" icon={AlertTriangle} tone={unverified ? "amber" : "default"} />
        <StatCard label="Open Proposals" value={openProposals} sub="Awaiting response" icon={FileText} />
        <StatCard label="Active Engagements" value={activeEngagements} icon={ShieldCheck} tone="green" />
        <StatCard label="Overdue Tasks" value={overdueTasks} icon={ListChecks} tone={overdueTasks ? "red" : "default"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-6">
        <Panel title="Top Priority Leads" to="/command-center/leads">
          {leads.data.filter((l) => l.lead_tier === "Tier 1" || l.lead_tier === "Tier 2").slice(0, 6).map((l) => (
            <Row key={l.id} title={l.facility_name} sub={l.recommended_service || l.potential_urgency || "—"} right={<Badge tone={l.lead_tier === "Tier 1" ? "red" : "amber"}>{l.lead_tier}</Badge>} />
          ))}
          {leads.data.filter((l) => l.lead_tier === "Tier 1" || l.lead_tier === "Tier 2").length === 0 && <EmptyRow text="No priority leads yet" />}
        </Panel>

        <Panel title="Recent Regulatory Signals" to="/command-center/signals">
          {signals.data.slice(0, 6).map((s) => (
            <Row key={s.id} title={s.facility_name} sub={s.signal_type} right={
              <div className="flex gap-1.5">
                <Badge tone={s.severity === "High" ? "red" : s.severity === "Medium" ? "amber" : "default"}>{s.severity}</Badge>
                <Badge tone={s.verified ? "green" : "amber"}>{s.verified ? "Verified" : "Unverified"}</Badge>
              </div>
            } />
          ))}
          {signals.data.length === 0 && <EmptyRow text="No signals recorded yet" />}
        </Panel>

        <Panel title="Open Opportunities" to="/command-center/pipeline">
          {opportunities.data.filter((o) => o.stage !== "Won" && o.stage !== "Lost").slice(0, 6).map((o) => (
            <Row key={o.id} title={o.opportunity_name} sub={o.stage} right={<span className="text-sm font-medium text-foreground">{o.estimated_value ? `$${o.estimated_value.toLocaleString()}` : "—"}</span>} />
          ))}
          {opportunities.data.filter((o) => o.stage !== "Won" && o.stage !== "Lost").length === 0 && <EmptyRow text="No open opportunities" />}
        </Panel>

        <Panel title="Overdue & Upcoming Tasks" to="/command-center/tasks">
          {tasks.data.filter((t) => t.status !== "Complete").slice(0, 6).map((t) => (
            <Row key={t.id} title={t.task} sub={t.owner_name || "Unassigned"} right={<Badge tone={t.priority === "Urgent" ? "red" : t.priority === "High" ? "amber" : "default"}>{t.priority}</Badge>} />
          ))}
          {tasks.data.filter((t) => t.status !== "Complete").length === 0 && <EmptyRow text="No open tasks" />}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, to, children }) {
  return (
    <div className="bg-white rounded-xl border border-border">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <h2 className="font-semibold text-foreground">{title}</h2>
        <Link to={to} className="text-xs font-medium text-primary hover:underline">View all →</Link>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ title, sub, right }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{sub}</p>
      </div>
      <div className="flex-shrink-0">{right}</div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <div className="px-5 py-6 text-sm text-muted-foreground text-center">{text}</div>;
}