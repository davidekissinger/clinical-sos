import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function ClientTasks() {
  const { entitlement } = useOutletContext();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState(null);
  const [submitting, setSubmitting] = useState(null);

  const loadTasks = async () => {
    try {
      const res = await base44.functions.invoke("getClientPortalData", { resource: "tasks" });
      setTasks(Array.isArray(res) ? res : (res?.data || []));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTasks(); }, []);

  const updateTask = async (task, newStatus) => {
    if (!entitlement?.effective_capabilities?.can_complete_tasks) {
      setActionResult({ error: "You do not have permission to complete tasks." });
      return;
    }
    setSubmitting(task.id);
    try {
      await base44.functions.invoke("clientUpdateTask", { task_id: task.id, status: newStatus });
      setActionResult({ success: "Task updated." });
      await loadTasks();
    } catch (e) { setActionResult({ error: e.message || "Failed to update task" }); }
    finally { setSubmitting(null); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Tasks</h1>
      {actionResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${actionResult.error ? "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400" : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"}`} role="status">{actionResult.error || actionResult.success}</div>
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
                  {task.client_completed_by && <p className="text-xs text-muted-foreground mt-1">Completed by: {task.client_completed_by}</p>}
                </div>
                {entitlement?.effective_capabilities?.can_complete_tasks && task.status !== "Complete" && (
                  <div className="flex gap-2">
                    {task.status === "Not Started" && <button onClick={() => updateTask(task, "In Progress")} disabled={submitting === task.id} className="btn-secondary text-xs disabled:opacity-60">Start</button>}
                    <button onClick={() => updateTask(task, "Complete")} disabled={submitting === task.id} className="btn-primary text-xs disabled:opacity-60">Complete</button>
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