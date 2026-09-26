# lead-intelligence-action Edge Function

Independent Supabase replacement for:

- `scoreLead`
- `scoreLeadDual`
- `verifySignal`

## Lead scoring

Both scoring modes preserve the legacy deterministic weighting, recency, severity, verification, tiering, service recommendation, operator-scope, commercial-opportunity, and priority calculations. Scores remain explainable and the explanation/breakdown is persisted with the lead/facility.

## Signal verification

The Base44 implementation used an LLM, but did not fetch or independently cross-check the referenced source; it passed the existing stored signal fields to the model and then applied deterministic gates.

The Supabase replacement makes that limitation explicit and uses a deterministic, auditable evidence-quality assessment based on:

- evidence-field completeness
- source URL presence
- government-domain source pattern
- CCN/date/retrieval timestamp
- factual evidence summary
- enforcement/tag specificity
- >180-day staleness

A signal is marked verified only when evidence is complete, the source matches an authoritative government-domain pattern, confidence is at least 80, and human review is not required. The response explicitly states that it does not independently fetch the external record.

This removes a Base44 LLM dependency without making the verification standard less conservative.
