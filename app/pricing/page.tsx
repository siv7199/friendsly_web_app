import Link from "next/link";

const PURPLE = "#6d28d9";
const PURPLE_LIGHT = "#ede9fe";
const BORDER = "#cec6e5";
const MUTED = "#6b7280";
const TEXT = "#0f0a1e";
const BG2 = "#f8f7ff";
const WORDMARK_FONT = 'var(--font-brand, "Times New Roman", serif)';

export const metadata = { title: "Pricing — Friendsly" };

export default function PricingPage() {
  return (
    <CompliancePage title="Simple, transparent pricing" section="Pricing">
      <div style={{ background: PURPLE_LIGHT, border: "1px solid #c4b5fd", borderRadius: 16, padding: "24px 28px", marginBottom: 40, fontSize: 15, lineHeight: 1.8, color: TEXT }}>
        Friendsly does not charge a flat subscription fee. You pay by the minute based on each creator&apos;s rate. Every creator sets their own price per minute for both live calls and private bookings. You can see the rate before joining or booking.
      </div>

      {[
        {
          title: "Watching Lives",
          body: "Watching a live is always free. You only pay if you choose to join the call and participate.",
        },
        {
          title: "Joining a Live Call",
          body: "When you join a live, you are charged the creator's per-minute rate for the duration you are connected. You can leave at any time and billing stops immediately.",
        },
        {
          title: "Private Bookings",
          body: "You book a session with a creator for a set duration. The total cost is the creator's per-minute rate multiplied by the number of minutes booked. Payment is collected at time of booking.",
        },
        {
          title: "No Subscriptions",
          body: "There are no subscriptions, no auto-renewals, and no recurring charges. You add credits to your account when you need them and spend them as you go.",
        },
      ].map(({ title, body }) => (
        <PolicySection key={title} title={title}>
          <p>{body}</p>
        </PolicySection>
      ))}

      <div style={{ fontSize: 15, color: MUTED, lineHeight: 1.6, padding: "20px 24px", background: BG2, borderRadius: 14, border: `1px solid ${BORDER}`, marginTop: 8 }}>
        See our full{" "}
        <Link href="/refunds" style={{ color: PURPLE, textDecoration: "none", fontWeight: 600 }}>Refund Policy</Link>
        {" "}for cancellation and refund terms.
      </div>
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
        <h1 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1, color: TEXT, marginBottom: 40 }}>
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
    <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: MUTED, textDecoration: "none", transition: "color 0.15s" }}>
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
