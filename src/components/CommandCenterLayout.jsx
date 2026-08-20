import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, UserCircle, Target, ListChecks,
  Settings, LogOut, Menu, X, FileText, ShieldCheck, Activity, Briefcase, Bot, Send, Rocket, Stethoscope, BookOpen, ClipboardList
} from "lucide-react";
import Logo from "@/components/brand/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { useTestData } from "@/lib/TestDataContext";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  { label: "Dashboard", path: "/command-center", icon: LayoutDashboard, roles: ["admin", "business_development", "clinical", "finance", "read_only"] },
  { label: "Leads", path: "/command-center/leads", icon: Target, roles: ["admin", "business_development", "clinical"] },
  { label: "Pipeline", path: "/command-center/pipeline", icon: Briefcase, roles: ["admin", "business_development", "clinical", "finance", "read_only"] },
  { label: "Facilities", path: "/command-center/facilities", icon: Building2, roles: ["admin", "business_development", "clinical", "read_only"] },
  { label: "Contacts", path: "/command-center/contacts", icon: UserCircle, roles: ["admin", "business_development", "clinical"] },
  { label: "Tasks", path: "/command-center/tasks", icon: ListChecks, roles: ["admin", "business_development", "clinical", "finance"] },
  { label: "Regulatory Signals", path: "/command-center/signals", icon: Activity, roles: ["admin", "clinical", "read_only"] },
  { label: "AI Agents", path: "/command-center/agents", icon: Bot, roles: ["admin", "clinical", "business_development"] },
  { label: "Outreach", path: "/command-center/outreach", icon: Send, roles: ["admin", "business_development", "clinical"] },
  { label: "Proposals", path: "/command-center/proposals", icon: FileText, roles: ["admin", "business_development", "finance"] },
  { label: "Engagements", path: "/command-center/engagements", icon: ShieldCheck, roles: ["admin", "clinical", "finance", "read_only"] },
  { label: "Client Accounts", path: "/command-center/client-accounts", icon: Users, roles: ["admin"] },
  { label: "Recovery Studio", path: "/command-center/recovery", icon: Stethoscope, roles: ["admin", "clinical", "read_only"] },
  { label: "Regulatory Cases", path: "/command-center/cases", icon: ClipboardList, roles: ["admin", "clinical", "read_only"] },
  { label: "Knowledge Library", path: "/command-center/knowledge", icon: BookOpen, roles: ["admin", "clinical", "read_only"] },
  { label: "Launch Readiness", path: "/command-center/launch-readiness", icon: Rocket, roles: ["admin"] },
  { label: "Settings", path: "/command-center/settings", icon: Settings, roles: ["admin"] },
];

export default function CommandCenterLayout() {
  const { user, logout } = useAuth();
  const { showTestData, setShowTestData } = useTestData();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const role = user?.role || "user";
  const roleLabel = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const visibleNav = NAV.filter((n) => n.roles.includes(role));

  const handleLogout = () => {
    logout(false);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-secondary/40 flex">
      <a href="#cc-main-content" className="skip-link">Skip to main content</a>
      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[hsl(263_65%_14%)] text-slate-300 flex flex-col transition-transform",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
          <Link to="/command-center"><Logo onDark /></Link>
          <button className="lg:hidden text-slate-400" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {visibleNav.map((n) => {
            const active = location.pathname === n.path;
            return (
              <Link
                key={n.path}
                to={n.path}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <n.icon className="h-[18px] w-[18px]" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.email}</p>
              <p className="text-xs text-slate-400">{roleLabel}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-card border-b border-border flex items-center justify-between px-5 lg:px-8 sticky top-0 z-20 safe-area-top">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-foreground" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
            <div>
              <p className="text-xs text-muted-foreground">Clinical SOS Command Center</p>
              <h1 className="text-sm font-semibold text-foreground">Private · Internal Use Only</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="hidden sm:flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showTestData}
                onChange={(e) => setShowTestData(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Show Test Data
            </label>
            <ThemeToggle compact />
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary hidden sm:inline">View public site →</Link>
          </div>
        </header>
        <main id="cc-main-content" className="flex-1 p-5 lg:p-8 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}