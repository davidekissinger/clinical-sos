import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardCheck, SearchCheck, Activity, FileText, Stethoscope, Users } from "lucide-react";
import { PageHero } from "@/components/PageCta";
import PageCta from "@/components/PageCta";
import { SERVICES } from "@/lib/siteContent";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const iconMap = { ClipboardCheck, SearchCheck, Activity, FileText, Stethoscope, Users };

export default function Services() {
  useDocumentMeta(
    "Consulting Services — Clinical SOS",
    "Practical, experienced consulting services for skilled nursing and long-term care organizations — survey response, compliance, operations, and leadership support."
  );
  return (
    <div>
      <PageHero
        eyebrow="Services"
        title="Focused consulting services for long-term care"
        subtitle="Practical, experienced support across survey response, compliance, operations, and leadership — designed for the realities of skilled nursing and long-term care organizations."
      />
      <section className="py-20">
        <div className="container-prose">
          <div className="grid md:grid-cols-2 gap-5">
            {SERVICES.map((s, i) => {
              const Icon = iconMap[i] || ClipboardCheck;
              return (
                <Link key={s.slug} to={`/services/${s.slug}`} className="card-elevated p-7 group hover:border-primary/40 transition">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center text-[hsl(262_50%_45%)] flex-shrink-0">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold leading-snug">{s.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.short}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Learn more <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary/60">
        <div className="container-prose">
          <div className="card-elevated p-8 md:p-10 bg-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="max-w-xl">
                <p className="section-eyebrow">Rapid Survey Recovery</p>
                <h2 className="mt-3 text-2xl font-bold">Facing survey pressure right now?</h2>
                <p className="mt-3 text-muted-foreground">A focused landing page for facilities dealing with deficiencies, Plans of Correction, Immediate Jeopardy, or enforcement activity.</p>
              </div>
              <Link to="/rapid-survey-recovery" className="btn-primary flex-shrink-0">Explore Rapid Survey Recovery <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </section>

      <PageCta />
    </div>
  );
}