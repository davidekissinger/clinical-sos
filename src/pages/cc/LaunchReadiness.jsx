import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, RefreshCw, HelpCircle } from "lucide-react";

const STATUS_ICON = { PASS: CheckCircle2, WARNING: AlertTriangle, FAIL: XCircle, "NOT TESTED": HelpCircle };
const STATUS_TONE = { PASS: "green", WARNING: "amber", FAIL: "red", "NOT TESTED": "default" };
const STATUS_COLOR = { PASS: "text-emerald-600", WARNING: "text-amber-600", FAIL: "text-rose-600", "NOT TESTED": "text-slate-500" };

export default function LaunchReadiness() {
  const checks = useEntities("LaunchReadinessCheck", { sort: "category", limit: 100 });
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    setRunning(true);
    await checks.reload();
    setRunning(false);
  };

  if (checks.loading) return <LoadingState />;

  const all = checks.data || [];
  const critical = all.filter((c) => c.is_critical);
  const criticalFails = critical.filter((c) => c.status === "FAIL");
  const criticalNotTested = critical.filter((c) => c.status === "NOT TESTED" || !c.last_tested_date);
  const productionReady = criticalFails.length === 0 && criticalNotTested.length === 0;

  const categories = [...new Set(all.map((c) => c.category))];

  return (
    <div>
      <PageHeader
        title="Launch Readiness"
        subtitle="Production readiness acceptance testing — all critical checks must be tested and PASS before production launch"
        action={
          <button onClick={refresh} disabled={running} className="btn-secondary text-sm disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      <div className={`rounded-2xl border-2 p-6 mb-6 ${productionReady ? "border-emerald-300 bg-emerald-50" : "border-rose-300 bg-rose-50"}`}>
        <div className="flex items-center gap-4">
          {productionReady ? <ShieldCheck className="h-12 w-12 text-emerald-600" /> : <XCircle className="h-12 w-12 text-rose-600" />}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Production Ready</p>
            <p className={`text-3xl font-bold ${productionReady ? "text-emerald-700" : "text-rose-700"}`}>{productionReady ? "YES" : "NO"}</p>
            {productionReady ? (
              <p className="text-sm text-emerald-600 mt-1">All critical checks tested and passed. System is cleared for production use.</p>
            ) : (
              <p className="text-sm text-rose-600 mt-1">
                {criticalFails.length > 0 && `${criticalFails.length} critical failure(s) must be resolved. `}
                {criticalNotTested.length > 0 && `${criticalNotTested.length} critical check(s) not yet tested.`}
                {!productionReady && " Production launch is NOT authorized."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <SummaryStat label="Total Checks" value={all.length} tone="default" />
        <SummaryStat label="Passed" value={all.filter((c) => c.status === "PASS").length} tone="green" />
        <SummaryStat label="Warnings" value={all.filter((c) => c.status === "WARNING").length} tone="amber" />
        <SummaryStat label="Failed" value={all.filter((c) => c.status === "FAIL").length} tone="red" />
        <SummaryStat label="Not Tested" value={all.filter((c) => c.status === "NOT TESTED" || !c.last_tested_date).length} tone="default" />
      </div>

      {categories.map((cat) => {
        const catChecks = all.filter((c) => c.category === cat);
        return (
          <div key={cat} className="mb-6">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">{cat}</h2>
            <div className="space-y-2">
              {catChecks.map((c) => {
                const Icon = STATUS_ICON[c.status] || AlertTriangle;
                const displayStatus = !c.last_tested_date && c.status === "PASS" ? "NOT TESTED" : c.status;
                return (
                  <div key={c.id} className="bg-white rounded-xl border border-border p-4 flex items-start gap-4">
                    <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${STATUS_COLOR[displayStatus]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground text-sm">{c.check_name}</p>
                        {c.is_critical && <Badge tone="red">Critical</Badge>}
                      </div>
                      {c.evidence && <p className="mt-1 text-sm text-muted-foreground">{c.evidence}</p>}
                      {c.test_method && <p className="mt-1 text-xs text-muted-foreground">Method: {c.test_method}</p>}
                      {c.test_evidence && <p className="mt-1 text-xs text-muted-foreground">Evidence: {c.test_evidence}</p>}
                      {c.tester && <p className="mt-1 text-xs text-muted-foreground">Tester: {c.tester}</p>}
                      {c.unresolved_issue && <p className="mt-1 text-sm text-rose-600 font-medium">⚠ {c.unresolved_issue}</p>}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        {c.last_tested_date ? <span>Last tested: {new Date(c.last_tested_date).toLocaleString()}</span> : <span className="text-rose-500 font-medium">Never tested</span>}
                        {c.owner && <span>· Owner: {c.owner}</span>}
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[displayStatus]}>{displayStatus}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {all.length === 0 && (
        <div className="bg-white rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No readiness checks configured</p>
          <p className="mt-1 text-sm text-muted-foreground">Launch readiness checks will appear here once seeded.</p>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }) {
  const tones = { default: "text-foreground", green: "text-emerald-600", amber: "text-amber-600", red: "text-rose-600" };
  return (
    <div className="bg-white rounded-xl border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}