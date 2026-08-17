import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Verification Agent backend: cross-checks a RegulatorySignal claim using LLM,
// assigns a confidence score, and marks it verified or "research required".
// Human review is still required for ambiguous cases — this never auto-approves outreach.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const signalId = body.signal_id;
    if (!signalId) return Response.json({ error: 'signal_id is required' }, { status: 400 });

    const svc = base44.asServiceRole;
    const signal = await svc.entities.RegulatorySignal.get(signalId);
    if (!signal) return Response.json({ error: 'Signal not found' }, { status: 404 });

    // Build verification prompt
    const prompt = `You are a verification analyst for a long-term care consulting firm. Your job is to assess whether a regulatory signal about a healthcare facility is credible and verifiable based on the information provided.

REGULATORY SIGNAL:
- Facility: ${signal.facility_name || "Unknown"}
- CCN: ${signal.ccn || "Unknown"}
- Signal Type: ${signal.signal_type}
- Severity: ${signal.severity || "Unknown"}
- Event Date: ${signal.event_date || "Unknown"}
- Source: ${signal.source || "Unknown"}
- Source URL: ${signal.source_url || "Unknown"}
- Factual Summary: ${signal.factual_evidence_summary || "None provided"}
- Enforcement Amount: ${signal.enforcement_amount || "N/A"}
- Deficiency Tag: ${signal.deficiency_tag || "N/A"}
- Current Status: ${signal.status || "Unknown"}

VERIFICATION CRITERIA:
1. Is the source an authoritative government source (CMS, state agency) or a third-party database?
2. Does the source URL point to an official record or a secondary report?
3. Is the event date specific and recent, or vague and old?
4. Does the factual summary contain specific, checkable details (CCN, tag numbers, amounts, dates)?
5. Are there any inconsistencies in the data?

Respond with a JSON object containing:
- confidence_score (0-100 integer): how confident you are this signal is real and current
- verification_method: brief description of how this was assessed
- evidence_assessment: 2-3 sentence assessment of the evidence quality
- recommended_status: one of "Verified", "Research Required", "Suppressed"
- stale_data_flag: boolean — true if the signal appears outdated (>180 days with no update)
- human_review_required: boolean — true if the case is ambiguous and needs human eyes

RULES:
- Never mark a signal "Verified" if the source is missing, unverified, or the source URL is absent.
- Never mark "Verified" if the event date is unknown AND the source is a third-party database.
- If the source URL is present and from a government domain (.gov, .state.), confidence should be higher.
- Ambiguous cases MUST have human_review_required = true.`;

    const llmResponse = await svc.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          confidence_score: { type: "number" },
          verification_method: { type: "string" },
          evidence_assessment: { type: "string" },
          recommended_status: { type: "string", enum: ["Verified", "Research Required", "Suppressed"] },
          stale_data_flag: { type: "boolean" },
          human_review_required: { type: "boolean" }
        },
        required: ["confidence_score", "verification_method", "evidence_assessment", "recommended_status", "stale_data_flag", "human_review_required"]
      },
    });

    const result = llmResponse || {};
    const confidence = Math.round(Number(result.confidence_score) || 0);

    // Evidence completeness check — required fields for a verifiable signal.
    // If any core evidence field is missing, the signal cannot be verified
    // and must be classified as "Research Required" regardless of LLM output.
    const evidenceFields = {
      ccn: signal.ccn,
      event_date: signal.event_date,
      source: signal.source,
      source_url: signal.source_url,
      factual_evidence_summary: signal.factual_evidence_summary,
      date_retrieved: signal.date_retrieved,
    };
    const missingEvidence = Object.entries(evidenceFields)
      .filter(([, v]) => !v || !String(v).trim())
      .map(([k]) => k);
    const evidenceComplete = missingEvidence.length === 0;

    // Determine final verified status
    // Only mark verified if: confidence >= 80, source URL present, government source,
    // evidence is complete, and LLM recommends Verified with no human review required.
    const hasGovSource = signal.source_url && /\.(gov|state\.\w+|medicaid)/i.test(signal.source_url);
    const hasSourceUrl = !!signal.source_url;
    let verified = false;
    let finalStatus = result.recommended_status || "Research Required";

    // Force Research Required if evidence is incomplete
    if (!evidenceComplete) {
      finalStatus = "Research Required";
      verified = false;
    } else if (confidence >= 80 && hasSourceUrl && hasGovSource && finalStatus === "Verified" && !result.human_review_required) {
      verified = true;
    } else if (confidence >= 80 && finalStatus === "Verified" && result.human_review_required) {
      finalStatus = "Research Required";
      verified = false;
    } else {
      verified = false;
    }

    // Update the signal
    const updateData = {
      confidence_score: confidence,
      verification_method: result.verification_method || "LLM-assisted verification",
      verified,
      stale_data_flag: !!result.stale_data_flag,
      reviewer: user.full_name || user.email,
      reviewer_id: user.id,
      status: finalStatus === "Suppressed" ? "Unknown" : (signal.status || "Current"),
    };

    const updated = await svc.entities.RegulatorySignal.update(signalId, updateData);

    // Log
    try {
      await svc.entities.AutomationLog.create({
        automation: "Signal Verification",
        started: new Date().toISOString(),
        completed: new Date().toISOString(),
        status: "Success",
        records_processed: 1,
        affected_record_ids: [signalId],
        triggered_by: user.full_name || user.email || "system",
        errors: missingEvidence.length > 0 ? `Missing evidence fields: ${missingEvidence.join(", ")}` : null,
      });
    } catch (e) { /* best-effort */ }

    return Response.json({
      ok: true,
      signal_id: signalId,
      confidence_score: confidence,
      verification_method: result.verification_method,
      evidence_assessment: result.evidence_assessment,
      recommended_status: finalStatus,
      verified,
      stale_data_flag: result.stale_data_flag,
      human_review_required: result.human_review_required,
      evidence_complete: evidenceComplete,
      missing_evidence_fields: missingEvidence,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}