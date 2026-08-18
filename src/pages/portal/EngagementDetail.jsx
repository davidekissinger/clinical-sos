import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, ClipboardList, FileText, ClipboardCheck, FolderCheck, ListChecks, ShieldCheck, AlertTriangle } from "lucide-react";

export default function ClientEngagementDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await base44.functions.invoke("getClientPortalDetail", { resource: "engagement", id });
        setData(res.data || res);
      } catch (e) { console.error(e); setDenied(true); }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;
  if (denied || !data) return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
      <p className="font-medium text-foreground">Access Denied</p>
      <p className="mt-1 text-sm text-muted-foreground">This engagement is not available or you are not authorized to view it.</p>
      <Link to="/client/engagements" className="mt-4 inline-block text-primary hover:underline text-sm">← Back to Engagements</Link>
    </div>
  );

  const engagement = data.engagement;
  const cases = data.cases || [];
  const deficiencies = data.deficiencies || [];
  const pocs = data.pocs || [];
  const workProducts = data.work_products || [];
  const evidence = data.evidence || [];
  const tasks = data.tasks || [];
  const audits = data.audits || [];
  const readiness = data.readiness || [];

  return (
    <div>
      <Link to="/client/engagements" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Engagements</Link>
      <h1 className="text-2xl font-bold text-foreground">{engagement?.engagement_name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{engagement?.service_type || "Consulting"} · {engagement?.status} · {engagement?.phase || "—"}</p>

      <div className="mt-6 space-y-6">
        <Section title="Regulatory Cases" icon={ClipboardList} items={cases.map(c => ({ id: c.id, title: c.case_name, sub: c.case_status, link: `/client/cases/${c.id}` }))} />
        <Section title="Deficiencies" icon={AlertTriangle} items={deficiencies.map(d => ({ id: d.id, title: `${d.f_tag} — ${d.deficiency_title || "Untitled"}`, sub: d.deficiency_status, link: `/client/deficiencies/${d.id}` }))} />
        <Section title="Plans of Correction" icon={ClipboardCheck} items={pocs.map(p => ({ id: p.id, title: `${p.f_tag} — v${p.version}`, sub: p.status, link: `/client/pocs` }))} />
        <Section title="Work Products" icon={FileText} items={workProducts.map(w => ({ id: w.id, title: w.document_type, sub: w.document_status, link: `/client/work-products` }))} />
        <Section title="Evidence Requests" icon={FolderCheck} items={evidence.map(e => ({ id: e.id, title: e.evidence_type, sub: e.review_status, link: `/client/evidence` }))} />
        <Section title="Tasks" icon={ListChecks} items={tasks.map(t => ({ id: t.id, title: t.task, sub: t.status, link: `/client/tasks` }))} />
        <Section title="Audits" icon={ClipboardList} items={audits.map(a => ({ id: a.id, title: a.plain_language_regulatory_focus || a.f_tag, sub: a.audit_result, link: `/client/audits` }))} />
        <Section title="Readiness Criteria" icon={ShieldCheck} items={readiness.map(r => ({ id: r.id, title: r.criterion_label, sub: r.is_met ? "Met" : "Unmet", link: `/client/readiness` }))} />
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, items }) {
  return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
      <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> {title}</h2>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No records available.</p> : (
        <div className="space-y-2">
          {items.map(item => (
            <Link key={item.id} to={item.link} className="block p-3 rounded-lg border border-border hover:border-primary transition">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-foreground">{item.title}</p><p className="text-xs text-muted-foreground">{item.sub}</p></div>
                <span className="text-primary text-sm">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}