import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, ChevronDown } from "lucide-react";

/**
 * MobileSelect — renders a native <select> on desktop and a bottom-sheet
 * picker on mobile viewports (<= 768px). Accepts the same value/onChange
 * interface as a standard select.
 */
export default function MobileSelect({ value, onChange, options, className = "", ariaLabel, placeholder, disabled }) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const normalized = (options || []).map(o =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  const selected = normalized.find(o => o.value === value);

  if (!isMobile) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={className} aria-label={ariaLabel} disabled={disabled}>
        {normalized.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        className={`${className} text-left flex items-center justify-between`}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span>{selected?.label || placeholder || "Select…"}</span>
        <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2 opacity-50" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-card rounded-t-2xl border-t border-border shadow-lg safe-area-bottom max-h-[60vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="sticky top-0 bg-white dark:bg-card border-b border-border px-4 py-3 flex items-center justify-between rounded-t-2xl">
                <span className="text-sm font-semibold text-foreground">{ariaLabel || "Select an option"}</span>
                <button onClick={() => setOpen(false)} aria-label="Close selector" className="text-muted-foreground p-1">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="divide-y divide-border">
                {normalized.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); }}
                    className={`w-full text-left px-4 py-3.5 text-sm flex items-center justify-between ${o.value === value ? "text-primary font-medium bg-accent/50" : "text-foreground"}`}
                  >
                    {o.label}
                    {o.value === value && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}