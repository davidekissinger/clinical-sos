import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Badge, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";

const COLUMNS = [
  { key: "Not Started", tone: "default" },
  { key: "In Progress", tone: "blue" },
  { key: "Blocked", tone: "amber" },
  { key: "Complete", tone: "green" },
];

export default function Tasks() {
  const tasks = useEntities("Task", { sort: "-due_date", limit: 200, excludeTestData: true });
  const [updating, setUpdating] = useState(null);

  if (tasks.loading) return <LoadingState />;

  const move = async (task, status) => {
    setUpdating(task.id);
    try { await base44.entities.Task.update(task.id, { status }); tasks.reload(); }
    finally { setUpdating(null); }
  };

  return (
    <div>
      <PageHeader title="Task Tracker" subtitle="Workstream deliverables, owners, and due dates" />
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = tasks.data.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="bg-secondary/40 rounded-xl border border-border">
              <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{col.key}</span>
                <Badge tone={col.tone}>{items.length}</Badge>
              </div>
              <div className="p-2 space-y-2 min-h-[80px]">
                {items.map((t) => (
                  <div key={t.id} className="bg-white dark:bg-card rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground leading-snug">{t.task}</p>
                      <Badge tone={t.priority === "Urgent" ? "red" : t.priority === "High" ? "amber" : "default"}>{t.priority}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{t.workstream} · {t.owner_name || "Unassigned"}</p>
                    {t.due_date && (
                      <p className={`mt-1 text-xs ${new Date(t.due_date) < new Date() && t.status !== "Complete" ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
                        Due {t.due_date}
                      </p>
                    )}
                    {col.key !== "Complete" && (
                      <select
                        value={t.status}
                        disabled={updating === t.id}
                        onChange={(e) => move(t, e.target.value)}
                        className="mt-2 w-full text-xs border border-border rounded-md px-2 py-1 bg-white dark:bg-card text-foreground"
                      >
                        {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No tasks</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}