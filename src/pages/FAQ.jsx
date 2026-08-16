import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PageHero } from "@/components/PageCta";
import PageCta from "@/components/PageCta";
import { FAQS } from "@/lib/siteContent";

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div>
      <PageHero
        eyebrow="FAQ"
        title="Frequently asked questions"
        subtitle="Clear answers about how Clinical SOS works, what we can and cannot promise, and how to engage."
      />
      <section className="py-20">
        <div className="container-prose max-w-3xl">
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={i} className="card-elevated overflow-hidden">
                <button
                  onClick={() => setOpen(open === i ? -1 : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-semibold text-foreground">{f.q}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition ${open === i ? "rotate-180" : ""}`} />
                </button>
                {open === i && (
                  <div className="px-5 pb-5 text-muted-foreground leading-relaxed">{f.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      <PageCta />
    </div>
  );
}