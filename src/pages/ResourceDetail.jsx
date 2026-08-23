import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PageCta from "@/components/PageCta";
import { RESOURCES } from "@/lib/siteContent";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

const ARTICLE_BODY = {
  "what-happens-after-a-nursing-home-survey-deficiency": [
    "A survey deficiency triggers a structured response process. Understanding what comes next helps leadership respond calmly and credibly rather than reactively.",
    "After findings are issued, the facility typically receives a statement of deficiencies and is expected to submit a Plan of Correction. The Plan of Correction describes how each deficiency will be addressed, how corrective actions will be monitored, and how recurrence will be prevented.",
    "The most effective responses focus on root causes rather than surface fixes. A deficiency that recurs in a later survey often indicates an underlying systems issue that was never fully addressed.",
    "Follow-up survey activity may verify that corrective actions are in place and sustained. Preparation for that follow-up should begin early, not at the last minute.",
  ],
  "understanding-plans-of-correction": [
    "A Plan of Correction is a facility's documented response to survey findings. It explains how each deficiency will be corrected, how corrective actions will be monitored for effectiveness, and how recurrence will be prevented.",
    "A credible Plan of Correction is specific, measurable, and aligned with how the facility actually operates. Vague commitments are harder to defend and harder to sustain.",
    "The strongest Plans of Correction connect corrective actions to root causes. When the underlying system issue is addressed, the corrective action is more likely to hold.",
    "Plans of Correction should be treated as living documents — implemented, monitored, and adjusted based on what the monitoring shows.",
  ],
  "preparing-for-a-follow-up-survey": [
    "A follow-up survey verifies that corrective actions are in place and sustained. Preparation should focus on evidence, consistency, and staff readiness.",
    "Documentation should demonstrate not just that a policy exists, but that it is being followed. Look for the gap between what is written and what is actually happening day to day.",
    "Staff should be able to speak to the changes that were made and why. Preparation that includes the people who do the work is more durable than preparation that happens only on paper.",
    "Approaching follow-up preparation as a sustained effort — rather than a last-minute scramble — produces more credible results and less organizational disruption.",
  ],
  "immediate-jeopardy-operational-response-considerations": [
    "An Immediate Jeopardy finding is among the most serious survey outcomes and demands a calm, structured response. The first priority is addressing the immediate risk.",
    "Effective response focuses on eliminating the jeopardy, documenting the corrective actions taken, and building a defensible position for follow-up.",
    "Because the stakes are high, experienced support can help leadership avoid compounding the situation with reactive decisions. A measured, evidence-based approach is stronger than a rushed one.",
    "Immediate Jeopardy situations should not be handled in isolation. Engaging clinical leadership, compliance, and operational leadership together produces a more coherent response.",
  ],
  "root-cause-analysis-in-skilled-nursing": [
    "Repeat deficiencies frequently point to underlying systems, not isolated mistakes. Root cause analysis is the process of identifying those underlying causes.",
    "Effective root cause analysis looks beyond the immediate event to the conditions that allowed it to occur — staffing, workflow, communication, documentation, training, and accountability.",
    "The goal is not to assign blame but to understand the system. Corrective actions that address root causes are far more likely to prevent recurrence than actions that address only the symptom.",
    "Root cause analysis works best when it is structured, documented, and revisited over time to confirm that corrective actions are working.",
  ],
  "mock-survey-readiness": [
    "A mock survey mirrors the regulatory survey process to surface issues before a real survey does. It is one of the most effective proactive tools available.",
    "A well-run mock survey is scoped to current regulatory focus areas and produces a prioritized list of findings with practical remediation guidance.",
    "The value of a mock survey depends on how honestly findings are reported and how seriously they are addressed. A mock survey that confirms everything is fine adds little.",
    "Mock surveys work best as part of a rhythm — not a one-time event — so that readiness is sustained rather than episodic.",
  ],
  "clinical-leadership-stabilization": [
    "Clinical leadership vacancies and instability create real risk for residents, staff, and survey outcomes. Stabilization focuses on continuity and consistency.",
    "Interim leadership support can bridge the gap while permanent solutions are built, providing continuity rather than a leadership vacuum.",
    "Stabilization is not only about filling a role. It is about supporting the systems, workflows, and accountability that clinical leadership depends on.",
    "Mentoring and transition support for incoming leaders helps ensure that improvements are sustained beyond the interim period.",
  ],
  "common-operational-breakdowns-behind-repeat-deficiencies": [
    "Repeat deficiencies often share common operational patterns: unclear accountability, inconsistent workflows, documentation that does not match practice, and weak monitoring.",
    "When the same deficiency appears across multiple surveys, it usually means the corrective action addressed the symptom but not the system.",
    "Communication breakdowns between shifts, departments, and leadership are a frequent underlying cause. So is training that does not translate into consistent practice.",
    "Breaking the cycle requires looking at operations as a system and building corrective actions that change how the work actually gets done.",
  ],
};

export default function ResourceDetail() {
  const { slug } = useParams();
  const resource = RESOURCES.find((r) => r.slug === slug);
  useDocumentMeta(
    resource ? `${resource.title} — Clinical SOS` : "Resource Not Found — Clinical SOS",
    resource ? resource.excerpt : undefined
  );
  if (!resource) {
    return (
      <div className="container-prose py-24 text-center">
        <h1 className="text-2xl font-bold">Resource not found</h1>
        <Link to="/resources" className="btn-primary mt-6">Back to resources</Link>
      </div>
    );
  }
  const body = ARTICLE_BODY[slug] || ["Content for this resource is being prepared."];

  return (
    <div>
      <article className="py-16 md:py-20">
        <div className="container-prose max-w-3xl">
          <Link to="/resources" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> All resources</Link>
          <span className="mt-6 block text-xs font-semibold text-[hsl(262_50%_45%)] uppercase tracking-wide">{resource.category}</span>
          <h1 className="mt-2 text-3xl md:text-4xl font-bold leading-tight">{resource.title}</h1>
          <div className="mt-8 space-y-5 text-foreground/90 leading-relaxed text-lg">
            {body.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <p className="mt-10 text-xs text-muted-foreground border-t border-border pt-6">
            This content is educational and factual. It does not constitute legal advice and makes no
            regulatory guarantees. Specific prospect or facility regulatory information is not
            published as marketing content.
          </p>
        </div>
      </article>
      <PageCta />
    </div>
  );
}