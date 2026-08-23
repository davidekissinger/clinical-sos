import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, AlertTriangle, ClipboardCheck, Search, FileCheck, Wrench, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/PageCta";
import PageCta from "@/components/PageCta";

const RECOVERY_STEPS = [
  { icon: Search, label: "Rapid Assessment", desc: "Quickly understand the findings, the operational context, and the highest-risk issues." },
  { icon: ClipboardCheck, label: "Root Cause Analysis", desc: "Identify the underlying causes behind the deficiencies rather than treating symptoms." },
  { icon: FileCheck, label: "Plan of Correction", desc: "Develop a credible, defensible Plan of Correction aligned with clinical and operational reality." },
  { icon: Wrench, label: "Implementation Guidance", desc: "Practical guidance to put corrective actions into effect consistently across the organization." },
  { icon: ShieldCheck, label: "Survey Preparation", desc: "Prepare for follow-up survey activity with focus and confidence." },
];

const SITUATIONS = [
  "Survey deficiencies requiring a Plan of Correction",
  "Immediate Jeopardy findings",
  "Civil Monetary Penalties (CMP) or enforcement activity",
  "DPNA or other enforcement actions",
  "Follow-up or re-survey preparation",
  "Urgent operational stabilization",
];

export default function RapidSurveyRecovery() {
  return (
    <div>
      <section className="bg-[hsl(263_65%_14%)] text-white">
        <div className="container-prose py-20 md:py-24">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(258_70%_80%)]" /> Founding Survey Recovery Sprint
          </div>
          <h1 className="mt-5 text-4xl md:text-5xl font-bold leading-[1.1]">Rapid Survey Recovery</h1>
          <p className="mt-5 text-lg text-slate-300 max-w-2xl leading-relaxed">
            Structured, experienced support for skilled nursing facilities facing survey deficiencies,
            Plans of Correction, Immediate Jeopardy, CMP/enforcement activity, and follow-up surveys.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/contact" className="btn-primary">Request a Consultation <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/contact" className="btn-secondary !bg-white/10 !border-white/20 !text-white hover:!bg-white/20">Talk With Our Team</Link>
          </div>
          <p className="mt-4 text-xs text-slate-300 max-w-xl">
            Typical Rapid Survey Recovery engagements are often in the range of two to six weeks
            depending on circumstances.
          </p>
          <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-5 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(258_70%_80%)]">Founding Survey Recovery Sprint</p>
            <p className="mt-2 text-sm text-slate-200">
              One CMS-2567 survey • Up to five citations • First complete working draft targeted within
              five business days after receipt of complete materials.
            </p>
            <p className="mt-3 text-sm text-slate-300">
              <span className="font-semibold text-white">Founding engagement fee: $3,500</span> — 50% at authorization, 50% at delivery of the first complete draft.
              Up to three founding engagements during validation.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Expanded citation counts, Immediate Jeopardy, emergency response, onsite work, legal advice,
              enterprise remediation and other material scope expansions require separate written scope and pricing.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Clinical SOS does not guarantee POC acceptance, successful revisit, deficiency removal, regulatory
              compliance, enforcement relief, or any specific clinical or regulatory result. The client remains
              responsible for factual accuracy, implementation, submission, monitoring, and final operational decisions.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container-prose">
          <p className="section-eyebrow">When This Applies</p>
          <h2 className="mt-3 text-3xl font-bold">Is your facility in one of these situations?</h2>
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            {SITUATIONS.map((s) => (
              <div key={s} className="card-elevated p-5 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-[hsl(262_50%_45%)] flex-shrink-0 mt-0.5" />
                <span className="text-foreground">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/60">
        <div className="container-prose">
          <p className="section-eyebrow">The Process</p>
          <h2 className="mt-3 text-3xl font-bold">Rapid Assessment → Root Cause → POC → Implementation → Preparation</h2>
          <div className="mt-10 grid md:grid-cols-5 gap-4">
            {RECOVERY_STEPS.map((s, i) => (
              <div key={s.label} className="card-elevated p-5">
                <span className="text-xs font-semibold text-[hsl(262_50%_45%)]">0{i + 1}</span>
                <s.icon className="mt-2 h-6 w-6 text-[hsl(262_50%_45%)]" />
                <h3 className="mt-3 font-semibold text-sm leading-snug">{s.label}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground max-w-2xl">
            Clinical SOS does not promise regulatory outcomes or imply that any Plan of Correction will
            be accepted. Regulatory decisions rest with the appropriate authorities. We help
            organizations prepare and respond credibly.
          </p>
        </div>
      </section>

      <PageCta title="Facing survey pressure right now?" subtitle="Request a consultation and select your urgency level. We'll respond accordingly." />
    </div>
  );
}