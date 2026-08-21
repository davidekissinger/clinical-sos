// Central source of truth for Clinical SOS services, navigation, and site copy.
// Brand positioning kept faithful to the master website document.

export const NAV_LINKS = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about" },
  { label: "Services", path: "/services" },
  { label: "Who We Help", path: "/who-we-help" },
  { label: "Resources", path: "/resources" },
  { label: "FAQ", path: "/faq" },
  { label: "Contact", path: "/contact" },
];

export const SERVICES = [
  {
    slug: "survey-response-and-plan-of-correction",
    title: "Survey Response and Plan of Correction Support",
    short: "Practical support responding to survey deficiencies and developing credible Plans of Correction.",
    icon: "ClipboardCheck",
    summary:
      "When a survey identifies deficiencies, the response that follows can define a facility's trajectory. Clinical SOS helps leadership interpret findings, organize an effective response, and develop a defensible Plan of Correction.",
    points: [
      "Survey deficiency review and interpretation",
      "Plan of Correction drafting and refinement",
      "Corrective-action planning with clinical and operational alignment",
      "Preparation for follow-up survey activity",
    ],
  },
  {
    slug: "mock-surveys-and-readiness-reviews",
    title: "Mock Surveys and Readiness Reviews",
    short: "Structured mock surveys and readiness reviews to surface issues before a real survey does.",
    icon: "SearchCheck",
    summary:
      "Proactive readiness is far less disruptive than reactive recovery. Clinical SOS conducts mock surveys and readiness reviews that mirror regulatory expectations and produce a prioritized action list.",
    points: [
      "Full-scope mock survey aligned to current regulatory focus areas",
      "Focused readiness reviews on high-risk domains",
      "Prioritized findings with practical remediation guidance",
      "Documentation and process gap identification",
    ],
  },
  {
    slug: "compliance-monitoring-and-root-cause-analysis",
    title: "Compliance Monitoring and Root Cause Analysis",
    short: "Ongoing compliance monitoring and root cause analysis to break repeat-deficiency cycles.",
    icon: "Activity",
    summary:
      "Repeat deficiencies often point to underlying systems, not isolated mistakes. Clinical SOS helps organizations identify root causes and build monitoring that sustains compliance over time.",
    points: [
      "Root cause analysis for recurring deficiencies",
      "Compliance monitoring program design",
      "Trend analysis across surveys and audits",
      "Sustainable corrective systems rather than one-time fixes",
    ],
  },
  {
    slug: "policy-and-workflow-development",
    title: "Policy and Workflow Development",
    short: "Clear, current policies and workflows that staff can actually follow and surveyors can verify.",
    icon: "FileText",
    summary:
      "Policies only protect an organization if they are current, aligned with practice, and consistently applied. Clinical SOS helps develop and refine policies and workflows that close the gap between documentation and daily operations.",
    points: [
      "Policy review, update, and development",
      "Workflow mapping and standardization",
      "Alignment with current regulatory expectations",
      "Staff-friendly procedures that support consistent practice",
    ],
  },
  {
    slug: "clinical-operations-stabilization",
    title: "Clinical Operations Stabilization",
    short: "Hands-on support stabilizing clinical operations during periods of instability or transition.",
    icon: "Stethoscope",
    summary:
      "Operational instability affects residents, staff, and survey outcomes. Clinical SOS works alongside clinical leadership to stabilize operations, restore consistency, and rebuild confidence.",
    points: [
      "Clinical operations assessment and stabilization",
      "Staffing and workflow realignment",
      "Leadership coaching and clinical system repair",
      "Monitoring through transition periods",
    ],
  },
  {
    slug: "interim-leadership-and-subject-matter-support",
    title: "Interim Leadership and Subject Matter Support",
    short: "Experienced interim leadership and subject-matter support to bridge critical gaps.",
    icon: "Users",
    summary:
      "Leadership vacancies and subject-matter gaps create real risk. Clinical SOS provides experienced interim leadership and targeted subject-matter support to bridge those gaps while permanent solutions are built.",
    points: [
      "Interim clinical leadership support",
      "Targeted subject-matter expertise",
      "Mentoring and transition support for incoming leaders",
      "Continuity during recruitment and onboarding",
    ],
  },
  {
    slug: "vendor-performance-and-risk-evaluation",
    title: "Vendor Performance & Risk Evaluation",
    short: "Structured, evidence-based evaluations of prospective and existing vendors serving skilled nursing and long-term care organizations.",
    icon: "ShieldCheck",
    summary:
      "Clinical SOS provides structured, evidence-based evaluations of prospective and existing vendors serving skilled nursing and long-term care organizations. We examine vendor qualifications, regulatory exposure, clinical performance, service reliability, contractual expectations, data-security practices, corrective-action history, and operational fit. Our evaluations help leadership make better-supported decisions about vendor selection, continued use, corrective action, monitoring, and contract renewal.",
    points: [
      "Identify vendor-related compliance and operational risks",
      "Evaluate performance against defined expectations",
      "Verify qualifications, insurance, licensing, and supporting evidence",
      "Connect vendor performance to resident safety and regulatory exposure",
      "Establish measurable corrective-action requirements",
      "Compare vendors using consistent criteria",
      "Support contract-renewal and replacement decisions",
      "Incorporate vendor performance into QAPI oversight",
    ],
  },
];

export const TEAM = [
  {
    name: "Mindy Jensen, RN",
    role: "Co-Founder | Clinical Leadership",
    initials: "MJ",
    photo: "https://static.wixstatic.com/media/99322d_4962391effc14625a3272ac6e80eb1ba~mv2.jpg",
    focus: [
      "Long-term care clinical leadership",
      "Skilled nursing operations",
      "Director of Nursing experience",
      "Regulatory recovery support",
    ],
    bio: "Mindy brings clinical leadership experience in skilled nursing and long-term care operations, including Director of Nursing responsibilities and support for organizations working through regulatory recovery.",
  },
  {
    name: "David Kissinger, BSHA, RN",
    role: "Co-Founder | Strategy and Business Development",
    initials: "DK",
    photo: "https://static.wixstatic.com/media/99322d_907dc51bd7d544d0be18c0b0c5f0df71~mv2.jpg",
    focus: [
      "Business development and strategy",
      "Client engagement",
      "Healthcare operations perspective",
      "Connecting organizations with the right consulting support",
    ],
    bio: "David focuses on business development, strategy, and client engagement, bringing a healthcare operations perspective and helping organizations connect with the consulting support they need.",
  },
  {
    name: "Matthew Bartow",
    role: "Co-Founder | Operations and Finance",
    initials: "MB",
    photo: "https://static.wixstatic.com/media/99322d_425b50ada8b54e21aee5db280bb76e47~mv2.jpg",
    focus: [
      "Operations",
      "Finance and billing",
      "Invoicing and reporting",
      "Business infrastructure",
    ],
    bio: "Matthew leads operations and finance, overseeing billing, invoicing, reporting, and the business infrastructure that supports Clinical SOS engagements.",
  },
];

export const WHO_WE_HELP = [
  "Skilled nursing facilities",
  "Long-term care organizations",
  "Multi-facility operators",
  "Facilities under survey pressure",
  "Organizations needing corrective action",
  "Facilities experiencing leadership or operational instability",
];

export const WHEN_TO_CALL = [
  "A recent survey identified deficiencies requiring a Plan of Correction",
  "Your organization is facing follow-up survey activity",
  "Immediate Jeopardy or enforcement action is creating pressure",
  "Leadership gaps are affecting clinical operations",
  "Repeat deficiencies suggest an underlying systems issue",
  "You want to assess readiness before the next survey cycle",
  "Operational instability is affecting consistency of care",
  "Your team would benefit from experienced, grounded support",
];

export const PROCESS_STEPS = [
  { label: "Assess", desc: "Understand the situation, the findings, and the operational context." },
  { label: "Prioritize", desc: "Focus on the highest-risk issues and the actions that matter most." },
  { label: "Support", desc: "Provide practical, experienced support aligned to your reality." },
  { label: "Stabilize", desc: "Help restore consistency, confidence, and a defensible position." },
];

export const FAQS = [
  {
    q: "What does Clinical SOS do?",
    a: "Clinical SOS provides practical consulting support for skilled nursing and long-term care organizations facing survey pressure, compliance concerns, operational instability, and leadership challenges. We focus on grounded, experienced support rather than generic advice.",
  },
  {
    q: "Can Clinical SOS guarantee a survey result?",
    a: "No. We do not promise specific regulatory outcomes or imply that we can guarantee acceptance of a Plan of Correction. We help organizations prepare and respond credibly, but regulatory decisions rest with the appropriate authorities.",
  },
  {
    q: "How quickly can Clinical SOS respond?",
    a: "For urgent situations such as Immediate Jeopardy or active enforcement, we aim to engage quickly. Request a consultation and share your urgency level, and our team will respond accordingly.",
  },
  {
    q: "How long is a typical engagement?",
    a: "Rapid Survey Recovery engagements are often in the range of two to six weeks depending on circumstances, though every situation is different. We scope engagements to the actual need rather than a fixed timeline.",
  },
  {
    q: "Do you work with multi-facility operators?",
    a: "Yes. We support single facilities and multi-facility operators, and we can coordinate operator-level responses when a regulatory pattern affects multiple facilities under one ownership structure.",
  },
  {
    q: "Will you share our information publicly?",
    a: "No. Information you submit through our contact form is kept private and is used only to respond to your request. We do not publish prospect-specific regulatory information as marketing content.",
  },
  {
    q: "Should I include resident information in the contact form?",
    a: "No. Please do not submit protected health information or resident-identifiable information through the form. Describe your situation in general terms and we will follow up directly.",
  },
];

export const RESOURCES = [
  {
    slug: "what-happens-after-a-nursing-home-survey-deficiency",
    title: "What Happens After a Nursing Home Survey Deficiency?",
    excerpt: "A practical overview of the steps that follow a survey deficiency and how to approach the response.",
    category: "Survey Response",
  },
  {
    slug: "understanding-plans-of-correction",
    title: "Understanding Plans of Correction",
    excerpt: "What a Plan of Correction is, what it should accomplish, and what makes one defensible.",
    category: "Compliance",
  },
  {
    slug: "preparing-for-a-follow-up-survey",
    title: "Preparing for a Follow-Up Survey",
    excerpt: "How to approach follow-up survey preparation with focus and credibility.",
    category: "Survey Readiness",
  },
  {
    slug: "immediate-jeopardy-operational-response-considerations",
    title: "Immediate Jeopardy: Operational Response Considerations",
    excerpt: "Calm, structured considerations for organizations facing an Immediate Jeopardy finding.",
    category: "Regulatory",
  },
  {
    slug: "root-cause-analysis-in-skilled-nursing",
    title: "Root Cause Analysis in Skilled Nursing",
    excerpt: "Why repeat deficiencies often point to systems, and how to investigate root causes effectively.",
    category: "Compliance",
  },
  {
    slug: "mock-survey-readiness",
    title: "Mock Survey Readiness",
    excerpt: "How a well-run mock survey surfaces real issues before a real survey does.",
    category: "Survey Readiness",
  },
  {
    slug: "clinical-leadership-stabilization",
    title: "Clinical Leadership Stabilization",
    excerpt: "Supporting clinical operations and leadership continuity during periods of instability.",
    category: "Operations",
  },
  {
    slug: "common-operational-breakdowns-behind-repeat-deficiencies",
    title: "Common Operational Breakdowns Behind Repeat Deficiencies",
    excerpt: "The operational patterns that frequently underlie recurring survey findings.",
    category: "Operations",
  },
];