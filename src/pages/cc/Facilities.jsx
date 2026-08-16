import React from "react";
import { PageHeader, Badge, Table, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";

export default function Facilities() {
  const facilities = useEntities("Facility", { sort: "-created_date", limit: 200 });
  if (facilities.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Facilities" subtitle="Skilled nursing and long-term care organizations in the intelligence database" />
      {facilities.data.length === 0 ? (
        <EmptyState title="No facilities yet" subtitle="Facilities are added by the regulatory lead engine and inbound requests." />
      ) : (
        <Table headers={["Facility", "Location", "Type", "Beds", "CMS Rating", "Operator", "Verified"]}>
          {facilities.data.map((f) => (
            <tr key={f.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-medium text-foreground">{f.facility_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{[f.city, f.state].filter(Boolean).join(", ") || "—"}</td>
              <td className="px-4 py-3"><Badge>{f.facility_type || "—"}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{f.bed_count || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{f.cms_rating ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{f.operator_name || "—"}</td>
              <td className="px-4 py-3"><Badge tone={f.last_verified_date ? "green" : "amber"}>{f.last_verified_date ? "Verified" : "Unverified"}</Badge></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}