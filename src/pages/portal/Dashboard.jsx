import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Briefcase, ClipboardList, ClipboardCheck, FileText, FolderCheck, ListChecks, ShieldCheck, AlertTriangle } from "lucide-react";

export default function ClientDashboard() {
  const { entitlement } = useOutletContext();
  const [engagements, setEngagements] = useState([]);
  const [cases, setCases] = useState([]);
  const [deficiencies, setDeficiencies] = useState([]);
  const [pocs, setPocs] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!entitlement?.engagement_ids?.length) { setLoading(false); return; }
      try {
        const engIds = entitlement.engagement_ids;
        const [engRes, caseRes, defRes, pocRes, evRes, taskRes] = await Promise.all([
          base44.entities.Engagement.list("-created_date", 100),
          base44.entities.RegulatoryCase.list("-created_date", 100),
          base44.entities.Deficiency.list("-created_date", 200),
          base44.entities.POC.list("-created_date", 200),
          base44.entities.EvidenceItem.list("-created_date", 200),
          base44.entities.Task.list("-due_date", 100),
        ]);
        const engList = Array.isArray(engRes) ? engRes : (engRes?.data || []);
        setEngagements(engList.filter(e => engIds.includes(e.id)));
        const caseList = Array.isArray(caseRes) ? caseRes : (caseRes?.data || []);
        setCases(caseList.filter(c => c.client_visibility && (c.engagement_id && engIds.includes(c.engagement_id))));
        const defList = Array.isArray(defRes) ? defRes : (defRes?.data || []);
        setDeficiencies(defList.filter(d => d.client_visibility));
        const pocList = Array.isArray(pocRes) ? pocRes : (pocRes?.data || []);
        setPocs(pocList.filter(p => p.client_visibility && p.status !== "AI Draft" && p.status !== "Clinical Review"));
        const evList = Array.isArray(evRes) ? evRes : (evRes?.data || []);
        setEvidence(evList.filter(e => e.client_visibility));
        const taskList = Array.isArray(taskRes) ? taskRes : (taskRes?.data || []);
        setTasks(taskList.filter(t => t.client_visibility));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    loadData();
  }, [entitlement]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;

  const activeCases = cases.filter(c => c.case_status !== "Closed");
  const openDeficiencies = deficiencies.filter(d => d.deficiency_status !== "Closed");
  const pocsInReview = pocs.filter(p => p.status === "Client Review");
  const approvedPocs = pocs.filter(p => p.status === "Approved for Use" || p.status === "Submitted" || p.status === "Accepted");
  const openEvidence = evidence.filter(e => e.review_status === "Required" || e.review_status === "Requested" || e.review_status === "Insufficient");
  const openTasks = tasks.filter(t => t.status !== "Complete");

  const stats = [
    { label: "Active Engagements", value: engagements.length, icon: Briefcase },
    { label: "Active Regulatory Cases", value: activeCases.length, icon: ClipboardList },
    { label: "Open Deficiencies", value: openDeficiencies.length, icon: AlertTriangle },
    { label: "POCs in Client Review", value: pocsInReview.length, icon: ClipboardCheck },
    { label: "Approved POCs", value: approvedPocs.length, icon: ClipboardCheck },
    { label: "Open Evidence Requests", value: openEvidence.length, icon: FolderCheck },
    { label: "Tasks Due", value: openTasks.length, icon: ListChecks },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Welcome, {entitlement?.account_name || "Client"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your engagement overview and regulatory recovery status.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white dark:bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {engagements.length > 0 ? (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
          <h2 className="font-semibold text-foreground mb-4">Your Engagements</h2>
          <div className="space-y-3">
            {engagements.map(eng => (
              <Link key={eng.id} to={`/client/engagements/${eng.id}`} className="block p-4 rounded-lg border border-border hover:border-primary transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{eng.engagement_name}</p>
                    <p className="text-sm text-muted-foreground">{eng.service_type || "Consulting"} · {eng.status}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{eng.phase || "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
          <p className="font-medium text-foreground">No engagements available</p>
          <p className="mt-1 text-sm text-muted-foreground">Your authorized engagements will appear here once published.</p>
        </div>
      )}
    </div>
  );
}