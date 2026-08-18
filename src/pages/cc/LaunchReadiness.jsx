import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState } from "@/components/cc/ui";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, RefreshCw, HelpCircle } from "lucide-react";

const STATUS_ICON = { PASS: CheckCircle2, WARNING: AlertTriangle, FAIL: XCircle, "NOT TESTED": HelpCircle, "INVALID PASS": AlertTriangle };
const STATUS_TONE = { PASS: "green", WARNING: "amber", FAIL: "red", "NOT TESTED": "default", "INVALID PASS": "amber" };
const STATUS_COLOR = { PASS: "text-emerald-600", WARNING: "text-amber-600", FAIL: "text-rose-600", "NOT TESTED": "text-slate-500", "INVALID PASS": "text-amber-600" };

/**
 * Loads ALL LaunchReadinessCheck records using safe pagination.
 * No fixed arbitrary page limit — fetches until no more records remain.
 */
function useAllLaunchReadinessChecks() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const PAGE_SIZE = 100;
      let all = [];
      let skip = 0;
      let hasMore = true;
      while (hasMore) {
        const res = await base44.entities.LaunchReadinessCheck.list("category", PAGE_SIZE, skip);
        const page = Array.isArray(res) ? res : (res?.data || []);
        all = all.concat(page);
        hasMore = page.length === PAGE_SIZE;
        skip += PAGE_SIZE;
      }
      setData(all);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

/**
 * Determines if a PASS is "invalid" — missing required evidence fields.
 * A critical PASS with incomplete evidence does NOT qualify for production readiness.
 */
function isInvalidPass(check) {
  if (check.status !== "PASS") return false;
  if (!check.last_tested_date) return true;
  if (!check.tester) return true;
  if (!check.test_method) return true;
  if (!check.test_evidence) return true;
  return false;
}

/**
 * STRICT Production Ready formula:
 * Production Ready = YES ONLY IF:
 *   critical.length > 0
 *   AND EVERY critical check has:
 *     status === "PASS"
 *     AND test_status === "Passed"
 *     AND last_tested_date populated
 *     AND tester populated
 *     AND test_method populated
 *     AND test_evidence populated
 *
 * WARNING, FAIL, NOT TESTED, Blocked, missing date/tester/method/evidence all block.
 */
function calculateProductionReady(allChecks) {
  const critical = allChecks.filter(c => c.is_critical);
  if (critical.length === 0) return { ready: false, reason: "No critical checks defined" };

  const blocking = critical.filter(c => {
    if (c.status !== "PASS") return true;
    if (c.test_status !== "Passed") return true;
    if (!c.last_tested_date) return true;
    if (!c.tester) return true;
    if (!c.test_method) return true;
    if (!c.test_evidence) return true;
    return false;
  });

  return {
    ready: blocking.length === 0,
    blockingCount: blocking.length,
    blockingChecks: blocking
  };
}

export default function LaunchReadiness() {
  const checks = useAllLaunchReadinessChecks();
  const [running, setRunning] = useState(false);

  const refresh = async () => {
    setRunning(true);
    await checks.reload();
    setRunning(false);
  };

  if (checks.loading) return <LoadingState />;

  const all = checks.data || [];
  const production = calculateProductionReady(all);
  const productionReady = production.ready;

  // Normalize categories — group by canonical category name
  const categories = [...new Set(all.map((c) => c.category))];

  // Summary stats using complete dataset
  const invalidPasses = all.filter(c => isInvalidPass(c));
  const passedCount = all.filter(c => c.status === "PASS" && !isInvalidPass(c)).length;
  const warningCount = all.filter(c => c.status === "WARNING").length;
  const failedCount = all.filter(c => c.status === "FAIL").length;
  const notTestedCount = all.filter(c => c.status === "NOT TESTED" || (!c.last_tested_date && c.status !== "PASS")).length;

  return (
    <div>
      <PageHeader
        title="Launch Readiness"
        subtitle="Production readiness acceptance testing — all critical checks must be tested and PASS with complete evidence before production launch"
        action={
          <button onClick={refresh} disabled={running} className="btn-secondary text-sm disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      <div className={`rounded-2xl border-2 p-6 mb-6 ${productionReady ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800" : "border-rose-300 bg-rose-50 dark:bg-rose-950/50 dark:border-rose-800"}`}>
        <div className="flex items-center gap-4">
          {productionReady ? <ShieldCheck className="h-12 w-12 text-emerald-600 dark:text-emerald-400" /> : <XCircle className="h-12 w-12 text-rose-600 dark:text-rose-400" />}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Production Ready</p>
            <p className={`text-3xl font-bold ${productionReady ? "text-emerald-700" : "text-rose-700"}`}>{productionReady ? "YES" : "NO"}</p>
            {productionReady ? (
              <p className="text-sm text-emerald-600 mt-1">All critical checks tested and passed with complete evidence. System is cleared for production use.</p>
            ) : (
              <p className="text-sm text-rose-600 mt-1">
                {production.blockingCount > 0 && `${production.blockingCount} critical check(s) blocking. `}
                {invalidPasses.length > 0 && `${invalidPasses.length} invalid PASS (evidence incomplete). `}
                Production launch is NOT authorized.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <SummaryStat label="Total Checks" value={all.length} tone="default" />
        <SummaryStat label="Passed" value={passedCount} tone="green" />
        <SummaryStat label="Warnings" value={warningCount} tone="amber" />
        <SummaryStat label="Failed" value={failedCount} tone="red" />
        <SummaryStat label="Not Tested" value={notTestedCount} tone="default" />
        <SummaryStat label="Invalid PASS" value={invalidPasses.length} tone="amber" />
      </div>

      {categories.map((cat) => {
        const catChecks = all.filter((c) => c.category === cat);
        return (
          <div key={cat} className="mb-6">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">{cat}</h2>
            <div className="space-y-2">
              {catChecks.map((c) => {
                const invalid = isInvalidPass(c);
                const displayStatus = invalid ? "INVALID PASS" : (!c.last_tested_date && c.status === "PASS" ? "NOT TESTED" : c.status);
                const Icon = STATUS_ICON[displayStatus] || AlertTriangle;
                return (
                  <div key={c.id} className="bg-white dark:bg-card rounded-xl border border-border p-4 flex items-start gap-4">
                    <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${STATUS_COLOR[displayStatus]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground text-sm">{c.check_name}</p>
                        {c.is_critical && <Badge tone="red">Critical</Badge>}
                      </div>
                      {c.test_method && <p className="mt-1 text-xs text-muted-foreground">Method: {c.test_method}</p>}
                      {c.test_evidence && <p className="mt-1 text-xs text-muted-foreground">Evidence: {c.test_evidence}</p>}
                      {c.tester && <p className="mt-1 text-xs text-muted-foreground">Tester: {c.tester}</p>}
                      {invalid && <p className="mt-1 text-sm text-amber-600 font-medium">⚠ PASS — EVIDENCE INCOMPLETE (missing tester, method, evidence, or date)</p>}
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
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No readiness checks configured</p>
          <p className="mt-1 text-sm text-muted-foreground">Launch readiness checks will appear here once seeded.</p>
        </div>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }) {
  const tones = { default: "text-foreground", green: "text-emerald-600 dark:text-emerald-400", amber: "text-amber-600 dark:text-amber-400", red: "text-rose-600 dark:text-rose-400" };
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </div>
  );
}