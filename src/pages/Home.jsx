import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Phone, ShieldCheck, Clock, Stethoscope, AlertTriangle, ClipboardCheck, SearchCheck, Activity, FileText, Users, HelpCircle } from "lucide-react";
import { SERVICES, TEAM, WHO_WE_HELP, WHEN_TO_CALL, PROCESS_STEPS, FAQS } from "@/lib/siteContent";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const iconMap = { ClipboardCheck, SearchCheck, Activity, FileText, Stethoscope, Users };

export default function Home() {
  useDocumentMeta(
    "Clinical SOS — Rapid Response Consulting for Skilled Nursing & Long-Term Care",
    "Rapid-response consulting for skilled nursing and long-term care organizations facing survey deficiencies, compliance issues, operational instability, and leadership gaps."
  );
  return (
    <div>
      {/* Hero */}
      <section className="hero-gradient">
        <div className="container-prose py-20 md:py-28">
          <div className="max-w-3xl animate-fade-up">
            <p className="section-eyebrow">Rapid Response Consulting</p>
            <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-[1.1] text-foreground">
              Rapid Response Consulting for Skilled Nursing and Long-Term Care
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              Clinical SOS helps nursing homes and long-term care organizations respond quickly to
              survey risk, compliance issues, operational instability, and leadership gaps with
              practical, experienced support.
            </p>
            <p className="mt-3 text-base font-medium text-primary">
              When the stakes are high, experience matters.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/contact" className="btn-primary">Request a Consultation <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/contact" className="btn-secondary"><Phone className="h-4 w-4" /> Talk With Our Team</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Credibility bar */}
      <section className="border-y border-border bg-white">
        <div className="container-prose py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { icon: ShieldCheck, label: "Survey Response Expertise" },
            { icon: Clock, label: "Rapid Engagement" },
            { icon: Stethoscope, label: "Clinical Leadership" },
            { icon: AlertTriangle, label: "Calm Under Pressure" },
          ].map((c) => (
            <div key={c.label} className="flex flex-col items-center gap-2">
              <c.icon className="h-6 w-6 text-[hsl(262_50%_45%)]" />
              <span className="text-sm font-medium text-foreground">{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* When your facility needs more than advice */}
      <section className="py-20">
        <div className="container-prose">
          <div className="max-w-2xl">
            <p className="section-eyebrow">When Your Facility Needs More Than Advice</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">Practical support for high-stakes situations</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Surveys, enforcement actions, and operational instability demand more than generic
              recommendations. They demand experienced, grounded support that understands long-term
              care reality and helps your team move with confidence.
            </p>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {[
              { t: "Survey Pressure", d: "Deficiencies, Plans of Correction, and follow-up survey preparation." },
              { t: "Compliance Concerns", d: "Repeat deficiencies, root cause analysis, and monitoring that lasts." },
              { t: "Operational Instability", d: "Clinical operations stabilization and continuity through transition." },
              { t: "Leadership Gaps", d: "Interim leadership and subject-matter support to bridge critical needs." },
              { t: "Enforcement Activity", d: "Calm, structured response to CMP, DPNA, and enforcement pressure." },
              { t: "Readiness", d: "Mock surveys and readiness reviews that surface issues early." },
            ].map((c) => (
              <div key={c.t} className="card-elevated p-6 hover:border-primary/40 transition">
                <h3 className="font-semibold text-foreground">{c.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-secondary/60">
        <div className="container-prose">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="section-eyebrow">Services</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold">Focused consulting services</h2>
            </div>
            <Link to="/services" className="btn-secondary">View all services <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((s, i) => {
              const Icon = iconMap[i] || ClipboardCheck;
              return (
                <Link key={s.slug} to={`/services/${s.slug}`} className="card-elevated p-6 group hover:border-primary/40 transition">
                  <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center text-[hsl(262_50%_45%)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground leading-snug">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.short}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    Learn more <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* When should you call */}
      <section className="py-20">
        <div className="container-prose grid lg:grid-cols-2 gap-12">
          <div>
            <p className="section-eyebrow">When Should You Call Clinical SOS?</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">Recognize the moment to act</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              These are common situations where experienced support makes a meaningful difference.
            </p>
          </div>
          <ul className="space-y-3">
            {WHEN_TO_CALL.map((w) => (
              <li key={w} className="flex gap-3 items-start">
                <span className="mt-1 h-2 w-2 rounded-full bg-[hsl(262_58%_44%)] flex-shrink-0" />
                <span className="text-foreground">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why Clinical SOS */}
      <section className="py-20 bg-[hsl(263_65%_14%)] text-white">
        <div className="container-prose">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(258_60%_75%)]">Why Clinical SOS</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">Experienced, calm, and practical</h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              We are practical, responsive, credible, and experienced. We stay calm under pressure and
              communicate clearly with executive audiences — grounded in long-term care reality.
            </p>
          </div>
          <div className="mt-10 grid md:grid-cols-4 gap-5">
            {[
              { t: "Practical", d: "Support that fits your operational reality, not theory." },
              { t: "Responsive", d: "We move quickly when the situation demands it." },
              { t: "Credible", d: "Experienced guidance rooted in long-term care." },
              { t: "Calm", d: "Steady, structured support under pressure." },
            ].map((w) => (
              <div key={w.t} className="rounded-2xl bg-white/5 border border-white/10 p-6">
                <h3 className="font-semibold text-white">{w.t}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="py-20">
        <div className="container-prose">
          <div className="max-w-2xl">
            <p className="section-eyebrow">Assess → Prioritize → Support → Stabilize</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">A clear, structured approach</h2>
          </div>
          <div className="mt-10 grid md:grid-cols-4 gap-5">
            {PROCESS_STEPS.map((s, i) => (
              <div key={s.label} className="relative card-elevated p-6">
                <span className="text-xs font-semibold text-[hsl(262_50%_45%)]">0{i + 1}</span>
                <h3 className="mt-2 font-semibold text-foreground">{s.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-secondary/60">
        <div className="container-prose">
          <div className="max-w-2xl">
            <p className="section-eyebrow">Leadership Team</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">The people behind Clinical SOS</h2>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {TEAM.map((m) => (
              <div key={m.name} className="card-elevated p-6">
                <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center text-[hsl(262_50%_45%)] font-bold">
                  {m.initials}
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{m.name}</h3>
                <p className="text-sm text-[hsl(262_50%_45%)] font-medium">{m.role}</p>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{m.bio}</p>
              </div>
            ))}
          </div>
          <div className="mt-6"><Link to="/about" className="btn-ghost">Learn more about the team <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>

      {/* Who we help */}
      <section className="py-20">
        <div className="container-prose grid lg:grid-cols-2 gap-12">
          <div>
            <p className="section-eyebrow">Who We Help</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">Built for long-term care organizations</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Clinical SOS is built specifically for the realities of skilled nursing and long-term care.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {WHO_WE_HELP.map((w) => (
              <div key={w} className="flex gap-3 items-start">
                <ShieldCheck className="h-5 w-5 text-[hsl(262_50%_45%)] flex-shrink-0 mt-0.5" />
                <span className="text-foreground">{w}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[hsl(263_65%_14%)] text-white">
        <div className="container-prose text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to talk through your situation?</h2>
          <p className="mt-4 text-slate-300">Request a consultation and share your urgency. We'll respond accordingly.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link to="/contact" className="btn-primary">Request a Consultation <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/rapid-survey-recovery" className="btn-secondary !bg-white/10 !border-white/20 !text-white hover:!bg-white/20">Rapid Survey Recovery</Link>
          </div>
        </div>
      </section>

      {/* FAQ preview */}
      <section className="py-20">
        <div className="container-prose">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="section-eyebrow">FAQ</p>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold">Common questions</h2>
            </div>
            <Link to="/faq" className="btn-secondary"><HelpCircle className="h-4 w-4" /> View all FAQs</Link>
          </div>
          <div className="mt-10 grid md:grid-cols-2 gap-5">
            {FAQS.slice(0, 4).map((f) => (
              <div key={f.q} className="card-elevated p-6">
                <h3 className="font-semibold text-foreground">{f.q}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}