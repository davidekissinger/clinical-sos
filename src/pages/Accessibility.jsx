import React from "react";
import { Link } from "react-router-dom";
import PageCta from "@/components/PageCta";

export default function Accessibility() {
  return (
    <>
      <section className="hero-gradient border-b border-border">
        <div className="container-prose py-16 lg:py-20">
          <p className="section-eyebrow">Our Commitment</p>
          <h1 className="mt-2 text-4xl font-bold text-foreground tracking-tight">Accessibility Statement</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Clinical SOS is committed to providing a digital experience that is accessible to
            people with disabilities. We are continually working to improve the accessibility and
            usability of our website and digital services.
          </p>
        </div>
      </section>

      <section className="py-12 lg:py-16">
        <div className="container-prose max-w-3xl">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <h2 className="text-2xl font-semibold text-foreground">Our Accessibility Goal</h2>
            <p className="text-muted-foreground mt-3">
              Clinical SOS aims to conform to the Web Content Accessibility Guidelines (WCAG) 2.2
              Level AA. We also strive to maintain compatibility with WCAG 2.1 Level AA requirements.
              These guidelines explain how to make web content more accessible to people with
              disabilities, including those who use screen readers, keyboard navigation, voice
              recognition software, and other assistive technologies.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10">What We Do</h2>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>Use semantic HTML structure with meaningful headings, landmarks, and labels.</li>
              <li>Ensure all interactive elements are keyboard accessible with visible focus indicators.</li>
              <li>Provide text alternatives for meaningful images and icons.</li>
              <li>Design for adequate color contrast in both light and dark modes.</li>
              <li>Never rely on color alone to convey meaning or status.</li>
              <li>Respect reduced-motion preferences for users who request it.</li>
              <li>Provide skip-to-content links on every major layout.</li>
              <li>Maintain accessible forms with programmatically associated labels and error messaging.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-foreground mt-10">Accessibility Is a Functional Requirement</h2>
            <p className="text-muted-foreground mt-3">
              We do not treat accessibility as a cosmetic enhancement or a third-party overlay.
              Accessibility is built into the structure, forms, navigation, and interactive
              controls of our website.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10">Continuous Improvement</h2>
            <p className="text-muted-foreground mt-3">
              Accessibility is an ongoing effort. Our process includes manual and automated
              evaluation as we continue to develop, test, and improve our digital services.
              New components and major changes are evaluated for accessibility before they are
              considered complete.
            </p>

            <h2 className="text-2xl font-semibold text-foreground mt-10">Reporting an Accessibility Issue</h2>
            <p className="text-muted-foreground mt-3">
              If you experience difficulty accessing or using any part of our website or digital
              services, please contact us so we can assist you. You are not required to disclose a
              disability to request assistance.
            </p>
            <p className="text-muted-foreground mt-3">
              When reporting an issue, please include:
            </p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>A description of the accessibility issue you encountered</li>
              <li>The page or feature involved</li>
              <li>Your preferred method of response, if applicable</li>
            </ul>

            <div className="mt-6 p-5 rounded-xl border border-border bg-secondary/30">
              <p className="text-sm font-medium text-foreground">Contact us about accessibility</p>
              <p className="text-sm text-muted-foreground mt-1">
                <Link to="/contact" className="text-primary hover:underline font-medium">Use our contact form</Link>
                {" "}and select "General inquiry" as the urgency level, or mention "accessibility" in your message.
              </p>
            </div>

            <div className="mt-8 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Clinical SOS does not claim "ADA Certified," "ADA Guaranteed," or "100% ADA Compliant"
                status. We are committed to providing an accessible digital experience and continuously
                work to improve accessibility.
              </p>
            </div>

            <h2 className="text-2xl font-semibold text-foreground mt-10">Third-Party Content</h2>
            <p className="text-muted-foreground mt-3">
              Some content on our website may be provided by third parties. While we strive to select
              accessible third-party tools and resources, we cannot guarantee the accessibility of
              third-party content that we do not control.
            </p>
          </div>
        </div>
      </section>

      <PageCta />
    </>
  );
}