import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Save, X } from "lucide-react";

export default function QAPIReviewForm({ deficiency, onSaved, onCancel }) {
  const [form, setForm] = useState({
    deficiency_id: deficiency.id,
    deficiency_name: deficiency.deficiency_title || "",
    regulatory_case_id: deficiency.regulatory_case_id || "",
    regulatory_case_name: deficiency.regulatory_case_name || "",
    facility_id: deficiency.facility_id || "",
    facility_name: deficiency.facility_name || "",
    monitoring_results: "",
    trends: "",
    failures: "",
    corrective_followups: "",
    repeated_patterns: "",
    responsible_leader: "",
    qapi_review_date: new Date().toISOString().slice(0, 10),
    qapi_decision: "",
    additional_action: "",
    monitoring_continuation: true,
    monitoring_reduction: false,
    monitoring_closure: false,
    summary: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.QAPIReview.create({ ...form, is_test_data: !!deficiency.is_test_data });
      if (onSaved) onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">New QAPI Review</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <L label="QAPI Review Date"><input type="date" value={form.qapi_review_date} onChange={e => set("qapi_review_date", e.target.value)} className="cc-input" /></L>
        <L label="Responsible Leader"><input value={form.responsible_leader} onChange={e => set("responsible_leader", e.target.value)} className="cc-input" /></L>
      </div>

      <L label="Monitoring Results"><textarea value={form.monitoring_results} onChange={e => set("monitoring_results", e.target.value)} rows={3} className="cc-input" /></L>
      <L label="Trends"><textarea value={form.trends} onChange={e => set("trends", e.target.value)} rows={2} className="cc-input" /></L>
      <L label="Failures"><textarea value={form.failures} onChange={e => set("failures", e.target.value)} rows={2} className="cc-input" /></L>
      <L label="Corrective Follow-ups"><textarea value={form.corrective_followups} onChange={e => set("corrective_followups", e.target.value)} rows={2} className="cc-input" /></L>
      <L label="Repeated Patterns"><textarea value={form.repeated_patterns} onChange={e => set("repeated_patterns", e.target.value)} rows={2} className="cc-input" /></L>
      <L label="QAPI Decision"><textarea value={form.qapi_decision} onChange={e => set("qapi_decision", e.target.value)} rows={2} className="cc-input" /></L>
      <L label="Additional Action"><textarea value={form.additional_action} onChange={e => set("additional_action", e.target.value)} rows={2} className="cc-input" /></L>
      <L label="Summary"><textarea value={form.summary} onChange={e => set("summary", e.target.value)} rows={3} className="cc-input" /></L>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.monitoring_continuation} onChange={e => { set("monitoring_continuation", e.target.checked); if (e.target.checked) { set("monitoring_reduction", false); set("monitoring_closure", false); } }} /> Continued Monitoring</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.monitoring_reduction} onChange={e => { set("monitoring_reduction", e.target.checked); if (e.target.checked) { set("monitoring_continuation", false); set("monitoring_closure", false); } }} /> Reduced Monitoring</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.monitoring_closure} onChange={e => { set("monitoring_closure", e.target.checked); if (e.target.checked) { set("monitoring_continuation", false); set("monitoring_reduction", false); } }} /> Closure</label>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save QAPI Review"}</button>

      <style>{`.cc-input{width:100%;border:1px solid hsl(var(--border));border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem;background:white;outline:none;}`}</style>
    </div>
  );
}

function L({ label, children }) {
  return <label className="block"><span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>{children}</label>;
}