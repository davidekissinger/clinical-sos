import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/cc/ui";
import { Save, FileText, AlertTriangle } from "lucide-react";

const POC_STATUS = ["AI Draft", "Clinical Review", "Client Review", "Approved for Use", "Submitted", "Accepted", "Revision Requested"];

export default function POCBuilder({ deficiency, onSaved }) {
  const [poc, setPoc] = useState({
    immediate_correction: deficiency.immediate_correction || "",
    potentially_affected_population: deficiency.potentially_affected_population || "",
    systemic_correction: deficiency.systemic_correction || "",
    education_training: deficiency.education_training || "",
    competency_validation: deficiency.competency_validation || "",
    audit_monitoring: deficiency.audit_monitoring || "",
    evidence_needed: deficiency.evidence_needed || "",
    responsible_leader: deficiency.responsible_leader || "",
    target_completion_date: deficiency.target_completion_date || "",
    qapi_oversight: deficiency.qapi_oversight || "",
  });
  const [pocStatus, setPocStatus] = useState("AI Draft");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const set = (k, v) => setPoc(p => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.Deficiency.update(deficiency.id, poc);
      if (onSaved) onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const generateNarrative = async () => {
    setGenerating(true);
    try {
      const prompt = `You are a long-term care regulatory consultant. Generate a Plan of Correction (POC) narrative for the following deficiency. Use ONLY the approved structured information provided. Do NOT invent any findings, residents, dates, or enforcement actions. If information is missing, state "To be completed."

F-Tag: ${deficiency.f_tag}
Deficiency: ${deficiency.deficiency_title || ""}
Survey Finding: ${deficiency.survey_finding || ""}
Factual Summary: ${deficiency.factual_summary || ""}

ELEMENT 1 - AFFECTED RESIDENT / SPECIFIC CORRECTION:
${poc.immediate_correction || "Not yet documented."}

ELEMENT 2 - OTHERS POTENTIALLY AFFECTED:
${poc.potentially_affected_population || "Not yet documented."}

ELEMENT 3 - SYSTEMIC CORRECTIVE ACTION:
${poc.systemic_correction || "Not yet documented."}

ELEMENT 4 - MONITORING:
${poc.audit_monitoring || "Not yet documented."}

ELEMENT 5 - RESPONSIBILITY / QAPI / COMPLETION:
Responsible Leader: ${poc.responsible_leader || "Not assigned."}
Target Completion: ${poc.target_completion_date || "Not set."}
QAPI Oversight: ${poc.qapi_oversight || "Not documented."}

Generate a formal POC narrative with clear section headers matching the five elements above. Mark any undocumented sections as "To be completed."`;

      const result = await base44.functions.invoke("generateWorkProduct", {
        document_type: "Plan of Correction Draft",
        deficiency_id: deficiency.id,
        facility_name: deficiency.facility_name,
        f_tag: deficiency.f_tag,
        prompt,
      });

      if (onSaved) onSaved();
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">AI-generated POC narratives are DRAFT ONLY. Clinical Review is required before any content becomes authoritative. POC status cannot be automatically marked as Submitted or Accepted — those require human entry.</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">POC Status:</span>
        <select value={pocStatus} onChange={e => setPocStatus(e.target.value)} className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white">
          {POC_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Badge tone={pocStatus === "Approved for Use" ? "green" : pocStatus === "Submitted" || pocStatus === "Accepted" ? "blue" : "amber"}>{pocStatus}</Badge>
      </div>

      <Section title="Element 1 — Affected Resident / Specific Correction" desc="What was corrected, what immediate action occurred, current status">
        <TextArea value={poc.immediate_correction} onChange={v => set("immediate_correction", v)} />
      </Section>

      <Section title="Element 2 — Others Potentially Affected" desc="How the facility identified others, universe reviewed, additional corrections">
        <TextArea value={poc.potentially_affected_population} onChange={v => set("potentially_affected_population", v)} />
      </Section>

      <Section title="Element 3 — Systemic Corrective Action" desc="Policy changes, workflow changes, staffing, equipment, clinical process, accountability, system changes to prevent recurrence">
        <TextArea value={poc.systemic_correction} onChange={v => set("systemic_correction", v)} />
      </Section>

      <Section title="Element 4 — Monitoring" desc="Audit method, sample size, frequency, duration, responsible auditor, failure threshold, corrective follow-up, escalation criteria">
        <TextArea value={poc.audit_monitoring} onChange={v => set("audit_monitoring", v)} />
      </Section>

      <Section title="Element 5 — Responsibility / QAPI / Completion" desc="Responsible leader, DON/Administrator/designee, QAPI reporting, target completion, sustainability review">
        <div className="grid sm:grid-cols-2 gap-3">
          <input placeholder="Responsible leader" value={poc.responsible_leader} onChange={e => set("responsible_leader", e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={poc.target_completion_date || ""} onChange={e => set("target_completion_date", e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm" />
        </div>
        <TextArea value={poc.qapi_oversight} onChange={v => set("qapi_oversight", v)} placeholder="QAPI reporting and oversight plan…" />
      </Section>

      <Section title="Education / Training" desc="Education and training plan for this deficiency">
        <TextArea value={poc.education_training} onChange={v => set("education_training", v)} />
      </Section>

      <Section title="Competency Validation" desc="Competency validation approach">
        <TextArea value={poc.competency_validation} onChange={v => set("competency_validation", v)} />
      </Section>

      <Section title="Evidence Needed" desc="Evidence required to demonstrate corrective action">
        <TextArea value={poc.evidence_needed} onChange={v => set("evidence_needed", v)} />
      </Section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save POC"}
        </button>
        <button onClick={generateNarrative} disabled={generating} className="btn-secondary text-sm disabled:opacity-60">
          <FileText className="h-4 w-4" /> {generating ? "Generating…" : "Generate POC Narrative (Draft)"}
        </button>
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
    <textarea
      value={value || ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || "Enter details…"}
      rows={4}
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:ring-2 focus:ring-accent outline-none resize-y"
    />
  );
}