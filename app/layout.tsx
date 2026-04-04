import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/context/AuthContext";
import { GlobalLiveStatusManager } from "@/components/shared/GlobalLiveStatusManager";

export const metadata: Metadata = {
  title: "Friendsly — Connect with Your Favorite Creators",
  description:
    "Book 1-on-1 video calls with micro-influencers. Join live sessions. Get exclusive access to the creators you love.",
  keywords: ["creator economy", "influencer", "video call", "booking", "live"],
};

export const viewport: Viewport = {
  themeColor: "#080614",
};

/**
 * Root Layout
 *
 * This is the outermost layout that wraps the ENTIRE application.
 * In Next.js App Router, every page is wrapped by the nearest layout.tsx
 * file above it in the folder tree. This one wraps everything.
 *
 * It sets up:
 * - The <html> and <body> tags (required — only one place should define these)
 * - Global CSS imports
 * - Any providers that need to wrap the whole app (auth, theme, etc.)
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-brand-bg text-slate-100 antialiased min-h-screen">
        <AuthProvider>
          <GlobalLiveStatusManager />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
