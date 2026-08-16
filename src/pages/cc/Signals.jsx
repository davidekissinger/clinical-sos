import React from "react";
import { PageHeader, Badge, Table, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";

export default function Signals() {
  const signals = useEntities("RegulatorySignal", { sort: "-date_retrieved", limit: 200 });
  if (signals.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Regulatory Intelligence" subtitle="Verified and unverified public regulatory signals with provenance" />
      {signals.data.length === 0 ? (
        <EmptyState title="No signals yet" subtitle="The Regulatory Intelligence Agent will populate signals from authoritative public sources." />
      ) : (
        <Table headers={["Facility", "Signal Type", "Severity", "Event Date", "Status", "Verified", "Source", "Confidence"]}>
          {signals.data.map((s) => (
            <tr key={s.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-medium text-foreground">{s.facility_name}</td>
              <td className="px-4 py-3"><Badge tone={s.severity === "High" ? "red" : s.severity === "Medium" ? "amber" : "default"}>{s.signal_type}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{s.severity || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.event_date || "—"}</td>
              <td className="px-4 py-3"><Badge tone={s.status === "Current" ? "amber" : s.status === "Resolved" ? "green" : "default"}>{s.status || "—"}</Badge></td>
              <td className="px-4 py-3"><Badge tone={s.verified ? "green" : "amber"}>{s.verified ? "Verified" : "Unverified"}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{s.source || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.confidence_score != null ? `${s.confidence_score}%` : "—"}</td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-4 text-xs text-muted-foreground">A prospect is never treated as a verified lead solely because a model says so. Unverified signals are marked "Research Required" and must not drive outreach.</p>
    </div>
  );
}