import type { ReactNode } from "react";
import { LegalPageLayout } from "@/components/shared/LegalPageLayout";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-brand-ink">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" effectiveDate="April 20, 2026">
      <p>
        This Privacy Policy explains what information Friendsly collects, how we use it, and the choices
        available to you when you use the service.
      </p>

      <Section title="Information we collect">
        <p>
          We collect information you provide directly, such as your name, email address, account details,
          profile information, support messages, booking topics, and payment-related records needed to
          complete transactions.
        </p>
        <p>
          We also collect usage and device information needed to operate the service, protect accounts,
          measure performance, and investigate abuse or fraud.
        </p>
      </Section>

      <Section title="How we use information">
        <p>We use information to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>create and manage accounts;</li>
          <li>process bookings, payments, refunds, and payouts;</li>
          <li>deliver live sessions and reminders;</li>
          <li>respond to support and safety reports;</li>
          <li>detect fraud, abuse, and policy violations; and</li>
          <li>improve product reliability and user experience.</li>
        </ul>
      </Section>

      <Section title="How we share information">
        <p>
          We share information with service providers who help us run Friendsly, such as hosting,
          authentication, video, and payment vendors. We may also share information when required by law, to
          enforce our terms, or to protect the rights, safety, and security of Friendsly and its users.
        </p>
        <p>
          Creator and fan profile information that is intentionally made public in the product may be visible
          to other users.
        </p>
      </Section>

      <Section title="Payments and sensitive data">
        <p>
          Payment details are handled by third-party payment processors. Friendsly does not store full card
          numbers in application code or normal product flows. Please do not send passwords, full card
          numbers, or other secrets through support forms.
        </p>
      </Section>

      <Section title="Retention and account deletion">
        <p>
          We retain information for as long as needed to provide the service, comply with legal obligations,
          resolve disputes, and protect the platform. You can request account deletion from your settings, and
          we will process it subject to legal, fraud-prevention, and financial recordkeeping requirements.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can update profile information from your account settings, contact support with privacy-related
          questions, and decide whether to continue using Friendsly. Because this is draft launch copy, any
          final privacy rights language will be updated after legal review.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Friendsly is not directed to children under 18, and we do not knowingly permit minors to use the
          service.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For privacy questions or requests, contact support@friendsly.app or use the support page in the app.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
