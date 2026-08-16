import React, { useState } from "react";
import { PageHeader } from "@/components/cc/ui";
import { Save, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState({
    activeStates: "IA, IL, IN, KS, MI, MN, MO, ND, NE, OH, SD, WI",
    minLeadScore: 60,
    lookbackDays: 365,
    outreachMode: "Human Approved",
    senderName: "Clinical SOS",
    followUp1: 4,
    followUp2: 8,
    dailyLimit: 25,
    commercialModel: "Hybrid",
    paymentTerms: "Net 30",
    bdOwner: "David Kissinger",
    clinicalOwner: "Mindy Jensen",
    financeOwner: "Matthew Bartow",
  });

  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));

  const save = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure the lead engine, outreach, commercial terms, and team ownership" />
      <form onSubmit={save} className="space-y-6 max-w-3xl">
        <Section title="Lead Engine" desc="Target geography, scoring thresholds, and data refresh.">
          <Input label="Active States" value={config.activeStates} onChange={(v) => set("activeStates", v)} hint="Comma-separated state abbreviations. Starts Midwest-focused; national expansion is easy." />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Minimum Lead Score" type="number" value={config.minLeadScore} onChange={(v) => set("minLeadScore", Number(v))} />
            <Input label="Regulatory Lookback (days)" type="number" value={config.lookbackDays} onChange={(v) => set("lookbackDays", Number(v))} />
          </div>
        </Section>

        <Section title="Outreach" desc="Automation mode and follow-up cadence. Defaults to Human Approved Outreach.">
          <Select label="Automation Mode" value={config.outreachMode} onChange={(v) => set("outreachMode", v)} options={["Research Only", "Human Approved", "Automated Sequence"]} />
          <Input label="Sender Identity" value={config.senderName} onChange={(v) => set("senderName", v)} />
          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="Follow-up 1 (days)" type="number" value={config.followUp1} onChange={(v) => set("followUp1", Number(v))} />
            <Input label="Follow-up 2 (days)" type="number" value={config.followUp2} onChange={(v) => set("followUp2", Number(v))} />
            <Input label="Daily Send Limit" type="number" value={config.dailyLimit} onChange={(v) => set("dailyLimit", Number(v))} />
          </div>
        </Section>

        <Section title="Commercial" desc="Engagement models and payment terms. Prices are not displayed publicly.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Default Commercial Model" value={config.commercialModel} onChange={(v) => set("commercialModel", v)} options={["Fixed Fee", "Hourly", "Time and Expense", "Hybrid"]} />
            <Input label="Standard Payment Terms" value={config.paymentTerms} onChange={(v) => set("paymentTerms", v)} />
          </div>
        </Section>

        <Section title="Team Ownership" desc="Default owners and escalation routing.">
          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="Business Development Owner" value={config.bdOwner} onChange={(v) => set("bdOwner", v)} />
            <Input label="Clinical Owner" value={config.clinicalOwner} onChange={(v) => set("clinicalOwner", v)} />
            <Input label="Finance Owner" value={config.financeOwner} onChange={(v) => set("financeOwner", v)} />
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary"><Save className="h-4 w-4" /> Save Configuration</button>
          {saved && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        </div>
      </form>
      <p className="mt-8 text-xs text-muted-foreground max-w-2xl">
        Integrations (email, calendar, CRM, storage, accounting) can be connected from the workspace
        connectors panel. HubSpot and QuickBooks are optional and not required to launch. Prospect data
        is never sent to QuickBooks — only won-engagement finance handoffs.
      </p>
    </div>
  );
}

function Section({ title, desc, children }) {
  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", hint }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1.5">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:ring-2 focus:ring-accent outline-none" />
      {hint && <span className="block mt-1 text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1.5">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:ring-2 focus:ring-accent outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}