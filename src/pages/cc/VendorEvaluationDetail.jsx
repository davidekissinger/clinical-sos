import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, ShieldCheck, AlertTriangle, FileText, Save } from "lucide-react";
import { PageHeader, Badge, EmptyState, LoadingState } from "@/components/cc/ui";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const EVALUATION_DOMAINS = [
  "Corporate and Credentialing", "Regulatory and Compliance", "Clinical Quality and Resident Safety",
  "Staffing and Competency", "Service Performance", "Data Privacy and Security",
  "Business Continuity", "Financial and Commercial Fit", "Contract and Service-Level Terms",
  "Implementation and Integration", "Reporting and QAPI Support", "References and Reputation"
];

const FINDING_STATUSES = ["Meets Expectations", "Partially Meets Expectations", "Does Not Meet Expectations", "Not Applicable", "Insufficient Evidence", "Not Yet Reviewed"];
const FINDING_TONE = { "Meets Expectations": "green", "Partially Meets Expectations": "amber", "Does Not Meet Expectations": "red", "Not Applicable": "default", "Insufficient Evidence": "amber", "Not Yet Reviewed": "default" };

export default function VendorEvaluationDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [evaluation, setEvaluation] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [savingScore, setSavingScore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const e = await base44.entities.VendorEvaluation.get(id);
      setEvaluation(e);
      const items = await base44.entities.VendorEvaluationItem.filter({ vendor_evaluation_id: id }, "evaluation_category", 500);
      setItems(items || []);
    } catch {
      setEvaluation(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const domainScores = calculateDomainScores(items);

  const recalculateScore = async () => {
    setSavingScore(true);
    try {
      const scores = calculateDomainScores(items);
      const totalWeight = items.reduce((sum, i) => sum + (i.weight || 0), 0);
      const totalPoints = items.reduce((sum, i) => sum + (i.points_awarded || 0) * (i.weight || 1), 0);
      const maxPoints = items.reduce((sum, i) => sum + (i.max_points || 100) * (i.weight || 1), 0);
      const overallScore = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : null;

      const hasInsufficient = items.some((i) => i.finding_status === "Insufficient Evidence" || i.evidence_received === "Not Received");
      const hasCriticalFlag = items.some((i) => i.risk_flag === true);

      let riskLevel = "Unknown / Insufficient Evidence";
      if (overallScore != null) {
        if (hasCriticalFlag) riskLevel = "Critical";
        else if (overallScore >= 85) riskLevel = "Low";
        else if (overallScore >= 70) riskLevel = "Moderate";
        else if (overallScore >= 50) riskLevel = "High";
        else riskLevel = "Critical";
      }

      let recommendation = "No Final Recommendation";
      if (hasInsufficient) recommendation = "Insufficient Evidence";
      else if (overallScore != null) {
        if (hasCriticalFlag) recommendation = "Replacement Should Be Considered";
        else if (overallScore >= 85) recommendation = "Recommended";
        else if (overallScore >= 70) recommendation = "Recommended With Conditions";
        else if (overallScore >= 50) recommendation = "Performance Improvement Required";
        else recommendation = "Not Recommended";
      }

      await base44.entities.VendorEvaluation.update(id, {
        overall_score: overallScore,
        risk_level: riskLevel,
        recommendation,
        evidence_completeness_status: hasInsufficient ? "Insufficient" : "Complete",
        last_reviewed: new Date().toISOString(),
      });

      setEvaluation((prev) => ({ ...prev, overall_score: overallScore, risk_level: riskLevel, recommendation, evidence_completeness_status: hasInsufficient ? "Insufficient" : "Complete" }));
      toast({ title: "Score recalculated", description: `Overall: ${overallScore ?? "—"} | Risk: ${riskLevel}` });
    } catch (err) {
      toast({ title: "Error recalculating score", description: err.message, variant: "destructive" });
    } finally {
      setSavingScore(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!evaluation) return <EmptyState title="Evaluation not found" />;

  return (
    <div>
      <Link to="/command-center/vendor-evaluations" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Evaluations
      </Link>

      <PageHeader title={evaluation.evaluation_name} subtitle={`${evaluation.evaluation_type} • ${evaluation.vendor_name || "—"}`} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card-elevated p-4">
          <p className="text-xs text-muted-foreground uppercase">Overall Score</p>
          <p className="text-2xl font-bold text-foreground">{evaluation.overall_score ?? "—"}</p>
        </div>
        <div className="card-elevated p-4">
          <p className="text-xs text-muted-foreground uppercase">Risk Level</p>
          <Badge tone={evaluation.risk_level === "Low" ? "green" : evaluation.risk_level === "Critical" || evaluation.risk_level === "High" ? "red" : "amber"}>{evaluation.risk_level}</Badge>
        </div>
        <div className="card-elevated p-4">
          <p className="text-xs text-muted-foreground uppercase">Recommendation</p>
          <Badge>{evaluation.recommendation}</Badge>
        </div>
        <div className="card-elevated p-4">
          <p className="text-xs text-muted-foreground uppercase">Status</p>
          <Badge>{evaluation.evaluation_status}</Badge>
        </div>
      </div>

      {/* Insufficient evidence warning */}
      {evaluation.evidence_completeness_status === "Insufficient" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              INSUFFICIENT EVIDENCE — Critical evidence is missing. A favorable score cannot conceal missing documentation.
            </p>
          </div>
        </div>
      )}

      {/* Human review requirement */}
      {evaluation.recommendation !== "No Final Recommendation" && evaluation.executive_approval_status !== "Approved" && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 mb-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm font-medium text-blue-800 dark:text-blue-400">
              This recommendation requires authorized human review before it becomes final. AI cannot finalize an evaluation.
            </p>
          </div>
        </div>
      )}

      {/* Domain scores */}
      {items.length > 0 && (
        <div className="card-elevated p-5 mb-6">
          <h3 className="font-semibold mb-4">Domain Scores</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {EVALUATION_DOMAINS.map((domain) => {
              const score = domainScores[domain];
              return (
                <div key={domain} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                  <span className="text-xs text-muted-foreground">{domain}</span>
                  <span className={`text-sm font-semibold ${score == null ? "text-muted-foreground" : score >= 85 ? "text-emerald-600" : score >= 70 ? "text-amber-600" : "text-rose-600"}`}>{score ?? "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evaluation items */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Evaluation Criteria ({items.length})</h2>
          <div className="flex items-center gap-3">
            <button onClick={recalculateScore} disabled={savingScore} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-primary">
              <Save className="h-4 w-4" /> {savingScore ? "Calculating…" : "Recalculate Score"}
            </button>
            <button onClick={() => setShowAddItem(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">
              <Plus className="h-4 w-4" /> Add Criterion
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState title="No criteria yet" subtitle="Add evaluation criteria to begin structured scoring." />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <EvaluationItemRow key={item.id} item={item} onUpdate={load} toast={toast} />
            ))}
          </div>
        )}
      </div>

      {showAddItem && <AddItemDialog evaluationId={id} evaluationName={evaluation.evaluation_name} onClose={() => setShowAddItem(false)} onAdded={load} toast={toast} />}
    </div>
  );
}

function EvaluationItemRow({ item, onUpdate, toast }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    finding_status: item.finding_status,
    points_awarded: item.points_awarded,
    weight: item.weight,
    risk_flag: item.risk_flag,
    reviewer_comments: item.reviewer_comments,
    evidence_received: item.evidence_received,
  });

  const save = async () => {
    try {
      await base44.entities.VendorEvaluationItem.update(item.id, form);
      toast({ title: "Criterion updated" });
      setEditing(false);
      onUpdate();
    } catch (err) {
      toast({ title: "Error updating", description: err.message, variant: "destructive" });
    }
  };

  if (!editing) {
    return (
      <div className="card-elevated p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge>{item.evaluation_category}</Badge>
              {item.risk_flag && <Badge tone="red">⚠ Critical Risk Flag</Badge>}
            </div>
            <p className="mt-2 font-medium text-foreground text-sm">{item.criterion}</p>
            {item.criterion_description && <p className="mt-1 text-xs text-muted-foreground">{item.criterion_description}</p>}
            {item.evidence_summary && <p className="mt-2 text-xs text-muted-foreground italic">Evidence: {item.evidence_summary}</p>}
            {item.reviewer_comments && <p className="mt-2 text-xs text-muted-foreground">Reviewer: {item.reviewer_comments}</p>}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <Badge tone={FINDING_TONE[item.finding_status] || "default"}>{item.finding_status}</Badge>
            {item.points_awarded != null && <span className="text-sm font-semibold">{item.points_awarded}/{item.max_points}</span>}
            {item.weight != null && <span className="text-xs text-muted-foreground">w: {item.weight}</span>}
            <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">Edit</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-4 border-primary">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Finding Status</span>
          <select value={form.finding_status} onChange={(e) => setForm({ ...form, finding_status: e.target.value })} className="cc-input mt-1">
            {FINDING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Evidence Received</span>
          <select value={form.evidence_received} onChange={(e) => setForm({ ...form, evidence_received: e.target.value })} className="cc-input mt-1">
            {["Received", "Partially Received", "Not Received", "Not Applicable", "Requested"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Points Awarded</span>
          <input type="number" value={form.points_awarded ?? ""} onChange={(e) => setForm({ ...form, points_awarded: e.target.value ? Number(e.target.value) : null })} className="cc-input mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Weight</span>
          <input type="number" step="0.1" value={form.weight ?? ""} onChange={(e) => setForm({ ...form, weight: e.target.value ? Number(e.target.value) : null })} className="cc-input mt-1" />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Reviewer Comments</span>
          <textarea rows={2} value={form.reviewer_comments ?? ""} onChange={(e) => setForm({ ...form, reviewer_comments: e.target.value })} className="cc-input mt-1" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.risk_flag ?? false} onChange={(e) => setForm({ ...form, risk_flag: e.target.checked })} className="h-4 w-4 rounded border-border" />
          <span className="text-sm text-muted-foreground">Critical risk flag</span>
        </label>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={() => setEditing(false)} className="btn-ghost text-xs">Cancel</button>
        <button onClick={save} className="btn-primary text-xs">Save</button>
      </div>
    </div>
  );
}

function AddItemDialog({ evaluationId, evaluationName, onClose, onAdded, toast }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    evaluation_category: "Corporate and Credentialing",
    criterion: "", criterion_description: "", weight: 1, max_points: 100,
    points_awarded: null, evidence_requirement: "", evidence_received: "Requested",
    evidence_source: "", evidence_summary: "", reviewer_comments: "",
    finding_status: "Not Yet Reviewed", risk_flag: false, client_visibility: false,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.criterion) { toast({ title: "Criterion is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await base44.entities.VendorEvaluationItem.create({
        ...form,
        vendor_evaluation_id: evaluationId,
        vendor_evaluation_name: evaluationName,
      });
      toast({ title: "Criterion added" });
      onAdded();
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-card rounded-xl border border-border shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold">Add Evaluation Criterion</h2>
          <button onClick={onClose} className="text-muted-foreground">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground mb-1.5 block">Evaluation Domain</span>
            <select value={form.evaluation_category} onChange={(e) => set("evaluation_category", e.target.value)} className="cc-input">
              {EVALUATION_DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground mb-1.5 block">Criterion *</span>
            <input value={form.criterion} onChange={(e) => set("criterion", e.target.value)} className="cc-input" placeholder="e.g., Verify current pharmacy license" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground mb-1.5 block">Description</span>
            <textarea rows={2} value={form.criterion_description} onChange={(e) => set("criterion_description", e.target.value)} className="cc-input" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-foreground mb-1.5 block">Weight</span>
              <input type="number" step="0.1" value={form.weight} onChange={(e) => set("weight", Number(e.target.value))} className="cc-input" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground mb-1.5 block">Max Points</span>
              <input type="number" value={form.max_points} onChange={(e) => set("max_points", Number(e.target.value))} className="cc-input" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground mb-1.5 block">Points Awarded</span>
              <input type="number" value={form.points_awarded ?? ""} onChange={(e) => set("points_awarded", e.target.value ? Number(e.target.value) : null)} className="cc-input" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-foreground mb-1.5 block">Evidence Requirement</span>
            <input value={form.evidence_requirement} onChange={(e) => set("evidence_requirement", e.target.value)} className="cc-input" placeholder="What evidence is needed?" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground mb-1.5 block">Evidence Summary</span>
            <textarea rows={2} value={form.evidence_summary} onChange={(e) => set("evidence_summary", e.target.value)} className="cc-input" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground mb-1.5 block">Reviewer Comments</span>
            <textarea rows={2} value={form.reviewer_comments} onChange={(e) => set("reviewer_comments", e.target.value)} className="cc-input" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.risk_flag} onChange={(e) => set("risk_flag", e.target.checked)} className="h-4 w-4 rounded border-border" />
            <span className="text-sm text-muted-foreground">Flag as critical risk</span>
          </label>
        </div>
        <div className="sticky bottom-0 bg-white dark:bg-card border-t border-border px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? "Saving…" : "Add Criterion"}</button>
        </div>
      </div>
    </div>
  );
}

function calculateDomainScores(items) {
  const scores = {};
  EVALUATION_DOMAINS.forEach((domain) => {
    const domainItems = items.filter((i) => i.evaluation_category === domain);
    if (domainItems.length === 0) { scores[domain] = null; return; }
    const totalWeight = domainItems.reduce((sum, i) => sum + (i.weight || 1), 0);
    const totalPoints = domainItems.reduce((sum, i) => sum + (i.points_awarded || 0) * (i.weight || 1), 0);
    const maxPoints = domainItems.reduce((sum, i) => sum + (i.max_points || 100) * (i.weight || 1), 0);
    scores[domain] = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : null;
  });
  return scores;
}