import React from "react";
import { LayoutDashboard, Target, Activity, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTabBackstack } from "@/hooks/useTabBackstack";

const MOBILE_NAV = [
  { label: "Dashboard", path: "/command-center", icon: LayoutDashboard, prefix: "/command-center", exact: true, roles: ["admin", "business_development", "clinical", "finance", "read_only"] },
  { label: "Leads", path: "/command-center/leads", icon: Target, prefix: "/command-center/leads", roles: ["admin", "business_development", "clinical"] },
  { label: "Signals", path: "/command-center/signals", icon: Activity, prefix: "/command-center/signals", roles: ["admin", "clinical", "read_only"] },
  { label: "Cases", path: "/command-center/cases", icon: ClipboardList, prefix: "/command-center/cases", roles: ["admin", "clinical", "read_only"] },
];

const STORAGE_KEY = "csos_cc_tab_backstack";

export default function CommandCenterMobileNav({ role }) {
  const visible = MOBILE_NAV.filter(n => n.roles.includes(role));
  const { isActive, handleTabClick } = useTabBackstack(visible, STORAGE_KEY);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white dark:bg-card border-t border-border safe-area-bottom" aria-label="Command center mobile navigation">
      <div className="flex items-center justify-around">
        {visible.map(n => (
          <button key={n.path} onClick={() => handleTabClick(n.path)} className={cn("flex flex-col items-center gap-0.5 py-2 px-3 text-xs min-h-[44px]", isActive(n) ? "text-primary" : "text-muted-foreground")}>
            <n.icon className="h-5 w-5" aria-hidden="true" />
            {n.label}
          </button>
        ))}
      </div>
    </nav>
  );
}