import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);

  const activeIndex = OPTIONS.findIndex((o) => o.value === theme);
  const [focusedIndex, setFocusedIndex] = useState(activeIndex >= 0 ? activeIndex : 2);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target) &&
          menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Move focus into menu when opened
  useEffect(() => {
    if (!open) return;
    setFocusedIndex(activeIndex >= 0 ? activeIndex : 2);
    const timer = setTimeout(() => {
      itemRefs.current[focusedIndex]?.focus();
    }, 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleButtonKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleItemKeyDown = (e, index) => {
    e.preventDefault();
    switch (e.key) {
      case "ArrowDown":
        setFocusedIndex((index + 1) % OPTIONS.length);
        itemRefs.current[(index + 1) % OPTIONS.length]?.focus();
        break;
      case "ArrowUp":
        setFocusedIndex((index - 1 + OPTIONS.length) % OPTIONS.length);
        itemRefs.current[(index - 1 + OPTIONS.length) % OPTIONS.length]?.focus();
        break;
      case "Home":
        setFocusedIndex(0);
        itemRefs.current[0]?.focus();
        break;
      case "End":
        setFocusedIndex(OPTIONS.length - 1);
        itemRefs.current[OPTIONS.length - 1]?.focus();
        break;
      case "Enter":
      case " ":
        selectOption(OPTIONS[index].value);
        break;
      case "Escape":
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const selectOption = (value) => {
    setTheme(value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const active = OPTIONS.find((o) => o.value === theme) || OPTIONS[2];
  const ActiveIcon = active.icon;

  if (compact) {
    return (
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => setOpen(!open)}
          onKeyDown={handleButtonKeyDown}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition min-h-[44px] min-w-[44px]"
          title={`Appearance: ${active.label}`}
          aria-label={`Appearance: ${active.label}. Press to change theme.`}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <ActiveIcon className="h-4 w-4" aria-hidden="true" />
        </button>
        {open && (
          <div
            ref={menuRef}
            className="absolute right-0 mt-2 w-44 bg-white dark:bg-card border border-border rounded-xl shadow-lg py-1.5 z-50"
            role="menu"
            aria-label="Appearance options"
          >
            {OPTIONS.map((o, i) => {
              const Icon = o.icon;
              const isActive = theme === o.value;
              return (
                <button
                  key={o.value}
                  ref={(el) => (itemRefs.current[i] = el)}
                  role="menuitemradio"
                  aria-checked={isActive}
                  aria-label={`Use ${o.label.toLowerCase()} mode`}
                  tabIndex={-1}
                  onKeyDown={(e) => handleItemKeyDown(e, i)}
                  onClick={() => selectOption(o.value)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm transition min-h-[44px]",
                    isActive ? "text-primary font-medium bg-accent/50" : "text-foreground hover:bg-secondary/60"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {o.label}
                  {isActive && <Check className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />}
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
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition min-h-[44px]",
              isActive
                ? "border-primary bg-accent/40 text-primary"
                : "border-border bg-white dark:bg-card text-muted-foreground hover:border-primary/40"
            )}
            aria-pressed={isActive}
            aria-label={`Use ${o.label.toLowerCase()} mode`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-medium">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}