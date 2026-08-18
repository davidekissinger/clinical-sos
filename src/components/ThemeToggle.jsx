import React, { useState, useRef, useEffect } from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = OPTIONS.find((o) => o.value === theme) || OPTIONS[2];
  const ActiveIcon = active.icon;

  if (compact) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
          title={`Appearance: ${active.label}`}
          aria-label={`Appearance: ${active.label}`}
        >
          <ActiveIcon className="h-4 w-4" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-card border border-border rounded-xl shadow-lg py-1.5 z-50">
            {OPTIONS.map((o) => {
              const Icon = o.icon;
              const isActive = theme === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => { setTheme(o.value); setOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm transition",
                    isActive ? "text-primary font-medium bg-accent/50" : "text-foreground hover:bg-secondary/60"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {o.label}
                  {isActive && <Check className="h-3.5 w-3.5 ml-auto" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const isActive = theme === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setTheme(o.value)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition",
              isActive
                ? "border-primary bg-accent/40 text-primary"
                : "border-border bg-white dark:bg-card text-muted-foreground hover:border-primary/40"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-sm font-medium">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}