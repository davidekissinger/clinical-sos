import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { Plus, Search, BookOpen, CheckCircle2 } from "lucide-react";

export default function Knowledge() {
  const knowledge = useEntities("RegulatoryKnowledge", { sort: "f_tag", limit: 200 });
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ f_tag: "", title: "", regulation_reference: "", plain_language_regulatory_focus: "", common_deficiency_patterns: "", possible_corrective_approaches: "", approval_status: "Draft" });
  const [saving, setSaving] = useState(false);

  const filtered = knowledge.data.filter(k =>
    !search ||
    k.f_tag?.toLowerCase().includes(search.toLowerCase()) ||
    k.title?.toLowerCase().includes(search.toLowerCase())
  );

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.RegulatoryKnowledge.create(form);
      setShowNew(false);
      setForm({ f_tag: "", title: "", regulation_reference: "", plain_language_regulatory_focus: "", common_deficiency_patterns: "", possible_corrective_approaches: "", approval_status: "Draft" });
      knowledge.reload();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (knowledge.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Regulatory Knowledge Library"
        subtitle="Reusable clinical SOS guidance for commonly encountered F-tags — NOT a substitute for facility-specific analysis"
        action={<button onClick={() => setShowNew(!showNew)} className="btn-primary text-sm"><Plus className="h-4 w-4" /> New Entry</button>}
      />

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <BookOpen className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>CLINICAL SOS REUSABLE GUIDANCE</strong> — This library provides general reference material. It must NOT substitute for analysis of the actual facility-specific CMS-2567. Always distinguish reusable guidance from facility-specific findings and corrective plans.
        </p>
      </div>

      {showNew && (
        <form onSubmit={create} className="bg-white rounded-xl border border-border p-5 mb-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <input required placeholder="F-Tag *" value={form.f_tag} onChange={e => setForm({...form, f_tag: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm" />
            <input required placeholder="Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <input placeholder="Regulation reference" value={form.regulation_reference} onChange={e => setForm({...form, regulation_reference: e.target.value})} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Plain-language regulatory focus" value={form.plain_language_regulatory_focus} onChange={e => setForm({...form, plain_language_regulatory_focus: e.target.value})} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Common deficiency patterns" value={form.common_deficiency_patterns} onChange={e => setForm({...form, common_deficiency_patterns: e.target.value})} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Possible corrective approaches" value={form.possible_corrective_approaches} onChange={e => setForm({...form, possible_corrective_approaches: e.target.value})} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? "Saving…" : "Create Entry"}</button>
        </form>
      )}

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by F-tag or title…" className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-white" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(k => (
          <div key={k.id} className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-primary">{k.f_tag}</span>
              <Badge tone={k.approval_status === "Approved" ? "green" : k.approval_status === "Retired" ? "red" : "amber"}>{k.approval_status}</Badge>
            </div>
            <p className="font-medium text-foreground text-sm">{k.title}</p>
            {k.plain_language_regulatory_focus && <p className="mt-1 text-xs text-muted-foreground">{k.plain_language_regulatory_focus}</p>}
            {k.last_reviewed && <p className="mt-2 text-xs text-muted-foreground">Reviewed: {new Date(k.last_reviewed).toLocaleDateString()}</p>}
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full"><EmptyState text="No knowledge entries found" icon={BookOpen} /></div>}
      </div>
    </div>
  );
}