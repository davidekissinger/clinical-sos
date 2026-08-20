import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Target, Activity, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { label: "Dashboard", path: "/command-center", icon: LayoutDashboard, roles: ["admin", "business_development", "clinical", "finance", "read_only"] },
  { label: "Leads", path: "/command-center/leads", icon: Target, roles: ["admin", "business_development", "clinical"] },
  { label: "Signals", path: "/command-center/signals", icon: Activity, roles: ["admin", "clinical", "read_only"] },
  { label: "Cases", path: "/command-center/cases", icon: ClipboardList, roles: ["admin", "clinical", "read_only"] },
];

export default function CommandCenterMobileNav({ role }) {
  const location = useLocation();
  const visible = MOBILE_NAV.filter(n => n.roles.includes(role));

  const isActive = (path) => {
    if (path === "/command-center") return location.pathname === "/command-center";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-card border-t border-border safe-area-bottom" aria-label="Command center mobile navigation">
      <div className="flex items-center justify-around">
        {visible.map(n => (
          <Link key={n.path} to={n.path} className={cn("flex flex-col items-center gap-0.5 py-2 px-3 text-xs min-h-[44px]", isActive(n.path) ? "text-primary" : "text-muted-foreground")}>
            <n.icon className="h-5 w-5" aria-hidden="true" />
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}