import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { useSearchParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, CreditCard, ArrowLeft, Loader2, AlertCircle } from "lucide-react";

export default function ClientSubscription() {
  const outletContext = useOutletContext();
  const entitlement = outletContext?.entitlement;
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(null);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const checkoutStatus = searchParams.get("status");

  useEffect(() => {
    async function loadTiers() {
      try {
        const res = await base44.entities.SubscriptionTier.list("sort_order", 50);
        const list = Array.isArray(res) ? res : (res?.data || []);
        setTiers(list.filter(t => t.is_active));
      } catch (e) {
        setError(e.message || "Unable to load subscription tiers.");
      } finally {
        setLoading(false);
      }
    }
    loadTiers();
  }, []);

  const handleSubscribe = async (tierId) => {
    // Block checkout if running in an iframe
    if (window.self !== window.top) {
      setError("Checkout requires opening the published app directly. It cannot be completed from within the preview iframe.");
      return;
    }

    setCheckingOut(tierId);
    setError(null);
    try {
      const result = await base44.functions.invoke("createCheckoutSession", { tier_id: tierId });
      if (result?.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        setError("Unable to start checkout. Please try again or contact support.");
      }
    } catch (e) {
      setError(e.message || "Checkout failed. Please try again or contact support.");
    } finally {
      setCheckingOut(null);
    }
  };

  const currentPlan = entitlement?.account_name ? tiers.find(t => t.tier_name === entitlement?.subscription_plan) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Link to="/client/account" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Account
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-2">Service Package Subscriptions</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose the consulting package that fits your organization's needs. All plans are billed annually.
      </p>

      {checkoutStatus === "success" && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Subscription activated</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">Your service package is now active. Your portal access has been updated.</p>
          </div>
        </div>
      )}

      {checkoutStatus === "cancelled" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-400">Checkout was cancelled. No charge was made.</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        </div>
      )}

      {entitlement?.subscription_status && entitlement.subscription_status !== "Not Applicable" && (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-4 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Current Subscription</span>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{entitlement.subscription_plan || "—"}</span>
            {" · "}
            Status: {entitlement.subscription_status}
            {entitlement.subscription_renewal_date && (
              <> · Renews: {new Date(entitlement.subscription_renewal_date).toLocaleDateString()}</>
            )}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((tier) => {
          const isCurrent = entitlement?.subscription_plan === tier.tier_name;
          return (
            <div
              key={tier.id}
              className={`bg-white dark:bg-card rounded-2xl border-2 p-6 flex flex-col transition ${
                isCurrent ? "border-primary shadow-md" : "border-border hover:border-primary/40"
              }`}
            >
              {isCurrent && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-accent rounded-full px-3 py-1 mb-3 self-start">
                  <CheckCircle2 className="h-3 w-3" /> Current Plan
                </span>
              )}
              <h2 className="text-lg font-bold text-foreground mb-1">{tier.tier_name}</h2>
              <p className="text-sm text-muted-foreground mb-4 flex-grow">{tier.description}</p>

              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">${tier.annual_price.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">/year</span>
              </div>

              <ul className="space-y-2 mb-6">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {tier.facility_limit > 0 && (
                <p className="text-xs text-muted-foreground mb-4">Includes up to {tier.facility_limit} facilit{tier.facility_limit === 1 ? "y" : "ies"}</p>
              )}
              {tier.facility_limit === 0 && (
                <p className="text-xs text-muted-foreground mb-4">Unlimited facilities</p>
              )}

              <button
                onClick={() => handleSubscribe(tier.id)}
                disabled={isCurrent || checkingOut === tier.id}
                className={`w-full rounded-full px-6 py-3 text-sm font-semibold transition ${
                  isCurrent
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:bg-[hsl(262_58%_28%)] focus-visible:outline-2 focus-visible:outline-offset-2"
                }`}
              >
                {isCurrent ? "Current Plan" : checkingOut === tier.id ? "Redirecting…" : "Subscribe"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}