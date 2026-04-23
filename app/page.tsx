import Link from "next/link";

const PURPLE = "#6d28d9";
const PURPLE_LIGHT = "#ede9fe";
const PURPLE_MUTED = "#a78bfa";
const BORDER = "#cec6e5";
const MUTED = "#6b7280";
const BG2 = "#f8f7ff";
const TEXT = "#0f0a1e";

const creatorCards = [
  { color: "linear-gradient(135deg,#a855f7,#ec4899)", name: "Lexi Monroe", cat: "Fitness & Nutrition", price: "$12/min", followers: "4.2M", live: true },
  { color: "linear-gradient(135deg,#6d28d9,#818cf8)", name: "Marcus Reid", cat: "Business & Mindset", price: "$18/min", followers: "2.1M", live: false },
  { color: "linear-gradient(135deg,#f59e0b,#ef4444)", name: "Zara Chen", cat: "Fashion & Style", price: "$9/min", followers: "8.7M", live: true },
  { color: "linear-gradient(135deg,#10b981,#6d28d9)", name: "DJ Promo", cat: "Music & Production", price: "$22/min", followers: "1.5M", live: false },
  { color: "linear-gradient(135deg,#f43f5e,#fb923c)", name: "Tanya Brooks", cat: "Wellness & Yoga", price: "$15/min", followers: "3.1M", live: true },
  { color: "linear-gradient(135deg,#8b5cf6,#06b6d4)", name: "Alex Vega", cat: "Gaming & Esports", price: "$8/min", followers: "12M", live: false },
  { color: "linear-gradient(135deg,#06b6d4,#10b981)", name: "Sofia Lim", cat: "Cooking & Food", price: "$11/min", followers: "5.6M", live: false },
  { color: "linear-gradient(135deg,#ec4899,#a855f7)", name: "Ryan Cole", cat: "Finance & Investing", price: "$25/min", followers: "900K", live: true },
];

function CreatorCard({ color, name, cat, price, followers, live }: typeof creatorCards[0]) {
  return (
    <div className="lp-creator-card">
      <div style={{ width: 52, height: 52, borderRadius: 14, background: color, marginBottom: 12, position: "relative", flexShrink: 0 }}>
        {live && (
          <span style={{ position: "absolute", bottom: -3, right: -3, background: "#22c55e", color: "#fff", fontSize: 7, fontWeight: 700, padding: "2px 5px", borderRadius: 100, border: "1.5px solid #fff" }}>
            LIVE
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: TEXT }}>{name}</div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 12 }}>{cat}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: PURPLE, background: PURPLE_LIGHT, padding: "3px 10px", borderRadius: 100 }}>{price}</span>
        <span style={{ fontSize: 10, color: MUTED }}>{followers}</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="lp-root" style={{ background: "#fff", color: TEXT, fontFamily: "var(--font-sans, Inter, sans-serif)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── HEADER ── */}
      <header className="lp-header" style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.94)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${BORDER}`,
        padding: "0 48px",
        height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-brand, "Times New Roman", serif)',
            fontSize: 22,
            lineHeight: 1,
            color: PURPLE,
            textDecoration: "none",
          }}
        >
          friendsly
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {[
            { label: "Pricing", href: "/pricing" },
            { label: "Terms", href: "/terms" },
            { label: "Privacy", href: "/privacy" },
            { label: "Refund Policy", href: "/refunds" },
            { label: "Contact", href: "/contact" },
          ].map(({ label, href }) => (
            <Link key={href} href={href} style={{ fontSize: 14, fontWeight: 500, color: MUTED, textDecoration: "none" }}>
              {label}
            </Link>
          ))}
          <Link href="/login" style={{
            background: PURPLE, color: "#fff",
            padding: "8px 20px", borderRadius: 100,
            fontSize: 14, fontWeight: 600,
            textDecoration: "none",
          }}>
            Sign In
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1 }}>

        {/* ── HERO ── */}
        <section className="lp-hero" style={{
          padding: "110px 56px 80px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          position: "relative", overflow: "hidden", background: "#fff",
        }}>
          <div style={{
            position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)",
            width: 900, height: 600, borderRadius: "50%",
            background: "radial-gradient(ellipse, #ede9fe 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div className="lp-fadeup-1" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: PURPLE_LIGHT, border: "1px solid #c4b5fd",
            borderRadius: 100, padding: "6px 16px 6px 10px",
            fontSize: 12, fontWeight: 500, color: PURPLE,
            marginBottom: 28, position: "relative", zIndex: 1,
          }}>
            <span className="lp-blink" style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", display: "inline-block" }} />
            2026 Early Access
          </div>

          <h1 className="lp-fadeup-2" style={{
            fontSize: "clamp(38px, 5.5vw, 72px)", fontWeight: 700,
            lineHeight: 1.06, letterSpacing: -2, maxWidth: 820,
            marginBottom: 22, position: "relative", zIndex: 1, color: TEXT,
          }}>
            Live 1:1 calls with{" "}
            <em style={{ fontStyle: "normal", color: PURPLE }}>your favorite creators</em>
          </h1>

          <p className="lp-fadeup-3" style={{
            fontSize: 18, lineHeight: 1.65, color: MUTED,
            maxWidth: 520, marginBottom: 40, fontWeight: 400,
            position: "relative", zIndex: 1,
          }}>
            Book a private video call with the influencers, coaches, and experts you follow — on your schedule.
          </p>

          <div className="lp-fadeup-4 lp-hero-actions" style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 72, position: "relative", zIndex: 1 }}>
            <Link href="/login?tab=signup" className="lp-btn-primary">Join the Waitlist</Link>
            <Link href="/discover" className="lp-btn-outline">Browse Creators</Link>
          </div>

          <div className="lp-fadeup-5 lp-hero-art" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/phones-hero.png"
              alt="Friendsly app screens showing live creator calls"
              style={{
                width: "100%", height: "auto", display: "block",
                filter: "drop-shadow(0 32px 64px rgba(109,40,217,0.15)) drop-shadow(0 8px 24px rgba(0,0,0,0.08))",
              }}
            />
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="lp-section-alt" style={{ padding: "100px 56px", background: BG2 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: PURPLE, marginBottom: 16, textAlign: "center" }}>
              How it works
            </div>
            <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 700, letterSpacing: -1.5, textAlign: "center", lineHeight: 1.1, marginBottom: 64, color: TEXT }}>
              Three steps to your{" "}
              <em style={{ fontStyle: "normal", color: PURPLE }}>dream conversation</em>
            </h2>
            <div className="lp-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              {[
                { num: "01", title: "Find Your Creator", desc: "Browse creators across every niche — fitness, business, music, fashion, and more. Filter by availability, price, and category." },
                { num: "02", title: "Book a Session", desc: "Choose your time, pay securely, and get instant confirmation. Meet & Greet sessions are short, affordable, and perfect for your first connection." },
                { num: "03", title: "Go Live 1:1", desc: "Join your private video call at the scheduled time. Your creator is there, fully present, just for you — no audience, no distractions." },
              ].map(({ num, title, desc }) => (
                <div key={num} className="lp-step-card">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                    {num}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, letterSpacing: -0.3 }}>{title}</div>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: MUTED }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CREATORS MARQUEE ── */}
        <section className="lp-section" style={{ padding: "100px 0", background: "#fff", overflow: "hidden" }}>
          <div className="lp-creators-head" style={{ padding: "0 56px", marginBottom: 48, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: PURPLE, marginBottom: 8 }}>
                Creators on Friendsly
              </div>
              <h2 style={{ fontSize: "clamp(24px, 3vw, 40px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1, color: TEXT }}>
                From fitness coaches to{" "}
                <em style={{ fontStyle: "normal", color: PURPLE }}>business mentors</em>
              </h2>
            </div>
            <Link href="/discover" className="lp-btn-primary" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
              Browse All Creators
            </Link>
          </div>
          <div style={{ overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 100, zIndex: 2, pointerEvents: "none", background: "linear-gradient(90deg,#fff,transparent)" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 100, zIndex: 2, pointerEvents: "none", background: "linear-gradient(-90deg,#fff,transparent)" }} />
            <div className="lp-marquee-track">
              {[...creatorCards, ...creatorCards].map((c, i) => (
                <CreatorCard key={i} {...c} />
              ))}
            </div>
          </div>
        </section>

        {/* ── FRIENDSLY LIVE ── */}
        <section className="lp-section" style={{ padding: "100px 56px", background: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -120, right: -120, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #ede9fe 0%, transparent 65%)", pointerEvents: "none" }} />
          <div className="lp-grid-2" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center", position: "relative", zIndex: 1 }}>

            {/* Live mockup */}
            <div className="lp-live-visual" style={{ position: "relative" }}>
              <div style={{ background: "#0f0a1e", borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 64px rgba(109,40,217,0.22), 0 4px 16px rgba(0,0,0,0.12)" }}>
                {/* Stage header */}
                <div style={{ padding: "20px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-brand, "Times New Roman", serif)', fontSize: 16, lineHeight: 1, color: PURPLE_MUTED }}>friendsly</span>
                    <span style={{ background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 100, letterSpacing: 1, display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="lp-blink-fast" style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", display: "inline-block" }} />
                      LIVE
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>1,247 watching</div>
                </div>

                {/* Creator video */}
                <div style={{ height: 200, background: "linear-gradient(135deg,#1e0a40 0%,#2d1060 50%,#1a0520 100%)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 90, height: 90, borderRadius: "50%", background: "linear-gradient(135deg,#a855f7,#ec4899)", position: "relative", boxShadow: "0 0 40px rgba(168,85,247,0.5)" }}>
                    <div style={{ position: "absolute", bottom: 2, right: 2, background: "#22c55e", width: 20, height: 20, borderRadius: "50%", border: "2px solid #1e0a40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>🎤</div>
                  </div>
                  <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Lexi Monroe</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>Fitness &amp; Nutrition · On Stage</div>
                  </div>
                </div>

                {/* On-stage fans */}
                <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>On Stage with Lexi</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {[
                      { bg: "linear-gradient(135deg,#6d28d9,#818cf8)", label: "You", opacity: 1 },
                      { bg: "linear-gradient(135deg,#f59e0b,#ef4444)", label: "@jake", opacity: 0.6 },
                      { bg: "linear-gradient(135deg,#10b981,#06b6d4)", label: "@maya", opacity: 0.6 },
                    ].map(({ bg, label, opacity }) => (
                      <div key={label} style={{ textAlign: "center", opacity }}>
                        <div style={{ width: 42, height: 42, borderRadius: "50%", background: bg, margin: "0 auto 4px", border: label === "You" ? "2px solid #7c3aed" : undefined, boxShadow: label === "You" ? "0 0 12px rgba(109,40,217,0.5)" : undefined }} />
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)" }}>{label}</div>
                      </div>
                    ))}
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
                    <div style={{ background: "rgba(109,40,217,0.3)", border: "1px solid rgba(109,40,217,0.6)", borderRadius: 100, padding: "7px 14px", fontSize: 11, fontWeight: 600, color: PURPLE_MUTED, whiteSpace: "nowrap" }}>
                      Join Stage →
                    </div>
                  </div>
                </div>

                {/* Viewer chat */}
                <div style={{ padding: "12px 20px 16px" }}>
                  {[
                    { bg: "linear-gradient(135deg,#f43f5e,#fb923c)", handle: "@ryan_k", msg: "omg this is wild you're actually on with her 😭" },
                    { bg: "linear-gradient(135deg,#8b5cf6,#06b6d4)", handle: "@sara_m", msg: "wait how do I get on stage next???" },
                    { bg: "linear-gradient(135deg,#ec4899,#a855f7)", handle: "@dev_j", msg: "this is the future of fan interaction fr 🔥" },
                  ].map(({ bg, handle, msg }) => (
                    <div key={handle} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: bg, flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                        <span style={{ color: PURPLE_MUTED, fontWeight: 600 }}>{handle}</span> {msg}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating stat pill */}
              <div style={{ position: "absolute", bottom: -16, left: 24, background: "#fff", border: `1.5px solid ${BORDER}`, borderRadius: 100, padding: "10px 18px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(109,40,217,0.1)" }}>
                <span style={{ fontSize: 16 }}>👁️</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>1,247 fans watching</div>
                  <div style={{ fontSize: 10, color: MUTED }}>3 fans on stage right now</div>
                </div>
              </div>
            </div>

            {/* Copy */}
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: PURPLE_LIGHT, border: "1px solid #c4b5fd", borderRadius: 100, padding: "5px 14px 5px 10px", fontSize: 12, fontWeight: 600, color: PURPLE, marginBottom: 20 }}>
                <span className="lp-blink-fast" style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 6px #ef4444", display: "inline-block" }} />
                New · Friendsly Live
              </div>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1, color: TEXT, marginBottom: 20 }}>
                Get on stage with{" "}
                <em style={{ fontStyle: "normal", color: PURPLE }}>your favorite influencer</em>
              </h2>
              <p style={{ fontSize: 16, lineHeight: 1.75, color: MUTED, marginBottom: 36 }}>
                When a creator goes live, you can raise your hand to join the stage — a guaranteed shot to be seen, heard, and face-to-face with the influencer you follow, while their entire audience watches.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 36 }}>
                {[
                  { icon: "📡", title: "Watch for free, always", desc: "Tune in to any live stream at no cost. See who's on stage, follow the conversation, vibe with the community." },
                  { icon: "🎤", title: "Join the stage", desc: "Pay per minute to step up and talk directly with the creator live — while the crowd watches you both." },
                  { icon: "🤝", title: "Connect with fans like you", desc: "Chat in real time with thousands of fans who share your passion — all in the same room as the creator." },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: PURPLE_LIGHT, border: "1px solid #ddd6fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/discover" className="lp-btn-primary">Watch a Live Now</Link>
            </div>
          </div>
        </section>

        {/* ── CHAT DEMO ── */}
        <section className="lp-section-alt" style={{ padding: "100px 56px", background: BG2 }}>
          <div className="lp-grid-2" style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
            {/* Chat UI */}
            <div>
              <div style={{ background: "#fff", border: `1.5px solid ${BORDER}`, borderRadius: 28, padding: 24, boxShadow: "0 8px 32px rgba(109,40,217,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f5f3ff", borderRadius: 14, marginBottom: 18, border: "1px solid #ddd6fe" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${PURPLE},#a855f7)`, flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: 13, fontWeight: 600, display: "block" }}>Session with Lexi Monroe</strong>
                    <span style={{ fontSize: 11, color: MUTED }}>Fitness Coach · ⭐ 4.9 · 1,204 sessions</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  {["🏋️ Training plan", "🥗 Meal advice"].map((p) => (
                    <span key={p} style={{ background: PURPLE_LIGHT, border: "1px solid #c4b5fd", borderRadius: 100, padding: "7px 14px", fontSize: 12, fontWeight: 500, color: PURPLE }}>{p}</span>
                  ))}
                </div>
                {[
                  { me: false, text: "Hey! I've been trying your cutting protocol for 6 weeks but I'm stuck at the same weight..." },
                  { me: true, text: "Let me see your current macros — what's your daily protein intake?" },
                  { me: false, text: "Around 120g. I'm 175lbs, training 4x a week." },
                  { me: true, text: "That's the issue. At your weight you want 140–175g. Let's fix that right now 💪" },
                ].map(({ me, text }, i) => (
                  <div key={i} style={{ marginBottom: 10, display: "flex", justifyContent: me ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "82%", padding: "11px 15px", borderRadius: 18, fontSize: 13, lineHeight: 1.5, ...(me ? { background: PURPLE, color: "#fff", borderBottomRightRadius: 4 } : { background: "#f1f0f9", border: `1px solid ${BORDER}`, borderBottomLeftRadius: 4, color: TEXT }) }}>
                      {text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: PURPLE, marginBottom: 16 }}>Real conversations</div>
              <h2 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 20, color: TEXT }}>
                Do it with <em style={{ fontStyle: "normal", color: PURPLE }}>Friendsly</em>
              </h2>
              <p style={{ fontSize: 15, color: MUTED, lineHeight: 1.7, marginBottom: 28 }}>
                Real people getting real help from their favorite creators through live video calls. Ask anything — get answers you can&apos;t find anywhere else.
              </p>
              <ul style={{ listStyle: "none", marginBottom: 32, padding: 0 }}>
                {[
                  { icon: "🏋️", text: "Get professional workout advice tailored to your exact goals from top fitness creators" },
                  { icon: "💼", text: "Pitch your business idea and get real feedback from top business mentors" },
                  { icon: "🎵", text: "One-on-one music lessons with artists you actually follow and admire" },
                ].map(({ icon, text }) => (
                  <li key={text} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 15, lineHeight: 1.55, color: MUTED }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: PURPLE_LIGHT, border: "1px solid #ddd6fe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16, marginTop: 2 }}>{icon}</div>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <Link href="/discover" className="lp-btn-primary">Find Your Creator</Link>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-section-dark" style={{ padding: "100px 56px", background: PURPLE, textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -150, left: -150, width: 400, height: 400, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -100, right: -100, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto" }}>
            <h2 style={{ fontSize: "clamp(32px, 4.5vw, 56px)", fontWeight: 700, letterSpacing: -2, lineHeight: 1.07, color: "#fff", marginBottom: 20 }}>
              Your creator is<br />waiting to meet you
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.75)", lineHeight: 1.65, marginBottom: 36 }}>
              Join the waitlist and get first access when Friendsly launches. Be part of a new era of creator–fan connection.
            </p>
            <Link href="/login?tab=signup" style={{
              background: "#fff", color: PURPLE,
              padding: "16px 40px", borderRadius: 100,
              fontSize: 15, fontWeight: 700,
              textDecoration: "none", display: "inline-block",
              boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
            }}>
              Join the Waitlist
            </Link>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 16 }}>No credit card required · Free to join</p>
          </div>
        </section>

        {/* ── DISCLAIMER ── */}
        <div className="lp-disclaimer" style={{ textAlign: "center", padding: "32px 48px" }}>
          <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
            By using Friendsly, you agree to our{" "}
            <Link href="/terms" style={{ color: PURPLE_MUTED, textDecoration: "none" }}>Terms of Service</Link>
            {" "}and{" "}
            <Link href="/privacy" style={{ color: PURPLE_MUTED, textDecoration: "none" }}>Privacy Policy</Link>
            . You must be 18 or older to use this platform.
          </p>
        </div>

      </main>

      {/* ── FOOTER ── */}
      <footer className="lp-footer" style={{
        background: BG2,
        borderTop: `1px solid ${BORDER}`,
        padding: "32px 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 24, flexWrap: "wrap",
      }}>
        <Link
          href="/"
          style={{
            fontFamily: 'var(--font-brand, "Times New Roman", serif)',
            fontSize: 22,
            lineHeight: 1,
            color: PURPLE,
            textDecoration: "none",
          }}
        >
          friendsly
        </Link>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: "Terms of Service", href: "/terms" },
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Refund Policy", href: "/refunds" },
            { label: "Contact", href: "/contact" },
          ].map(({ label, href }) => (
            <Link key={href} href={href} style={{ fontSize: 13, color: MUTED, textDecoration: "none" }}>{label}</Link>
          ))}
        </div>
        <div className="lp-footer-copy" style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6, textAlign: "right" }}>
          © 2026 Friendsly. All rights reserved.<br />
          You must be 18 or older to use this platform.
        </div>
      </footer>

    </div>
  );
}
