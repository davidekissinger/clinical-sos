import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, AlertTriangle, FileSearch, ClipboardCheck, Scale, TrendingUp, Building2, Lock, Eye, CheckCircle2 } from "lucide-react";
import { PageHero } from "@/components/PageCta";
import PageCta from "@/components/PageCta";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const BENEFITS = [
  { icon: AlertTriangle, title: "Identify Vendor-Related Risks", desc: "Surface compliance, operational, and clinical risks created or amplified by vendor relationships." },
  { icon: TrendingUp, title: "Evaluate Performance", desc: "Assess vendor performance against defined, measurable expectations — not impressions." },
  { icon: CheckCircle2, title: "Verify Qualifications", desc: "Confirm licenses, insurance, certifications, and supporting evidence through source review." },
  { icon: ShieldCheck, title: "Protect Resident Safety", desc: "Connect vendor performance to resident safety outcomes and regulatory exposure." },
  { icon: ClipboardCheck, title: "Corrective Action", desc: "Establish measurable corrective-action requirements with monitoring and follow-up." },
  { icon: Scale, title: "Compare Vendors", desc: "Compare vendors using consistent criteria, not materially different standards." },
];

const EVALUATION_DOMAINS = [
  { title: "Corporate & Credentialing", desc: "Legal business status, licensure, certification, accreditation, insurance, exclusion screening, ownership disclosure." },
  { title: "Regulatory & Compliance", desc: "Regulatory history, compliance-program maturity, survey relevance, sanctions, required policies, incident reporting." },
  { title: "Clinical Quality & Resident Safety", desc: "Clinical qualifications, outcomes, resident-safety practices, infection prevention, medication management, escalation." },
  { title: "Staffing & Competency", desc: "Staffing capacity, background checks, orientation, education, competency validation, turnover, coverage reliability." },
  { title: "Service Performance", desc: "Timeliness, responsiveness, accuracy, availability, service interruptions, complaint frequency, resolution time." },
  { title: "Data Privacy & Security", desc: "HIPAA applicability, BAA status, data accessed, minimum-necessary controls, cybersecurity, encryption, breach notification." },
  { title: "Business Continuity", desc: "Emergency-preparedness capability, backup staffing, disaster recovery, technology redundancy, supply continuity." },
  { title: "Financial & Commercial Fit", desc: "Pricing transparency, rate structure, additional fees, billing accuracy, financial stability, value relative to service." },
  { title: "Contract & SLA Terms", desc: "Scope clarity, measurable deliverables, performance standards, renewal terms, termination rights, audit rights, service credits." },
  { title: "Implementation & Integration", desc: "Implementation plan, training, workflow compatibility, technology integration, data migration, change management." },
  { title: "Reporting & QAPI Support", desc: "Performance data availability, report accuracy, trend reporting, corrective-action reporting, facility QAPI participation." },
  { title: "References & Reputation", desc: "Verified references, relevant experience, similar clients, documented complaints, public enforcement information." },
];

const EVALUATION_TYPES = [
  "Pre-contract vendor due diligence",
  "Competitive vendor comparison",
  "New-vendor implementation readiness",
  "Existing-vendor performance review",
  "Contract-renewal evaluation",
  "Service-level agreement review",
  "Corrective-action evaluation",
  "Incident-triggered vendor review",
  "Regulatory-case-related vendor review",
  "Routine annual vendor evaluation",
  "Organization-wide vendor portfolio review",
];

const PROCESS_STEPS = [
  { icon: FileSearch, label: "Vendor Need", desc: "Define the service need, vendor category, and evaluation scope." },
  { icon: ShieldCheck, label: "Due Diligence", desc: "Verify qualifications, licensing, insurance, accreditation, and regulatory history through source review." },
  { icon: Eye, label: "Evidence Collection", desc: "Request and review supporting evidence with source provenance and last-verification dates." },
  { icon: Scale, label: "Evaluation & Scoring", desc: "Score vendor performance against configurable, weighted criteria across all evaluation domains." },
  { icon: AlertTriangle, label: "Risk Identification", desc: "Identify critical risk flags that require attention regardless of overall score." },
  { icon: ClipboardCheck, label: "Decision & Conditions", desc: "Support contract-renewal, replacement, or corrective-action decisions with documented rationale." },
  { icon: TrendingUp, label: "Monitoring", desc: "Monitor performance against expectations with follow-up reviews and QAPI oversight." },
];

export default function VendorEvaluation() {
  useDocumentMeta(
    "Vendor Performance & Risk Evaluation — Clinical SOS",
    "Structured, evidence-based evaluations of prospective and existing vendors serving skilled nursing and long-term care organizations. Verify qualifications, assess performance, and manage vendor risk."
  );
  return (
    <div>
      <section className="bg-[hsl(263_65%_14%)] text-white">
        <div className="container-prose py-20 md:py-24">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-[hsl(258_70%_80%)]" /> Vendor Governance
          </div>
          <h1 className="mt-5 text-4xl md:text-5xl font-bold leading-[1.1]">Vendor Performance & Risk Evaluation</h1>
          <p className="mt-5 text-lg text-slate-300 max-w-2xl leading-relaxed">
            Know whether the partners supporting your facility are reducing risk—or adding to it.
            Clinical SOS provides structured, evidence-based evaluations of prospective and existing vendors
            serving skilled nursing and long-term care organizations.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/contact" className="btn-primary">Request a Vendor Evaluation <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/contact" className="btn-secondary !bg-white/10 !border-white/20 !text-white hover:!bg-white/20">Talk With Our Team</Link>
          </div>
          <p className="mt-4 text-xs text-slate-300 max-w-xl">
            ClinicalSOS vendor evaluations are operational and compliance-oriented. They do not replace
            review by qualified legal counsel and do not constitute a legal opinion, financial audit,
            cybersecurity certification, or guarantee of vendor performance.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container-prose">
          <p className="section-eyebrow">Service Benefits</p>
          <h2 className="mt-3 text-3xl font-bold">Evidence-based vendor decisions, not impressions</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Our evaluations help leadership make better-supported decisions about vendor selection, continued use,
            corrective action, monitoring, and contract renewal.
          </p>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="card-elevated p-6">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-[hsl(262_50%_45%)]">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/60">
        <div className="container-prose">
          <p className="section-eyebrow">Evaluation Domains</p>
          <h2 className="mt-3 text-3xl font-bold">Comprehensive criteria across twelve domains</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl">
            Each evaluation examines vendor performance across configurable domains with administrator-defined
            weights. We do not use a hidden or unexplained AI score.
          </p>
          <div className="mt-10 grid md:grid-cols-2 gap-4">
            {EVALUATION_DOMAINS.map((d, i) => (
              <div key={d.title} className="card-elevated p-5">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-[hsl(262_50%_45%)] mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="font-semibold text-sm">{d.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container-prose">
          <p className="section-eyebrow">Evaluation Types</p>
          <h2 className="mt-3 text-3xl font-bold">Supporting every stage of the vendor lifecycle</h2>
          <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {EVALUATION_TYPES.map((t) => (
              <div key={t} className="card-elevated p-4 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-[hsl(262_50%_45%)] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/60">
        <div className="container-prose">
          <p className="section-eyebrow">The Process</p>
          <h2 className="mt-3 text-3xl font-bold">A traceable vendor-governance chain</h2>
          <div className="mt-10 grid md:grid-cols-4 lg:grid-cols-7 gap-4">
            {PROCESS_STEPS.map((s, i) => (
              <div key={s.label} className="card-elevated p-5">
                <span className="text-xs font-semibold text-[hsl(262_50%_45%)]">0{i + 1}</span>
                <s.icon className="mt-2 h-6 w-6 text-[hsl(262_50%_45%)]" />
                <h3 className="mt-3 font-semibold text-sm leading-snug">{s.label}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground max-w-2xl">
            We clearly distinguish verified fact, client-reported concerns, vendor-reported information,
            public-source information, AI-generated draft analysis, and reviewer conclusions. We never create
            defamatory or unsupported statements about a vendor.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container-prose">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="section-eyebrow">Risk & Scoring</p>
              <h2 className="mt-3 text-3xl font-bold">Transparent scoring with critical-failure overrides</h2>
              <p className="mt-4 text-muted-foreground">
                Each evaluation produces a 0–100 vendor performance score with domain-level breakdowns.
                Critical failures — such as missing licenses, unverified insurance, exclusion concerns, or
                missing BAAs — are flagged separately and remain visible even when the total score is otherwise favorable.
              </p>
              <p className="mt-4 text-muted-foreground">
                A numerical score never automatically creates a final recommendation. Material missing evidence
                displays <strong>INSUFFICIENT EVIDENCE</strong> and prevents a favorable recommendation from concealing
                missing critical documentation.
              </p>
            </div>
            <div className="card-elevated p-6">
              <h3 className="font-semibold mb-4">Risk Levels</h3>
              <div className="space-y-2">
                {["Low", "Moderate", "High", "Critical", "Unknown / Insufficient Evidence"].map((r) => (
                  <div key={r} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${r === "Low" ? "bg-emerald-500" : r === "Moderate" ? "bg-amber-500" : r === "High" ? "bg-orange-500" : r === "Critical" ? "bg-rose-500" : "bg-slate-400"}`} />
                    <span className="text-sm text-foreground">{r}</span>
                  </div>
                ))}
              </div>
              <h3 className="font-semibold mt-6 mb-4">Recommendations</h3>
              <div className="space-y-1.5">
                {["Recommended", "Recommended With Conditions", "Continue With Monitoring", "Performance Improvement Required", "Renewal Review Required", "Replacement Should Be Considered", "Not Recommended", "Insufficient Evidence"].map((r) => (
                  <p key={r} className="text-xs text-muted-foreground">{r}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PageCta title="Need to evaluate a vendor?" subtitle="Request a vendor evaluation and share your scope. We'll help you make an evidence-based decision." />
    </div>
  );
}