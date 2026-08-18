import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Save, X } from "lucide-react";

export default function EducationPlanForm({ deficiency, onSaved, onCancel }) {
  const [form, setForm] = useState({
    deficiency_id: deficiency.id,
    deficiency_name: deficiency.deficiency_title || "",
    regulatory_case_id: deficiency.regulatory_case_id || "",
    regulatory_case_name: deficiency.regulatory_case_name || "",
    facility_id: deficiency.facility_id || "",
    facility_name: deficiency.facility_name || "",
    education_outline: "",
    staff_training_content: "",
    department_assignments: "",
    attendance_roster: "",
    competency_requirements: "",
    completion_tracker: "",
    remediation_needs: "",
    education_status: "Assigned",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.EducationPlan.create({ ...form, is_test_data: !!deficiency.is_test_data });
      if (onSaved) onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">New Education Plan</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <L label="Training Topic / Education Outline">
        <textarea value={form.education_outline} onChange={e => set("education_outline", e.target.value)} rows={3} className="cc-input" placeholder="Training topic and outline…" />
      </L>
      <L label="Staff Training Content">
        <textarea value={form.staff_training_content} onChange={e => set("staff_training_content", e.target.value)} rows={3} className="cc-input" placeholder="Training content summary…" />
      </L>
      <div className="grid sm:grid-cols-2 gap-3">
        <L label="Departments / Staff"><input value={form.department_assignments} onChange={e => set("department_assignments", e.target.value)} className="cc-input" /></L>
        <L label="Education Status">
          <select value={form.education_status} onChange={e => set("education_status", e.target.value)} className="cc-input">
            {["Assigned", "Scheduled", "Completed", "Competency Pending", "Competency Completed", "Remediation Required"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </L>
      </div>
      <L label="Competency Requirements"><textarea value={form.competency_requirements} onChange={e => set("competency_requirements", e.target.value)} rows={2} className="cc-input" /></L>
      <L label="Attendance Roster"><textarea value={form.attendance_roster} onChange={e => set("attendance_roster", e.target.value)} rows={2} className="cc-input" /></L>
      <L label="Remediation Needs"><textarea value={form.remediation_needs} onChange={e => set("remediation_needs", e.target.value)} rows={2} className="cc-input" /></L>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs text-amber-800">Education cannot be marked complete simply because materials were generated. Competency validation and attendance tracking are required.</p>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Education Plan"}</button>

      <style>{`.cc-input{width:100%;border:1px solid hsl(var(--border));border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;background:white;outline:none;}`}</style>
    </div>
  );
}

function L({ label, children }) {
  return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>{children}</label>;
}