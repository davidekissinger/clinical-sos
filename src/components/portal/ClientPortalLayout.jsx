import React, { useState } from "react";
import { Outlet, Link, useLocation, useOutletContext } from "react-router-dom";
import { Menu, X, LogOut, Home, Briefcase, ClipboardList, FileText, FolderCheck, ClipboardCheck, ListChecks, ShieldCheck, FolderOpen, UserCircle, CreditCard } from "lucide-react";
import Logo from "@/components/brand/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import AccountStatusBanner from "@/components/portal/AccountStatusBanner";
import ClientPortalErrorBoundary from "@/components/portal/ClientPortalErrorBoundary";
import MobileBottomNav from "@/components/portal/MobileBottomNav";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { label: "Home", path: "/client", icon: Home },
  { label: "My Engagements", path: "/client/engagements", icon: Briefcase },
  { label: "Regulatory Recovery", path: "/client/recovery", icon: ClipboardList },
  { label: "Plans of Correction", path: "/client/pocs", icon: ClipboardCheck },
  { label: "Work Products", path: "/client/work-products", icon: FileText },
  { label: "Evidence Requests", path: "/client/evidence", icon: FolderCheck },
  { label: "Audits", path: "/client/audits", icon: ClipboardList },
  { label: "Tasks", path: "/client/tasks", icon: ListChecks },
  { label: "Revisit Readiness", path: "/client/readiness", icon: ShieldCheck },
  { label: "Documents", path: "/client/documents", icon: FolderOpen },
  { label: "Account", path: "/client/account", icon: UserCircle },
  { label: "Subscription", path: "/client/subscription", icon: CreditCard },
];

export default function ClientPortalLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const outletContext = useOutletContext();

  const handleLogout = async () => {
    await logout("/");
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      <a href="#client-main-content" className="skip-link">Skip to main content</a>
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-card border-r border-border flex flex-col transition-transform",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <Link to="/client"><Logo /></Link>
          <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="Client portal navigation">
          {NAV.map((n) => {
            const active = location.pathname === n.path || (n.path !== "/client" && location.pathname.startsWith(n.path));
            return (
              <Link
                key={n.path}
                to={n.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  active ? "bg-accent text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <n.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-primary text-sm font-semibold">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{user?.full_name || user?.email}</p>
              <p className="text-xs text-muted-foreground">Client Portal</p>
            </div>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-card border-b border-border flex items-center justify-between px-5 lg:px-8 sticky top-0 z-20 safe-area-top">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-foreground" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <div>
              <p className="text-xs text-muted-foreground">Clinical SOS Client Portal</p>
              <h1 className="text-sm font-semibold text-foreground">Secure · Private</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary hidden sm:inline">View public site →</Link>
          </div>
        </header>
        <AccountStatusBanner />
        <main id="client-main-content" className="flex-1 p-5 lg:p-8 overflow-x-hidden pb-20 md:pb-8">
          <ClientPortalErrorBoundary>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
              >
                <Outlet context={outletContext} />
              </motion.div>
            </AnimatePresence>
          </ClientPortalErrorBoundary>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
