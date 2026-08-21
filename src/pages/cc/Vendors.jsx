import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Building2, ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader, Badge, Table, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { useTestData } from "@/lib/TestDataContext";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import MobileSelect from "@/components/MobileSelect";

const CATEGORIES = [
  "Pharmacy", "Therapy", "Staffing Agency", "Laboratory", "Radiology",
  "Wound Care Provider", "Medical Equipment and DME", "Medical Supplies",
  "Electronic Health Records / Healthcare Technology", "Cybersecurity and IT",
  "Billing and Revenue-Cycle Services", "Dietary and Food Services",
  "Environmental Services", "Transportation", "Behavioral Health",
  "Hospice and Home Health", "Infection-Prevention Services",
  "Emergency-Preparedness Vendors", "Consultant Services",
  "Maintenance and Life-Safety Services", "Other Facility-Selected Category"
];

const RISK_TONE = {
  "Low": "green", "Moderate": "amber", "High": "red", "Critical": "red", "Unknown / Insufficient Evidence": "default"
};

export default function Vendors() {
  const { showTestData } = useTestData();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const vendors = useEntities("Vendor", { sort: "-created_date", limit: 200, excludeTestData: !showTestData });

  const filtered = useMemo(() => {
    if (!vendors.data) return [];
    return vendors.data.filter((v) => {
      const matchSearch = !search || 
        v.vendor_legal_name?.toLowerCase().includes(search.toLowerCase()) ||
        v.dba_name?.toLowerCase().includes(search.toLowerCase()) ||
        v.vendor_category?.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !categoryFilter || v.vendor_category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [vendors.data, search, categoryFilter]);

  if (vendors.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle="Vendor directory for due diligence, performance evaluation, and risk monitoring"
        action={
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Vendor
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors by name, DBA, or category…"
            className="cc-input pl-9"
          />
        </div>
        <div className="sm:w-64">
          <MobileSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: "", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
            className="cc-input"
            ariaLabel="Filter by category"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No vendors found" subtitle="Create a vendor to begin due diligence and performance evaluation." />
      ) : (
        <Table headers={["Vendor", "Category", "BAA Status", "PHI Access", "Confidence", "Status"]}>
          {filtered.map((v) => (
            <tr key={v.id} className="hover:bg-secondary/30 cursor-pointer" onClick={() => window.location.href = `/command-center/vendors/${v.id}`}>
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{v.vendor_legal_name}</div>
                {v.dba_name && <div className="text-xs text-muted-foreground">DBA: {v.dba_name}</div>}
              </td>
              <td className="px-4 py-3"><Badge>{v.vendor_category || "—"}</Badge></td>
              <td className="px-4 py-3"><Badge tone={v.baa_status === "Executed" ? "green" : v.baa_status === "Not Required" ? "default" : "amber"}>{v.baa_status || "—"}</Badge></td>
              <td className="px-4 py-3"><Badge tone={v.phi_access_expected === "Yes" ? "red" : v.phi_access_expected === "No" ? "green" : "default"}>{v.phi_access_expected || "—"}</Badge></td>
              <td className="px-4 py-3"><Badge tone={v.confidence === "High" ? "green" : v.confidence === "Medium" ? "amber" : "default"}>{v.confidence || "—"}</Badge></td>
              <td className="px-4 py-3"><Badge tone={v.record_status === "Active" ? "green" : v.record_status === "Research Required" ? "amber" : "default"}>{v.record_status || "—"}</Badge></td>
            </tr>
          ))}
        </Table>
      )}

      {showCreate && <CreateVendorDialog onClose={() => setShowCreate(false)} onCreated={() => {       setShowCreate(false); vendors.reload(); }} toast={toast} />}
    </div>
  );
}

function CreateVendorDialog({ onClose, onCreated, toast }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor_legal_name: "", dba_name: "", vendor_category: "Pharmacy",
    description_of_services: "", primary_contact_name: "", primary_contact_email: "",
    primary_contact_phone: "", website: "", headquarters_address: "",
    baa_status: "Unknown", phi_access_expected: "Unknown", record_status: "Active",
    confidence: "Unverified", internal_notes: "", client_visible_summary: "",
    is_test_data: false,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    if (!form.vendor_legal_name) { toast({ title: "Vendor legal name is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await base44.entities.Vendor.create(form);
      toast({ title: "Vendor created", description: form.vendor_legal_name });
      onCreated();
    } catch (err) {
      toast({ title: "Error creating vendor", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold">New Vendor</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">Vendor Legal Name *</span>
              <input value={form.vendor_legal_name} onChange={(e) => set("vendor_legal_name", e.target.value)} className="cc-input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">DBA / Common Name</span>
              <input value={form.dba_name} onChange={(e) => set("dba_name", e.target.value)} className="cc-input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">Category *</span>
              <MobileSelect value={form.vendor_category} onChange={(v) => set("vendor_category", v)} options={CATEGORIES} className="cc-input" ariaLabel="Vendor category" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">Website</span>
              <input value={form.website} onChange={(e) => set("website", e.target.value)} className="cc-input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">Primary Contact</span>
              <input value={form.primary_contact_name} onChange={(e) => set("primary_contact_name", e.target.value)} className="cc-input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">Contact Email</span>
              <input type="email" value={form.primary_contact_email} onChange={(e) => set("primary_contact_email", e.target.value)} className="cc-input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">Contact Phone</span>
              <input value={form.primary_contact_phone} onChange={(e) => set("primary_contact_phone", e.target.value)} className="cc-input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">Headquarters</span>
              <input value={form.headquarters_address} onChange={(e) => set("headquarters_address", e.target.value)} className="cc-input" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">BAA Status</span>
              <MobileSelect value={form.baa_status} onChange={(v) => set("baa_status", v)} options={["Executed", "Pending", "Not Required", "Unknown"]} className="cc-input" ariaLabel="BAA status" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-foreground mb-1.5">PHI Access Expected</span>
              <MobileSelect value={form.phi_access_expected} onChange={(v) => set("phi_access_expected", v)} options={["Yes", "No", "Unknown"]} className="cc-input" ariaLabel="PHI access expected" />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium text-foreground mb-1.5">Description of Services</span>
            <textarea rows={3} value={form.description_of_services} onChange={(e) => set("description_of_services", e.target.value)} className="cc-input" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-foreground mb-1.5">Client-Visible Summary</span>
            <textarea rows={2} value={form.client_visible_summary} onChange={(e) => set("client_visible_summary", e.target.value)} className="cc-input" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-foreground mb-1.5">Internal Notes</span>
            <textarea rows={2} value={form.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} className="cc-input" />
          </label>
        </div>
        <div className="sticky bottom-0 bg-white dark:bg-card border-t border-border px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={onSave} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? "Saving…" : "Create Vendor"}</button>
        </div>
      </div>
    </div>
  );
}