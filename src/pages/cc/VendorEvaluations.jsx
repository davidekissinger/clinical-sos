import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ShieldCheck } from "lucide-react";
import { PageHeader, Badge, Table, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { useTestData } from "@/lib/TestDataContext";
import MobileSelect from "@/components/MobileSelect";

const EVALUATION_TYPES = [
  "Pre-Contract Vendor Due Diligence", "Competitive Vendor Comparison",
  "New-Vendor Implementation Readiness", "Existing-Vendor Performance Review",
  "Contract-Renewal Evaluation", "Service-Level Agreement Review",
  "Corrective-Action Evaluation", "Incident-Triggered Vendor Review",
  "Regulatory-Case-Related Vendor Review", "Routine Annual Vendor Evaluation",
  "Organization-Wide Vendor Portfolio Review"
];

const RISK_TONE = {
  "Low": "green", "Moderate": "amber", "High": "red", "Critical": "red", "Unknown / Insufficient Evidence": "default"
};

const REC_TONE = {
  "Recommended": "green", "Recommended With Conditions": "blue", "Continue With Monitoring": "default",
  "Performance Improvement Required": "amber", "Renewal Review Required": "amber",
  "Replacement Should Be Considered": "red", "Not Recommended": "red",
  "Insufficient Evidence": "amber", "No Final Recommendation": "default"
};

export default function VendorEvaluations() {
  const { showTestData } = useTestData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const evals = useEntities("VendorEvaluation", { sort: "-created_date", limit: 200, excludeTestData: !showTestData });

  const filtered = useMemo(() => {
    if (!evals.data) return [];
    return evals.data.filter((e) => {
      const matchSearch = !search || e.evaluation_name?.toLowerCase().includes(search.toLowerCase()) || e.vendor_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || e.evaluation_status === statusFilter;
      const matchRisk = !riskFilter || e.risk_level === riskFilter;
      return matchSearch && matchStatus && matchRisk;
    });
  }, [evals.data, search, statusFilter, riskFilter]);

  if (evals.loading) return <LoadingState />;

  const statuses = ["Intake", "Scope Definition", "Evidence Requested", "Evidence Collection", "Under Evaluation", "Additional Information Required", "Clinical Review", "Operational Review", "Compliance Review", "Client Review", "Improvement Plan", "Monitoring", "Final Review", "Final", "Closed", "On Hold"];
  const risks = ["Low", "Moderate", "High", "Critical", "Unknown / Insufficient Evidence"];

  return (
    <div>
      <PageHeader
        title="Vendor Evaluations"
        subtitle="Structured due diligence, performance evaluation, and risk assessment"
        action={
          <Link to="/command-center/vendor-evaluations/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New Evaluation
          </Link>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search evaluations…" className="cc-input pl-9" />
        </div>
        <div className="sm:w-48">
          <MobileSelect value={statusFilter} onChange={setStatusFilter} options={[{ value: "", label: "All statuses" }, ...statuses.map((s) => ({ value: s, label: s }))]} className="cc-input" ariaLabel="Filter by status" />
        </div>
        <div className="sm:w-48">
          <MobileSelect value={riskFilter} onChange={setRiskFilter} options={[{ value: "", label: "All risk levels" }, ...risks.map((r) => ({ value: r, label: r }))]} className="cc-input" ariaLabel="Filter by risk" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No evaluations found" subtitle="Create a vendor evaluation to begin structured due diligence." />
      ) : (
        <Table headers={["Evaluation", "Vendor", "Type", "Score", "Risk", "Recommendation", "Status"]}>
          {filtered.map((e) => (
            <tr key={e.id} className="hover:bg-secondary/30 cursor-pointer" onClick={() => window.location.href = `/command-center/vendor-evaluations/${e.id}`}>
              <td className="px-4 py-3 font-medium text-foreground">{e.evaluation_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.vendor_name || "—"}</td>
              <td className="px-4 py-3"><Badge>{e.evaluation_type}</Badge></td>
              <td className="px-4 py-3">{e.overall_score != null ? <span className="font-semibold">{e.overall_score}</span> : "—"}</td>
              <td className="px-4 py-3"><Badge tone={RISK_TONE[e.risk_level] || "default"}>{e.risk_level || "—"}</Badge></td>
              <td className="px-4 py-3"><Badge tone={REC_TONE[e.recommendation] || "default"}>{e.recommendation || "—"}</Badge></td>
              <td className="px-4 py-3"><Badge>{e.evaluation_status}</Badge></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}