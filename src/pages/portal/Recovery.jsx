import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ClientRecovery() {
  const { entitlement } = useOutletContext();
  const [cases, setCases] = useState([]);
  const [deficiencies, setDeficiencies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [caseRes, defRes] = await Promise.all([
          base44.entities.RegulatoryCase.list("-created_date", 200),
          base44.entities.Deficiency.list("-created_date", 200),
        ]);
        const flt = (r) => Array.isArray(r) ? r : (r?.data || []);
        setCases(flt(caseRes).filter(c => c.client_visibility));
        setDeficiencies(flt(defRes).filter(d => d.client_visibility));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Regulatory Recovery</h1>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active Cases</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{cases.filter(c => c.case_status !== "Closed").length}</p>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open Deficiencies</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{deficiencies.filter(d => d.deficiency_status !== "Closed").length}</p>
        </div>
      </div>
      {cases.length > 0 && (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-3">Regulatory Cases</h2>
          <div className="space-y-2">
            {cases.map(c => (
              <div key={c.id} className="p-3 rounded-lg border border-border">
                <p className="text-sm font-medium text-foreground">{c.case_name}</p>
                <p className="text-xs text-muted-foreground">{c.case_status} · {c.facility_name || "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}