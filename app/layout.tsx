import type { Metadata, Viewport } from "next";
import { Barlow, Nunito_Sans } from "next/font/google";
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
});

export const metadata: Metadata = {
  title: "Friendsly — Connect with Your Favorite Creators",
  description:
    "Book 1-on-1 video calls with micro-influencers. Join live sessions. Get exclusive access to the creators you love.",
  keywords: ["creator economy", "influencer", "video call", "booking", "live"],
};

export const viewport: Viewport = {
  themeColor: "#7468F2",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${brandFont.variable}`}>
      <body className="bg-brand-bg text-brand-ink antialiased min-h-screen font-sans">
        <AuthProvider>
          <GlobalLiveStatusManager />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
