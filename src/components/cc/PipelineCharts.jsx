import React, { useMemo } from "react";
import {
  ComposedChart, AreaChart, Bar, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const MONTHS = 8;

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default function PipelineCharts({ leads = [], opportunities = [] }) {
  const data = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        leadsCreated: 0,
        won: 0,
        pipelineValue: 0,
      });
    }
    const indexByKey = {};
    buckets.forEach((b, i) => { indexByKey[b.key] = i; });

    leads.forEach((l) => {
      const k = monthKey(l.created_date);
      const idx = indexByKey[k];
      if (idx !== undefined) buckets[idx].leadsCreated += 1;
    });

    opportunities.forEach((o) => {
      const k = monthKey(o.created_date);
      const idx = indexByKey[k];
      if (idx === undefined) return;
      if (o.stage === "Won") buckets[idx].won += 1;
      if (o.stage !== "Won" && o.stage !== "Lost" && o.stage !== "Suppressed") {
        buckets[idx].pipelineValue += o.estimated_value || 0;
      }
    });

    return buckets.map((b) => ({
      ...b,
      conversionRate: b.leadsCreated > 0 ? Math.round((b.won / b.leadsCreated) * 100) : 0,
      pipelineValueK: Math.round(b.pipelineValue / 1000),
    }));
  }, [leads, opportunities]);

  return (
    <div className="grid lg:grid-cols-2 gap-5 mt-6">
      <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-1">Lead Conversion by Month</h2>
        <p className="text-xs text-muted-foreground mb-4">Leads created vs. opportunities won, with conversion rate</p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} unit="%" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "0.8rem",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
            <Bar yAxisId="left" dataKey="leadsCreated" name="Leads Created" fill="hsl(262 58% 45%)" radius={[4, 4, 0, 0]} />
            <Bar yAxisId="left" dataKey="won" name="Won" fill="hsl(142 60% 45%)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="conversionRate" name="Conversion %" stroke="hsl(43 74% 50%)" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-1">Pipeline Value by Month</h2>
        <p className="text-xs text-muted-foreground mb-4">Total estimated value of open opportunities created each month</p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
            <defs>
              <linearGradient id="pipelineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(262 58% 55%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(262 58% 55%)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}k`} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: "0.8rem",
              }}
              formatter={(value) => [`$${value}k`, "Pipeline Value"]}
            />
            <Area
              type="monotone"
              dataKey="pipelineValueK"
              name="Pipeline Value"
              stroke="hsl(262 58% 50%)"
              strokeWidth={2}
              fill="url(#pipelineGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}