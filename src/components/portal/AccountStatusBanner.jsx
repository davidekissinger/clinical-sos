import React from "react";
import { useOutletContext } from "react-router-dom";
import { AlertCircle, Clock, AlertTriangle, Ban } from "lucide-react";

export default function AccountStatusBanner() {
  const outletContext = useOutletContext();
  const entitlement = outletContext?.entitlement;

  if (!entitlement || !entitlement.access_status || entitlement.access_status === "Active") return null;

  const status = entitlement.access_status;
  const message = entitlement.portal_message;

  const config = {
    "Grace Period": { icon: Clock, bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-800 dark:text-amber-300", label: "Grace Period" },
    "Restricted": { icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", text: "text-amber-800 dark:text-amber-300", label: "Restricted Access" },
    "Suspended": { icon: Ban, bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", text: "text-rose-800 dark:text-rose-300", label: "Suspended" },
    "Terminated": { icon: Ban, bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", text: "text-rose-800 dark:text-rose-300", label: "Terminated" },
  };

  const c = config[status];
  if (!c) return null;
  const Icon = c.icon;

  return (
    <div className={`${c.bg} ${c.border} border-b px-5 lg:px-8 py-3`} role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${c.text} flex-shrink-0`} aria-hidden="true" />
        <div>
          <span className={`text-sm font-semibold ${c.text}`}>{c.label}</span>
          {message && <span className={`ml-2 text-sm ${c.text}`}>{message}</span>}
        </div>
      </div>
    </div>
  );
}