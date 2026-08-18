import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ClientWorkProducts() {
  const outletContext = useOutletContext();
  const entitlement = outletContext?.entitlement;
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.functions.invoke("getClientPortalData", { resource: "work_products" });
        setProducts(Array.isArray(res) ? res : (res?.data || []));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Work Products</h1>
      {products.length === 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No work products available</p>
          <p className="mt-1 text-sm text-muted-foreground">Published work products will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(wp => (
            <div key={wp.id} className="bg-white dark:bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{wp.document_type}</p>
                  <p className="text-xs text-muted-foreground">{wp.engagement_name || "—"} · {wp.facility_name || "—"} · v{wp.version || "1.0"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground font-medium">{wp.document_status}</span>
                  {entitlement?.effective_capabilities?.can_download_documents && wp.document_status === "FINAL" && (
                    <span className="text-xs text-primary">Download available</span>
                  )}
                </div>
              </div>
              {wp.f_tag && <p className="mt-2 text-xs text-muted-foreground">F-Tag: {wp.f_tag}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}