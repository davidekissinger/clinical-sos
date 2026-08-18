import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ClientDocuments() {
  const outletContext = useOutletContext();
  const entitlement = outletContext?.entitlement;
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.functions.invoke("getClientPortalData", { resource: "documents" });
        setDocuments(Array.isArray(res) ? res : (res?.data || []));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  const byEngagement = {};
  documents.forEach(d => {
    const key = d.engagement_name || "Unassigned";
    if (!byEngagement[key]) byEngagement[key] = [];
    byEngagement[key].push(d);
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Documents</h1>
      {documents.length === 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No documents available</p>
          <p className="mt-1 text-sm text-muted-foreground">Published documents will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byEngagement).map(([engName, docs]) => (
            <div key={engName} className="bg-white dark:bg-card rounded-xl border border-border p-5">
              <h2 className="font-semibold text-foreground mb-3">{engName}</h2>
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{doc.document_type}</p>
                      <p className="text-xs text-muted-foreground">v{doc.version || "1.0"} · {doc.document_status} · {doc.generation_date ? new Date(doc.generation_date).toLocaleDateString() : "—"}</p>
                      {doc.f_tag && <p className="text-xs text-muted-foreground">F-Tag: {doc.f_tag}</p>}
                    </div>
                    {entitlement?.effective_capabilities?.can_download_documents && doc.document_status === "FINAL"
                      ? <span className="text-xs text-primary">Download</span>
                      : <span className="text-xs text-muted-foreground">View only</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}