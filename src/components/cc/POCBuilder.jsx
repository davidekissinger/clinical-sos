import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/cc/ui";
import { Save, FileText, AlertTriangle, Plus, CheckCircle, Send, ClipboardCheck, UserCheck, ArrowRightCircle, RotateCcw } from "lucide-react";

const POC_STATUS_FLOW = {
  "AI Draft": ["submit_for_clinical_review"],
  "Clinical Review": ["approve_for_use", "send_to_client_review", "return_for_revision"],
  "Client Review": ["return_to_clinical_review", "approve_from_client_review", "return_for_revision"],
  "Approved for Use": ["submit_poc"],
  "Submitted": ["record_acceptance"],
  "Accepted": [],
  "Revision Requested": [],
  "Superseded": [],
};

const ACTION_LABELS = {
  submit_for_clinical_review: { label: "Submit for Clinical Review", icon: ArrowRightCircle },
  approve_for_use: { label: "Approve for Use", icon: CheckCircle },
  send_to_client_review: { label: "Send to Client Review", icon: Send },
  return_to_clinical_review: { label: "Return to Clinical Review", icon: RotateCcw },
  approve_from_client_review: { label: "Approve for Use", icon: CheckCircle },
  return_for_revision: { label: "Return for Revision", icon: RotateCcw },
  submit_poc: { label: "Submit POC", icon: Send },
  record_acceptance: { label: "Record Acceptance", icon: UserCheck },
};

const EVIDENCE_REQUIRED = ["submit_poc", "record_acceptance"];

export default function POCBuilder({ deficiency, onSaved }) {
  const [pocs, setPocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePoc, setActivePoc] = useState(null);
  const [showEvidenceForm, setShowEvidenceForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [transitionError, setTransitionError] = useState("");

  useEffect(() => {
    loadPOCs();
    loadUser();
  }, [deficiency.id]);

  const loadUser = async () => {
    try {
      const u = await base44.auth.me();
      setCurrentUser(u);
    } catch (e) { /* best-effort */ }
  };

  const loadPOCs = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.POC.filter({ deficiency_id: deficiency.id });
      const sorted = (all || []).sort((a, b) => (b.version || 0) - (a.version || 0));
      setPocs(sorted);
      setActivePoc(sorted[0] || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const createNewVersion = async () => {
    setSaving(true);
    try {
      const nextVersion = (pocs[0]?.version || 0) + 1;
      const userName = currentUser?.full_name || currentUser?.email || null;
      const poc = await base44.entities.POC.create({
        deficiency_id: deficiency.id,
        regulatory_case_id: deficiency.regulatory_case_id || null,
        facility_id: deficiency.facility_id || null,
        facility_name: deficiency.facility_name || null,
        f_tag: deficiency.f_tag || null,
        version: nextVersion,
        element_1_specific_correction: deficiency.immediate_correction || "",
        element_2_others_potentially_affected: deficiency.potentially_affected_population || "",
        element_3_systemic_correction: deficiency.systemic_correction || "",
        element_4_monitoring: deficiency.audit_monitoring || "",
        element_5_responsibility_qapi_completion: [deficiency.responsible_leader, deficiency.target_completion_date, deficiency.qapi_oversight].filter(Boolean).join(" | "),
        education_plan: deficiency.education_training || "",
        competency_plan: deficiency.competency_validation || "",
        evidence_requirements: deficiency.evidence_needed || "",
        status: "AI Draft",
        prepared_by: userName,
        is_test_data: !!deficiency.is_test_data,
      });
      // Supersede prior versions
      for (const p of pocs) {
        if (p.status !== "Superseded") {
          try { await base44.entities.POC.update(p.id, { status: "Superseded", superseded_by_version: nextVersion }); } catch (e) { /* best-effort */ }
        }
      }
      await loadPOCs();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const updatePoc = async (field, value) => {
    if (!activePoc) return;
    setActivePoc({ ...activePoc, [field]: value });
  };

  const savePoc = async () => {
    if (!activePoc) return;
    setSaving(true);
    try {
      await base44.entities.POC.update(activePoc.id, {
        element_1_specific_correction: activePoc.element_1_specific_correction,
        element_2_others_potentially_affected: activePoc.element_2_others_potentially_affected,
        element_3_systemic_correction: activePoc.element_3_systemic_correction,
        element_4_monitoring: activePoc.element_4_monitoring,
        element_5_responsibility_qapi_completion: activePoc.element_5_responsibility_qapi_completion,
        education_plan: activePoc.education_plan,
        competency_plan: activePoc.competency_plan,
        evidence_requirements: activePoc.evidence_requirements,
      });
      if (onSaved) onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const generateNarrative = async () => {
    if (!activePoc) return;
    setGenerating(true);
    setTransitionError("");
    try {
      const result = await base44.functions.invoke("generateWorkProduct", {
        document_type: "Plan of Correction Draft",
        deficiency_id: deficiency.id,
        poc_id: activePoc.id,
        action: "generate_poc_narrative",
      });
      const data = result.data || result;
      if (data?.ok === false) {
        setTransitionError(data.error || "Work product generation failed.");
      } else if (data?.content) {
        await base44.entities.POC.update(activePoc.id, { generated_narrative: data.content });
        await loadPOCs();
      }
    } catch (e) {
      setTransitionError(e?.message || "Generation failed.");
      console.error(e);
    }
    finally { setGenerating(false); }
  };

  const transitionPoc = async (action, evidence) => {
    if (!activePoc) return;
    setTransitionError("");
    try {
      const result = await base44.functions.invoke("transitionPOC", {
        poc_id: activePoc.id,
        action,
        evidence,
      });
      const data = result.data || result;
      if (data?.error) {
        setTransitionError(data.error);
      } else {
        await loadPOCs();
        setShowEvidenceForm(null);
      }
    } catch (e) {
      setTransitionError(e?.message || "Transition failed.");
      console.error(e);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading POCs…</div>;

  const availableActions = activePoc ? (POC_STATUS_FLOW[activePoc.status] || []) : [];

  if (pocs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">AI-generated POC narratives are DRAFT ONLY. Clinical Review is required before any content becomes authoritative. POC status cannot be automatically marked as Submitted or Accepted — those require human action with evidence.</p>
        </div>
        <button onClick={createNewVersion} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
          <Plus className="h-4 w-4" /> Create POC (Version 1)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300">AI-generated POC narratives are DRAFT ONLY. Clinical Review is required before any content becomes authoritative. POC status cannot be automatically marked as Submitted or Accepted — those require human action with evidence.</p>
      </div>

      {/* Version selector + status */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={activePoc?.id || ""} onChange={e => setActivePoc(pocs.find(p => p.id === e.target.value))} aria-label="Select POC version" className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-card text-foreground">
          {pocs.map(p => <option key={p.id} value={p.id}>Version {p.version} — {p.status}</option>)}
        </select>
        <Badge tone={activePoc?.status === "Accepted" ? "green" : activePoc?.status === "Submitted" ? "blue" : activePoc?.status === "Approved for Use" ? "green" : activePoc?.status === "Superseded" ? "default" : "amber"}>{activePoc?.status}</Badge>
        <button onClick={createNewVersion} disabled={saving} className="btn-ghost text-sm"><Plus className="h-4 w-4" /> New Version</button>
      </div>

      {/* Provenance / audit trail */}
      {activePoc && (
        <div className="bg-secondary/30 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {activePoc.prepared_by && <div><span className="text-muted-foreground">Prepared by:</span> <span className="font-medium text-foreground">{activePoc.prepared_by}</span></div>}
          {activePoc.reviewed_by && <div><span className="text-muted-foreground">Reviewed by:</span> <span className="font-medium text-foreground">{activePoc.reviewed_by}</span></div>}
          {activePoc.clinical_approved_by && <div><span className="text-muted-foreground">Clinical approval:</span> <span className="font-medium text-foreground">{activePoc.clinical_approved_by}</span></div>}
          {activePoc.submitted_by && <div><span className="text-muted-foreground">Submitted by:</span> <span className="font-medium text-foreground">{activePoc.submitted_by}</span></div>}
          {activePoc.submitted_date && <div><span className="text-muted-foreground">Submitted:</span> <span className="font-medium text-foreground">{new Date(activePoc.submitted_date).toLocaleDateString()}</span></div>}
          {activePoc.accepted_by && <div><span className="text-muted-foreground">Accepted by:</span> <span className="font-medium text-foreground">{activePoc.accepted_by}</span></div>}
          {activePoc.accepted_date && <div><span className="text-muted-foreground">Accepted:</span> <span className="font-medium text-foreground">{new Date(activePoc.accepted_date).toLocaleDateString()}</span></div>}
        </div>
      )}

      {activePoc && (
        <>
          <Section title="Element 1 — Affected Resident / Specific Correction" desc="What was corrected, what immediate action occurred, current status">
            <TextArea label="Element 1 — Affected Resident / Specific Correction" value={activePoc.element_1_specific_correction || ""} onChange={v => updatePoc("element_1_specific_correction", v)} />
          </Section>
          <Section title="Element 2 — Others Potentially Affected" desc="How the facility identified others, universe reviewed, additional corrections">
            <TextArea label="Element 2 — Others Potentially Affected" value={activePoc.element_2_others_potentially_affected || ""} onChange={v => updatePoc("element_2_others_potentially_affected", v)} />
          </Section>
          <Section title="Element 3 — Systemic Corrective Action" desc="Policy changes, workflow changes, staffing, equipment, clinical process, accountability, system changes to prevent recurrence">
            <TextArea label="Element 3 — Systemic Corrective Action" value={activePoc.element_3_systemic_correction || ""} onChange={v => updatePoc("element_3_systemic_correction", v)} />
          </Section>
          <Section title="Element 4 — Monitoring" desc="Audit method, sample size, frequency, duration, responsible auditor, failure threshold, corrective follow-up, escalation criteria">
            <TextArea label="Element 4 — Monitoring" value={activePoc.element_4_monitoring || ""} onChange={v => updatePoc("element_4_monitoring", v)} />
          </Section>
          <Section title="Element 5 — Responsibility / QAPI / Completion" desc="Responsible leader, DON/Administrator/designee, QAPI reporting, target completion, sustainability review">
            <TextArea label="Element 5 — Responsibility / QAPI / Completion" value={activePoc.element_5_responsibility_qapi_completion || ""} onChange={v => updatePoc("element_5_responsibility_qapi_completion", v)} />
          </Section>
          <Section title="Education / Training" desc="Education and training plan for this deficiency">
            <TextArea label="Education / Training" value={activePoc.education_plan || ""} onChange={v => updatePoc("education_plan", v)} />
          </Section>
          <Section title="Competency Validation" desc="Competency validation approach">
            <TextArea label="Competency Validation" value={activePoc.competency_plan || ""} onChange={v => updatePoc("competency_plan", v)} />
          </Section>
          <Section title="Evidence Needed" desc="Evidence required to demonstrate corrective action">
            <TextArea label="Evidence Needed" value={activePoc.evidence_requirements || ""} onChange={v => updatePoc("evidence_requirements", v)} />
          </Section>

          {activePoc.generated_narrative && (
            <Section title="Generated Narrative (AI Draft)" desc="AI-generated POC narrative — DRAFT ONLY, requires clinical review. Validated against source data.">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">{activePoc.generated_narrative}</pre>
            </Section>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={savePoc} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save POC"}</button>
            <button onClick={generateNarrative} disabled={generating} className="btn-secondary text-sm disabled:opacity-60"><FileText className="h-4 w-4" /> {generating ? "Generating…" : "Generate POC Narrative (Draft)"}</button>
          </div>

          {/* Lifecycle transition buttons */}
          {availableActions.length > 0 && (
            <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold text-foreground text-sm mb-1">POC Lifecycle Actions</h3>
              <p className="text-xs text-muted-foreground mb-3">All actions are performed by the authenticated user. AI cannot perform these transitions.</p>
              <div className="flex flex-wrap gap-2">
                {availableActions.map(actionKey => {
                  const cfg = ACTION_LABELS[actionKey];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <button key={actionKey} onClick={() => {
                      if (EVIDENCE_REQUIRED.includes(actionKey)) setShowEvidenceForm(actionKey);
                      else if (actionKey === "return_for_revision") setShowEvidenceForm("return_for_revision");
                      else transitionPoc(actionKey);
                    }} className="btn-secondary text-sm">
                      <Icon className="h-4 w-4" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {transitionError && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-400">{transitionError}</div>
          )}

          {showEvidenceForm && (
            <EvidenceForm
              actionKey={showEvidenceForm}
              actionLabel={ACTION_LABELS[showEvidenceForm]?.label || showEvidenceForm}
              onSubmit={(evidence) => transitionPoc(showEvidenceForm, evidence)}
              onCancel={() => setShowEvidenceForm(null)}
              isRevision={showEvidenceForm === "return_for_revision"}
            />
          )}
        </>
      )}
    </div>
  );
}

function EvidenceForm({ actionKey, actionLabel, onSubmit, onCancel, isRevision }) {
  const [evidence, setEvidence] = useState("");
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-5 space-y-3">
      <h3 className="font-semibold text-foreground text-sm">{actionLabel} — Human Confirmation Required</h3>
      <p className="text-xs text-muted-foreground">
        {isRevision
          ? "Provide revision notes for the POC author."
          : "This action requires evidence or a source/confirmation note. The authenticated user will be recorded."}
      </p>
      <textarea value={evidence} onChange={e => setEvidence(e.target.value)}
        aria-label={isRevision ? "Revision notes" : "Source or confirmation note"}
        placeholder={isRevision ? "Revision notes…" : "Source / confirmation note (e.g. 'Verified via client email on …')"}
        rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-card text-foreground" />
      <div className="flex gap-2">
        <button onClick={() => onSubmit(evidence)} disabled={!evidence} className="btn-primary text-sm disabled:opacity-60">{actionLabel}</button>
        <button onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
      </div>
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      {desc && <p className="text-xs text-muted-foreground mt-0.5 mb-3">{desc}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextArea({ value, onChange, placeholder, label }) {
  return (
    <textarea value={value || ""} onChange={e => onChange(e.target.value)}
      aria-label={label || placeholder || "Enter details"}
      placeholder={placeholder || "Enter details…"} rows={4}
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-accent outline-none resize-y" />
  );
}