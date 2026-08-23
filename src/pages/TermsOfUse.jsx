import React from "react";
import { Link } from "react-router-dom";
import { FileText, Shield, Scale, AlertTriangle, Clock, Mail } from "lucide-react";
import { PageHero } from "@/components/PageCta";

export default function TermsOfUse() {
  return (
    <div>
      <PageHero
        eyebrow="Legal"
        title="Terms of Use"
        subtitle="The terms governing your use of the Clinical SOS website."
      />
      <section className="py-16">
        <div className="container-prose max-w-3xl">
          <div className="space-y-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 font-medium">
                  These Terms of Use are a draft pending founder and legal review. They have not been approved by legal counsel.
                </p>
              </div>
            </div>

            <Section icon={FileText} title="1. Acceptance of Terms">
              <p>
                By accessing or using the Clinical SOS website (the "Site"), you agree to be bound by these Terms of Use.
                If you do not agree to these terms, please do not use the Site. Clinical SOS is the public brand of
                Clinical Advantage Consultants LLC.
              </p>
            </Section>

            <Section icon={Shield} title="2. No Protected Health Information">
              <p>
                You must not submit protected health information (PHI), resident-identifiable information, or any other
                confidential or regulated health information through any form on this Site. Our website forms are not
                designed to receive, store, or transmit PHI. If you need to share sensitive information, do so through
                a secure channel during a formal consulting engagement.
              </p>
            </Section>

            <Section icon={Scale} title="3. Consulting Does Not Replace Legal Advice">
              <p>
                The information provided on this Site is for general informational purposes only and does not constitute
                legal, regulatory, or medical advice. Clinical SOS provides consulting services, not legal representation.
                Organizations should consult qualified legal counsel for legal advice and regulatory interpretation.
              </p>
            </Section>

            <Section icon={AlertTriangle} title="4. No Guaranteed Outcomes">
              <p>
                Clinical SOS does not promise or guarantee specific regulatory outcomes, survey results, or the
                acceptance of any Plan of Correction. Regulatory decisions rest with the appropriate state and federal
                authorities. We help organizations prepare and respond credibly, but we cannot guarantee any specific
                regulatory result.
              </p>
            </Section>

            <Section icon={Shield} title="5. Client Responsibility">
              <p>
                The client remains responsible for factual accuracy, implementation, submission, monitoring, and final
                operational decisions. Clinical SOS provides support, guidance, and recommendations, but the client
                organization retains responsibility for all final decisions and operational outcomes.
              </p>
            </Section>

            <Section icon={FileText} title="6. Intellectual Property">
              <p>
                The content on this Site, including text, graphics, logos, and design elements, is the property of
                Clinical Advantage Consultants LLC and is protected by applicable intellectual property laws. You may
                not reproduce, distribute, or create derivative works from the content on this Site without prior
                written permission.
              </p>
            </Section>

            <Section icon={Shield} title="7. Limitation of Liability">
              <p>
                To the fullest extent permitted by law, Clinical Advantage Consultants LLC shall not be liable for any
                direct, indirect, incidental, consequential, or punitive damages arising from your use of or reliance
                on the information provided on this Site. Your use of the Site is at your own risk.
              </p>
            </Section>

            <Section icon={Scale} title="8. Third-Party Links">
              <p>
                This Site may contain links to third-party websites. We are not responsible for the content, accuracy,
                or practices of any third-party websites. Accessing third-party websites through links on this Site is
                at your own risk.
              </p>
            </Section>

            <Section icon={FileText} title="9. Account Registration">
              <p>
                Certain areas of this Site, including the client portal, require an account. Client portal access is
                provided by invitation only. Creating a general account does not grant access to client records or
                portal features. Only users with an active client membership and authorized entitlements may access
                the client portal.
              </p>
            </Section>

            <Section icon={Clock} title="10. Changes to These Terms">
              <p>
                We may update these Terms of Use from time to time. Changes will be posted on this page with an updated
                revision date. Your continued use of the Site after changes are posted constitutes acceptance of the
                updated terms.
              </p>
            </Section>

            <Section icon={Mail} title="11. Contact">
              <p>
                If you have questions about these Terms of Use, please contact us through our{" "}
                <Link to="/contact" className="text-primary font-medium hover:underline">contact form</Link>.
              </p>
            </Section>

            <p className="text-xs text-muted-foreground border-t border-border pt-6">
              Last updated: August 23, 2026. This document is a draft and has not been reviewed or approved by legal counsel.
              Clinical Advantage Consultants LLC. All rights reserved.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </h2>
      <div className="text-muted-foreground leading-relaxed text-sm">{children}</div>
    </div>
  );
}