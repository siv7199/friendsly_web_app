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

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" effectiveDate="April 20, 2026">
      <p>
        These Terms of Service govern your access to Friendsly. By creating an account, booking a call,
        joining a live session, or otherwise using the service, you agree to follow these terms and our
        Privacy Policy.
      </p>

      <Section title="Who can use Friendsly">
        <p>
          Friendsly is intended only for adults who are at least 18 years old. By using the service, you
          confirm that you are 18 or older and that you can enter into a binding agreement.
        </p>
        <p>
          You may not use Friendsly if you are barred from receiving services under applicable law or if
          your account has been suspended or terminated.
        </p>
      </Section>

      <Section title="Accounts and acceptable use">
        <p>
          You are responsible for keeping your login credentials secure and for activity that occurs under
          your account. Please provide accurate information, keep your contact details current, and do not
          impersonate another person.
        </p>
        <p>
          You may not use Friendsly to harass, threaten, exploit, defraud, distribute unlawful content, or
          interfere with the experience of creators, fans, or the platform. We may investigate misuse and
          remove content, suspend access, or terminate accounts when needed to protect the community.
        </p>
      </Section>

      <Section title="Bookings, payments, and refunds">
        <p>
          Paid bookings and live-stage fees are processed through third-party payment providers. Prices,
          durations, cancellation windows, late fees, and refund outcomes are shown in the product flow and
          are incorporated into these terms.
        </p>
        <p>
          When you purchase a booking, you authorize Friendsly and its payment partners to charge the amount
          displayed at checkout, along with any applicable taxes or fees. Refunds, if available, are handled
          according to the booking refund policy shown before and after purchase.
        </p>
      </Section>

      <Section title="Calls, live sessions, and recordings">
        <p>
          Friendsly is designed for live interactive sessions. Unless Friendsly expressly allows it in the
          product flow or both participants clearly consent where required by law, you may not record, copy,
          or redistribute calls, live sessions, or private communications from the platform.
        </p>
        <p>
          We may limit access to calls or live features, including join windows and participation controls,
          to protect users and enforce platform policies.
        </p>
      </Section>

      <Section title="Termination and suspension">
        <p>
          You may stop using Friendsly at any time and can request account deletion through your settings.
          We may suspend or terminate access if we believe you violated these terms, created safety risk,
          failed to meet payment obligations, or exposed Friendsly to legal or operational harm.
        </p>
      </Section>

      <Section title="Disclaimers and limits">
        <p>
          Friendsly is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest extent allowed by law,
          Friendsly disclaims warranties of merchantability, fitness for a particular purpose, and
          non-infringement.
        </p>
        <p>
          To the fullest extent permitted by law, Friendsly will not be liable for indirect, incidental,
          special, consequential, or punitive damages arising out of or related to your use of the service.
        </p>
      </Section>

      <Section title="Dispute resolution">
        <p>
          These draft terms contemplate an arbitration-based dispute resolution process and class-action
          waiver, subject to review by counsel and the final published legal text. Until that review is
          complete, treat this section as placeholder language only.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms can be sent through the support page or by emailing support@friendsly.app.
        </p>
      </Section>
    </LegalPageLayout>
  );
}
