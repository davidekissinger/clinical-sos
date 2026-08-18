import React from "react";
import { PageHeader, Badge, Table, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";

export default function Proposals() {
  const proposals = useEntities("Proposal", { sort: "-created_date", limit: 200, excludeTestData: true });
  if (proposals.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Proposals" subtitle="Draft and approved proposals — all documents require management approval before sending" />
      {proposals.data.length === 0 ? (
        <EmptyState title="No proposals yet" subtitle="The Proposal Assistant generates drafts from approved templates after discovery." />
      ) : (
        <Table headers={["Proposal", "Facility", "Model", "Fee", "Status", "Reviewer", "Sent", "Acceptance"]}>
          {proposals.data.map((p) => (
            <tr key={p.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-medium text-foreground">{p.proposal_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.facility_name || "—"}</td>
              <td className="px-4 py-3"><Badge>{p.engagement_model || "—"}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{p.fee ? `$${p.fee.toLocaleString()}` : "—"}</td>
              <td className="px-4 py-3"><Badge tone={p.status === "Draft" ? "amber" : p.status === "Approved" || p.status === "Sent" ? "blue" : p.status === "Accepted" ? "green" : "default"}>{p.status}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{p.reviewer_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.sent_date ? new Date(p.sent_date).toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3"><Badge tone={p.acceptance_status === "Accepted" ? "green" : p.acceptance_status === "Rejected" ? "red" : "default"}>{p.acceptance_status || "Pending"}</Badge></td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Proposals default to Draft until an authorized manager reviews and approves. The Consulting Services Agreement is an internal draft template only — never represented as attorney-approved or executed.</p>
    </div>
  );
}