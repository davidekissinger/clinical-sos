import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ClipboardCheck, SearchCheck, Activity, FileText, Stethoscope, Users, CheckCircle2 } from "lucide-react";
import PageCta from "@/components/PageCta";
import { SERVICES } from "@/lib/siteContent";

const iconMap = { ClipboardCheck, SearchCheck, Activity, FileText, Stethoscope, Users };

export default function ServiceDetail() {
  const { slug } = useParams();
  const service = SERVICES.find((s) => s.slug === slug);
  if (!service) {
    return (
      <div className="container-prose py-24 text-center">
        <h1 className="text-2xl font-bold">Service not found</h1>
        <Link to="/services" className="btn-primary mt-6">Back to services</Link>
      </div>
    );
  }
  const Icon = iconMap[SERVICES.indexOf(service)] || ClipboardCheck;

  return (
    <div>
      <section className="hero-gradient border-b border-border">
        <div className="container-prose py-16 md:py-20">
          <Link to="/services" className="text-sm text-muted-foreground hover:text-primary">← All services</Link>
          <div className="mt-6 flex items-start gap-5">
            <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center text-[hsl(262_50%_45%)] flex-shrink-0">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <p className="section-eyebrow">Service</p>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold leading-tight">{service.title}</h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl leading-relaxed">{service.summary}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container-prose grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold">What this includes</h2>
            <ul className="mt-6 space-y-4">
              {service.points.map((p) => (
                <li key={p} className="flex gap-3 items-start">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(262_50%_45%)] flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card-elevated p-6 h-fit">
            <h3 className="font-semibold">Talk through your situation</h3>
            <p className="mt-2 text-sm text-muted-foreground">Share what you're facing and your urgency level. We'll respond accordingly.</p>
            <Link to="/contact" className="btn-primary mt-4 w-full">Request a Consultation <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <PageCta />
    </div>
  );
}