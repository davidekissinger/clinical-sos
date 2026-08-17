import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { Mail, Phone, Linkedin, Plus, Pencil, Trash2, X, ChevronDown, ChevronRight, Copy } from "lucide-react";

const CHANNEL_ICON = { Email: Mail, Phone, LinkedIn: Linkedin, "In-Person": Plus, Other: Mail };

export default function Outreach() {
  const templates = useEntities("OutreachTemplate", { sort: "sequence_name", limit: 500 });
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // template being edited or "new"
  const [saving, setSaving] = useState(false);

  // Group templates by sequence_name
  const sequences = useMemo(() => {
    const map = {};
    (templates.data || []).forEach((t) => {
      if (!map[t.sequence_name]) map[t.sequence_name] = [];
      map[t.sequence_name].push(t);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.step_number - b.step_number));
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates.data]);

  const blank = (sequenceName = "") => ({
    sequence_name: sequenceName,
    step_number: (sequences.find(([n]) => n === sequenceName)?.[1].length || 0) + 1,
    step_label: "",
    stage: "Qualified",
    channel: "Email",
    timing: "",
    subject: "",
    body: "",
    active: true,
    notes: "",
  });

  const save = async (data) => {
    setSaving(true);
    try {
      if (data.id) await base44.entities.OutreachTemplate.update(data.id, data);
      else await base44.entities.OutreachTemplate.create(data);
      await templates.reload();
      setEditing(null);
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this template step?")) return;
    await base44.entities.OutreachTemplate.delete(id);
    templates.reload();
  };

  if (templates.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Outreach Sequences"
        subtitle="Define reusable multi-step follow-up sequences with templates for each stage of the sales cycle"
        action={
          <button onClick={() => setEditing({ ...blank(), _isNewSeq: true })} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> New Sequence
          </button>
        }
      />

      {sequences.length === 0 && !editing && (
        <EmptyState title="No outreach sequences yet" subtitle="Create your first sequence to define follow-up steps and templates." />
      )}

      <div className="space-y-4">
        {sequences.map(([name, steps]) => {
          const isOpen = expanded === name;
          const activeCount = steps.filter((s) => s.active).length;
          return (
            <div key={name} className="bg-white rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : name)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{steps.length} step{steps.length !== 1 ? "s" : ""} · {activeCount} active</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="purple">{steps[0]?.stage || "—"}</Badge>
                  <span onClick={(e) => { e.stopPropagation(); setEditing({ ...blank(name) }); }}>
                    <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"><Plus className="h-3 w-3" /> Step</span>
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border divide-y divide-border">
                  {steps.map((s, i) => {
                    const Icon = CHANNEL_ICON[s.channel] || Mail;
                    return (
                      <div key={s.id} className="px-5 py-4 flex items-start gap-4">
                        <div className="flex flex-col items-center pt-1">
                          <div className="h-7 w-7 rounded-full bg-accent text-[hsl(262_50%_45%)] flex items-center justify-center text-xs font-bold">{s.step_number}</div>
                          {i < steps.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground text-sm">{s.step_label || `Step ${s.step_number}`}</p>
                            <Badge tone="default">{s.stage}</Badge>
                            <Badge tone="blue"><Icon className="h-3 w-3 mr-1" />{s.channel}</Badge>
                            {s.timing && <span className="text-xs text-muted-foreground">{s.timing}</span>}
                            {!s.active && <Badge tone="amber">Inactive</Badge>}
                          </div>
                          {s.subject && <p className="mt-1 text-sm font-medium text-foreground">Subject: {s.subject}</p>}
                          {s.body && <p className="mt-1 text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{s.body}</p>}
                          {s.notes && <p className="mt-1 text-xs text-muted-foreground italic">{s.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing({ ...s })} className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(s.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <TemplateEditor
          template={editing}
          isNewSequence={editing._isNewSeq}
          existingSequences={sequences.map(([n]) => n)}
          saving={saving}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TemplateEditor({ template, isNewSequence, existingSequences, saving, onSave, onClose }) {
  const [form, setForm] = useState(template);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    delete payload._isNewSeq;
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">{form.id ? "Edit Step" : "New Step"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Sequence name *</span>
              {isNewSequence ? (
                <input required value={form.sequence_name} onChange={(e) => set("sequence_name", e.target.value)} className="ot-input" placeholder="e.g. IJ Rapid Response" />
              ) : (
                <select value={form.sequence_name} onChange={(e) => set("sequence_name", e.target.value)} className="ot-input">
                  {existingSequences.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Step number *</span>
              <input type="number" min={1} required value={form.step_number} onChange={(e) => set("step_number", parseInt(e.target.value) || 1)} className="ot-input" />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Step label</span>
              <input value={form.step_label || ""} onChange={(e) => set("step_label", e.target.value)} className="ot-input" placeholder="e.g. Initial outreach" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Timing</span>
              <input value={form.timing || ""} onChange={(e) => set("timing", e.target.value)} className="ot-input" placeholder="e.g. Day 0, +3 days, +1 week" />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Sales cycle stage *</span>
              <select value={form.stage} onChange={(e) => set("stage", e.target.value)} className="ot-input">
                {["New", "Researching", "Verified", "Qualified", "Outreach Review", "Contacted", "Engaged", "Discovery Scheduled", "Discovery Completed", "Proposal Draft", "Proposal Sent", "Negotiation", "Nurture"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1.5">Channel</span>
              <select value={form.channel} onChange={(e) => set("channel", e.target.value)} className="ot-input">
                {["Email", "Phone", "LinkedIn", "In-Person", "Other"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Subject line</span>
            <input value={form.subject || ""} onChange={(e) => set("subject", e.target.value)} className="ot-input" placeholder="Email subject" />
          </label>

          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Template body</span>
            <textarea rows={8} value={form.body || ""} onChange={(e) => set("body", e.target.value)} className="ot-input resize-y" placeholder="Write your template. Use {{first_name}}, {{facility_name}}, {{organization_name}} as merge fields." />
          </label>

          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Notes</span>
            <textarea rows={2} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} className="ot-input resize-y" placeholder="Internal notes" />
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 rounded border-border" />
            <span className="text-sm">Active</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? "Saving…" : "Save Step"}</button>
          </div>
        </form>
        <style>{`
          .ot-input { width: 100%; border: 1px solid hsl(var(--border)); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; background: white; outline: none; transition: border-color .15s, box-shadow .15s; }
          .ot-input:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--accent)); }
        `}</style>
      </div>
    </div>
  );
}