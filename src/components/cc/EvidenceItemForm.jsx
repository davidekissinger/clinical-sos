import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Save, X } from "lucide-react";

const EVIDENCE_TYPES = [
  "Corrected Resident-Specific Documentation", "Policy Revision", "Care-Plan Revision", "Physician Orders",
  "Equipment Correction", "Inspection Record", "Training Materials", "Attendance Roster",
  "Competency Validation", "Completed Audit", "Follow-Up Correction", "Photograph",
  "Log", "Leadership Rounding", "QAPI Documentation", "Consultant Review", "Other Supporting Evidence"
];

const REVIEW_STATUSES = ["Required", "Requested", "Received", "Under Review", "Accepted", "Insufficient", "Replaced", "Not Applicable"];

export default function EvidenceItemForm({ deficiency, onSaved, onCancel }) {
  const [form, setForm] = useState({
    deficiency_id: deficiency.id,
    deficiency_name: deficiency.deficiency_title || "",
    regulatory_case_id: deficiency.regulatory_case_id || "",
    regulatory_case_name: deficiency.regulatory_case_name || "",
    facility_id: deficiency.facility_id || "",
    facility_name: deficiency.facility_name || "",
    evidence_type: EVIDENCE_TYPES[0],
    description: "",
    date: new Date().toISOString().slice(0, 10),
    source: "",
    responsible_person: "",
    uploaded_document_url: "",
    review_status: "Required",
    reviewer: "",
    accepted_as_sufficient: false,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.EvidenceItem.create({
        ...form,
        accepted_as_sufficient: form.review_status === "Accepted",
        is_test_data: !!deficiency.is_test_data,
      });
      if (onSaved) onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Add Evidence</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <L label="Evidence Type">
          <select value={form.evidence_type} onChange={e => set("evidence_type", e.target.value)} className="cc-input">
            {EVIDENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </L>
        <L label="Date"><input type="date" value={form.date} onChange={e => set("date", e.target.value)} className="cc-input" /></L>
        <L label="Responsible Person"><input value={form.responsible_person} onChange={e => set("responsible_person", e.target.value)} className="cc-input" /></L>
        <L label="Source"><input value={form.source} onChange={e => set("source", e.target.value)} className="cc-input" /></L>
        <L label="Document Link (if available)"><input value={form.uploaded_document_url} onChange={e => set("uploaded_document_url", e.target.value)} className="cc-input" /></L>
        <L label="Review Status">
          <select value={form.review_status} onChange={e => set("review_status", e.target.value)} className="cc-input">
            {REVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </L>
        <L label="Reviewer"><input value={form.reviewer} onChange={e => set("reviewer", e.target.value)} className="cc-input" /></L>
      </div>

      <L label="Description"><textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} className="cc-input" /></L>
      <L label="Notes"><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="cc-input" /></L>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs text-amber-800">A corrective action cannot be marked complete unless required evidence has been accepted or an authorized consultant overrides with documented rationale.</p>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Evidence"}</button>

      <style>{`.cc-input{width:100%;border:1px solid hsl(var(--border));border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;background:white;outline:none;}`}</style>
    </div>
  );
}

function L({ label, children }) {
  return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>{children}</label>;
}