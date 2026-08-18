import React, { useState, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export default function ClientEntitlementRoute() {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();
  const [entitlement, setEntitlement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkEntitlement() {
      if (!user) { setLoading(false); return; }
      try {
        const res = await base44.functions.invoke("getClientPortalContext", {});
        setEntitlement(res.data || res);
      } catch (e) {
        setEntitlement({ authorized: false, access_status: null });
      } finally {
        setLoading(false);
      }
    }
    if (!isLoadingAuth) checkEntitlement();
  }, [user, isLoadingAuth]);

  if (isLoadingAuth || loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login?returnTo=/client" replace />;

  // Pending users go directly to access-pending — never bounce through staff routes
  if (user.role === "pending") {
    return <Navigate to="/access-pending" replace />;
  }

  // Non-client staff roles go to command center
  if (user.role !== "client") {
    return <Navigate to="/command-center" replace />;
  }

  if (!entitlement || (!entitlement.authorized && !entitlement.access_status)) {
    return <Navigate to="/access-pending" replace />;
  }

  // Suspended / Terminated → redirect to account page
  if (entitlement.access_status === "Suspended" || entitlement.access_status === "Terminated") {
    if (location.pathname !== "/client/account") {
      return <Navigate to="/client/account" replace />;
    }
  }

  return <Outlet context={{ entitlement }} />;
}