import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { ArrowLeft, Save, AlertTriangle, FileText, ClipboardCheck, GraduationCap, FolderCheck, Stethoscope, ShieldCheck } from "lucide-react";
import POCBuilder from "@/components/cc/POCBuilder";

const TABS = [
  { key: "identification", label: "Identification", icon: FileText },
  { key: "poc", label: "POC Builder", icon: ClipboardCheck },
  { key: "rca", label: "Root Cause", icon: AlertTriangle },
  { key: "audits", label: "Audit Tools", icon: ClipboardCheck },
  { key: "education", label: "Education", icon: GraduationCap },
  { key: "evidence", label: "Evidence Binder", icon: FolderCheck },
  { key: "qapi", label: "QAPI", icon: Stethoscope },
  { key: "revisit", label: "Revisit Readiness", icon: ShieldCheck },
];

const ROOT_CAUSE_CATEGORIES = [
  "People / Staffing", "Training", "Competency", "Policy", "Procedure", "Workflow",
  "Equipment", "Supplies", "Environment", "Documentation", "Communication",
  "Leadership Oversight", "Staffing Levels", "Scheduling", "Accountability",
  "Monitoring Failure", "Technology", "Resident-Specific Factors", "Vendor/Pharmacy", "Other"
];

export default function DeficiencyDetail() {
  const { id } = useParams();
  const deficiencies = useEntities("Deficiency", { limit: 200 });
  const audits = useEntities("AuditTool", { sort: "-audit_date", limit: 200 });
  const education = useEntities("EducationPlan", { limit: 100 });
  const evidence = useEntities("EvidenceItem", { sort: "-created_date", limit: 200 });
  const qapi = useEntities("QAPIReview", { limit: 100 });
  const [tab, setTab] = useState("identification");
  const [rcaText, setRcaText] = useState("");
  const [saving, setSaving] = useState(false);

  const def = deficiencies.data.find(d => d.id === id);
  const defAudits = audits.data.filter(a => a.deficiency_id === id);
  const defEducation = education.data.filter(e => e.deficiency_id === id);
  const defEvidence = evidence.data.filter(e => e.deficiency_id === id);
  const defQapi = qapi.data.filter(q => q.deficiency_id === id);

  if (deficiencies.loading) return <LoadingState />;
  if (!def) return <div><Link to="/command-center/cases" className="text-sm text-muted-foreground hover:text-primary">← Back</Link><EmptyState text="Deficiency not found" /></div>;

  return (
    <div>
      <Link to={def.regulatory_case_id ? `/command-center/cases/${def.regulatory_case_id}` : "/command-center/cases"} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Case
      </Link>

      <PageHeader
        title={`${def.f_tag} — ${def.deficiency_title || "Untitled Deficiency"}`}
        subtitle={`${def.facility_name || "—"} · ${def.scope_severity || "—"} · ${def.deficiency_status}`}
      />

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {def.immediate_jeopardy === "Yes" && <Badge tone="red">Immediate Jeopardy</Badge>}
        {def.immediate_safety_concern && <Badge tone="red">Immediate Safety Concern</Badge>}
        <Badge tone={def.deficiency_status === "Closed" ? "green" : def.deficiency_status === "Approved" ? "blue" : "default"}>{def.deficiency_status}</Badge>
        <Badge tone={def.revisit_readiness_status === "Ready" ? "green" : def.revisit_readiness_status === "Not Ready" || def.revisit_readiness_status === "Significant Gaps" ? "red" : "amber"}>Revisit: {def.revisit_readiness_status}</Badge>
        {def.is_test_data && <Badge tone="amber">TEST DATA</Badge>}
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 mb-5 border-b border-border overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.key === "audits" && defAudits.length > 0 && <span className="ml-1 text-xs bg-secondary rounded-full px-1.5">{defAudits.length}</span>}
            {t.key === "evidence" && defEvidence.length > 0 && <span className="ml-1 text-xs bg-secondary rounded-full px-1.5">{defEvidence.length}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "identification" && <IdentificationTab def={def} />}
      {tab === "poc" && <POCBuilder deficiency={def} />}
      {tab === "rca" && <RCATab def={def} rcaText={rcaText} setRcaText={setRcaText} />}
      {tab === "audits" && <AuditsTab def={def} audits={defAudits} />}
      {tab === "education" && <EducationTab def={def} education={defEducation} />}
      {tab === "evidence" && <EvidenceTab def={def} evidence={defEvidence} />}
      {tab === "qapi" && <QAPITab def={def} qapi={defQapi} />}
      {tab === "revisit" && <RevisitTab def={def} />}
    </div>
  );
}

function IdentificationTab({ def }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...def });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await base44.entities.Deficiency.update(def.id, form); setEditing(false); }
    catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const fields = [
    { key: "f_tag", label: "F-Tag" },
    { key: "regulation_reference", label: "Regulation Reference" },
    { key: "deficiency_title", label: "Deficiency Title" },
    { key: "scope_severity", label: "Scope & Severity" },
    { key: "immediate_jeopardy", label: "Immediate Jeopardy", type: "select", options: ["Yes", "No", "Unknown"] },
    { key: "source_cms_2567", label: "Source CMS-2567" },
    { key: "page_reference", label: "Page Reference" },
    { key: "survey_finding", label: "Survey Finding", type: "textarea" },
    { key: "factual_summary", label: "Factual Summary", type: "textarea" },
    { key: "affected_residents_deidentified", label: "Affected Residents (De-identified)", type: "textarea" },
    { key: "deficiency_date", label: "Deficiency Date", type: "date" },
    { key: "regulatory_focus", label: "Regulatory Focus", type: "textarea" },
    { key: "clinical_significance", label: "Clinical Significance", type: "textarea" },
    { key: "immediate_safety_concern", label: "Immediate Safety Concern", type: "boolean" },
    { key: "deficiency_status", label: "Status", type: "select", options: ["Draft", "Clinical Review", "Client Review", "Approved", "Implementation", "Evidence Pending", "Monitoring", "Revisit Ready", "Closed"] },
  ];

  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">Deficiency Identification</h2>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> Save</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="btn-secondary text-sm">Edit</button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {fields.map(f => (
          <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
            {editing ? (
              f.type === "textarea" ? (
                <textarea value={form[f.key] || ""} onChange={e => setForm({...form, [f.key]: e.target.value})} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              ) : f.type === "select" ? (
                <select value={form[f.key] || ""} onChange={e => setForm({...form, [f.key]: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white">
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "boolean" ? (
                <select value={form[f.key] ? "true" : "false"} onChange={e => setForm({...form, [f.key]: e.target.value === "true"})} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="false">No</option><option value="true">Yes</option>
                </select>
              ) : (
                <input type={f.type === "date" ? "date" : "text"} value={form[f.key] || ""} onChange={e => setForm({...form, [f.key]: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
              )
            ) : (
              <p className="text-sm text-foreground">{f.type === "boolean" ? (form[f.key] ? "Yes" : "No") : (form[f.key] || "—")}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RCATab({ def, rcaText, setRcaText }) {
  const [categories, setCategories] = useState(def.root_cause_categories || []);
  const [fiveWhys, setFiveWhys] = useState(["", "", "", "", ""]);
  const [contributingFactors, setContributingFactors] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleCat = (cat) => {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Deficiency.update(def.id, {
        root_cause_categories: categories,
        likely_contributing_factors: contributingFactors + "\n\n5 Whys:\n" + fiveWhys.map((w, i) => `Why ${i+1}: ${w}`).join("\n"),
      });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">AI may assist with questions and draft analysis, but the consultant must approve the final root cause. Never invent contributing factors not supported by evidence.</p>
      </div>

      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground text-sm mb-3">Root Cause Categories</h3>
        <div className="flex flex-wrap gap-2">
          {ROOT_CAUSE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                categories.includes(cat) ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground text-sm mb-3">5 Whys Analysis</h3>
        <div className="space-y-3">
          {fiveWhys.map((w, i) => (
            <div key={i}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Why {i + 1}</label>
              <input value={w} onChange={e => { const n = [...fiveWhys]; n[i] = e.target.value; setFiveWhys(n); }} placeholder="Because…" className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground text-sm mb-3">Contributing Factor Summary</h3>
        <textarea value={contributingFactors} onChange={e => setContributingFactors(e.target.value)} rows={4} placeholder="Summarize the contributing factors identified…" className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
      </div>

      <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Root Cause Analysis"}</button>
    </div>
  );
}

function AuditsTab({ def, audits }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">Audit Tools</h2>
        <button className="btn-primary text-sm"><ClipboardCheck className="h-4 w-4" /> New Audit</button>
      </div>
      <div className="space-y-3">
        {audits.map(a => (
          <div key={a.id} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{a.plain_language_regulatory_focus || a.f_tag}</p>
                <p className="text-xs text-muted-foreground">Auditor: {a.auditor || "—"} · {a.audit_date || "—"} · {a.unit_hall || "—"}</p>
              </div>
              <Badge tone={a.audit_result === "Pass" ? "green" : a.audit_result === "Failed" ? "red" : "amber"}>{a.audit_result}</Badge>
            </div>
            {a.what_was_corrected && <p className="mt-2 text-xs text-muted-foreground">Corrected: {a.what_was_corrected}</p>}
            {a.what_remains_unresolved && <p className="mt-1 text-xs text-rose-600">Unresolved: {a.what_remains_unresolved}</p>}
          </div>
        ))}
        {audits.length === 0 && <EmptyState text="No audit tools created yet" icon={ClipboardCheck} />}
      </div>
    </div>
  );
}

function EducationTab({ def, education }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">Education & Competency</h2>
        <button className="btn-primary text-sm"><GraduationCap className="h-4 w-4" /> New Education Plan</button>
      </div>
      <div className="space-y-3">
        {education.map(e => (
          <div key={e.id} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{e.education_outline || "Education Plan"}</p>
                <p className="text-xs text-muted-foreground">{e.department_assignments || "—"} · {e.education_status}</p>
              </div>
              <Badge tone={e.education_status === "Completed" || e.education_status === "Competency Completed" ? "green" : e.education_status === "Remediation Required" ? "red" : "amber"}>{e.education_status}</Badge>
            </div>
          </div>
        ))}
        {education.length === 0 && <EmptyState text="No education plans created yet" icon={GraduationCap} />}
      </div>
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">Education cannot be marked complete simply because materials were generated. Competency validation and attendance tracking are required.</p>
      </div>
    </div>
  );
}

function EvidenceTab({ def, evidence }) {
  const accepted = evidence.filter(e => e.review_status === "Accepted");
  const pending = evidence.filter(e => e.review_status === "Required" || e.review_status === "Requested" || e.review_status === "Received" || e.review_status === "Under Review");
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-foreground">Evidence Binder</h2>
          <p className="text-xs text-muted-foreground">{accepted.length} accepted · {pending.length} pending</p>
        </div>
        <button className="btn-primary text-sm"><FolderCheck className="h-4 w-4" /> Add Evidence</button>
      </div>
      <div className="space-y-3">
        {evidence.map(e => (
          <div key={e.id} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{e.evidence_type}</p>
                <p className="text-xs text-muted-foreground truncate">{e.description || "—"} · {e.date || "—"}</p>
                <p className="text-xs text-muted-foreground">Responsible: {e.responsible_person || "—"} · Reviewer: {e.reviewer || "—"}</p>
              </div>
              <Badge tone={e.review_status === "Accepted" ? "green" : e.review_status === "Insufficient" ? "red" : "amber"}>{e.review_status}</Badge>
            </div>
          </div>
        ))}
        {evidence.length === 0 && <EmptyState text="No evidence items recorded" icon={FolderCheck} />}
      </div>
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">A corrective action cannot be marked complete unless required evidence has been accepted or an authorized consultant overrides with documented rationale.</p>
      </div>
    </div>
  );
}

function QAPITab({ def, qapi }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">QAPI Reviews</h2>
        <button className="btn-primary text-sm"><Stethoscope className="h-4 w-4" /> New QAPI Review</button>
      </div>
      <div className="space-y-3">
        {qapi.map(q => (
          <div key={q.id} className="bg-white rounded-xl border border-border p-4">
            <p className="text-sm font-medium text-foreground">QAPI Review — {q.qapi_review_date || "—"}</p>
            <p className="text-xs text-muted-foreground mt-1">Leader: {q.responsible_leader || "—"}</p>
            {q.summary && <p className="mt-2 text-sm text-foreground">{q.summary}</p>}
            <div className="mt-2 flex gap-2">
              {q.monitoring_continuation && <Badge tone="blue">Continued</Badge>}
              {q.monitoring_reduction && <Badge tone="amber">Reduced</Badge>}
              {q.monitoring_closure && <Badge tone="green">Closed</Badge>}
            </div>
          </div>
        ))}
        {qapi.length === 0 && <EmptyState text="No QAPI reviews recorded" icon={Stethoscope} />}
      </div>
    </div>
  );
}

function RevisitTab({ def }) {
  const readinessItems = [
    { label: "Resident-specific correction complete", key: "resident_correction" },
    { label: "Affected universe review complete", key: "universe_review" },
    { label: "Systemic changes implemented", key: "systemic_changes" },
    { label: "Policy changes complete", key: "policy_changes" },
    { label: "Education complete", key: "education_complete" },
    { label: "Competencies complete", key: "competencies" },
    { label: "Required audits complete", key: "audits" },
    { label: "Audit compliance acceptable", key: "audit_compliance" },
    { label: "Failed audits corrected", key: "failed_audits_corrected" },
    { label: "Evidence complete", key: "evidence" },
    { label: "QAPI reviewed", key: "qapi" },
    { label: "Staff interview readiness", key: "staff_interview" },
    { label: "Record review readiness", key: "record_review" },
    { label: "Environmental readiness", key: "environmental" },
  ];
  const [checks, setChecks] = useState({});
  const [saving, setSaving] = useState(false);

  const completed = Object.values(checks).filter(Boolean).length;
  const total = readinessItems.length;
  const score = Math.round((completed / total) * 100);
  const status = score >= 90 ? "Ready" : score >= 70 ? "Nearly Ready" : score >= 40 ? "Significant Gaps" : "Not Ready";

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Deficiency.update(def.id, {
        revisit_readiness_status: status,
        priority_explanation: `Revisit Readiness Score: ${score}/100 (${status}). ${completed}/${total} items complete.`,
      });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl border-2 p-5 ${status === "Ready" ? "border-emerald-300 bg-emerald-50" : status === "Nearly Ready" ? "border-blue-300 bg-blue-50" : "border-rose-300 bg-rose-50"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinical SOS Internal Readiness Assessment</p>
            <p className={`text-3xl font-bold ${status === "Ready" ? "text-emerald-700" : status === "Nearly Ready" ? "text-blue-700" : "text-rose-700"}`}>{status}</p>
            <p className="text-sm text-muted-foreground mt-1">{score}/100 — {completed} of {total} items complete</p>
          </div>
          <div className="text-right">
            <div className="w-24 h-24 rounded-full border-8 border-current flex items-center justify-center text-2xl font-bold" style={{ color: status === "Ready" ? "#059669" : status === "Nearly Ready" ? "#2563eb" : "#e11d48" }}>
              {score}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">This is a Clinical SOS internal readiness assessment. Clinical SOS does not guarantee that a facility will pass a regulatory revisit.</p>
      </div>

      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground text-sm mb-3">Readiness Checklist</h3>
        <div className="space-y-2">
          {readinessItems.map(item => (
            <label key={item.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 cursor-pointer">
              <input type="checkbox" checked={checks[item.key] || false} onChange={e => setChecks({...checks, [item.key]: e.target.checked})} className="h-4 w-4 rounded border-border" />
              <span className="text-sm text-foreground">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Readiness Assessment"}</button>
    </div>
  );
}