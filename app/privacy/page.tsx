import Link from "next/link";

const PURPLE = "#6d28d9";
const BORDER = "#cec6e5";
const MUTED = "#6b7280";
const TEXT = "#0f0a1e";
const WORDMARK_FONT = 'var(--font-brand, "Times New Roman", serif)';

export const metadata = { title: "Privacy Policy — Friendsly" };

export default function PrivacyPage() {
  return (
    <CompliancePage title="Privacy Policy" section="Legal">
      <PolicySection title="What We Collect">
        <p>We collect your name, email address, and profile image when you create an account. We collect payment information, which is processed and stored by Stripe. We do not store your full card number. We collect information about your activity on the platform, including calls joined, bookings made, and credits spent.</p>
      </PolicySection>

      <PolicySection title="How We Use Your Information">
        <p>We use your information to operate your account, process payments, send account-related emails such as booking confirmations and credit notifications, and enforce our Terms of Service. We do not send marketing emails. We use AI to generate topic summaries from call transcriptions. These summaries are internal and not shared publicly.</p>
      </PolicySection>

      <PolicySection title="Video and Audio Data">
        <p>Live calls are public sessions that may be recorded by creators or by Friendsly. By joining a live call, you consent to the possibility of being recorded. Private one-on-one bookings are not recorded. Video infrastructure is provided by Daily.co. Recordings from live calls may be stored for up to 30 days. In-call chat messages are deleted when the call ends.</p>
      </PolicySection>

      <PolicySection title="Third Parties">
        <p>We share data with Stripe for payment processing and Daily.co for video infrastructure. We do not sell your personal data to third parties.</p>
      </PolicySection>

      <PolicySection title="Cookies">
        <p>We use cookies only for session management and authentication. We do not use advertising cookies or third-party tracking cookies.</p>
      </PolicySection>

      <PolicySection title="Data Retention">
        <p>We retain your account data for as long as your account is active. If you delete your account, your personal data is deleted. Recordings from live calls are stored for up to 30 days then automatically deleted.</p>
      </PolicySection>

      <PolicySection title="Your Rights">
        <p>
          You may request access to, correction of, or deletion of your personal data by contacting{" "}
          <a href="mailto:matvey@friendsly.app" style={{ color: PURPLE, textDecoration: "none" }}>matvey@friendsly.app</a>. If you are a California resident, you have rights under the CCPA, including the right to know what data we collect, the right to delete your data, and the right to opt out of the sale of your data. We do not sell data. If you are in the EU, you may have rights under the GDPR.
        </p>
      </PolicySection>

      <PolicySection title="Children">
        <p>Friendsly is not intended for anyone under 18. We do not knowingly collect data from anyone under 18. If we become aware that a user is under 18, we will delete their account.</p>
      </PolicySection>

      <PolicySection title="Security">
        <p>We use HTTPS on all pages. Payments are handled by Stripe, which is PCI-DSS compliant. We do not store payment card data on our servers.</p>
      </PolicySection>

      <PolicySection title="Changes to This Policy">
        <p>We may update this policy. We will notify you by email if we make material changes.</p>
      </PolicySection>

      <PolicySection title="Contact">
        <p><a href="mailto:matvey@friendsly.app" style={{ color: PURPLE, textDecoration: "none" }}>matvey@friendsly.app</a></p>
      </PolicySection>
    </CompliancePage>
  );
}

/* ── Shared layout components ── */

function CompliancePage({ title, section, children }: { title: string; section: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", color: TEXT, fontFamily: "var(--font-sans, Inter, sans-serif)", minHeight: "100vh" }}>
      <ComplianceHeader />
      <div style={{ padding: "72px 48px 56px", maxWidth: 760, margin: "0 auto" }}>
        <BackHome />
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: PURPLE, marginBottom: 14, marginTop: 24 }}>{section}</div>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1, color: TEXT, marginBottom: 8 }}>
          {title}
        </h1>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 48px 80px" }}>
        {children}
      </div>
    </div>
  );
}

function ComplianceHeader() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${BORDER}`, padding: "0 48px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Link href="/" style={{ fontFamily: WORDMARK_FONT, fontSize: 22, lineHeight: 1, color: PURPLE, textDecoration: "none" }}>friendsly</Link>
      <Link href="/login" style={{ background: PURPLE, color: "#fff", padding: "8px 20px", borderRadius: 100, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Sign In</Link>
    </header>
  );
}

function BackHome() {
  return (
    <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: MUTED, textDecoration: "none" }}>
      <span style={{ fontSize: 16 }}>←</span> Back to Home
    </Link>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: TEXT, paddingBottom: 8, borderBottom: `1px solid ${BORDER}` }}>{title}</h3>
      <div style={{ fontSize: 15, lineHeight: 1.8, color: "#374151" }}>{children}</div>
    </section>
  );
}

