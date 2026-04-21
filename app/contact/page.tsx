import Link from "next/link";

const PURPLE = "#6d28d9";
const BORDER = "#e5e2f0";
const MUTED = "#6b7280";
const TEXT = "#0f0a1e";
const BG2 = "#f8f7ff";

export const metadata = { title: "Contact — Friendsly" };

export default function ContactPage() {
  return (
    <div style={{ background: "#fff", color: TEXT, fontFamily: "var(--font-sans, Inter, sans-serif)", minHeight: "100vh" }}>

      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${BORDER}`, padding: "0 48px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontFamily: "var(--font-pacifico, cursive)", fontSize: 22, color: PURPLE, textDecoration: "none" }}>friendsly</Link>
        <Link href="/login" style={{ background: PURPLE, color: "#fff", padding: "8px 20px", borderRadius: 100, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Sign In</Link>
      </header>

      <div style={{ padding: "72px 48px 56px", maxWidth: 640, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, color: MUTED, textDecoration: "none" }}>
          <span style={{ fontSize: 16 }}>←</span> Back to Home
        </Link>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: PURPLE, marginBottom: 14, marginTop: 24 }}>Get in touch</div>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1, color: TEXT, marginBottom: 8 }}>
          Contact <em style={{ fontStyle: "normal", color: PURPLE }}>Friendsly</em>
        </h1>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 48px 80px" }}>
        <div style={{ background: BG2, border: `1.5px solid ${BORDER}`, borderRadius: 24, padding: "40px 36px", textAlign: "center" }}>
          <span style={{ fontSize: 40, marginBottom: 20, display: "block" }}>✉️</span>
          <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: TEXT }}>Email Support</h3>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: MUTED, marginBottom: 12 }}>
            For support, billing questions, or refund requests, email us at:
          </p>
          <a href="mailto:matvey@friendsly.app" style={{ color: PURPLE, textDecoration: "none", fontWeight: 600, fontSize: 17 }}>
            matvey@friendsly.app
          </a>
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px solid ${BORDER}`, fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            We aim to respond within 2 business days.<br />
            <strong style={{ color: TEXT }}>Friendsly</strong> · North Carolina, USA
          </div>
        </div>
      </div>

    </div>
  );
}
