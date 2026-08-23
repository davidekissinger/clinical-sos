import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/PageCta";
import PageCta from "@/components/PageCta";
import { RESOURCES } from "@/lib/siteContent";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export default function Resources() {
  useDocumentMeta(
    "Resources & Insights — Clinical SOS",
    "Practical resources for long-term care leaders on survey response, Plans of Correction, root cause analysis, compliance, and operational readiness."
  );
  return (
    <div>
      <PageHero
        eyebrow="Resources & Insights"
        title="Credible educational content for long-term care leaders"
        subtitle="Practical, factual insights on survey response, compliance, and operations — designed to inform, not to alarm. No legal advice and no regulatory guarantees."
      />
      <section className="py-20">
        <div className="container-prose">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {RESOURCES.map((r) => (
              <Link key={r.slug} to={`/resources/${r.slug}`} className="card-elevated p-6 group hover:border-primary/40 transition flex flex-col">
                <span className="text-xs font-semibold text-[hsl(262_50%_45%)] uppercase tracking-wide">{r.category}</span>
                <h3 className="mt-3 font-semibold leading-snug">{r.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">{r.excerpt}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-10 text-xs text-muted-foreground max-w-2xl">
            Educational content is provided for general informational purposes and does not constitute legal advice.
          </p>
        </div>
      </section>
      <PageCta />
    </div>
  );
}