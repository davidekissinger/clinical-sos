# generate-work-product Edge Function

Independent Supabase replacement for Base44 `generateWorkProduct`.

## Independence strategy

The Base44 function depended on Base44's hosted LLM integration. The independent replacement deliberately does not introduce another external AI-provider dependency. It produces a structured DRAFT directly from authoritative ClinicalSOS database fields.

The output is therefore less stylistically generative than the prior LLM version, but it preserves the most important controls:

- server-side source retrieval only
- no client free-text factual prompt
- blank factual fields render exactly as `To be completed.`
- unverified regulatory mappings display `REGULATORY MAPPING REQUIRES VERIFICATION`
- approved RegulatoryKnowledge may be included only as clearly labeled reference guidance
- no inferred clinical actions, completion claims, responsible people, dates, resident facts, or regulatory facts
- complete source snapshot / source field / source record provenance
- DRAFT status

## Stale-source protection

The Edge Function captures `updated_date` for every source record and passes those versions to the existing `clinical_save_generated_work_product` RPC.

That RPC locks and rechecks each source version before saving. If a source changed during generation, the save is rejected with HTTP 409 rather than attaching stale content to a changed clinical record.

## Save behavior

The existing database RPC:

- verifies admin/clinical authorization
- saves the work product as DRAFT
- preserves provenance arrays/snapshot
- updates the linked POC `generated_narrative` where applicable
- records the generation in the automation audit log

This removes the final substantive Base44-hosted LLM dependency from the backend while retaining a safe, usable draft-generation path.
