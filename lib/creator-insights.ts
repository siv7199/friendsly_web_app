import type { CreatorAnalyticsSnapshot } from "@/lib/analytics";
import type { CreatorProfile, CreatorStats } from "@/types";

export interface CreatorInsight {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  tone: "action" | "opportunity" | "momentum";
}

interface CreatorInsightInput {
  user: CreatorProfile;
  stats: CreatorStats;
  analytics: CreatorAnalyticsSnapshot;
  profileStrength: number;
  activePackageCount: number;
  availabilitySlotCount: number;
}

export function getCreatorInsights({
  user,
  stats,
  analytics,
  profileStrength,
  activePackageCount,
  availabilitySlotCount,
}: CreatorInsightInput): CreatorInsight[] {
  const insights: CreatorInsight[] = [];
  const missingSocialCount = [user.instagram_url, user.tiktok_url, user.x_url].filter(Boolean).length;

  if (activePackageCount === 0) {
    insights.push({
      id: "packages",
      title: "Add your first offering",
      description: "Fans can view your profile, but they still need a package before they can book you.",
      ctaLabel: "Manage Offerings",
      ctaHref: "/management",
      tone: "action",
    });
  }

  if (availabilitySlotCount === 0) {
    insights.push({
      id: "availability",
      title: "Open your calendar",
      description: "Set weekly availability so fans can see real times and convert faster.",
      ctaLabel: "Update Availability",
      ctaHref: "/calendar",
      tone: "action",
    });
  }

  if (profileStrength < 80) {
    const missingItems: string[] = [];
    if (!user.avatar_url) missingItems.push("photo");
    if (!user.bio) missingItems.push("bio");
    if (!user.category) missingItems.push("category");
    if (missingSocialCount === 0) missingItems.push("social links");

    insights.push({
      id: "profile",
      title: "Complete your profile",
      description:
        missingItems.length > 0
          ? `Finish your ${missingItems.slice(0, 2).join(" and ")} to build trust before fans decide to book.`
          : "A more complete profile usually makes your page feel more trustworthy to first-time visitors.",
      ctaLabel: "Open Settings",
      ctaHref: "/settings",
      tone: "opportunity",
    });
  }

  if (analytics.profileViews >= 10 && stats.conversionRate < 5) {
    insights.push({
      id: "conversion",
      title: "Traffic is arriving, but conversion is low",
      description: `${analytics.profileViews} profile views turned into ${analytics.bookingsCreated + analytics.liveQueueJoins} booking actions this period. Try a lower-entry package or clearer positioning.`,
      ctaLabel: "Refine Offerings",
      ctaHref: "/management",
      tone: "opportunity",
    });
  }

  if (analytics.completedCalls > 0 && (stats.reviewCount ?? 0) === 0) {
    insights.push({
      id: "reviews",
      title: "Turn completed calls into social proof",
      description: "You already have completed sessions. A few reviews will make your profile much easier to trust.",
      ctaLabel: "View Calendar",
      ctaHref: "/calendar",
      tone: "momentum",
    });
  }

  if (analytics.profileViews === 0 && missingSocialCount > 0) {
    insights.push({
      id: "distribution",
      title: "Bring more people to your page",
      description: "Add your social links and share your Friendsly profile so you can start generating traffic.",
      ctaLabel: "Open Settings",
      ctaHref: "/settings",
      tone: "momentum",
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "momentum",
      title: "Your profile is in a strong place",
      description: "Keep your calendar updated and go live regularly to turn profile traffic into repeat bookings.",
      ctaLabel: "Go Live",
      ctaHref: "/live",
      tone: "momentum",
    });
  }

  return insights.slice(0, 3);
}
