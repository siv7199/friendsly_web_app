import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Barlow, Cormorant_Garamond, Nunito_Sans, Pacifico } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import { GlobalLiveStatusManager } from "@/components/shared/GlobalLiveStatusManager";

const displayFont = Barlow({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const serifFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const brandFont = localFont({
  src: "../TAN-ASTORIA-Display.ttf",
  variable: "--font-brand",
  display: "swap",
});

const bodyFont = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  adjustFontFallback: false,
});

const pacificoFont = Pacifico({
  subsets: ["latin"],
  variable: "--font-pacifico",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Friendsly — Connect with Your Favorite Creators",
  description:
    "Book 1-on-1 video calls with micro-influencers. Join live sessions. Get exclusive access to the creators you love.",
  keywords: ["creator economy", "influencer", "video call", "booking", "live"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7468F2",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${brandFont.variable} ${serifFont.variable} ${pacificoFont.variable} h-full overflow-hidden bg-brand-bg`}
    >
      <body className="h-full overflow-hidden bg-brand-bg text-brand-ink antialiased font-sans">
        <AuthProvider>
          <GlobalLiveStatusManager />
          <div id="app-root" className="app-root-shell">
            {children}
          </div>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
