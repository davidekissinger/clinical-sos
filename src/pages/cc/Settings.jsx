import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PageHeader, LoadingState } from "@/components/cc/ui";
import ThemeToggle from "@/components/ThemeToggle";
import { Save, CheckCircle2, FlaskConical, AlertTriangle, Palette } from "lucide-react";

export default function Settings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const configs = await base44.entities.LeadEngineConfig.list();
        if (configs && configs.length > 0) {
          setConfig(configs[0]);
        } else {
          setConfig({
            outreach_mode: "Human Approved Outreach",
            test_mode: false,
            test_email_recipients: [],
            minimum_lead_score: 40,
            regulatory_lookback_days: 365,
            daily_outreach_limit: 25,
            sender_name: "Clinical SOS",
            bd_owner_name: "David Kissinger",
            clinical_owner_name: "Mindy Jensen",
            finance_owner_name: "Matthew Bartow",
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...config, last_updated: new Date().toISOString() };
      if (config.id) {
        await base44.entities.LeadEngineConfig.update(config.id, payload);
      } else {
        await base44.entities.LeadEngineConfig.create(payload);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure the lead engine, outreach, commercial terms, and team ownership" />

      {/* Appearance */}
      <div className="bg-white dark:bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold text-foreground">Appearance</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Choose how the Command Center looks. Your preference persists across sessions.</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Test Mode Banner */}
      <div className={`rounded-2xl border-2 p-5 mb-6 ${config.test_mode ? "border-amber-300 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800"}`}>
        <div className="flex items-start gap-4">
          {config.test_mode ? (
            <FlaskConical className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-foreground">Test Mode: {config.test_mode ? "ON" : "OFF"}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {config.test_mode
                    ? "All outbound communication routes to internal test addresses only. No prospect emails will be sent."
                    : "Live mode — outreach follows normal approval workflow."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => set("test_mode", !config.test_mode)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${config.test_mode ? "bg-amber-500" : "bg-emerald-500"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${config.test_mode ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {config.test_mode && (
              <div className="mt-3">
                <label className="block">
                  <span className="block text-sm font-medium text-foreground mb-1.5">Test Email Recipients</span>
                  <input
                    value={(config.test_email_recipients || []).join(", ")}
                    onChange={(e) => set("test_email_recipients", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:ring-2 focus:ring-accent outline-none"
                    placeholder="test1@clinicalsos.com, test2@clinicalsos.com"
                  />
                  <span className="block mt-1 text-xs text-muted-foreground">Comma-separated. All test-mode emails route here instead of real prospects.</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6 max-w-3xl">
        <Section title="Lead Engine" desc="Target geography, scoring thresholds, and data refresh.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Minimum Lead Score" type="number" value={config.minimum_lead_score ?? 40} onChange={(v) => set("minimum_lead_score", Number(v))} />
            <Input label="Regulatory Lookback (days)" type="number" value={config.regulatory_lookback_days ?? 365} onChange={(v) => set("regulatory_lookback_days", Number(v))} />
          </div>
          <Input
            label="Active States"
            value={(config.active_states || []).join(", ")}
            onChange={(v) => set("active_states", v.split(",").map((s) => s.trim()).filter(Boolean))}
            hint="Comma-separated state abbreviations."
          />
        </Section>

        <Section title="Outreach" desc="Automation mode and follow-up cadence. Defaults to Human Approved Outreach.">
          <Select label="Outreach Mode" value={config.outreach_mode || "Human Approved Outreach"} onChange={(v) => set("outreach_mode", v)} options={["Research Only", "Human Approved Outreach", "Approved Automated Sequence"]} />
          <Input label="Sender Identity" value={config.sender_name || ""} onChange={(v) => set("sender_name", v)} />
          <Input label="Daily Send Limit" type="number" value={config.daily_outreach_limit ?? 25} onChange={(v) => set("daily_outreach_limit", Number(v))} />
        </Section>

        <Section title="Team Ownership" desc="Default owners and escalation routing.">
          <div className="grid sm:grid-cols-3 gap-4">
            <Input label="Business Development" value={config.bd_owner_name || ""} onChange={(v) => set("bd_owner_name", v)} />
            <Input label="Clinical" value={config.clinical_owner_name || ""} onChange={(v) => set("clinical_owner_name", v)} />
            <Input label="Finance" value={config.finance_owner_name || ""} onChange={(v) => set("finance_owner_name", v)} />
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save Configuration"}
          </button>
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
    <div className="bg-white dark:bg-card rounded-xl border border-border p-6">
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
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-accent outline-none" />
      {hint && <span className="block mt-1 text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-foreground mb-1.5">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white dark:bg-card text-foreground focus:border-primary focus:ring-2 focus:ring-accent outline-none">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}