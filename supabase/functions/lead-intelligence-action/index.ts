import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function publicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (!legacy) throw new Error("Supabase publishable key unavailable");
  return legacy;
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase server key unavailable");
  return legacy;
}

function numberValue(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function audit(
  admin: ReturnType<typeof createClient>,
  actor: Record<string, unknown>,
  automation: string,
  ids: string[],
  errors: string | null = null,
) {
  try {
    const now = new Date().toISOString();
    await admin.from("automation_logs").insert({
      automation,
      started: now,
      completed: now,
      status: "Success",
      records_processed: 1,
      affected_record_ids: ids,
      triggered_by: actor.full_name || actor.email || "system",
      acting_user_id: actor.id,
      acting_profile_id: actor.id,
      acting_user_name: actor.full_name || actor.email || "Unknown",
      errors,
      manual_override: false,
    });
  } catch (error) {
    console.error("Non-blocking intelligence audit failure", error);
  }
}

async function config(admin: ReturnType<typeof createClient>) {
  const { data, error } = await admin.from("lead_engine_configs")
    .select("*").order("created_date", { ascending: true }).limit(1);
  if (error) throw error;
  return data?.[0] || {};
}

async function upsertLead(
  admin: ReturnType<typeof createClient>,
  facilityId: string,
  payload: Record<string, unknown>,
) {
  const { data: existing, error: existingError } = await admin.from("leads")
    .select("id").eq("facility_id", facilityId).order("created_date", { ascending: true }).limit(1);
  if (existingError) throw existingError;

  if (existing?.length) {
    const { data, error } = await admin.from("leads")
      .update(payload).eq("id", existing[0].id).select("*").single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await admin.from("leads")
    .insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

function simpleService(signalType: string) {
  const map: Record<string,string> = {
    "Immediate Jeopardy": "Rapid Survey Recovery",
    "CMP": "Survey Response and Plan of Correction Support",
    "DPNA": "Clinical Operations Stabilization",
    "Special Focus Facility": "Mock Surveys and Readiness Reviews",
    "SFF Candidate": "Mock Surveys and Readiness Reviews",
    "Repeat Deficiency": "Compliance Monitoring and Root Cause Analysis",
    "Infection-Control Deficiency": "Policy and Workflow Development",
    "Low Health Inspection Rating": "Mock Surveys and Readiness Reviews",
    "Follow-Up Survey": "Survey Response and Plan of Correction Support",
    "Ownership Change": "Interim Leadership and Subject Matter Support",
    "Leadership/Operational Signal": "Interim Leadership and Subject Matter Support",
  };
  return map[signalType] || null;
}

async function scoreSimple(
  admin: ReturnType<typeof createClient>,
  actor: Record<string, unknown>,
  facility: Record<string, any>,
  signals: Record<string, any>[],
  cfg: Record<string, any>,
) {
  if (!signals.length) {
    return {
      ok: true,
      score: 0,
      tier: "Nurture",
      explanation: "No regulatory signals on file for this facility.",
      signals_count: 0,
    };
  }

  const w = cfg.signal_weights || {
    immediate_jeopardy: 35, cmp: 25, dpna: 25, sff: 30,
    repeat_deficiency: 18, infection_control: 15, low_rating: 10,
    follow_up_survey: 12, ownership_change: 14, leadership_signal: 12,
  };

  const now = new Date();
  const lookbackDays = numberValue(cfg.regulatory_lookback_days, 365);
  const cutoff = new Date(now.getTime() - lookbackDays * 86400000);
  const breakdown: any[] = [];
  let score = 0;
  let verifiedCount = 0;
  let highSeverityCount = 0;

  for (const sig of signals) {
    if (sig.status === "Resolved") continue;
    const st = sig.signal_type;
    let weight =
      st === "Immediate Jeopardy" ? numberValue(w.immediate_jeopardy, 35) :
      st === "CMP" ? numberValue(w.cmp, 25) :
      st === "DPNA" ? numberValue(w.dpna, 25) :
      ["Special Focus Facility","SFF Candidate"].includes(st) ? numberValue(w.sff, 30) :
      st === "Repeat Deficiency" ? numberValue(w.repeat_deficiency, 18) :
      st === "Infection-Control Deficiency" ? numberValue(w.infection_control, 15) :
      st === "Low Health Inspection Rating" ? numberValue(w.low_rating, 10) :
      st === "Follow-Up Survey" ? numberValue(w.follow_up_survey, 12) :
      st === "Ownership Change" ? numberValue(w.ownership_change, 14) :
      st === "Leadership/Operational Signal" ? numberValue(w.leadership_signal, 12) : 8;

    let recencyFactor = 1;
    if (sig.event_date) {
      const eventDate = new Date(sig.event_date);
      if (eventDate < cutoff) {
        const daysOld = (now.getTime() - eventDate.getTime()) / 86400000;
        recencyFactor = Math.max(0.2, 1 - (daysOld - lookbackDays) / (lookbackDays * 2));
      }
    } else {
      recencyFactor = 0.5;
    }

    let severityMult = 1;
    if (sig.severity === "High") { severityMult = 1.2; highSeverityCount++; }
    else if (sig.severity === "Low") severityMult = 0.6;

    let verifyFactor = 0.5;
    if (sig.verified === true) { verifyFactor = 1; verifiedCount++; }
    else if (numberValue(sig.confidence_score, 0) >= 70) verifyFactor = 0.75;

    const component = Math.round(weight * recencyFactor * severityMult * verifyFactor);
    score += component;
    breakdown.push({
      signal_type: st,
      severity: sig.severity,
      event_date: sig.event_date,
      verified: sig.verified,
      weight,
      recencyFactor,
      severityMult,
      verifyFactor,
      component,
      source: sig.source,
    });
  }

  score = Math.min(100, score);
  const minScore = numberValue(cfg.minimum_lead_score, 40);
  const tier =
    score >= 75 && verifiedCount > 0 ? "Tier 1" :
    score >= 55 ? "Tier 2" :
    score >= minScore ? "Tier 3" : "Nurture";

  const explanation = [
    `Lead score: ${score}/100 (Tier: ${tier}).`,
    `Based on ${signals.length} regulatory signal(s) — ${verifiedCount} verified, ${highSeverityCount} high-severity.`,
    `Lookback period: ${lookbackDays} days.`,
    "",
    "Score breakdown:",
    ...breakdown.map((b) =>
      `• ${b.signal_type} (${b.severity || "Unknown"} severity, ${b.verified ? "verified" : "unverified"}, event: ${b.event_date || "unknown"}) → weight ${b.weight} × recency ${b.recencyFactor.toFixed(2)} × severity ${b.severityMult} × verification ${b.verifyFactor.toFixed(2)} = ${b.component} points.`
    ),
    "",
    `Tier logic: Tier 1 (score≥75 + ≥1 verified signal), Tier 2 (score≥55), Tier 3 (score≥${minScore}), Nurture (below ${minScore}).`,
    score === 0 && signals.length ? "All signals are resolved — no active regulatory concern detected." : "",
  ].filter(Boolean).join("\n");

  let recommendedService = "Survey Response and Plan of Correction Support";
  for (const item of breakdown) {
    const service = simpleService(item.signal_type);
    if (service) { recommendedService = service; break; }
  }

  const urgency = tier === "Tier 1" ? "Urgent" : tier === "Tier 2" ? "Regulatory" : tier === "Tier 3" ? "Proactive" : "General Inquiry";
  const lead = await upsertLead(admin, facility.id, {
    facility_id: facility.id,
    facility_name: facility.facility_name,
    organization_name: facility.operator_name,
    lead_score: score,
    lead_tier: tier,
    score_explanation: explanation,
    verification_status: verifiedCount ? "Verified" : "Research Required",
    recommended_service: recommendedService,
    potential_urgency: urgency,
    next_action: tier === "Tier 1" ? "Immediate outreach review required" :
      tier === "Tier 2" ? "Queue for outreach approval" :
      tier === "Tier 3" ? "Add to proactive outreach list" : "Monitor for changes",
    next_action_date: new Date().toISOString().slice(0,10),
    is_test_data: !!facility.is_test_data,
  });

  await audit(admin, actor, "Lead Scoring", [facility.id, lead.id].filter(Boolean));
  return {
    ok: true, score, tier, explanation, lead_id: lead.id,
    signals_count: signals.length, verified_count: verifiedCount,
    recommended_service: recommendedService,
  };
}

async function scoreDual(
  admin: ReturnType<typeof createClient>,
  actor: Record<string, unknown>,
  facility: Record<string, any>,
  signals: Record<string, any>[],
  cfg: Record<string, any>,
) {
  if (!signals.length) {
    return {
      ok: true, facility_id: facility.id, facility_name: facility.facility_name,
      regulatory_urgency_score: 0, commercial_opportunity_score: 0,
      clinical_sos_priority_score: 0, regulatory_urgency: "Unknown / Research Required",
      explanation: "No regulatory signals found for this facility. Cannot score without verified enforcement data.",
      regulatory_breakdown: [], commercial_breakdown: [], signals_count: 0,
    };
  }

  const lookbackDays = numberValue(cfg.regulatory_lookback_days, 365);
  const ruWeights = cfg.regulatory_urgency_weights || {};
  const coWeights = cfg.commercial_opportunity_weights || {};
  const prWeights = cfg.priority_score_weights || { regulatory_urgency_weight: 0.6, commercial_opportunity_weight: 0.4 };
  const now = new Date();
  const lookbackMs = lookbackDays * 86400000;
  const ruBreakdown: any[] = [];
  let ruScore = 0;

  for (const sig of signals) {
    const eventDate = sig.event_date ? new Date(sig.event_date) : null;
    const ageMs = eventDate ? now.getTime() - eventDate.getTime() : lookbackMs;
    const recency = ageMs <= lookbackMs ? Math.max(0.25, 1 - ageMs / lookbackMs) : 0.25;
    const verifiedMult = sig.verified ? 1 : 0.5;
    const severityMult = sig.severity === "High" ? 1.2 : sig.severity === "Medium" ? 1 : 0.7;

    let weight = 0;
    let label = "";
    switch (sig.signal_type) {
      case "Immediate Jeopardy": weight = numberValue(ruWeights.immediate_jeopardy, 35); label = "Immediate Jeopardy"; break;
      case "CMP": weight = sig.cmp_type === "Per Day" ? numberValue(ruWeights.cmp_per_day, 30) : numberValue(ruWeights.cmp_per_instance, 20); label = `CMP (${sig.cmp_type || "Unknown"})`; break;
      case "DPNA": weight = numberValue(ruWeights.dpna, 28); label = "Denial of Payment for New Admissions"; break;
      case "Special Focus Facility": weight = numberValue(ruWeights.sff_active, 25); label = "Special Focus Facility"; break;
      case "SFF Candidate": weight = numberValue(ruWeights.sff_candidate, 18); label = "SFF Candidate"; break;
      case "Repeat Deficiency": weight = numberValue(ruWeights.repeat_serious_deficiency, 18); label = "Repeat Deficiency"; break;
      case "Follow-Up Survey": weight = sig.revisit_status === "Failed" ? numberValue(ruWeights.failed_revisit, 22) : numberValue(ruWeights.upcoming_revisit, 12); label = `Follow-Up Survey (${sig.revisit_status || "Pending"})`; break;
      case "Infection-Control Deficiency": weight = numberValue(ruWeights.infection_control, 15); label = "Infection-Control Deficiency"; break;
      default: weight = sig.severity === "High" ? numberValue(ruWeights.high_severity, 12) : sig.severity === "Medium" ? numberValue(ruWeights.medium_severity, 8) : numberValue(ruWeights.low_severity, 4); label = sig.signal_type;
    }
    const points = Math.round(weight * recency * severityMult * verifiedMult);
    ruScore += points;
    ruBreakdown.push({
      signal_type: sig.signal_type, label, severity: sig.severity, verified: sig.verified,
      event_date: sig.event_date, weight,
      recency_multiplier: Math.round(recency * 100) / 100,
      severity_multiplier: severityMult, verification_multiplier: verifiedMult,
      points, source: sig.source, source_url: sig.source_url,
      evidence_summary: sig.factual_evidence_summary,
    });
  }

  let operatorCount = 1;
  if (facility.operator_name) {
    const { count, error } = await admin.from("facilities")
      .select("id", { count: "exact", head: true })
      .eq("operator_name", facility.operator_name);
    if (error) throw error;
    operatorCount = count || 1;
    if (operatorCount > 1) {
      const weight = numberValue(ruWeights.multi_facility_operator_bonus, 5);
      const points = Math.round(weight * Math.min(1, operatorCount / 5));
      ruScore += points;
      ruBreakdown.push({
        signal_type: "Operator Scope",
        label: `Multi-facility operator (${operatorCount} facilities)`,
        weight, recency_multiplier: 1, severity_multiplier: 1,
        verification_multiplier: 1, points,
        source: "Internal facility database",
        evidence_summary: `${facility.operator_name} operates ${operatorCount} facilities — enforcement at one may indicate systemic risk.`,
      });
    }
  }

  ruScore = Math.min(100, Math.round(ruScore));
  const hasVerified = signals.some((s) => s.verified);
  const hasIJ = signals.some((s) => s.signal_type === "Immediate Jeopardy");
  const hasDPNA = signals.some((s) => s.signal_type === "DPNA");
  const hasCMPPerDay = signals.some((s) => s.signal_type === "CMP" && s.cmp_type === "Per Day");
  const highSeverityCount = signals.filter((s) => s.severity === "High").length;

  let urgency = "Unknown / Research Required";
  if (!hasVerified && ruScore < 40) urgency = "Unknown / Research Required";
  else if (hasIJ || hasDPNA || hasCMPPerDay || (highSeverityCount >= 3 && hasVerified)) urgency = "Critical";
  else if (ruScore >= 70) urgency = "Severe";
  else if (ruScore >= 50) urgency = "High";
  else if (ruScore >= 30) urgency = "Moderate";
  else urgency = "Proactive";

  const coBreakdown: any[] = [];
  let coScore = 0;
  const enforcement = signals.some((s) => ["Immediate Jeopardy","CMP","DPNA","Special Focus Facility"].includes(s.signal_type));
  if (enforcement) {
    const p = numberValue(coWeights.service_match, 20); coScore += p;
    coBreakdown.push({ label: "Strong Clinical SOS service match (enforcement recovery)", points: p });
  } else {
    const p = Math.round(numberValue(coWeights.service_match, 20) * 0.5); coScore += p;
    coBreakdown.push({ label: "Moderate service match (consulting/proactive)", points: p });
  }

  if (operatorCount >= 5) {
    const p = numberValue(coWeights.operator_size, 15); coScore += p;
    coBreakdown.push({ label: `Multi-facility operator (${operatorCount} facilities)`, points: p });
  } else if (operatorCount >= 2) {
    const p = Math.round(numberValue(coWeights.operator_size, 15) * 0.7); coScore += p;
    coBreakdown.push({ label: `Small operator (${operatorCount} facilities)`, points: p });
  }
  if (operatorCount > 1) {
    const p = numberValue(coWeights.multi_facility_affected, 10); coScore += p;
    coBreakdown.push({ label: "Multiple facilities potentially affected", points: p });
  }

  const beds = numberValue(facility.bed_count, 0);
  if (beds >= 100) { coScore += 8; coBreakdown.push({ label: `Large facility (${beds} beds)`, points: 8 }); }
  else if (beds >= 50) { coScore += 5; coBreakdown.push({ label: `Medium facility (${beds} beds)`, points: 5 }); }

  const { data: contacts, error: contactsError } = await admin.from("contacts")
    .select("role_category").eq("facility_id", facility.id);
  if (contactsError) throw contactsError;
  if (contacts?.length) {
    const hasExec = contacts.some((c) => ["CEO","COO","Owner","Regional Operations","Regional Clinical"].includes(c.role_category));
    const p = hasExec ? numberValue(coWeights.decision_maker_identified, 15) : Math.round(numberValue(coWeights.decision_maker_identified, 15) * 0.6);
    coScore += p;
    coBreakdown.push({
      label: hasExec ? "Regional/executive decision-maker identified" : "Facility-level contact identified (administrator/DON)",
      points: p,
    });
  }

  if (["Critical","Severe"].includes(urgency)) {
    const p = numberValue(coWeights.urgency_alignment, 12); coScore += p;
    coBreakdown.push({ label: "High regulatory urgency aligns with immediate need", points: p });
  } else if (urgency === "High") {
    const p = Math.round(numberValue(coWeights.urgency_alignment, 12) * 0.7); coScore += p;
    coBreakdown.push({ label: "Moderate urgency alignment", points: p });
  }

  const { count: interactionCount, error: interactionError } = await admin.from("interactions")
    .select("id", { count: "exact", head: true }).eq("facility_id", facility.id);
  if (interactionError) throw interactionError;
  if (interactionCount) {
    const p = numberValue(coWeights.prior_interaction, 8); coScore += p;
    coBreakdown.push({ label: "Prior interaction recorded", points: p });
  }

  coScore = Math.min(100, Math.round(coScore));
  const ruWeight = numberValue(prWeights.regulatory_urgency_weight, 0.6);
  const coWeight = numberValue(prWeights.commercial_opportunity_weight, 0.4);
  const priority = Math.round(ruScore * ruWeight + coScore * coWeight);

  const explanation = [
    `REGULATORY URGENCY SCORE: ${ruScore}/100`,
    ...ruBreakdown.map((b) => `  • ${b.label}: +${b.points} (weight ${b.weight} × recency ${b.recency_multiplier} × severity ${b.severity_multiplier} × verification ${b.verification_multiplier})`),
    "", `COMMERCIAL OPPORTUNITY SCORE: ${coScore}/100`,
    ...coBreakdown.map((b) => `  • ${b.label}: +${b.points}`),
    "", `CLINICAL SOS PRIORITY SCORE: ${priority}/100`,
    `  Regulatory Urgency (${ruScore}) × ${ruWeight} + Commercial Opportunity (${coScore}) × ${coWeight} = ${priority}`,
    "", `Regulatory Urgency Classification: ${urgency}`,
    `Based on ${signals.length} regulatory signal(s) — ${signals.filter((s) => s.verified).length} verified, ${highSeverityCount} high-severity.`,
    `Operator scope: ${operatorCount} facilit${operatorCount === 1 ? "y" : "ies"} under ${facility.operator_name || "Unknown"}.`,
  ].join("\n");

  const tier = priority >= 75 ? "Tier 1" : priority >= 55 ? "Tier 2" : priority >= 40 ? "Tier 3" : "Nurture";
  const lead = await upsertLead(admin, facility.id, {
    facility_id: facility.id, facility_name: facility.facility_name,
    organization_name: facility.operator_name, lead_score: priority, lead_tier: tier,
    score_explanation: explanation, regulatory_urgency: urgency,
    regulatory_urgency_score: ruScore, commercial_opportunity_score: coScore,
    clinical_sos_priority_score: priority,
    score_breakdown: JSON.stringify({ regulatory: ruBreakdown, commercial: coBreakdown }),
    verification_status: hasVerified ? "Verified" : "Research Required",
    recommended_service: enforcement ? "Rapid Survey Recovery" : "Proactive Consulting",
    potential_urgency: urgency === "Critical" ? "Urgent" : urgency === "Severe" ? "Regulatory" : urgency === "High" ? "Corrective Action" : "Proactive",
    is_test_data: !!facility.is_test_data,
  });

  const { error: facilityError } = await admin.from("facilities").update({
    regulatory_urgency: urgency, regulatory_urgency_score: ruScore,
    commercial_opportunity_score: coScore, clinical_sos_priority_score: priority,
    score_explanation: explanation,
  }).eq("id", facility.id);
  if (facilityError) throw facilityError;

  await audit(admin, actor, "Dual Lead Scoring", [facility.id, lead.id].filter(Boolean));
  return {
    ok: true, facility_id: facility.id, facility_name: facility.facility_name,
    regulatory_urgency_score: ruScore, commercial_opportunity_score: coScore,
    clinical_sos_priority_score: priority, regulatory_urgency: urgency,
    explanation, regulatory_breakdown: ruBreakdown, commercial_breakdown: coBreakdown,
    signals_count: signals.length, verified_count: signals.filter((s) => s.verified).length,
    operator_facility_count: operatorCount, lead_id: lead.id,
  };
}

async function verifySignal(
  admin: ReturnType<typeof createClient>,
  actor: Record<string, unknown>,
  signal: Record<string, any>,
) {
  const fields: Record<string, unknown> = {
    ccn: signal.ccn,
    event_date: signal.event_date,
    source: signal.source,
    source_url: signal.source_url,
    factual_evidence_summary: signal.factual_evidence_summary,
    date_retrieved: signal.date_retrieved,
  };
  const missing = Object.entries(fields)
    .filter(([,value]) => !value || !String(value).trim())
    .map(([key]) => key);
  const evidenceComplete = missing.length === 0;

  let govSource = false;
  let sourceHost = "";
  if (signal.source_url) {
    try {
      sourceHost = new URL(signal.source_url).hostname.toLowerCase();
      govSource = sourceHost.endsWith(".gov") ||
        sourceHost.includes(".state.") ||
        sourceHost.includes("medicaid");
    } catch {}
  }

  let confidence = 0;
  if (signal.source) confidence += 10;
  if (signal.source_url) confidence += 15;
  if (govSource) confidence += 25;
  if (signal.event_date) confidence += 15;
  if (signal.ccn) confidence += 10;
  if (signal.factual_evidence_summary) confidence += 15;
  if (signal.date_retrieved) confidence += 5;
  if (signal.deficiency_tag || Number(signal.enforcement_amount) > 0) confidence += 5;
  confidence = Math.min(100, confidence);

  let stale = false;
  if (signal.event_date) {
    const ageDays = (Date.now() - new Date(signal.event_date).getTime()) / 86400000;
    stale = Number.isFinite(ageDays) && ageDays > 180;
  }

  const humanReview = !evidenceComplete || !govSource || confidence < 80 || stale;
  const verified = evidenceComplete && govSource && confidence >= 80 && !humanReview;
  const recommended = verified ? "Verified" : "Research Required";
  const method = "Deterministic evidence completeness, source-authority, specificity, and recency assessment";
  const assessment = verified
    ? `Evidence is complete and the source URL resolves to an authoritative government-domain pattern (${sourceHost}). Stored identifiers, date, retrieval timestamp, and factual summary support verification; this assessment does not independently fetch the external record.`
    : `Evidence requires human review. Missing fields: ${missing.length ? missing.join(", ") : "none"}. Government-source pattern: ${govSource ? "yes" : "no"}; stale-data flag: ${stale ? "yes" : "no"}. This assessment evaluates stored provenance fields and does not independently fetch the external record.`;

  const { error } = await admin.from("regulatory_signals").update({
    confidence_score: confidence,
    verification_method: method,
    verified,
    stale_data_flag: stale,
    reviewer: actor.full_name || actor.email,
    reviewer_id: actor.id,
    status: signal.status || "Current",
  }).eq("id", signal.id);
  if (error) throw error;

  await audit(
    admin, actor, "Signal Verification", [signal.id],
    missing.length ? `Missing evidence fields: ${missing.join(", ")}` : null,
  );

  return {
    ok: true, signal_id: signal.id, confidence_score: confidence,
    verification_method: method, evidence_assessment: assessment,
    recommended_status: recommended, verified, stale_data_flag: stale,
    human_review_required: humanReview, evidence_complete: evidenceComplete,
    missing_evidence_fields: missing,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("SUPABASE_URL unavailable");

    const userClient = createClient(url, publicKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor, error: actorError } = await admin.from("profiles")
      .select("id,email,full_name,role").eq("id", user.id).maybeSingle();
    if (actorError) throw actorError;
    if (!actor) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "verify_signal") {
      if (!["admin","clinical"].includes(actor.role)) return json({ error: "Forbidden — admin or clinical only" }, 403);
      const signalId = typeof body.signal_id === "string" ? body.signal_id : "";
      if (!signalId) return json({ error: "signal_id is required" }, 400);
      const { data: signal, error } = await admin.from("regulatory_signals")
        .select("*").eq("id", signalId).maybeSingle();
      if (error) throw error;
      if (!signal) return json({ error: "Signal not found" }, 404);
      return json(await verifySignal(admin, actor, signal));
    }

    if (!["score_lead","score_lead_dual"].includes(action)) return json({ error: "Unknown action" }, 400);
    if (!["admin","business_development","clinical"].includes(actor.role)) {
      return json({ error: "Forbidden — admin, business development, or clinical only" }, 403);
    }

    const facilityId = typeof body.facility_id === "string" ? body.facility_id : "";
    if (!facilityId) return json({ error: "facility_id is required" }, 400);

    const [{ data: facility, error: facilityError }, { data: signals, error: signalsError }, cfg] = await Promise.all([
      admin.from("facilities").select("*").eq("id", facilityId).maybeSingle(),
      admin.from("regulatory_signals").select("*").eq("facility_id", facilityId),
      config(admin),
    ]);
    if (facilityError) throw facilityError;
    if (signalsError) throw signalsError;
    if (!facility) return json({ error: "Facility not found" }, 404);

    return json(
      action === "score_lead"
        ? await scoreSimple(admin, actor, facility, signals || [], cfg)
        : await scoreDual(admin, actor, facility, signals || [], cfg)
    );
  } catch (error) {
    console.error("lead-intelligence-action failed", error);
    return json({ error: "Unable to complete lead intelligence action" }, 500);
  }
});
