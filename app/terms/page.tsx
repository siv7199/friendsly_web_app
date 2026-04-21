import Link from "next/link";

const PURPLE = "#6d28d9";
const BORDER = "#e5e2f0";
const MUTED = "#6b7280";
const TEXT = "#0f0a1e";
const BG2 = "#f8f7ff";

export const metadata = { title: "Terms of Service — Friendsly" };

export default function TermsPage() {
  return (
    <CompliancePage title="Terms of Service" section="Legal">
      <MetaBox />

      <PolicySection title="Acceptance of Terms">
        <p>By accessing or using Friendsly, you agree to these Terms of Service. If you do not agree, do not use the platform. You must be at least 18 years old to create an account or make purchases on Friendsly.</p>
      </PolicySection>

      <PolicySection title="Description of Service">
        <p>Friendsly is a platform that connects fans with creators through paid live video calls and private one-on-one video bookings. Fans may watch live calls for free. Joining a live call or booking a private session requires payment based on the creator&apos;s per-minute rate.</p>
      </PolicySection>

      <PolicySection title="Accounts">
        <p>You must provide your real name, a valid email address, and a profile image to create an account. You are responsible for keeping your account credentials secure. You may not share your account with another person.</p>
      </PolicySection>

      <PolicySection title="Payments and Credits">
        <p>Payments are processed by Stripe. You add credits to your account and spend them on live call participation or bookings. There are no subscription fees or auto-renewals. All transactions are in US dollars.</p>
      </PolicySection>

      <PolicySection title="Refunds and Cancellations">
        <p>
          Refunds are governed by our{" "}
          <Link href="/refunds" style={{ color: PURPLE, textDecoration: "none" }}>Refund Policy</Link>
          {" "}at friendsly.app/refunds.
        </p>
      </PolicySection>

      <PolicySection title="Recordings and Content">
        <p>Live calls may be recorded and posted publicly by the creator or by Friendsly, as these calls are public by nature. Private one-on-one bookings are never recorded and remain completely private. By participating in a live call, you acknowledge that the session may be recorded and published. In-call chat messages are cleared when a session ends and are not stored.</p>
      </PolicySection>

      <PolicySection title="AI Features">
        <p>Friendsly uses AI to generate a summary of topics discussed during calls. This summary is derived from a call transcription. By using the platform, you consent to this processing. Summaries are not shared publicly.</p>
      </PolicySection>

      <PolicySection title="Creator Conduct">
        <p>Creators are responsible for showing up to scheduled bookings on time. Creators may set their own per-minute rates. Creators may not charge for services not described on their profile.</p>
      </PolicySection>

      <PolicySection title="Acceptable Use">
        <p>You may not use Friendsly to:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li style={{ marginBottom: 6 }}>Harass, threaten, or abuse any other user</li>
          <li style={{ marginBottom: 6 }}>Share illegal content during a video call</li>
          <li style={{ marginBottom: 6 }}>Record a private booking session</li>
          <li style={{ marginBottom: 6 }}>Impersonate another person</li>
          <li style={{ marginBottom: 6 }}>Use the platform if you are under 18</li>
        </ul>
      </PolicySection>

      <PolicySection title="Intellectual Property">
        <p>Friendsly and its logo are the property of the operator. You may not reproduce or use Friendsly branding without written permission.</p>
      </PolicySection>

      <PolicySection title="Disclaimer of Warranties">
        <p>Friendsly is provided as-is. We do not guarantee uninterrupted service or that calls will be error-free. We are not responsible for dropped calls or technical issues caused by your internet connection or device.</p>
      </PolicySection>

      <PolicySection title="Limitation of Liability">
        <p>To the maximum extent permitted by law, Friendsly&apos;s liability for any claim arising from your use of the platform is limited to the amount you paid in the 30 days prior to the claim.</p>
      </PolicySection>

      <PolicySection title="Dispute Resolution">
        <p>Any disputes arising from these terms will be governed by the laws of the State of North Carolina, USA. You agree to resolve disputes through binding arbitration rather than litigation, except for claims that qualify for small claims court.</p>
      </PolicySection>

      <PolicySection title="Changes to Terms">
        <p>We may update these terms at any time. We will notify you by email if we make material changes. Continued use of the platform after changes constitutes acceptance.</p>
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
      <Link href="/" style={{ fontFamily: "var(--font-pacifico, cursive)", fontSize: 22, color: PURPLE, textDecoration: "none" }}>friendsly</Link>
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

function MetaBox() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, padding: "18px 22px", background: BG2, border: `1px solid ${BORDER}`, borderRadius: 14, marginBottom: 36, fontSize: 13, color: MUTED }}>
      <span><strong style={{ color: TEXT }}>Effective date:</strong> June 1, 2026</span>
      <span><strong style={{ color: TEXT }}>Business:</strong> Friendsly, operated by Matvey Kolmakov, sole proprietor, North Carolina, USA</span>
      <span><strong style={{ color: TEXT }}>Contact:</strong> <a href="mailto:matvey@friendsly.app" style={{ color: PURPLE, textDecoration: "none" }}>matvey@friendsly.app</a></span>
    </div>
  );
}
