import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/cc/ui";
import { Save, FileText, AlertTriangle, Plus, CheckCircle } from "lucide-react";

const POC_STATUS = ["AI Draft", "Clinical Review", "Client Review", "Approved for Use", "Submitted", "Accepted", "Revision Requested", "Superseded"];

export default function POCBuilder({ deficiency, onSaved }) {
  const [pocs, setPocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePoc, setActivePoc] = useState(null);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showAcceptForm, setShowAcceptForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadPOCs();
  }, [deficiency.id]);

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
        prepared_by: null,
        is_test_data: !!deficiency.is_test_data,
      });
      await loadPOCs();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const updatePoc = async (field, value) => {
    if (!activePoc) return;
    const updated = { ...activePoc, [field]: value };
    setActivePoc(updated);
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
    try {
      const prompt = `You are a long-term care regulatory consultant. Generate a Plan of Correction (POC) narrative for the following deficiency. Use ONLY the approved structured information provided. Do NOT invent any findings, residents, dates, or enforcement actions. If information is missing, state "To be completed."

F-Tag: ${deficiency.f_tag}
Deficiency: ${deficiency.deficiency_title || ""}
Survey Finding: ${deficiency.survey_finding || ""}
Factual Summary: ${deficiency.factual_summary || ""}

ELEMENT 1 - AFFECTED RESIDENT / SPECIFIC CORRECTION:
${activePoc.element_1_specific_correction || "Not yet documented."}

ELEMENT 2 - OTHERS POTENTIALLY AFFECTED:
${activePoc.element_2_others_potentially_affected || "Not yet documented."}

ELEMENT 3 - SYSTEMIC CORRECTIVE ACTION:
${activePoc.element_3_systemic_correction || "Not yet documented."}

ELEMENT 4 - MONITORING:
${activePoc.element_4_monitoring || "Not yet documented."}

ELEMENT 5 - RESPONSIBILITY / QAPI / COMPLETION:
${activePoc.element_5_responsibility_qapi_completion || "Not yet documented."}

Generate a formal POC narrative with clear section headers. Mark any undocumented sections as "To be completed."`;

      const result = await base44.functions.invoke("generateWorkProduct", {
        document_type: "Plan of Correction Draft",
        deficiency_id: deficiency.id,
        facility_name: deficiency.facility_name,
        f_tag: deficiency.f_tag,
        prompt,
      });
      const data = result.data || result;
      if (data?.content) {
        await base44.entities.POC.update(activePoc.id, { generated_narrative: data.content });
        await loadPOCs();
      }
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  const submitPoc = async (source, user) => {
    if (!activePoc) return;
    try {
      await base44.entities.POC.update(activePoc.id, {
        status: "Submitted",
        submitted_date: new Date().toISOString(),
        submission_source: source,
        submitted_by: user,
      });
      await loadPOCs();
      setShowSubmitForm(false);
    } catch (e) { console.error(e); }
  };

  const acceptPoc = async (source, user) => {
    if (!activePoc) return;
    try {
      await base44.entities.POC.update(activePoc.id, {
        status: "Accepted",
        accepted_date: new Date().toISOString(),
        acceptance_source: source,
        accepted_by: user,
      });
      await loadPOCs();
      setShowAcceptForm(false);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading POCs…</div>;

  if (pocs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">AI-generated POC narratives are DRAFT ONLY. Clinical Review is required before any content becomes authoritative. POC status cannot be automatically marked as Submitted or Accepted — those require human entry.</p>
        </div>
        <button onClick={createNewVersion} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
          <Plus className="h-4 w-4" /> Create POC (Version 1)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">AI-generated POC narratives are DRAFT ONLY. Clinical Review is required before any content becomes authoritative. POC status cannot be automatically marked as Submitted or Accepted — those require human entry.</p>
      </div>

      {/* Version selector + status */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={activePoc?.id || ""} onChange={e => setActivePoc(pocs.find(p => p.id === e.target.value))} className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white">
          {pocs.map(p => <option key={p.id} value={p.id}>Version {p.version} — {p.status}</option>)}
        </select>
        <Badge tone={activePoc?.status === "Accepted" ? "green" : activePoc?.status === "Submitted" ? "blue" : activePoc?.status === "Approved for Use" ? "green" : "amber"}>{activePoc?.status}</Badge>
        <button onClick={createNewVersion} disabled={saving} className="btn-ghost text-sm"><Plus className="h-4 w-4" /> New Version</button>
      </div>

      {activePoc && (
        <>
          <Section title="Element 1 — Affected Resident / Specific Correction" desc="What was corrected, what immediate action occurred, current status">
            <TextArea value={activePoc.element_1_specific_correction || ""} onChange={v => updatePoc("element_1_specific_correction", v)} />
          </Section>
          <Section title="Element 2 — Others Potentially Affected" desc="How the facility identified others, universe reviewed, additional corrections">
            <TextArea value={activePoc.element_2_others_potentially_affected || ""} onChange={v => updatePoc("element_2_others_potentially_affected", v)} />
          </Section>
          <Section title="Element 3 — Systemic Corrective Action" desc="Policy changes, workflow changes, staffing, equipment, clinical process, accountability, system changes to prevent recurrence">
            <TextArea value={activePoc.element_3_systemic_correction || ""} onChange={v => updatePoc("element_3_systemic_correction", v)} />
          </Section>
          <Section title="Element 4 — Monitoring" desc="Audit method, sample size, frequency, duration, responsible auditor, failure threshold, corrective follow-up, escalation criteria">
            <TextArea value={activePoc.element_4_monitoring || ""} onChange={v => updatePoc("element_4_monitoring", v)} />
          </Section>
          <Section title="Element 5 — Responsibility / QAPI / Completion" desc="Responsible leader, DON/Administrator/designee, QAPI reporting, target completion, sustainability review">
            <TextArea value={activePoc.element_5_responsibility_qapi_completion || ""} onChange={v => updatePoc("element_5_responsibility_qapi_completion", v)} />
          </Section>
          <Section title="Education / Training" desc="Education and training plan for this deficiency">
            <TextArea value={activePoc.education_plan || ""} onChange={v => updatePoc("education_plan", v)} />
          </Section>
          <Section title="Competency Validation" desc="Competency validation approach">
            <TextArea value={activePoc.competency_plan || ""} onChange={v => updatePoc("competency_plan", v)} />
          </Section>
          <Section title="Evidence Needed" desc="Evidence required to demonstrate corrective action">
            <TextArea value={activePoc.evidence_requirements || ""} onChange={v => updatePoc("evidence_requirements", v)} />
          </Section>

          {activePoc.generated_narrative && (
            <Section title="Generated Narrative (AI Draft)" desc="AI-generated POC narrative — DRAFT ONLY, requires clinical review">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-secondary/30 p-3 rounded-lg">{activePoc.generated_narrative}</pre>
            </Section>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={savePoc} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save POC"}</button>
            <button onClick={generateNarrative} disabled={generating} className="btn-secondary text-sm disabled:opacity-60"><FileText className="h-4 w-4" /> {generating ? "Generating…" : "Generate POC Narrative (Draft)"}</button>
            {activePoc.status === "Approved for Use" && !showSubmitForm && (
              <button onClick={() => setShowSubmitForm(true)} className="btn-secondary text-sm"><FileText className="h-4 w-4" /> Submit POC</button>
            )}
            {activePoc.status === "Submitted" && !showAcceptForm && (
              <button onClick={() => setShowAcceptForm(true)} className="btn-secondary text-sm"><CheckCircle className="h-4 w-4" /> Accept POC</button>
            )}
          </div>

          {showSubmitForm && <HumanActionForm title="Submit POC — Human Confirmation Required" actionLabel="Confirm Submission" onSubmit={submitPoc} onCancel={() => setShowSubmitForm(false)} />}
          {showAcceptForm && <HumanActionForm title="Accept POC — Human Confirmation Required" actionLabel="Confirm Acceptance" onSubmit={acceptPoc} onCancel={() => setShowAcceptForm(false)} />}
        </>
      )}
    </div>
  );
}

function HumanActionForm({ title, actionLabel, onSubmit, onCancel }) {
  const [source, setSource] = useState("");
  const [user, setUser] = useState("");
  return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-3">
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground">AI cannot perform this action. A human must confirm with their name and a source/confirmation note.</p>
      <input value={user} onChange={e => setUser(e.target.value)} placeholder="Your name" className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
      <textarea value={source} onChange={e => setSource(e.target.value)} placeholder="Source / confirmation note (e.g. 'Verified via client email on …')" rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
      <div className="flex gap-2">
        <button onClick={() => onSubmit(source, user)} disabled={!source || !user} className="btn-primary text-sm disabled:opacity-60">{actionLabel}</button>
        <button onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
      </div>
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      {desc && <p className="text-xs text-muted-foreground mt-0.5 mb-3">{desc}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextArea({ value, onChange, placeholder }) {
  return (
    <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Enter details…"} rows={4} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:ring-2 focus:ring-accent outline-none resize-y" />
  );
}