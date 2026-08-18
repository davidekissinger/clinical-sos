import React from "react";
import { Link } from "react-router-dom";
import { PageHeader, StatCard, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { AlertTriangle, FileText, CheckCircle2, XCircle, Clock, Activity, ShieldAlert, ClipboardCheck, GraduationCap, FolderCheck, Stethoscope } from "lucide-react";

export default function RecoveryDashboard() {
  const cases = useEntities("RegulatoryCase", { sort: "-created_date", limit: 100, excludeTestData: true });
  const deficiencies = useEntities("Deficiency", { sort: "-priority_ranking", limit: 200, excludeTestData: true });
  const audits = useEntities("AuditTool", { sort: "-audit_date", limit: 200, excludeTestData: true });
  const evidence = useEntities("EvidenceItem", { sort: "-created_date", limit: 200, excludeTestData: true });
  const education = useEntities("EducationPlan", { sort: "-created_date", limit: 100, excludeTestData: true });
  const qapi = useEntities("QAPIReview", { sort: "-qapi_review_date", limit: 100, excludeTestData: true });

  const loading = cases.loading || deficiencies.loading;

  if (loading) return <LoadingState />;

  const activeCases = cases.data.filter(c => c.case_status !== "Closed");
  const criticalCases = cases.data.filter(c => c.regulatory_urgency === "Critical");
  const openDeficiencies = deficiencies.data.filter(d => d.deficiency_status !== "Closed");
  const highPriorityDef = deficiencies.data.filter(d => d.immediate_jeopardy === "Yes" || d.scope_severity?.includes("Immediate Jeopardy"));
  const completedAudits = audits.data.filter(a => a.audit_result !== "Not Completed");
  const failedAudits = audits.data.filter(a => a.audit_result === "Failed");
  const passedAudits = audits.data.filter(a => a.audit_result === "Pass");
  const complianceRate = completedAudits.length > 0 ? Math.round((passedAudits.length / completedAudits.length) * 100) : 0;
  const evidenceAccepted = evidence.data.filter(e => e.review_status === "Accepted");
  const evidencePending = evidence.data.filter(e => e.review_status === "Required" || e.review_status === "Requested" || e.review_status === "Received");
  const educationCompleted = education.data.filter(e => e.education_status === "Completed" || e.education_status === "Competency Completed");
  const qapiReviews = qapi.data.length;
  const revisitReady = deficiencies.data.filter(d => d.revisit_readiness_status === "Ready");
  const notReady = deficiencies.data.filter(d => d.revisit_readiness_status === "Not Ready" || d.revisit_readiness_status === "Significant Gaps");

  const overdueItems = [
    ...deficiencies.data.filter(d => d.target_completion_date && new Date(d.target_completion_date) < new Date() && d.deficiency_status !== "Closed"),
  ];

  return (
    <div>
      <PageHeader title="Rapid Regulatory Recovery" subtitle="High-priority regulatory engagements and work-product status" />

      {/* Case Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Cases" value={activeCases.length} sub={`${criticalCases.length} critical urgency`} icon={ShieldAlert} tone={criticalCases.length ? "red" : "default"} />
        <StatCard label="Open Deficiencies" value={openDeficiencies.length} sub={`${highPriorityDef.length} high-priority / IJ`} icon={AlertTriangle} tone={highPriorityDef.length ? "amber" : "default"} />
        <StatCard label="Audit Compliance" value={`${complianceRate}%`} sub={`${completedAudits.length} audits · ${failedAudits.length} failed`} icon={ClipboardCheck} tone={complianceRate < 80 ? "amber" : "green"} />
        <StatCard label="Revisit Ready" value={revisitReady.length} sub={`${notReady.length} not ready`} icon={CheckCircle2} tone={notReady.length ? "red" : "green"} />
      </div>

      {/* Work Product Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="POCs Drafted" value={deficiencies.data.filter(d => d.deficiency_status !== "Draft").length} sub={`${deficiencies.data.filter(d => d.deficiency_status === "Approved" || d.deficiency_status === "Implementation").length} approved`} icon={FileText} />
        <StatCard label="Education Completed" value={educationCompleted.length} sub={`${education.data.filter(e => e.education_status === "Competency Pending").length} competency pending`} icon={GraduationCap} />
        <StatCard label="Evidence Accepted" value={evidenceAccepted.length} sub={`${evidencePending.length} pending`} icon={FolderCheck} tone={evidencePending.length ? "amber" : "default"} />
        <StatCard label="QAPI Reviews" value={qapiReviews} icon={Stethoscope} />
      </div>

      {/* Active Cases */}
      <div className="bg-white dark:bg-card rounded-xl border border-border mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Active Regulatory Cases</h2>
          <Link to="/command-center/cases" className="text-xs font-medium text-primary hover:underline">View all →</Link>
        </div>
        <div className="divide-y divide-border">
          {activeCases.slice(0, 6).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link to={`/command-center/cases/${c.id}`} className="text-sm font-medium text-foreground hover:text-primary truncate block">{c.case_name}</Link>
                <p className="text-xs text-muted-foreground truncate">{c.facility_name} · {c.case_status}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge tone={c.regulatory_urgency === "Critical" ? "red" : c.regulatory_urgency === "Severe" ? "amber" : "default"}>{c.regulatory_urgency}</Badge>
                {c.regulatory_urgency_score != null && <span className="text-sm font-bold text-foreground">{c.regulatory_urgency_score}</span>}
              </div>
            </div>
          ))}
          {activeCases.length === 0 && <EmptyState text="No active regulatory cases" />}
        </div>
      </div>

      {/* Overdue & Timeline */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white dark:bg-card rounded-xl border border-border">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Clock className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Overdue Items</h2>
          </div>
          <div className="divide-y divide-border">
            {overdueItems.slice(0, 6).map((d) => (
              <div key={d.id} className="px-5 py-3">
                <Link to={`/command-center/deficiencies/${d.id}`} className="text-sm font-medium text-foreground hover:text-primary">{d.f_tag} — {d.deficiency_title || "Untitled"}</Link>
                <p className="text-xs text-rose-600 font-medium">Due {d.target_completion_date} · {d.deficiency_status}</p>
              </div>
            ))}
            {overdueItems.length === 0 && <EmptyState text="No overdue items" />}
          </div>
        </div>

        <div className="bg-white dark:bg-card rounded-xl border border-border">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> High-Priority Deficiencies</h2>
          </div>
          <div className="divide-y divide-border">
            {deficiencies.data.filter(d => d.deficiency_status !== "Closed").sort((a,b) => (b.priority_ranking||0) - (a.priority_ranking||0)).slice(0, 6).map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <Link to={`/command-center/deficiencies/${d.id}`} className="text-sm font-medium text-foreground hover:text-primary">{d.f_tag} — {d.deficiency_title || "Untitled"}</Link>
                  <p className="text-xs text-muted-foreground truncate">{d.scope_severity || "—"} · {d.deficiency_status}</p>
                </div>
                {d.immediate_jeopardy === "Yes" && <Badge tone="red">IJ</Badge>}
              </div>
            ))}
            {deficiencies.data.filter(d => d.deficiency_status !== "Closed").length === 0 && <EmptyState text="No open deficiencies" />}
          </div>
        </div>
      </div>
    </div>
  );
}