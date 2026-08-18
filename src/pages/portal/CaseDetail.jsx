import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft } from "lucide-react";

export default function ClientCaseDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.functions.invoke("getClientPortalDetail", { resource: "case", id });
        setData(res.data || res);
      } catch (e) { console.error(e); setDenied(true); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;
  if (denied || !data) return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
      <p className="font-medium text-foreground">Access Denied</p>
      <p className="mt-1 text-sm text-muted-foreground">This case is not available or you are not authorized to view it.</p>
      <Link to="/client/recovery" className="mt-4 inline-block text-primary hover:underline text-sm">← Back to Recovery</Link>
    </div>
  );

  const regCase = data.case;
  const deficiencies = data.deficiencies || [];

  return (
    <div>
      <Link to="/client/recovery" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Recovery</Link>
      <h1 className="text-2xl font-bold text-foreground">{regCase?.case_name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{regCase?.facility_name || "—"} · {regCase?.case_status}</p>

      <div className="mt-6 bg-white dark:bg-card rounded-xl border border-border p-6">
        <h2 className="font-semibold text-foreground mb-4">Case Overview</h2>
        <dl className="grid sm:grid-cols-2 gap-4">
          <div><dt className="text-xs font-medium text-muted-foreground">Survey Date</dt><dd className="text-sm text-foreground mt-1">{regCase?.survey_date || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Current Status</dt><dd className="text-sm text-foreground mt-1">{regCase?.current_regulatory_status || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">IJ Status</dt><dd className="text-sm text-foreground mt-1">{regCase?.ij_status || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">CMP Status</dt><dd className="text-sm text-foreground mt-1">{regCase?.cmp_status || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">DPNA Status</dt><dd className="text-sm text-foreground mt-1">{regCase?.dpna_status || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Total Deficiencies</dt><dd className="text-sm text-foreground mt-1">{regCase?.total_deficiencies || "—"}</dd></div>
        </dl>
      </div>

      {deficiencies.length > 0 && (
        <div className="mt-6 bg-white dark:bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-3">Published Deficiencies</h2>
          <div className="space-y-2">
            {deficiencies.map(d => (
              <Link key={d.id} to={`/client/deficiencies/${d.id}`} className="block p-3 rounded-lg border border-border hover:border-primary transition">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground">{d.f_tag} — {d.deficiency_title || "Untitled"}</p><p className="text-xs text-muted-foreground">{d.deficiency_status}</p></div>
                  <span className="text-primary text-sm">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}