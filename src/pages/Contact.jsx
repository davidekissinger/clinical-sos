import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ShieldAlert, Calendar } from "lucide-react";
import { PageHero } from "@/components/PageCta";
import { base44 } from "@/api/base44Client";
import { SERVICES } from "@/lib/siteContent";

const URGENCY_OPTIONS = [
  "General inquiry",
  "Proactive survey preparation",
  "Corrective action support",
  "Operational concern",
  "Leadership support",
  "Regulatory issue",
  "Urgent assistance requested",
];

export default function Contact() {
  const [form, setForm] = useState({
    name: "", organization: "", title: "", business_email: "", business_phone: "",
    facility_or_org_name: "", state: "", number_of_facilities: "", service_needed: "",
    current_challenge: "", urgency_level: "General inquiry", preferred_contact_method: "Email",
    preferred_consultation_time: "", consent_acknowledged: false,
  });
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.consent_acknowledged) { setError("Please acknowledge the communication consent to continue."); return; }
    setStatus("submitting");
    setError("");
    try {
      const sourcePage = typeof window !== "undefined" ? window.location.pathname : "/contact";
      const res = await base44.functions.invoke("submitConsultation", { ...form, source_page: sourcePage });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);

      try {
        await base44.analytics.track({ eventName: "contact_form_submitted", properties: { urgency: form.urgency_level, tier: data.tier, score: data.score, service: form.service_needed, source_page: sourcePage } });
      } catch (err) { /* best-effort */ }

      setResult({ score: data.score, tier: data.tier, consultationId: data.consultation_id });
      setStatus("success");
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again or email us directly.");
      setStatus("error");
    }
  };

  if (status === "success" && result) {
    return (
      <div>
        <PageHero eyebrow="Request a Consultation" title="Thank you — your request is in" subtitle="A member of the Clinical SOS team will respond based on your indicated urgency." />
        <section className="py-20">
          <div className="container-prose max-w-xl">
            <div className="card-elevated p-8 text-center">
              <div className="h-14 w-14 rounded-full bg-accent mx-auto flex items-center justify-center text-[hsl(262_50%_45%)]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-bold">We've received your request</h2>
              <p className="mt-3 text-muted-foreground">
                Your request has been routed to our Business Development team and a follow-up task has been created.
                Based on your urgency, we'll respond accordingly.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-[hsl(262_50%_40%)]">
                Priority: {result.tier} · Score {result.score}
              </div>
              <div className="mt-8 rounded-xl border border-border p-5 text-left">
                <h3 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-[hsl(262_50%_45%)]" /> What happens next</h3>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>We review your request and qualify the urgency.</li>
                  <li>A team member reaches out using your preferred contact method.</li>
                  <li>We offer a consultation time and prepare relevant context for the conversation.</li>
                </ol>
              </div>
              <Link to="/" className="btn-secondary mt-6">Back to home</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <PageHero
        eyebrow="Request a Consultation"
        title="Let's talk through your situation"
        subtitle="Share what you're facing and your urgency level. The more context you provide, the more useful our first conversation will be."
      />
      <section className="py-20">
        <div className="container-prose grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <form onSubmit={onSubmit} className="card-elevated p-6 md:p-8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Name *"><input required value={form.name} onChange={(e) => set("name", e.target.value)} className="cs-input" /></Field>
                <Field label="Organization"><input value={form.organization} onChange={(e) => set("organization", e.target.value)} className="cs-input" /></Field>
                <Field label="Title"><input value={form.title} onChange={(e) => set("title", e.target.value)} className="cs-input" /></Field>
                <Field label="Business email *"><input type="email" required value={form.business_email} onChange={(e) => set("business_email", e.target.value)} className="cs-input" /></Field>
                <Field label="Business phone"><input value={form.business_phone} onChange={(e) => set("business_phone", e.target.value)} className="cs-input" /></Field>
                <Field label="Facility or organization name"><input value={form.facility_or_org_name} onChange={(e) => set("facility_or_org_name", e.target.value)} className="cs-input" /></Field>
                <Field label="State"><input value={form.state} onChange={(e) => set("state", e.target.value)} className="cs-input" /></Field>
                <Field label="Number of facilities, if applicable"><input value={form.number_of_facilities} onChange={(e) => set("number_of_facilities", e.target.value)} className="cs-input" /></Field>
              </div>

              <Field label="Service needed">
                <select value={form.service_needed} onChange={(e) => set("service_needed", e.target.value)} className="cs-input">
                  <option value="">Select a service…</option>
                  {SERVICES.map((s) => <option key={s.slug} value={s.title}>{s.title}</option>)}
                  <option value="Rapid Survey Recovery">Rapid Survey Recovery</option>
                  <option value="Not sure yet">Not sure yet</option>
                </select>
              </Field>

              <Field label="Current challenge">
                <textarea rows={4} value={form.current_challenge} onChange={(e) => set("current_challenge", e.target.value)} className="cs-input" placeholder="Describe your situation in general terms — no resident names or PHI." />
              </Field>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Urgency level *">
                  <select required value={form.urgency_level} onChange={(e) => set("urgency_level", e.target.value)} className="cs-input">
                    {URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
                <Field label="Preferred contact method">
                  <select value={form.preferred_contact_method} onChange={(e) => set("preferred_contact_method", e.target.value)} className="cs-input">
                    {["Email", "Phone", "Video call"].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Preferred consultation time">
                <input value={form.preferred_consultation_time} onChange={(e) => set("preferred_consultation_time", e.target.value)} className="cs-input" placeholder="e.g. Weekday mornings, this week" />
              </Field>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={form.consent_acknowledged} onChange={(e) => set("consent_acknowledged", e.target.checked)} className="mt-1 h-4 w-4 rounded border-border" />
                <span className="text-sm text-muted-foreground">
                  I acknowledge that submitting this form authorizes Clinical SOS to contact me about my request. I understand I should not submit protected health information.
                </span>
              </label>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button type="submit" disabled={status === "submitting"} className="btn-primary w-full disabled:opacity-60">
                {status === "submitting" ? "Submitting…" : <>Request a Consultation <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 font-medium">
                  Please do not submit protected health information or resident-identifiable information through this form.
                </p>
              </div>
            </div>
            <div className="card-elevated p-6">
              <h3 className="font-semibold">What happens after you submit</h3>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>We create a record and qualify your urgency.</li>
                <li>A team member is assigned and alerted.</li>
                <li>We reach out via your preferred method.</li>
                <li>We offer a consultation and prepare context.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .cs-input {
          width: 100%;
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.9rem;
          background: white;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .cs-input:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--accent)); }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}