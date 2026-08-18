import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft } from "lucide-react";

export default function ClientDeficiencyDetail() {
  const { id } = useParams();
  const { entitlement } = useOutletContext();
  const [deficiency, setDeficiency] = useState(null);
  const [pocs, setPocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const d = await base44.entities.Deficiency.get(id);
        // Must be client-visible AND within authorized tenant scope
        if (!d || !d.client_visibility ||
            !entitlement?.facility_ids?.includes(d.facility_id)) {
          setDenied(true); setLoading(false); return;
        }
        setDeficiency(d);
        const pocRes = await base44.entities.POC.list("-created_date", 200);
        const list = Array.isArray(pocRes) ? pocRes : (pocRes?.data || []);
        setPocs(list.filter(p => p.client_visibility && p.deficiency_id === id));
      } catch (e) { console.error(e); setDenied(true); }
      finally { setLoading(false); }
    }
    load();
  }, [id, entitlement]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;
  if (denied) return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
      <p className="font-medium text-foreground">Access Denied</p>
      <p className="mt-1 text-sm text-muted-foreground">This deficiency is not available or you are not authorized to view it.</p>
      <Link to="/client/recovery" className="mt-4 inline-block text-primary hover:underline text-sm">← Back to Recovery</Link>
    </div>
  );

  return (
    <div>
      <Link to="/client/recovery" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Recovery</Link>
      <h1 className="text-2xl font-bold text-foreground">{deficiency?.f_tag} — {deficiency?.deficiency_title || "Untitled"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{deficiency?.facility_name || "—"} · {deficiency?.deficiency_status}</p>

      <div className="mt-6 bg-white dark:bg-card rounded-xl border border-border p-6">
        <h2 className="font-semibold text-foreground mb-4">Deficiency Overview</h2>
        <dl className="grid sm:grid-cols-2 gap-4">
          <div><dt className="text-xs font-medium text-muted-foreground">Regulation Reference</dt><dd className="text-sm text-foreground mt-1">{deficiency?.regulation_reference || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Scope & Severity</dt><dd className="text-sm text-foreground mt-1">{deficiency?.scope_severity || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Harm Level</dt><dd className="text-sm text-foreground mt-1">{deficiency?.harm_level || "—"}</dd></div>
          <div><dt className="text-xs font-medium text-muted-foreground">Deficiency Date</dt><dd className="text-sm text-foreground mt-1">{deficiency?.deficiency_date || "—"}</dd></div>
        </dl>
        {deficiency?.survey_finding && (
          <div className="mt-4">
            <dt className="text-xs font-medium text-muted-foreground mb-1">Survey Finding</dt>
            <dd className="text-sm text-muted-foreground leading-relaxed">{deficiency.survey_finding}</dd>
          </div>
        )}
      </div>

      {pocs.length > 0 && (
        <div className="mt-6 bg-white dark:bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-3">Plans of Correction</h2>
          <div className="space-y-2">
            {pocs.map(p => (
              <Link key={p.id} to="/client/pocs" className="block p-3 rounded-lg border border-border hover:border-primary transition">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground">{p.f_tag} — Version {p.version}</p><p className="text-xs text-muted-foreground">{p.status}</p></div>
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