import React from "react";
import { PageHeader, Badge, Table, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";

export default function Engagements() {
  const engagements = useEntities("Engagement", { sort: "-created_date", limit: 200 });
  if (engagements.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Engagements" subtitle="Active and completed consulting engagements" />
      {engagements.data.length === 0 ? (
        <EmptyState title="No engagements yet" subtitle="Engagements are created when an opportunity is won." />
      ) : (
        <Table headers={["Engagement", "Client", "Service", "Phase", "Manager", "Clinical Lead", "Start", "Est. End", "Status"]}>
          {engagements.data.map((e) => (
            <tr key={e.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-medium text-foreground">{e.engagement_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.client_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.service_type || "—"}</td>
              <td className="px-4 py-3"><Badge>{e.phase || "—"}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{e.manager_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.clinical_lead_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.start_date || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.estimated_end_date || "—"}</td>
              <td className="px-4 py-3"><Badge tone={e.status === "Active" ? "green" : e.status === "Complete" ? "blue" : "default"}>{e.status}</Badge></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}