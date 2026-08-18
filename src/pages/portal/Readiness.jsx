import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export default function ClientReadiness() {
  const { entitlement } = useOutletContext();
  const [deficiencies, setDeficiencies] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [defRes, critRes] = await Promise.all([
          base44.entities.Deficiency.list("-created_date", 200),
          base44.entities.RevisitReadinessCriterion.list("-created_date", 200),
        ]);
        const flt = (r) => Array.isArray(r) ? r : (r?.data || []);
        setDeficiencies(flt(defRes).filter(d => d.client_visibility));
        setCriteria(flt(critRes).filter(c => c.client_visibility));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  const statuses = deficiencies.map(d => d.revisit_readiness_status || "Not Assessed");
  const ready = statuses.filter(s => s === "Ready").length;
  const nearly = statuses.filter(s => s === "Nearly Ready").length;
  const gaps = statuses.filter(s => s === "Significant Gaps").length;
  const notReady = statuses.filter(s => s === "Not Ready").length;
  const notAssessed = statuses.filter(s => s === "Not Assessed").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Revisit Readiness</h1>

      <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinical SOS Internal Revisit Readiness Assessment</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <ReadinessStat label="Ready" count={ready} tone="green" />
          <ReadinessStat label="Nearly Ready" count={nearly} tone="blue" />
          <ReadinessStat label="Significant Gaps" count={gaps} tone="amber" />
          <ReadinessStat label="Not Ready" count={notReady} tone="red" />
          <ReadinessStat label="Not Assessed" count={notAssessed} tone="default" />
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-amber-800 dark:text-amber-300">This is a Clinical SOS internal readiness assessment. Clinical SOS does not guarantee the outcome of a regulatory revisit.</p>
      </div>

      {deficiencies.length > 0 && (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-3">Deficiency Readiness</h2>
          <div className="space-y-2">
            {deficiencies.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div><p className="text-sm font-medium text-foreground">{d.f_tag} — {d.deficiency_title || "Untitled"}</p></div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.revisit_readiness_status === "Ready" ? "bg-emerald-50 text-emerald-700" : d.revisit_readiness_status === "Not Ready" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{d.revisit_readiness_status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReadinessStat({ label, count, tone }) {
  const tones = {
    green: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950",
    blue: "text-blue-700 bg-blue-50 dark:bg-blue-950",
    amber: "text-amber-700 bg-amber-50 dark:bg-amber-950",
    red: "text-rose-700 bg-rose-50 dark:bg-rose-950",
    default: "text-muted-foreground bg-secondary"
  };
  return (
    <div className={`rounded-lg p-3 text-center ${tones[tone]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
}