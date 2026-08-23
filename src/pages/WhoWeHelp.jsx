import React from "react";
import { ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/PageCta";
import PageCta from "@/components/PageCta";
import { WHO_WE_HELP } from "@/lib/siteContent";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export default function WhoWeHelp() {
  useDocumentMeta(
    "Who We Help — Skilled Nursing and Long-Term Care — Clinical SOS",
    "Clinical SOS supports skilled nursing facilities, long-term care organizations, and multi-facility operators facing survey, compliance, and operational challenges."
  );
  return (
    <div>
      <PageHero
        eyebrow="Who We Help"
        title="Built for skilled nursing and long-term care"
        subtitle="Clinical SOS is designed specifically for the realities of long-term care organizations — from single facilities to multi-facility operators."
      />
      <section className="py-20">
        <div className="container-prose">
          <div className="grid md:grid-cols-2 gap-4">
            {WHO_WE_HELP.map((w) => (
              <div key={w} className="card-elevated p-6 flex gap-3 items-start">
                <ShieldCheck className="h-6 w-6 text-[hsl(262_50%_45%)] flex-shrink-0 mt-0.5" />
                <span className="font-medium text-foreground">{w}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/60">
        <div className="container-prose grid lg:grid-cols-2 gap-12">
          <div>
            <p className="section-eyebrow">Operator-Level Support</p>
            <h2 className="mt-3 text-3xl font-bold">When a pattern affects multiple facilities</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              When the same regulatory pattern affects multiple facilities under one ownership
              structure, an operator-level response is often more effective than facility-by-facility
              outreach. Clinical SOS helps coordinate that kind of response.
            </p>
          </div>
          <div>
            <p className="section-eyebrow">Single-Facility Support</p>
            <h2 className="mt-3 text-3xl font-bold">Focused help for one facility</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              For a single facility under pressure, we provide focused, hands-on support — from survey
              response through stabilization — sized to the actual need.
            </p>
          </div>
        </div>
      </section>

      <PageCta />
    </div>
  );
}