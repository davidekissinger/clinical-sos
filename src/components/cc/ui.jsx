import React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, tone = "default" }) {
  const tones = {
    default: "text-[hsl(262_50%_45%)] bg-accent",
    green: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-rose-600 bg-rose-50",
    blue: "text-blue-600 bg-blue-50",
  };
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        {Icon && <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", tones[tone])}><Icon className="h-4 w-4" /></div>}
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Badge({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    purple: "bg-accent text-[hsl(262_50%_40%)] dark:text-[hsl(258_50%_80%)]",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    red: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  };
  return <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Table({ headers, children }) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>{headers.map((h) => <th key={h} className="text-left font-medium px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-accent border-t-[hsl(262_50%_45%)] rounded-full animate-spin" />
    </div>
  );
}