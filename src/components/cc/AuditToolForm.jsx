import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Save, X } from "lucide-react";

export default function AuditToolForm({ deficiency, onSaved, onCancel }) {
  const [form, setForm] = useState({
    facility_id: deficiency.facility_id || "",
    facility_name: deficiency.facility_name || "",
    regulatory_case_id: deficiency.regulatory_case_id || "",
    regulatory_case_name: deficiency.regulatory_case_name || "",
    deficiency_id: deficiency.id,
    deficiency_name: deficiency.deficiency_title || "",
    f_tag: deficiency.f_tag || "",
    cms_regulatory_reference: deficiency.regulation_reference || "",
    plain_language_regulatory_focus: deficiency.regulatory_focus || "",
    specific_deficiency_focus: deficiency.deficiency_title || "",
    corrective_action_focus: deficiency.immediate_correction || "",
    audit_date: new Date().toISOString().slice(0, 10),
    auditor: "",
    unit_hall: "",
    shift: "",
    checklist_items: [{ question: "", response: "N/A", notes: "", follow_up_action: "", responsible_person: "", due_date: "", correction_status: "Not Started" }],
    audit_result: "Not Completed",
    what_was_corrected: "",
    what_remains_unresolved: "",
    responsible_person: "",
    monitoring_sample_size: "",
    monitoring_frequency: "",
    monitoring_duration: "",
    monitoring_responsible_person: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addChecklistItem = () => {
    setForm(f => ({ ...f, checklist_items: [...f.checklist_items, { question: "", response: "N/A", notes: "", follow_up_action: "", responsible_person: "", due_date: "", correction_status: "Not Started" }] }));
  };

  const updateChecklistItem = (i, field, val) => {
    setForm(f => {
      const items = [...f.checklist_items];
      items[i] = { ...items[i], [field]: val };
      return { ...f, checklist_items: items };
    });
  };

  const removeChecklistItem = (i) => {
    setForm(f => ({ ...f, checklist_items: f.checklist_items.filter((_, idx) => idx !== i) }));
  };

  const save = async (complete = false) => {
    setSaving(true);
    try {
      const auditResult = complete ? "Pass" : "Not Completed";
      const hasFailures = form.checklist_items.some(c => c.response === "No" && !c.follow_up_action);
      const finalResult = complete ? (hasFailures ? "Failed" : "Pass") : "Not Completed";

      await base44.entities.AuditTool.create({
        ...form,
        checklist_json: JSON.stringify(form.checklist_items),
        audit_result: finalResult,
        is_test_data: !!deficiency.is_test_data,
      });
      if (onSaved) onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">New Audit Tool</h3>
        <button onClick={onCancel} aria-label="Close audit tool form" className="text-muted-foreground hover:text-foreground min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-secondary/60"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <L label="Audit Date"><input type="date" value={form.audit_date} onChange={e => set("audit_date", e.target.value)} className="cc-input" /></L>
        <L label="Auditor"><input value={form.auditor} onChange={e => set("auditor", e.target.value)} className="cc-input" /></L>
        <L label="Unit / Hall"><input value={form.unit_hall} onChange={e => set("unit_hall", e.target.value)} className="cc-input" /></L>
        <L label="Shift"><input value={form.shift} onChange={e => set("shift", e.target.value)} className="cc-input" /></L>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-foreground">Checklist Items</h4>
          <button onClick={addChecklistItem} className="text-xs text-primary font-medium min-h-[32px] px-2">+ Add Item</button>
        </div>
        <div className="space-y-3">
          {form.checklist_items.map((item, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input value={item.question} onChange={e => updateChecklistItem(i, "question", e.target.value)}
                  aria-label={`Audit item ${i + 1} question`}
                  placeholder="Audit question / checklist item…" className="cc-input flex-1" />
                <button onClick={() => removeChecklistItem(i)} aria-label={`Remove audit item ${i + 1}`} className="text-rose-500 hover:text-rose-700 mt-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <select value={item.response} onChange={e => updateChecklistItem(i, "response", e.target.value)}
                  aria-label={`Audit item ${i + 1} response`} className="cc-input">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="N/A">N/A</option>
                </select>
                <input value={item.responsible_person} onChange={e => updateChecklistItem(i, "responsible_person", e.target.value)}
                  aria-label={`Audit item ${i + 1} responsible person`}
                  placeholder="Responsible person" className="cc-input" />
                <input type="date" value={item.due_date} onChange={e => updateChecklistItem(i, "due_date", e.target.value)}
                  aria-label={`Audit item ${i + 1} due date`} className="cc-input" />
              </div>
              <input value={item.notes} onChange={e => updateChecklistItem(i, "notes", e.target.value)}
                aria-label={`Audit item ${i + 1} notes`}
                placeholder="Notes…" className="cc-input" />
              {item.response === "No" && (
                <input value={item.follow_up_action} onChange={e => updateChecklistItem(i, "follow_up_action", e.target.value)}
                  aria-label={`Audit item ${i + 1} follow-up action`}
                  placeholder="Follow-up action required (if No)…" className="cc-input" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <L label="What was corrected"><input value={form.what_was_corrected} onChange={e => set("what_was_corrected", e.target.value)} className="cc-input" /></L>
        <L label="What remains unresolved"><input value={form.what_remains_unresolved} onChange={e => set("what_remains_unresolved", e.target.value)} className="cc-input" /></L>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => save(false)} disabled={saving} className="btn-secondary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Draft"}</button>
        <button onClick={() => save(true)} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Complete Audit"}</button>
      </div>
    </div>
  );
}

function L({ label, children }) {
  return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>{children}</label>;
}