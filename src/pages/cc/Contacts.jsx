import React from "react";
import { PageHeader, Badge, Table, EmptyState, LoadingState } from "@/components/cc/ui";
import { useEntities } from "@/hooks/useEntities";

export default function Contacts() {
  const contacts = useEntities("Contact", { sort: "-created_date", limit: 200 });
  if (contacts.loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="Contacts" subtitle="Publicly identified business decision-makers and inbound contacts" />
      {contacts.data.length === 0 ? (
        <EmptyState title="No contacts yet" subtitle="Contacts are identified by the Contact Intelligence agent and inbound forms." />
      ) : (
        <Table headers={["Name", "Title", "Role", "Organization", "Email", "Confidence", "Status"]}>
          {contacts.data.map((c) => (
            <tr key={c.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-medium text-foreground">{c.first_name} {c.last_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.title || "—"}</td>
              <td className="px-4 py-3"><Badge>{c.role_category || "—"}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{c.organization_name || c.facility_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.business_email || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.contact_confidence != null ? `${c.contact_confidence}%` : "—"}</td>
              <td className="px-4 py-3">
                {c.do_not_contact || c.opt_out ? <Badge tone="red">Do Not Contact</Badge>
                  : c.inferred ? <Badge tone="amber">Inferred</Badge>
                  : <Badge tone="green">Active</Badge>}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Inferred contact information is clearly labeled and never treated as verified until validated. Email addresses are never invented and marked as verified.</p>
    </div>
  );
}