import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, ClipboardList, FileText, ClipboardCheck, FolderCheck, ShieldCheck, ListChecks } from "lucide-react";

export default function ClientEngagementDetail() {
  const { id } = useParams();
  const { entitlement } = useOutletContext();
  const [engagement, setEngagement] = useState(null);
  const [cases, setCases] = useState([]);
  const [deficiencies, setDeficiencies] = useState([]);
  const [pocs, setPocs] = useState([]);
  const [workProducts, setWorkProducts] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const eng = await base44.entities.Engagement.get(id);
        if (!eng || !eng.client_visibility || !entitlement?.engagement_ids?.includes(id)) {
          setDenied(true); setLoading(false); return;
        }
        setEngagement(eng);
        const [caseRes, defRes, pocRes, wpRes, evRes, taskRes] = await Promise.all([
          base44.entities.RegulatoryCase.list("-created_date", 200),
          base44.entities.Deficiency.list("-created_date", 200),
          base44.entities.POC.list("-created_date", 200),
          base44.entities.WorkProduct.list("-created_date", 200),
          base44.entities.EvidenceItem.list("-created_date", 200),
          base44.entities.Task.list("-due_date", 100),
        ]);
        const flt = (r) => Array.isArray(r) ? r : (r?.data || []);
        setCases(flt(caseRes).filter(c => c.client_visibility && c.engagement_id === id));
        setDeficiencies(flt(defRes).filter(d => d.client_visibility));
        setPocs(flt(pocRes).filter(p => p.client_visibility && p.status !== "AI Draft" && p.status !== "Clinical Review"));
        setWorkProducts(flt(wpRes).filter(w => w.client_visibility && w.document_status !== "DRAFT" && w.document_status !== "CLINICAL REVIEW"));
        setEvidence(flt(evRes).filter(e => e.client_visibility));
        setTasks(flt(taskRes).filter(t => t.client_visibility && t.linked_engagement_id === id));
      } catch (e) { console.error(e); setDenied(true); }
      finally { setLoading(false); }
    }
    load();
  }, [id, entitlement]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-accent border-t-primary rounded-full animate-spin" /></div>;
  if (denied) return (
    <div className="bg-white dark:bg-card rounded-xl border border-border p-12 text-center">
      <p className="font-medium text-foreground">Access Denied</p>
      <p className="mt-1 text-sm text-muted-foreground">This engagement is not available or you are not authorized to view it.</p>
      <Link to="/client/engagements" className="mt-4 inline-block text-primary hover:underline text-sm">← Back to Engagements</Link>
    </div>
  );

  return (
    <div>
      <Link to="/client/engagements" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-4"><ArrowLeft className="h-4 w-4" /> Back to Engagements</Link>
      <h1 className="text-2xl font-bold text-foreground">{engagement?.engagement_name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{engagement?.service_type || "Consulting"} · {engagement?.status} · {engagement?.phase || "—"}</p>

      <div className="mt-6 space-y-6">
        <Section title="Regulatory Cases" icon={ClipboardList} items={cases.map(c => ({ id: c.id, title: c.case_name, sub: c.case_status, link: `/client/cases/${c.id}` }))} />
        <Section title="Plans of Correction" icon={ClipboardCheck} items={pocs.map(p => ({ id: p.id, title: `${p.f_tag} — v${p.version}`, sub: p.status, link: `/client/pocs` }))} />
        <Section title="Work Products" icon={FileText} items={workProducts.map(w => ({ id: w.id, title: w.document_type, sub: w.document_status, link: `/client/work-products` }))} />
        <Section title="Evidence Requests" icon={FolderCheck} items={evidence.map(e => ({ id: e.id, title: e.evidence_type, sub: e.review_status, link: `/client/evidence` }))} />
        <Section title="Tasks" icon={ListChecks} items={tasks.map(t => ({ id: t.id, title: t.task, sub: t.status, link: `/client/tasks` }))} />
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