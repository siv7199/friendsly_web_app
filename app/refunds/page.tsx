import Link from "next/link";

const PURPLE = "#6d28d9";
const PURPLE_LIGHT = "#ede9fe";
const BORDER = "#cec6e5";
const MUTED = "#6b7280";
const TEXT = "#0f0a1e";
const BG2 = "#f8f7ff";

export const metadata = { title: "Refund Policy — Friendsly" };

export default function RefundsPage() {
  return (
    <CompliancePage title="Refund Policy" section="Legal">
      <MetaBox />

      <PolicySection title="Booking Cancellation & Refund Schedule">
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {[
            { scenario: "Cancellations more than 24 hours before a scheduled booking", outcome: "Full refund to your Friendsly account credits.", tag: "Full", tagColor: { bg: "#dcfce7", text: "#16a34a" } },
            { scenario: "Cancellations less than 24 hours before a scheduled booking", outcome: "50% refund to your Friendsly account credits.", tag: "50%", tagColor: { bg: "#fef3c7", text: "#d97706" } },
            { scenario: "Creator no-show: creator does not join a scheduled booking", outcome: "Full refund to your Friendsly account credits.", tag: "Full", tagColor: { bg: "#dcfce7", text: "#16a34a" } },
            { scenario: "Fan no-show after creator waited the full session", outcome: "75% refund to your Friendsly account credits.", tag: "75%", tagColor: { bg: "#fef3c7", text: "#d97706" } },
            { scenario: "Both parties absent", outcome: "Full refund.", tag: "Full", tagColor: { bg: "#dcfce7", text: "#16a34a" } },
          ].map(({ scenario, outcome, tag, tagColor }) => (
            <li key={scenario} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ background: tagColor.bg, color: tagColor.text, padding: "2px 10px", borderRadius: 100, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", marginTop: 2, flexShrink: 0 }}>{tag}</span>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 2, color: TEXT, fontSize: 14 }}>{scenario}</div>
                <div style={{ color: MUTED, fontSize: 14 }}>{outcome}</div>
              </div>
            </li>
          ))}
        </ul>
      </PolicySection>

      <PolicySection title="Auto-Cancellation">
        <p>If neither party joins within 10 minutes of the scheduled start time, the booking is automatically cancelled. Refund amount depends on which party joined during that window.</p>
      </PolicySection>

      <PolicySection title="Live Call Charges">
        <p>Charges for live call participation are non-refundable once the session is complete, except in cases of documented platform error.</p>
      </PolicySection>

      <PolicySection title="Refund Method">
        <p>
          All refunds are issued as Friendsly account credits, not back to your original payment method, unless required by applicable law. To request a refund, contact{" "}
          <a href="mailto:matvey@friendsly.app" style={{ color: PURPLE, textDecoration: "none" }}>matvey@friendsly.app</a>.
        </p>
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
