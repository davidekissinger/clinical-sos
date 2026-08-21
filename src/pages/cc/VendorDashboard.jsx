import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Building2, ShieldCheck, AlertTriangle, ClipboardList, Calendar, FileText, TrendingUp, Lock } from "lucide-react";
import { PageHeader, Badge, EmptyState, LoadingState, StatCard } from "@/components/cc/ui";
import { useTestData } from "@/lib/TestDataContext";
import { base44 } from "@/api/base44Client";

export default function VendorDashboard() {
  const { showTestData } = useTestData();
  const [vendors, setVendors] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [v, e, r, p] = await Promise.all([
          base44.entities.Vendor.list("-created_date", 200),
          base44.entities.VendorEvaluation.list("-created_date", 200),
          base44.entities.VendorRelationship.list("-created_date", 200),
          base44.entities.VendorPerformanceImprovementPlan.list("-created_date", 200),
        ]);
        setVendors(v || []);
        setEvaluations(e || []);
        setRelationships(r || []);
        setPlans(p || []);
      } catch (err) {
        // error
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    const activeVendors = vendors.filter((v) => v.record_status === "Active");
    const prospectiveRels = relationships.filter((r) => r.relationship_status === "Prospective" || r.relationship_status === "Due Diligence");
    const inProgress = evaluations.filter((e) => !["Final", "Closed"].includes(e.evaluation_status));
    const highRisk = evaluations.filter((e) => e.risk_level === "High" || e.risk_level === "Critical");
    const criticalFlags = evaluations.flatMap((e) => e.id ? [e] : []).filter((e) => e.risk_level === "Critical");
    const openPlans = plans.filter((p) => !["Completed", "Closed"].includes(p.current_status));
    const overduePlans = plans.filter((p) => p.current_status === "Overdue" || (p.target_completion_date && p.target_completion_date < new Date().toISOString().split("T")[0] && !["Completed", "Closed"].includes(p.current_status)));
    const insufficientEvidence = evaluations.filter((e) => e.recommendation === "Insufficient Evidence" || e.evidence_completeness_status === "Insufficient");
    const upcomingRenewals = relationships.filter((r) => {
      if (!r.contract_expiration_date) return false;
      const days = (new Date(r.contract_expiration_date) - new Date()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 90;
    });
    const expiringInsurance = vendors.filter((v) => {
      if (!v.insurance_expiration_date) return false;
      const days = (new Date(v.insurance_expiration_date) - new Date()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 90;
    });
    const baaMissing = relationships.filter((r) => r.baa_status === "Pending" || r.baa_status === "Unknown");

    return {
      activeVendors: activeVendors.length,
      prospectiveVendors: prospectiveRels.length,
      inProgress: inProgress.length,
      highRisk: highRisk.length,
      criticalFlags: criticalFlags.length,
      openPlans: openPlans.length,
      overduePlans: overduePlans.length,
      insufficientEvidence: insufficientEvidence.length,
      upcomingRenewals: upcomingRenewals.length,
      expiringInsurance: expiringInsurance.length,
      baaMissing: baaMissing.length,
    };
  }, [vendors, evaluations, relationships, plans]);

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Vendor Evaluation Dashboard" subtitle="Vendor governance, risk monitoring, and performance oversight" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Vendors" value={stats.activeVendors} icon={Building2} />
        <StatCard label="Prospective" value={stats.prospectiveVendors} icon={ShieldCheck} tone="blue" />
        <StatCard label="Evaluations In Progress" value={stats.inProgress} icon={FileText} tone="purple" />
        <StatCard label="High-Risk Vendors" value={stats.highRisk} icon={AlertTriangle} tone="red" />
        <StatCard label="Critical Risk Flags" value={stats.criticalFlags} icon={AlertTriangle} tone="red" />
        <StatCard label="Open Improvement Plans" value={stats.openPlans} icon={ClipboardList} tone="amber" />
        <StatCard label="Overdue Corrective Actions" value={stats.overduePlans} icon={AlertTriangle} tone="red" />
        <StatCard label="Insufficient Evidence" value={stats.insufficientEvidence} icon={Lock} tone="amber" />
        <StatCard label="Upcoming Renewals (90d)" value={stats.upcomingRenewals} icon={Calendar} tone="amber" />
        <StatCard label="Insurance Expiring (90d)" value={stats.expiringInsurance} icon={AlertTriangle} tone="amber" />
        <StatCard label="BAA Pending/Missing" value={stats.baaMissing} icon={Lock} tone="amber" />
        <StatCard label="Total Evaluations" value={evaluations.length} icon={TrendingUp} />
      </div>

      {/* High-risk vendors */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">High-Risk & Critical Evaluations</h2>
        {evaluations.filter((e) => e.risk_level === "High" || e.risk_level === "Critical").length === 0 ? (
          <EmptyState title="No high-risk evaluations" subtitle="Vendors with high or critical risk levels will appear here." />
        ) : (
          <div className="space-y-2">
            {evaluations.filter((e) => e.risk_level === "High" || e.risk_level === "Critical").map((e) => (
              <Link key={e.id} to={`/command-center/vendor-evaluations/${e.id}`} className="block card-elevated p-4 hover:border-primary transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{e.evaluation_name}</p>
                    <p className="text-sm text-muted-foreground">{e.vendor_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.overall_score != null && <Badge tone="purple">{e.overall_score}/100</Badge>}
                    <Badge tone="red">{e.risk_level}</Badge>
                    <Badge>{e.recommendation}</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming renewals */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Upcoming Contract Renewals (90 days)</h2>
        {stats.upcomingRenewals === 0 ? (
          <EmptyState title="No upcoming renewals" subtitle="Vendor relationships with contracts expiring within 90 days will appear here." />
        ) : (
          <div className="space-y-2">
            {relationships.filter((r) => {
              if (!r.contract_expiration_date) return false;
              const days = (new Date(r.contract_expiration_date) - new Date()) / (1000 * 60 * 60 * 24);
              return days > 0 && days <= 90;
            }).map((r) => (
              <div key={r.id} className="card-elevated p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{r.vendor_name}</p>
                    <p className="text-sm text-muted-foreground">{r.client_name || r.organization_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="amber">Expires: {r.contract_expiration_date}</Badge>
                    {r.auto_renewal && <Badge tone="blue">Auto-renew</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue improvement plans */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Overdue Corrective Actions</h2>
        {stats.overduePlans === 0 ? (
          <EmptyState title="No overdue actions" subtitle="Overdue vendor corrective actions will appear here." />
        ) : (
          <div className="space-y-2">
            {plans.filter((p) => p.current_status === "Overdue" || (p.target_completion_date && p.target_completion_date < new Date().toISOString().split("T")[0] && !["Completed", "Closed"].includes(p.current_status))).map((p) => (
              <div key={p.id} className="card-elevated p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{p.vendor_name}</p>
                    <p className="text-sm text-muted-foreground">{p.performance_issue}</p>
                  </div>
                  <Badge tone="red">Overdue — Target: {p.target_completion_date}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}