import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function PageCta({ title = "Ready to talk through your situation?", subtitle = "Request a consultation and share your urgency. We'll respond accordingly." }) {
  return (
    <section className="py-16 bg-[hsl(263_65%_14%)] text-white">
      <div className="container-prose text-center max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold">{title}</h2>
        <p className="mt-4 text-slate-300">{subtitle}</p>
        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <Link to="/contact" className="btn-primary">Request a Consultation <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/services" className="btn-secondary !bg-white/10 !border-white/20 !text-white hover:!bg-white/20">Explore Services</Link>
        </div>
      </div>
    </section>
  );
}

export function PageHero({ eyebrow, title, subtitle }) {
  return (
    <section className="hero-gradient border-b border-border">
      <div className="container-prose py-16 md:py-20">
        {eyebrow && <p className="section-eyebrow">{eyebrow}</p>}
        <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-[1.1]">{title}</h1>
        {subtitle && <p className="mt-5 text-lg text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
    </section>
  );
}