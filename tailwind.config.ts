import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // ── Light system — fan experience ────────────────────────────────
          bg:       "#F7F5FB",   // soft violet-tinted white canvas
          surface:  "#FFFFFF",   // pure white card surface
          elevated: "#EEE9FF",   // light periwinkle — hovers, active states
          border:   "#E0D9F5",   // delicate lavender border

          // ── Stage / media areas — the purple that fills card tops ────────
          stage:    "#C5BAF5",   // medium periwinkle — card media bg (matches reference)
          "stage-deep": "#9B8FE8", // richer purple for darker stage accents

          // ── Dark system — nav rail, creator studio, immersive areas ──────
          dark:           "#0F0D1A",  // deepest dark (slightly more purple than before)
          "dark-surface": "#1A1628",  // dark cards, sidebars
          "dark-elevated":"#251F38",  // hover states on dark
          "dark-border":  "#332B4E",  // subtle dark border

          // ── Primary — periwinkle purple ──────────────────────────────────
          primary:         "#6C5CE7",  // core brand purple (slightly more vivid)
          "primary-hover": "#5A4BD5",
          "primary-light": "#A59CF2",  // on dark bg
          "primary-bg":    "#EEE9FF",  // very light tint
          "primary-deep":  "#4A3BBF",  // deep for contrast text
          "primary-mid":   "#8B7ED8",  // mid-weight purple for nav pills, borders

          // ── Ink — text on light surfaces ────────────────────────────────
          ink:          "#1A1628",  // near-black with violet tint
          "ink-muted":  "#5E5880",  // medium purple-gray
          "ink-subtle": "#9B97B5",  // light purple-gray

          // ── Status ──────────────────────────────────────────────────────
          gold:       "#F59E0B",
          live:       "#22C55E",
          "live-bg":  "#F0FDF4",
          warning:    "#F97316",
          info:       "#6366F1",

          // ── Panel system ─────────────────────────────────────────────────
          panel:          "#F3F0FB",
          "panel-dim":    "#EAE5F8",
          "panel-border": "#D6CEF0",
        },
      },
      fontFamily: {
        sans:    ["var(--font-sans)", "Nunito Sans", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Barlow", "system-ui", "sans-serif"],
        brand:   ["var(--font-brand)", "serif"],
      },
      backgroundImage: {
        "gradient-radial":    "radial-gradient(var(--tw-gradient-stops))",
        "gradient-hero":      "radial-gradient(ellipse at 60% 0%, #6C5CE715 0%, transparent 60%)",
        "gradient-primary":   "linear-gradient(150deg, #6C5CE7 0%, #4A3BBF 100%)",
        "gradient-gold":      "linear-gradient(150deg, #F59E0B 0%, #D97706 100%)",
        "gradient-dark":      "linear-gradient(160deg, #251F38 0%, #1A1628 100%)",
        "gradient-stage":     "linear-gradient(to top, rgba(15,13,26,0.92) 0%, rgba(15,13,26,0.4) 55%, transparent 100%)",
        "gradient-card-media":"linear-gradient(135deg, #C5BAF5 0%, #9B8FE8 100%)",
      },
      boxShadow: {
        // Light surface shadows — purple-tinted
        "xs-light":    "0 1px 2px 0 rgba(108,92,231,0.06)",
        "sm-light":    "0 1px 4px 0 rgba(108,92,231,0.08), 0 1px 2px 0 rgba(0,0,0,0.03)",
        "md-light":    "0 4px 16px 0 rgba(108,92,231,0.10), 0 2px 6px 0 rgba(0,0,0,0.04)",
        "lg-light":    "0 8px 32px 0 rgba(108,92,231,0.14), 0 4px 12px 0 rgba(0,0,0,0.06)",
        "xl-light":    "0 16px 48px 0 rgba(108,92,231,0.18), 0 6px 16px 0 rgba(0,0,0,0.08)",
        // Elevated card hover
        "card":        "0 2px 8px 0 rgba(0,0,0,0.06), 0 0 0 1px rgba(108,92,231,0.06)",
        "card-hover":  "0 8px 24px 0 rgba(108,92,231,0.16), 0 2px 6px 0 rgba(0,0,0,0.06)",
        // Glow effects — used sparingly
        "glow-primary":"0 0 24px 0 rgba(108,92,231,0.30)",
        "glow-live":   "0 0 20px 0 rgba(34,197,94,0.25)",
        // Legacy names preserved
        "panel":       "0 2px 12px 0 rgba(108,92,231,0.07), 0 1px 3px 0 rgba(0,0,0,0.04)",
        "panel-hover": "0 8px 28px 0 rgba(108,92,231,0.14), 0 2px 8px 0 rgba(0,0,0,0.07)",
        "glow-gold":   "0 4px 20px 0 rgba(245,158,11,0.25)",
      },
      borderRadius: {
        "2.5xl": "20px",
        "3xl":   "24px",
        "4xl":   "32px",
      },
      animation: {
        "pulse-live":   "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":      "fadeIn 0.25s ease-out",
        "slide-up":     "slideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-down":   "slideDown 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        "card-enter":   "cardEnter 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        "rail-enter":   "railEnter 0.35s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in":     "scaleIn 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
        "badge-pop":    "badgePop 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%":   { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        cardEnter: {
          "0%":   { opacity: "0", transform: "translateY(8px) scale(0.99)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        railEnter: {
          "0%":   { opacity: "0", transform: "translateX(-6px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%":   { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        badgePop: {
          "0%":   { opacity: "0", transform: "scale(0.8)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
