import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { Plus, Search, FilePlus } from "lucide-react";
import MobileSelect from "@/components/MobileSelect";
import PullToRefresh from "@/components/PullToRefresh";

export default function Cases() {
  const cases = useEntities("RegulatoryCase", { sort: "-created_date", limit: 200, excludeTestData: true });
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ case_name: "", facility_name: "", client_name: "", survey_date: "", case_status: "Intake" });
  const [saving, setSaving] = useState(false);

  const filtered = cases.data.filter(c =>
    !search ||
    c.case_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.facility_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.RegulatoryCase.create({ ...form, clinical_approval_status: "Draft" });
      setShowNew(false);
      setForm({ case_name: "", facility_name: "", client_name: "", survey_date: "", case_status: "Intake" });
      cases.reload();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (cases.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Regulatory Cases"
        subtitle="Consulting delivery cases — from intake through revisit readiness and closure"
        action={
          <button onClick={() => setShowNew(!showNew)} className="btn-primary text-sm">
            <Plus className="h-4 w-4" /> New Case
          </button>
        }
      />

      {showNew && (
        <form onSubmit={create} className="bg-white dark:bg-card rounded-xl border border-border p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <input required placeholder="Case name *" value={form.case_name} onChange={e => setForm({...form, case_name: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Facility name" value={form.facility_name} onChange={e => setForm({...form, facility_name: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Client name" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm" />
          <input type="date" value={form.survey_date} onChange={e => setForm({...form, survey_date: e.target.value})} className="border border-border rounded-lg px-3 py-2 text-sm" />
          <MobileSelect value={form.case_status} onChange={v => setForm({...form, case_status: v})} options={["Intake","Source Documents Pending","Initial Review","Deficiencies Extracted","Clinical Analysis","Corrective Strategy","POC Development","Implementation","Monitoring","Revisit Preparation","Revisit Pending","Substantial Compliance Pending","Closed","On Hold"]} className="border border-border rounded-lg px-3 py-2 text-sm" ariaLabel="Case status" />
          <button type="submit" disabled={saving} className="btn-primary text-sm disabled:opacity-60">{saving ? "Saving…" : "Create Case"}</button>
        </form>
      )}

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases…" className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-white dark:bg-card text-foreground" />
      </div>

      <PullToRefresh onRefresh={cases.reload}>
        <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm cc-responsive-table">
            <thead className="bg-secondary/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Case</th>
                <th className="text-left px-4 py-3 font-medium">Facility / Client</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Urgency</th>
                <th className="text-left px-4 py-3 font-medium">Score</th>
                <th className="text-left px-4 py-3 font-medium">Deficiencies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/30 cursor-pointer" onClick={() => window.location.href = `/command-center/cases/${c.id}`}>
                  <td className="px-4 py-3"><Link to={`/command-center/cases/${c.id}`} className="font-medium text-foreground hover:text-primary" onClick={e => e.stopPropagation()}>{c.case_name}</Link></td>
                  <td className="px-4 py-3 text-muted-foreground">{c.facility_name}<br/><span className="text-xs">{c.client_name}</span></td>
                  <td className="px-4 py-3"><Badge tone="default">{c.case_status}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={c.regulatory_urgency === "Critical" ? "red" : c.regulatory_urgency === "Severe" ? "amber" : "default"}>{c.regulatory_urgency}</Badge></td>
                  <td className="px-4 py-3 font-bold">{c.regulatory_urgency_score ?? "—"}</td>
                  <td className="px-4 py-3">{c.total_deficiencies ?? "—"} ({c.high_priority_deficiencies ?? 0} high)</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <EmptyState text="No regulatory cases found" icon={FilePlus} />}
        </div>
      </PullToRefresh>
    </div>
  );
}