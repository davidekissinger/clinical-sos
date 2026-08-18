import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function ClientAudits() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.functions.invoke("getClientPortalData", { resource: "audits" });
        setAudits(Array.isArray(res) ? res : (res?.data || []));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Audits</h1>
      {audits.length === 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No audits available</p>
          <p className="mt-1 text-sm text-muted-foreground">Published audits will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map(a => (
            <div key={a.id} className="bg-white dark:bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.plain_language_regulatory_focus || a.f_tag}</p>
                  <p className="text-xs text-muted-foreground">{a.audit_date || "—"} · {a.auditor || "—"}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.audit_result === "Pass" ? "bg-emerald-50 text-emerald-700" : a.audit_result === "Failed" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{a.audit_result}</span>
              </div>
              {a.what_was_corrected && <p className="mt-2 text-xs text-muted-foreground">Corrected: {a.what_was_corrected}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}