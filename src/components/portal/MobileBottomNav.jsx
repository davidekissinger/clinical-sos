import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Briefcase, ListChecks, UserCircle, MoreHorizontal, X, ClipboardList, ClipboardCheck, FileText, FolderCheck, ShieldCheck, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { label: "Home", path: "/client", icon: Home, prefix: "/client", exact: true },
  { label: "Engagements", path: "/client/engagements", icon: Briefcase, prefix: "/client/engagements" },
  { label: "Tasks", path: "/client/tasks", icon: ListChecks, prefix: "/client/tasks" },
  { label: "Account", path: "/client/account", icon: UserCircle, prefix: "/client/account" },
];

const SECONDARY = [
  { label: "Recovery", path: "/client/recovery", icon: ClipboardList },
  { label: "POCs", path: "/client/pocs", icon: ClipboardCheck },
  { label: "Work Products", path: "/client/work-products", icon: FileText },
  { label: "Evidence", path: "/client/evidence", icon: FolderCheck },
  { label: "Audits", path: "/client/audits", icon: ClipboardList },
  { label: "Readiness", path: "/client/readiness", icon: ShieldCheck },
  { label: "Documents", path: "/client/documents", icon: FolderOpen },
];

const STORAGE_KEY = "csos_tab_backstack";

function getBackStacks() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveBackStack(tabPath, pathname) {
  const stacks = getBackStacks();
  stacks[tabPath] = pathname;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stacks));
}

function clearBackStack(tabPath) {
  const stacks = getBackStacks();
  delete stacks[tabPath];
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stacks));
}

function getTabForPath(pathname) {
  for (const p of PRIMARY) {
    if (p.exact) {
      if (pathname === p.prefix) return p.path;
    } else if (pathname.startsWith(p.prefix)) {
      return p.path;
    }
  }
  return null;
}

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  // Persist the current route as the active tab's backstack entry
  useEffect(() => {
    const tabPath = getTabForPath(location.pathname);
    if (tabPath) saveBackStack(tabPath, location.pathname);
  }, [location.pathname]);

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.prefix;
    return location.pathname.startsWith(item.prefix);
  };

  const handleTabClick = (path) => {
    setMoreOpen(false);
    const item = PRIMARY.find(p => p.path === path);
    if (item && isActive(item)) {
      clearBackStack(path);
      navigate(path);
    } else {
      const stacks = getBackStacks();
      navigate(stacks[path] || path);
    }
  };

  const isMoreActive = SECONDARY.some(s => location.pathname.startsWith(s.path));

  return (
    <>
      {moreOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-[60px] left-0 right-0 z-50 md:hidden bg-white dark:bg-card border-t border-border rounded-t-2xl shadow-lg safe-area-bottom">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">More</span>
              <button onClick={() => setMoreOpen(false)} aria-label="Close more menu" className="text-muted-foreground p-1"><X className="h-4 w-4" /></button>
            </div>
            <nav className="grid grid-cols-3 gap-1 p-3" aria-label="More navigation">
              {SECONDARY.map(s => (
                <Link key={s.path} to={s.path} onClick={() => setMoreOpen(false)} className={cn("flex flex-col items-center gap-1 p-3 rounded-lg text-xs", location.pathname.startsWith(s.path) ? "bg-accent text-primary" : "text-muted-foreground")}>
                  <s.icon className="h-5 w-5" aria-hidden="true" />
                  {s.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-card border-t border-border safe-area-bottom" aria-label="Mobile bottom navigation">
        <div className="flex items-center justify-around">
          {PRIMARY.map(p => (
            <button key={p.path} onClick={() => handleTabClick(p.path)} className={cn("flex flex-col items-center gap-0.5 py-2 px-3 text-xs min-h-[44px]", isActive(p) ? "text-primary" : "text-muted-foreground")}>
              <p.icon className="h-5 w-5" aria-hidden="true" />
              {p.label}
            </button>
          ))}
          <button onClick={() => setMoreOpen(!moreOpen)} className={cn("flex flex-col items-center gap-0.5 py-2 px-3 text-xs min-h-[44px]", moreOpen || isMoreActive ? "text-primary" : "text-muted-foreground")} aria-expanded={moreOpen} aria-label="More options">
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}