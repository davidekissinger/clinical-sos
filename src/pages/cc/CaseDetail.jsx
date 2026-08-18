import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { Plus, ArrowLeft, AlertTriangle, FileText, ShieldCheck } from "lucide-react";
import { useParams } from "react-router-dom";

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cases = useEntities("RegulatoryCase", { limit: 200 });
  const deficiencies = useEntities("Deficiency", { sort: "-priority_ranking", limit: 200 });

  const caseData = cases.data.find(c => c.id === id);
  const caseDeficiencies = deficiencies.data.filter(d => d.regulatory_case_id === id);

  if (cases.loading || deficiencies.loading) return <LoadingState />;

  if (!caseData) {
    return (
      <div>
        <Link to="/command-center/cases" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Cases</Link>
        <EmptyState text="Regulatory case not found" />
      </div>
    );
  }

  return (
    <div>
      <Link to="/command-center/cases" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Cases</Link>

      <PageHeader
        title={caseData.case_name}
        subtitle={`${caseData.facility_name || "—"} · ${caseData.client_name || "—"}`}
        action={
          <button onClick={() => navigate(`/command-center/cases/${id}/new-deficiency`)} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> Add Deficiency
          </button>
        }
      />

      {/* Case Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Case Status" value={caseData.case_status} />
        <SummaryCard label="Regulatory Urgency" value={caseData.regulatory_urgency} tone={caseData.regulatory_urgency === "Critical" ? "red" : caseData.regulatory_urgency === "Severe" ? "amber" : "default"} />
        <SummaryCard label="Urgency Score" value={caseData.regulatory_urgency_score ?? "—"} />
        <SummaryCard label="Priority Score" value={caseData.clinical_sos_priority_score ?? "—"} />
      </div>

      {/* Enforcement Exposure */}
      <div className="bg-white dark:bg-card rounded-xl border border-border p-5 mb-6">
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Verified Enforcement Exposure</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
          <Field label="IJ Status" value={caseData.ij_status} />
          <Field label="CMP Status" value={caseData.cmp_status} />
          <Field label="DPNA Status" value={caseData.dpna_status} />
          <Field label="SFF Status" value={caseData.sff_status} />
          <Field label="Survey Date" value={caseData.survey_date} />
          <Field label="CMS-2567 Date" value={caseData.cms_2567_date} />
          <Field label="Revisit Date" value={caseData.revisit_date} />
          <Field label="State Agency" value={caseData.state_agency} />
          <Field label="Total Deficiencies" value={caseData.total_deficiencies} />
          <Field label="High-Priority" value={caseData.high_priority_deficiencies} />
          <Field label="Scope/Severity" value={caseData.scope_severity_overview} />
          <Field label="Clinical Approval" value={caseData.clinical_approval_status} />
        </div>
        {caseData.notes && <p className="mt-3 text-sm text-muted-foreground border-t border-border pt-3">{caseData.notes}</p>}
      </div>

      {/* Deficiencies */}
      <div className="bg-white dark:bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Deficiencies ({caseDeficiencies.length})</h2>
        </div>
        <div className="divide-y divide-border">
          {caseDeficiencies.map((d) => (
            <div key={d.id} className="px-5 py-3 hover:bg-secondary/30">
              <Link to={`/command-center/deficiencies/${d.id}`} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{d.f_tag} — {d.deficiency_title || "Untitled Deficiency"}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.scope_severity || "—"} · {d.deficiency_status}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.immediate_jeopardy === "Yes" && <Badge tone="red">IJ</Badge>}
                  <Badge tone={d.deficiency_status === "Closed" ? "green" : d.deficiency_status === "Approved" || d.deficiency_status === "Implementation" ? "blue" : "default"}>{d.deficiency_status}</Badge>
                  {d.revisit_readiness_status !== "Not Assessed" && <Badge tone={d.revisit_readiness_status === "Ready" ? "green" : d.revisit_readiness_status === "Nearly Ready" ? "blue" : "amber"}>{d.revisit_readiness_status}</Badge>}
                </div>
              </Link>
            </div>
          ))}
          {caseDeficiencies.length === 0 && <EmptyState text="No deficiencies extracted yet" icon={AlertTriangle} />}
        </div>
      </div>

      {caseData.score_explanation && (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-5 mt-6">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Score Explanation</h2>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-secondary/30 rounded-lg p-4">{caseData.score_explanation}</pre>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  const tones = { default: "text-foreground", red: "text-rose-600 dark:text-rose-400", amber: "text-amber-600 dark:text-amber-400", green: "text-emerald-600 dark:text-emerald-400" };
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-lg font-bold ${tones[tone] || "text-foreground"}`}>{value || "—"}</p>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}