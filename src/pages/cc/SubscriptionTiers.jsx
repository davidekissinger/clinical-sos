import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState, EmptyState } from "@/components/cc/ui";
import { CreditCard, RefreshCw } from "lucide-react";

export default function SubscriptionTiers() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.entities.SubscriptionTier.list("sort_order", 50);
      setTiers(Array.isArray(res) ? res : (res?.data || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (tier) => {
    try {
      await base44.entities.SubscriptionTier.update(tier.id, { is_active: !tier.is_active });
      load();
      setResult({ success: `${tier.tier_name} ${tier.is_active ? "deactivated" : "activated"}` });
    } catch (e) {
      setResult({ error: e.message });
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Subscription Tiers"
        subtitle={`${tiers.length} service-package tiers configured`}
        action={
          <button onClick={load} className="btn-secondary text-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <div className="bg-white dark:bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              {["Tier", "Annual Price", "Stripe Product", "Stripe Price", "Facilities", "Capabilities", "Status", "Actions"].map(h => (
                <th key={h} scope="col" className="text-left font-medium px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tiers.map(t => (
              <tr key={t.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium text-foreground">
                  {t.tier_name}
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">{t.description}</p>
                </td>
                <td className="px-4 py-3 text-foreground">${t.annual_price?.toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{t.stripe_product_id}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{t.stripe_price_id}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.facility_limit === 0 ? "Unlimited" : t.facility_limit}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.included_capabilities?.length || 0} caps</td>
                <td className="px-4 py-3"><Badge tone={t.is_active ? "green" : "red"}>{t.is_active ? "Active" : "Inactive"}</Badge></td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(t)} className="btn-ghost text-xs">
                    {t.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tiers.length === 0 && <EmptyState title="No subscription tiers" subtitle="Tiers are seeded from Stripe products." />}
      </div>

      <div className="mt-4 bg-secondary/30 rounded-xl border border-border p-4">
        <div className="flex items-start gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Subscription tiers are created from Stripe products and prices. To add or modify tiers, update the Stripe products and sync the SubscriptionTier records.
            Each tier maps to a Clinical SOS service package with included client portal capabilities.
          </p>
        </div>
      </div>

      {result && (
        <div className={`fixed bottom-4 right-4 rounded-xl border p-4 shadow-lg z-50 max-w-sm ${result.error ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`} role="status" aria-live="polite">
          <p className="text-sm font-medium">{result.error || result.success}</p>
          <button onClick={() => setResult(null)} className="mt-1 text-xs underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}