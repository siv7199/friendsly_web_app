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
        // --- Friendsly Brand Palette ---
        brand: {
          // Dark backgrounds (layered depth)
          bg:       "#080614", // deepest background
          surface:  "#100D22", // cards, sidebars
          elevated: "#1A1535", // modals, popovers
          border:   "#2A2350", // subtle borders

          // Primary — electric violet
          primary:        "#7C3AED", // violet-600
          "primary-hover":"#6D28D9", // violet-700
          "primary-light":"#A78BFA", // violet-400 (glows, text)
          "primary-glow": "#7C3AED33", // semi-transparent for glows

          // Accent — gold (premium / CTA)
          gold:       "#F59E0B", // amber-500
          "gold-light":"#FCD34D", // amber-300
          "gold-glow": "#F59E0B33",

          // Status colors
          live:    "#22C55E", // green-500
          "live-glow": "#22C55E33",
          warning: "#F97316", // orange-500
          info:    "#38BDF8", // sky-400
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-hero":
          "radial-gradient(ellipse at 50% 0%, #7C3AED22 0%, transparent 65%)",
        "gradient-card":
          "linear-gradient(135deg, #1A153580 0%, #100D2280 100%)",
        "gradient-primary":
          "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
        "gradient-gold":
          "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
      },
      boxShadow: {
        "glow-primary": "0 0 20px 2px #7C3AED44",
        "glow-gold": "0 0 20px 2px #F59E0B44",
        "glow-live": "0 0 20px 2px #22C55E44",
        "card": "0 4px 24px 0 #00000040",
      },
      animation: {
        "pulse-live": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
