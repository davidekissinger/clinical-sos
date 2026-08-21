import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Building2, ShieldCheck, AlertTriangle, FileText, ClipboardList, Scale } from "lucide-react";
import { PageHeader, Badge, EmptyState, LoadingState } from "@/components/cc/ui";
import { useTestData } from "@/lib/TestDataContext";
import { base44 } from "@/api/base44Client";

export default function VendorDetail() {
  const { id } = useParams();
  const { showTestData } = useTestData();
  const [vendor, setVendor] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [improvementPlans, setImprovementPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const v = await base44.entities.Vendor.get(id);
        setVendor(v);
        const [rels, evals, plans] = await Promise.all([
          base44.entities.VendorRelationship.filter({ vendor_id: id }, "-created_date", 50),
          base44.entities.VendorEvaluation.filter({ vendor_id: id }, "-created_date", 50),
          base44.entities.VendorPerformanceImprovementPlan.filter({ vendor_id: id }, "-created_date", 50),
        ]);
        setRelationships(rels || []);
        setEvaluations(evals || []);
        setImprovementPlans(plans || []);
      } catch (err) {
        setVendor(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <LoadingState />;
  if (!vendor) return <EmptyState title="Vendor not found" subtitle="This vendor may have been removed." />;

  return (
    <div>
      <Link to="/command-center/vendors" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Vendors
      </Link>
      <PageHeader title={vendor.vendor_legal_name} subtitle={vendor.vendor_category} />

      {/* Overview */}
      <div className="grid md:grid-cols-3 gap-5 mb-8">
        <div className="card-elevated p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contact</h3>
          <p className="text-sm font-medium text-foreground">{vendor.primary_contact_name || "—"}</p>
          <p className="text-sm text-muted-foreground">{vendor.primary_contact_email || "—"}</p>
          <p className="text-sm text-muted-foreground">{vendor.primary_contact_phone || "—"}</p>
          {vendor.website && <p className="text-sm text-primary mt-2 truncate">{vendor.website}</p>}
        </div>
        <div className="card-elevated p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Compliance</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">BAA Status</span><Badge tone={vendor.baa_status === "Executed" ? "green" : "amber"}>{vendor.baa_status}</Badge></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">PHI Access</span><Badge tone={vendor.phi_access_expected === "Yes" ? "red" : "default"}>{vendor.phi_access_expected}</Badge></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Confidence</span><Badge>{vendor.confidence}</Badge></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Record Status</span><Badge tone={vendor.record_status === "Active" ? "green" : "default"}>{vendor.record_status}</Badge></div>
          </div>
        </div>
        <div className="card-elevated p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Credentials</h3>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">Licenses:</span> {vendor.relevant_licenses || "—"}</p>
            <p><span className="font-medium text-foreground">Certifications:</span> {vendor.relevant_certifications || "—"}</p>
            <p><span className="font-medium text-foreground">Accreditation:</span> {vendor.accreditation || "—"}</p>
            <p><span className="font-medium text-foreground">Insurance:</span> {vendor.insurance_information || "—"}</p>
            {vendor.insurance_expiration_date && <p><span className="font-medium text-foreground">Insurance Expires:</span> {vendor.insurance_expiration_date}</p>}
          </div>
        </div>
      </div>

      {vendor.description_of_services && (
        <div className="card-elevated p-5 mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Description of Services</h3>
          <p className="text-sm text-foreground leading-relaxed">{vendor.description_of_services}</p>
        </div>
      )}

      {vendor.known_regulatory_concerns && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-400">Known Regulatory or Compliance Concerns</h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{vendor.known_regulatory_concerns}</p>
            </div>
          </div>
        </div>
      )}

      {/* Relationships */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Vendor Relationships ({relationships.length})</h2>
        {relationships.length === 0 ? (
          <EmptyState title="No vendor relationships" subtitle="Create a relationship to link this vendor to a client organization or facility." />
        ) : (
          <div className="space-y-3">
            {relationships.map((r) => (
              <div key={r.id} className="card-elevated p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{r.client_name || r.organization_name || "—"}</p>
                    <p className="text-sm text-muted-foreground">{r.service_provided || "—"}</p>
                  </div>
                  <Badge tone={r.relationship_status === "Active" ? "green" : r.relationship_status === "Terminated" ? "red" : "default"}>{r.relationship_status}</Badge>
                </div>
                {r.contract_expiration_date && (
                  <p className="text-xs text-muted-foreground mt-2">Contract expires: {r.contract_expiration_date}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Evaluations */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Evaluations ({evaluations.length})</h2>
          <Link to={`/command-center/vendor-evaluations/new?vendor_id=${vendor.id}`} className="text-sm text-primary hover:underline">New Evaluation →</Link>
        </div>
        {evaluations.length === 0 ? (
          <EmptyState title="No evaluations" subtitle="Start a vendor evaluation to assess qualifications, performance, and risk." />
        ) : (
          <div className="space-y-3">
            {evaluations.map((e) => (
              <Link key={e.id} to={`/command-center/vendor-evaluations/${e.id}`} className="block card-elevated p-4 hover:border-primary transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{e.evaluation_name}</p>
                    <p className="text-sm text-muted-foreground">{e.evaluation_type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.overall_score != null && <Badge tone="purple">{e.overall_score}/100</Badge>}
                    <Badge tone={e.risk_level === "Low" ? "green" : e.risk_level === "Critical" || e.risk_level === "High" ? "red" : e.risk_level === "Moderate" ? "amber" : "default"}>{e.risk_level}</Badge>
                    <Badge tone="default">{e.evaluation_status}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Improvement Plans */}
      {improvementPlans.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Performance Improvement Plans ({improvementPlans.length})</h2>
          <div className="space-y-3">
            {improvementPlans.map((p) => (
              <div key={p.id} className="card-elevated p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{p.performance_issue}</p>
                  <Badge tone={p.current_status === "Completed" || p.current_status === "Closed" ? "green" : p.current_status === "Overdue" || p.current_status === "Escalated" ? "red" : "amber"}>{p.current_status}</Badge>
                </div>
                {p.target_completion_date && <p className="text-xs text-muted-foreground mt-2">Target: {p.target_completion_date}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}