import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/PageCta";
import PageCta from "@/components/PageCta";
import { TEAM } from "@/lib/siteContent";

export default function About() {
  return (
    <div>
      <PageHero
        eyebrow="About Clinical SOS"
        title="Practical consulting support, grounded in long-term care reality"
        subtitle="Clinical SOS is the public-facing brand of Clinical Advantage Consultants LLC, providing practical consulting support for skilled nursing and long-term care organizations facing survey pressure, compliance concerns, operational instability, and leadership challenges."
      />

      <section className="py-20">
        <div className="container-prose grid lg:grid-cols-2 gap-12">
          <div>
            <p className="section-eyebrow">Our Approach</p>
            <h2 className="mt-3 text-3xl font-bold">Calm, credible, and experienced</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We are practical, responsive, credible, and experienced. We stay calm under pressure and
              communicate clearly with executive audiences. Our support is grounded in long-term care
              reality — not generic healthcare consulting theory.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We do not promise regulatory outcomes or imply affiliation with any regulator. We help
              organizations prepare, respond, and stabilize with a defensible, structured approach.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { t: "Practical", d: "Support that fits your operational reality." },
              { t: "Responsive", d: "Quick engagement when the situation demands it." },
              { t: "Credible", d: "Experienced guidance rooted in long-term care." },
              { t: "Executive-facing", d: "Clear communication for leadership audiences." },
            ].map((w) => (
              <div key={w.t} className="card-elevated p-6">
                <h3 className="font-semibold">{w.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/60">
        <div className="container-prose">
          <p className="section-eyebrow">Leadership Team</p>
          <h2 className="mt-3 text-3xl font-bold">The team behind Clinical SOS</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {TEAM.map((m) => (
              <div key={m.name} className="card-elevated p-6">
                <div className="h-14 w-14 rounded-full bg-accent flex items-center justify-center text-[hsl(262_50%_45%)] font-bold">
                  {m.initials}
                </div>
                <h3 className="mt-4 font-semibold">{m.name}</h3>
                <p className="text-sm text-[hsl(262_50%_45%)] font-medium">{m.role}</p>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{m.bio}</p>
                <ul className="mt-4 space-y-1.5">
                  {m.focus.map((f) => (
                    <li key={f} className="text-sm text-muted-foreground flex gap-2 items-start">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(262_58%_44%)] flex-shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground max-w-2xl">
            Team descriptions reflect the roles and focus areas supported by source materials. No
            biographical details, certifications, awards, or years of experience beyond what is
            documented are represented.
          </p>
        </div>
      </section>

      <PageCta />
    </div>
  );
}