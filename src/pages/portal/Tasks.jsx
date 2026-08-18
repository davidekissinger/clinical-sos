import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ClientTasks() {
  const { entitlement } = useOutletContext();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.entities.Task.list("-due_date", 100);
        const list = Array.isArray(res) ? res : (res?.data || []);
        setTasks(list.filter(t => t.client_visibility));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const updateTask = async (task, newStatus) => {
    if (!entitlement?.effective_capabilities?.can_complete_tasks) {
      setActionResult({ error: "You do not have permission to complete tasks." });
      return;
    }
    try {
      await base44.entities.Task.update(task.id, { status: newStatus });
      setActionResult({ success: "Task updated." });
      const res = await base44.entities.Task.list("-due_date", 100);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setTasks(list.filter(t => t.client_visibility));
    } catch (e) { setActionResult({ error: e.message }); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Tasks</h1>
      {actionResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${actionResult.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`} role="status">{actionResult.error || actionResult.success}</div>
      )}
      {tasks.length === 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No tasks</p>
          <p className="mt-1 text-sm text-muted-foreground">Client tasks will appear here when published.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="bg-white dark:bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{task.task}</p>
                  <p className="text-xs text-muted-foreground">{task.status} · Due: {task.due_date || "—"}</p>
                </div>
                {entitlement?.effective_capabilities?.can_complete_tasks && task.status !== "Complete" && (
                  <div className="flex gap-2">
                    {task.status === "Not Started" && <button onClick={() => updateTask(task, "In Progress")} className="btn-secondary text-xs">Start</button>}
                    <button onClick={() => updateTask(task, "Complete")} className="btn-primary text-xs">Complete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}