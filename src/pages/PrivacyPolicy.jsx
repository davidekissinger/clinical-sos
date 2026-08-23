import React from "react";
import { Link } from "react-router-dom";
import { Shield, Mail, FileText, Clock, Lock, Eye, Server, AlertTriangle } from "lucide-react";
import { PageHero } from "@/components/PageCta";

export default function PrivacyPolicy() {
  return (
    <div>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="How Clinical SOS collects, uses, and protects information submitted through our website."
      />
      <section className="py-16">
        <div className="container-prose max-w-3xl">
          <div className="space-y-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 font-medium">
                  This Privacy Policy is a draft pending founder and legal review. It has not been approved by legal counsel.
                </p>
              </div>
            </div>

            <Section icon={FileText} title="1. About This Policy">
              <p>
                Clinical SOS is the public brand of Clinical Advantage Consultants LLC. This Privacy Policy describes
                what information we collect through our website and how we use, protect, and retain it. This policy
                applies to information submitted through our public website forms, including our consultation request form.
              </p>
              <p>
                This policy does not cover information shared during a formal consulting engagement, which is governed
                by the terms of the engagement agreement between Clinical Advantage Consultants LLC and the client organization.
              </p>
            </Section>

            <Section icon={Eye} title="2. Information We Collect">
              <p>When you submit a consultation request through our website, we collect the following information:</p>
              <ul className="mt-3 space-y-1.5 list-disc list-inside text-sm">
                <li><strong>Contact information:</strong> Your name, business email, and business phone number</li>
                <li><strong>Organization information:</strong> Your organization name, title, facility or organization name, state, and number of facilities</li>
                <li><strong>Inquiry contents:</strong> The service you are interested in, your current challenge (as described by you), your urgency level, preferred contact method, and preferred consultation time</li>
                <li><strong>Consent records:</strong> Whether you acknowledged the communication consent</li>
                <li><strong>Source page:</strong> The page on our website from which you submitted the form</li>
                <li><strong>IP address:</strong> Your IP address at the time of submission, collected automatically for security and abuse prevention</li>
                <li><strong>Timestamps:</strong> The date and time of your submission and when the form was loaded in your browser</li>
                <li><strong>Analytics events:</strong> Anonymous analytics events such as form start and form submission, which do not include your personal information</li>
              </ul>
              <p className="mt-3 text-sm">
                We do not collect protected health information (PHI) or resident-identifiable information through our
                website forms. Please do not submit PHI through any website form.
              </p>
            </Section>

            <Section icon={Server} title="3. Purpose of Collection">
              <p>We use the information you submit to:</p>
              <ul className="mt-3 space-y-1.5 list-disc list-inside text-sm">
                <li>Respond to your consultation request</li>
                <li>Qualify the urgency of your inquiry and route it to the appropriate team member</li>
                <li>Prepare relevant context for an initial consultation conversation</li>
                <li>Create internal records (contact, opportunity, and task) in our customer relationship management system</li>
                <li>Score and categorize leads for internal prioritization</li>
                <li>Prevent automated abuse of our forms using IP address, timestamp, and honeypot techniques</li>
              </ul>
            </Section>

            <Section icon={Lock} title="4. Internal Access">
              <p>
                Access to information submitted through our website is restricted to authorized Clinical SOS team members
                with a legitimate business need. Access is controlled through role-based permissions. Administrators
                and business development team members may access consultation request records. Other team members
                do not have access unless explicitly authorized.
              </p>
            </Section>

            <Section icon={Server} title="5. Service Providers">
              <p>
                Clinical SOS uses the Base44 platform to host our website, store submitted information, and manage
                our internal operations. Base44 acts as our service provider and processes submitted information on
                our behalf. We do not sell, rent, or share your information with third parties for marketing purposes.
              </p>
            </Section>

            <Section icon={Clock} title="6. Retention">
              <p>
                Information submitted through our consultation request form is retained for as long as necessary to
                respond to your inquiry and for legitimate business record-keeping purposes. If you become a client,
                your information may be retained as part of your client engagement records. If you do not become a
                client, your information is retained for a reasonable period to document the inquiry and response.
              </p>
            </Section>

            <Section icon={Lock} title="7. Security Limitations">
              <p>
                We implement reasonable technical and organizational measures to protect the information you submit.
                However, no website or transmission method is completely secure. We cannot guarantee the absolute
                security of your information. If you have sensitive or confidential information to share, please do so
                through a secure channel during a formal consulting engagement, not through our website forms.
              </p>
              <p className="mt-3">
                Clinical SOS is not HIPAA-compliant and does not claim any regulatory certification regarding data
                protection. We do not accept or store protected health information through our website.
              </p>
            </Section>

            <Section icon={Mail} title="8. Contact Us">
              <p>
                If you have questions about this Privacy Policy or how your information is handled, please contact us
                through our <Link to="/contact" className="text-primary font-medium hover:underline">contact form</Link>.
              </p>
            </Section>

            <Section icon={Clock} title="9. Updates to This Policy">
              <p>
                We may update this Privacy Policy from time to time. Changes will be posted on this page with an
                updated revision date. We encourage you to review this page periodically.
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