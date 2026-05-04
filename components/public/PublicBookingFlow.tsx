"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Home,
  Instagram,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Music2,
  Radio,
  Star,
  User,
  Video,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/lib/context/AuthContext";
import { readJsonResponse } from "@/lib/http";
import { cn, formatCurrency } from "@/lib/utils";
import { getAvailableStartTimesForViewerDate, getBrowserTimeZone, getTimeZoneAbbreviation } from "@/lib/timezones";
import { RefundPolicyModal } from "@/components/shared/RefundPolicyModal";
import { STRIPE_OPTIONS } from "@/lib/stripe-ui";
import { getLiveSessionPath } from "@/lib/routes";
import { sanitizeSocialUrl } from "@/lib/social";
import { BookingModal } from "@/components/fan/BookingModal";
import type { CallPackage, Creator } from "@/types";

type CreatorPayload = {
  id: string;
  slug: string;
  name: string;
  username: string;
  bio: string;
  category: string;
  tags?: string[];
  rating?: number;
  reviewCount?: number;
  avatarInitials: string;
  avatarColor: string;
  avatarUrl?: string;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  xUrl?: string | null;
  timeZone: string;
  bookingIntervalMinutes: number;
  isLive: boolean;
  liveJoinFee?: number | null;
  currentLiveSessionId?: string | null;
  scheduledLiveAt?: string | null;
  scheduledLiveTimeZone?: string | null;
};

type ReviewPayload = {
  id: string;
  fan: string;
  initials: string;
  color: string;
  imageUrl?: string;
  rating: number;
  comment: string;
  date: string;
};

type PackagePayload = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  isActive?: boolean;
};

type AvailabilitySlot = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  package_id?: string | null;
};

type ExistingBookingWindow = {
  scheduledAt: string;
  duration: number;
};

type Step = "select" | "details" | "identity" | "payment" | "success";

type DraftState = {
  packageId: string | null;
  selectedDateIso: string | null;
  selectedTime: string | null;
  topic: string;
};

type PaymentInitKey = {
  creatorId: string;
  packageId: string;
  scheduledAtIso: string;
  mode?: "authenticated" | "guest";
};

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function getAvailableDates(weekOffset: number) {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 8; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i + (weekOffset * 7));
    dates.push(date);
  }
  return dates;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function parseSlotToIso(date: Date, slot: string) {
  const timeParts = slot.match(/(\d+):(\d+)\s+(AM|PM)/);
  let hours = 12;
  let minutes = 0;
  if (timeParts) {
    hours = parseInt(timeParts[1], 10);
    minutes = parseInt(timeParts[2], 10);
    if (timeParts[3] === "PM" && hours !== 12) hours += 12;
    if (timeParts[3] === "AM" && hours === 12) hours = 0;
  }
  const scheduledDate = new Date(date);
  scheduledDate.setHours(hours, minutes, 0, 0);
  return scheduledDate.toISOString();
}

function rangesOverlap(
  leftStartIso: string,
  leftDurationMinutes: number,
  rightStartIso: string,
  rightDurationMinutes: number
) {
  const leftStart = new Date(leftStartIso).getTime();
  const leftEnd = leftStart + (leftDurationMinutes * 60 * 1000);
  const rightStart = new Date(rightStartIso).getTime();
  const rightEnd = rightStart + (rightDurationMinutes * 60 * 1000);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function getScheduledLiveCountdown(scheduledLiveAt?: string | null, nowMs = Date.now()) {
  if (!scheduledLiveAt) return null;
  const diff = new Date(scheduledLiveAt).getTime() - nowMs;
  if (diff <= 0) return "Going live soon";
  const totalMinutes = Math.floor(diff / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const minutes = totalMinutes % 60;

  if (days >= 1) {
    const remainingHours = totalHours % 24;
    return remainingHours > 0 ? `Going live in ${days}d ${remainingHours}h` : `Going live in ${days}d`;
  }

  return totalHours > 0 ? `Going live in ${totalHours}h ${minutes}m` : `Going live in ${minutes}m`;
}

function getDraftKey(slug: string) {
  return `shareable-booking-draft:${slug}`;
}

function PaymentForm({
  onBack,
  onSubmit,
  accountFields,
  canSubmit = true,
  submitDisabledReason,
  isSubmitting,
  setIsSubmitting,
  setError,
}: {
  onBack: () => void;
  onSubmit: (paymentIntentId: string) => Promise<void>;
  accountFields?: ReactNode;
  canSubmit?: boolean;
  submitDisabledReason?: string;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setError: (value: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  async function handlePay() {
    if (!stripe || !elements || !isReady) return;
    if (!canSubmit) {
      setError(submitDisabledReason ?? "Complete all required details before paying.");
      return;
    }
    setIsSubmitting(true);
    setError("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}`,
      },
    });

    if (error) {
      setError(error.message ?? "Payment failed. Please try again.");
      setIsSubmitting(false);
      return;
    }

    if (!paymentIntent) {
      setError("Payment did not complete.");
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmit(paymentIntent.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not complete booking.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} onReady={() => setIsReady(true)} />
      {accountFields}
      <div className="flex flex-col gap-3 min-[420px]:flex-row">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          variant="gold"
          className="flex-1 whitespace-normal text-center leading-tight"
          onClick={handlePay}
          disabled={isSubmitting || !stripe || !isReady || !canSubmit}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : !isReady ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Initialising...</>
          ) : (
            "Pay Now"
          )}
        </Button>
      </div>
    </div>
  );
}

export function PublicBookingFlow({ creatorSlug }: { creatorSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    isLoading: authLoading,
    login,
    signup,
    setRole,
    error: authError,
  } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creator, setCreator] = useState<CreatorPayload | null>(null);
  const [packages, setPackages] = useState<PackagePayload[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<ReviewPayload[]>([]);
  const [existingBookingWindows, setExistingBookingWindows] = useState<ExistingBookingWindow[]>([]);

  const [step, setStep] = useState<Step>("select");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [showBookingTimes, setShowBookingTimes] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingIntent, setFetchingIntent] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showRefundPolicyOnSuccess, setShowRefundPolicyOnSuccess] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [authIntent, setAuthIntent] = useState<"booking" | "live" | null>(null);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [guestAgreedToTerms, setGuestAgreedToTerms] = useState(false);
  const [guestConfirmedAge, setGuestConfirmedAge] = useState(false);
  const [settingFanRole, setSettingFanRole] = useState(false);
  const [awaitingEmailVerification, setAwaitingEmailVerification] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const paymentInitKeyRef = useRef<string | null>(null);
  const hasHandledLiveIntentRef = useRef(false);
  const hasHandledRedirectRef = useRef(false);
  const authCardRef = useRef<HTMLDivElement | null>(null);

  const draftKey = getDraftKey(creatorSlug);
  const viewerTimeZone = getBrowserTimeZone();
  const liveIntentRequested = searchParams.get("intent") === "live";

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? null,
    [packages, selectedPackageId]
  );
  const bookingPackages = useMemo<CallPackage[]>(
    () => packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      duration: pkg.duration,
      price: pkg.price,
      description: pkg.description,
      isActive: pkg.isActive ?? true,
      bookingsCount: 0,
    })),
    [packages]
  );

  const sessionPrice = selectedPackage?.price ?? 0;
  const sessionDuration = selectedPackage?.duration ?? 15;
  const totalCents = Math.round(sessionPrice * 1.025 * 100);
  const sessionGrossPrice = totalCents / 100;
  const platformFeeAmount = sessionGrossPrice - sessionPrice;
  const guestAccountReady = Boolean(
    user?.role === "fan" ||
    (
      signUpName.trim() &&
      signUpEmail.trim() &&
      signUpEmail.includes("@") &&
      signUpPassword.length >= 8 &&
      /[A-Z]/.test(signUpPassword) &&
      /[^A-Za-z0-9]/.test(signUpPassword) &&
      guestAgreedToTerms &&
      guestConfirmedAge
    )
  );
  const availableDates = getAvailableDates(weekOffset);
  const canReviewAndPay = Boolean(selectedPackage && selectedDate && selectedTime);
  const needsPackageSelection = !selectedPackage;
  const currentStepLabel =
    step === "success"
      ? "Done"
      : step === "payment" || step === "identity"
      ? "3"
      : !selectedPackage
      ? "1"
      : selectedDate && selectedTime
      ? "3"
      : "2";
  const packageAvailability = availability.filter((slot) =>
    !selectedPackage?.id ? slot.package_id == null : slot.package_id == null || slot.package_id === selectedPackage.id
  );
  const hasLiveRate = Boolean(creator?.liveJoinFee && creator.liveJoinFee > 0);
  const scheduledLiveCountdown = creator?.isLive ? null : getScheduledLiveCountdown(creator?.scheduledLiveAt, currentTime);
  const scheduledLiveLabel = (() => {
    if (!creator?.scheduledLiveAt || creator.isLive) return null;
    const scheduledDate = new Date(creator.scheduledLiveAt);
    const timeZone = creator.scheduledLiveTimeZone || creator.timeZone;
    const abbreviation = timeZone ? getTimeZoneAbbreviation(scheduledDate, timeZone) : null;
    return `${scheduledDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}${abbreviation ? ` ${abbreviation}` : ""}`;
  })();
  const showLivePanel = Boolean(creator && (creator.isLive || hasLiveRate || scheduledLiveCountdown || scheduledLiveLabel));
  const bookingCreator = creator ? ({
    id: creator.id,
    name: creator.name,
    username: `@${creator.username}`,
    bio: creator.bio,
    category: creator.category,
    tags: creator.tags ?? [],
    followers: "0",
    rating: Number(creator.rating ?? 0),
    reviewCount: creator.reviewCount ?? reviews.length,
    avatarInitials: creator.avatarInitials,
    avatarColor: creator.avatarColor,
    avatarUrl: creator.avatarUrl,
    isLive: creator.isLive,
    currentLiveSessionId: creator.currentLiveSessionId ?? undefined,
    queueCount: 0,
    callPrice: packages.length ? Math.min(...packages.map((pkg) => pkg.price)) : 0,
    callDuration: packages[0]?.duration ?? 15,
    nextAvailable: "",
    totalCalls: 0,
    responseTime: "",
    liveJoinFee: creator.liveJoinFee ?? undefined,
    scheduledLiveAt: creator.scheduledLiveAt ?? undefined,
    scheduledLiveTimeZone: creator.scheduledLiveTimeZone ?? undefined,
    timeZone: creator.timeZone,
    bookingIntervalMinutes: creator.bookingIntervalMinutes,
    instagramUrl: creator.instagramUrl ?? undefined,
    tiktokUrl: creator.tiktokUrl ?? undefined,
    xUrl: creator.xUrl ?? undefined,
  } satisfies Creator) : null;
  const liveButtonLabel = (() => {
    if (creator?.isLive) return user?.role === "fan" ? "Join Live Now" : "Sign in or create account to join";
    if (scheduledLiveCountdown) return scheduledLiveCountdown;
    return "Live not scheduled";
  })();
  const liveButtonDisabled = !creator?.isLive;

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshLiveStatus() {
      try {
        const creatorRes = await fetch(`/api/public/creators/${encodeURIComponent(creatorSlug)}/live-status`);
        const creatorData = await readJsonResponse<{ creator?: CreatorPayload }>(creatorRes);
        if (!creatorRes.ok || cancelled) return;
        if (!creatorData?.creator) return;

        setCreator((current) => current ? { ...current, ...creatorData.creator } : creatorData.creator ?? null);
      } catch {
        // Ignore lightweight live-status refresh failures and preserve the page state.
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void refreshLiveStatus();
      }
    }

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    void refreshLiveStatus();

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [creatorSlug]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setLoadError("");

        const creatorRes = await fetch(`/api/public/creators/${encodeURIComponent(creatorSlug)}`);
        const creatorData = await readJsonResponse<{
          creator?: CreatorPayload;
          packages?: PackagePayload[];
          availability?: AvailabilitySlot[];
          reviews?: ReviewPayload[];
          error?: string;
        }>(creatorRes);
        if (!creatorRes.ok) {
          throw new Error(creatorData?.error ?? "Could not load creator.");
        }
        if (!creatorData?.creator) {
          throw new Error("Could not load creator.");
        }

        if (cancelled) return;
        setCreator(creatorData.creator);
        setPackages(creatorData.packages ?? []);
        setAvailability(creatorData.availability ?? []);
        setReviews(creatorData.reviews ?? []);

        const bookedRes = await fetch(
          `/api/public/bookings/availability?creatorId=${encodeURIComponent(creatorData.creator.id)}`
        );
        const bookedData = await readJsonResponse<{ bookings?: ExistingBookingWindow[] }>(bookedRes);
        if (!cancelled && bookedRes.ok) {
          setExistingBookingWindows((bookedData?.bookings ?? []) as ExistingBookingWindow[]);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load creator.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [creatorSlug]);

  useEffect(() => {
    const rawDraft = window.sessionStorage.getItem(draftKey);
    if (!rawDraft) return;
    try {
      const draft = JSON.parse(rawDraft) as DraftState;
      if (draft.packageId) setSelectedPackageId(draft.packageId);
      if (draft.selectedDateIso) setSelectedDate(new Date(draft.selectedDateIso));
      if (draft.selectedTime) setSelectedTime(draft.selectedTime);
      if (draft.topic) setTopic(draft.topic);
    } catch {
      window.sessionStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    const draft: DraftState = {
      packageId: selectedPackage?.id ?? null,
      selectedDateIso: selectedDate?.toISOString() ?? null,
      selectedTime,
      topic,
    };

    window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftKey, selectedDate, selectedPackage?.id, selectedTime, topic]);

  useEffect(() => {
    setClientSecret(null);
    setPaymentError("");
    setFetchingIntent(false);
    paymentInitKeyRef.current = null;
  }, [selectedPackage?.id, selectedDate?.toISOString(), selectedTime, user?.id]);

  const availableDateKeys = new Set(
    availableDates
      .filter((date) => {
        const rawSlots = getAvailableStartTimesForViewerDate({
          date,
          availability: packageAvailability,
          creatorTimeZone: creator?.timeZone ?? "America/New_York",
          durationMinutes: sessionDuration,
          incrementMinutes: creator?.bookingIntervalMinutes ?? 30,
        });

        return rawSlots.some((slot) => {
          const candidateIso = parseSlotToIso(date, slot);
          return !existingBookingWindows.some((booking) =>
            rangesOverlap(candidateIso, sessionDuration, booking.scheduledAt, booking.duration)
          );
        });
      })
      .map((date) => date.toDateString())
  );

  const availableTimeSlots = selectedDate
    ? getAvailableStartTimesForViewerDate({
        date: selectedDate,
        availability: packageAvailability,
        creatorTimeZone: creator?.timeZone ?? "America/New_York",
        durationMinutes: sessionDuration,
        incrementMinutes: creator?.bookingIntervalMinutes ?? 30,
      }).filter((slot) => {
        const candidateIso = parseSlotToIso(selectedDate, slot);
        return !existingBookingWindows.some((booking) =>
          rangesOverlap(candidateIso, sessionDuration, booking.scheduledAt, booking.duration)
        );
      })
    : [];

  async function handleAuthenticatedBookingSuccess(paymentIntentId: string) {
    if (!creator || !selectedPackage || !selectedDate || !selectedTime) {
      throw new Error("Missing booking details.");
    }

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorId: creator.id,
        packageId: selectedPackage.id,
        scheduledAt: parseSlotToIso(selectedDate, selectedTime),
        topic,
        paymentIntentId,
      }),
    });
    const data = await readJsonResponse<{
      booking?: { scheduled_at?: string; scheduledAt?: string; duration?: number };
      error?: string;
    }>(response);
    if (!response.ok) {
      throw new Error(data?.error ?? "Could not create booking.");
    }

    const confirmedScheduledAt = data?.booking?.scheduled_at ?? data?.booking?.scheduledAt ?? parseSlotToIso(selectedDate, selectedTime);
    const confirmedDuration = Number(data?.booking?.duration ?? selectedPackage.duration);
    setExistingBookingWindows((current) => [
      ...current,
      { scheduledAt: confirmedScheduledAt, duration: confirmedDuration },
    ]);
    window.sessionStorage.removeItem(draftKey);
    setSuccessMessage(`Your call with ${creator.name} is confirmed.`);
    setStep("success");
  }

  async function handleGuestBookingSuccess(paymentIntentId: string) {
    if (!creator || !selectedPackage || !selectedDate || !selectedTime) {
      throw new Error("Missing booking details.");
    }

    const response = await fetch("/api/public/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorId: creator.id,
        packageId: selectedPackage.id,
        scheduledAt: parseSlotToIso(selectedDate, selectedTime),
        topic,
        paymentIntentId,
        fullName: signUpName.trim(),
        email: signUpEmail.trim(),
        password: signUpPassword,
      }),
    });
    const data = await readJsonResponse<{
      booking?: { scheduled_at?: string; scheduledAt?: string; duration?: number };
      error?: string;
    }>(response);
    if (!response.ok) {
      throw new Error(data?.error ?? "Could not create booking.");
    }

    setAuthIntent(null);
    const loginResult = await login(signUpEmail.trim(), signUpPassword);
    if (!loginResult.success) {
      throw new Error("Your booking is confirmed, but we could not sign you in automatically. Please sign in with the email and password you just used.");
    }

    const confirmedScheduledAt = data?.booking?.scheduled_at ?? data?.booking?.scheduledAt ?? parseSlotToIso(selectedDate, selectedTime);
    const confirmedDuration = Number(data?.booking?.duration ?? selectedPackage.duration);
    setExistingBookingWindows((current) => [
      ...current,
      { scheduledAt: confirmedScheduledAt, duration: confirmedDuration },
    ]);
    window.sessionStorage.removeItem(draftKey);
    setSuccessMessage(`Your call with ${creator.name} is confirmed.`);
    setStep("success");
  }

  function focusAuthCard() {
    window.requestAnimationFrame(() => {
      authCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleJoinLive() {
    if (!creator?.isLive) return;
    const liveHref = getLiveSessionPath({
      creatorId: creator.id,
      creatorUsername: creator.slug || creator.username,
      sessionId: creator.currentLiveSessionId,
    });

    if (user?.role === "fan") {
      router.push(liveHref);
      return;
    }

    setAuthIntent("live");
    setAuthTab("signin");
    setStep("identity");
    focusAuthCard();
  }

  function handleSeeTimes() {
    setShowBookingModal(true);
  }

  function handleContinueFromDetails() {
    if (user?.role === "fan") {
      setStep("payment");
      return;
    }

    setAuthIntent(null);
    setAuthTab("signup");
    setStep("payment");
  }

  async function handleSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signInEmail.trim() || !signInPassword) return;
    setAwaitingEmailVerification(false);
    await login(signInEmail.trim(), signInPassword);
  }

  async function handleSignUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword) return;
    const result = await signup(signUpEmail.trim(), signUpPassword, signUpName.trim(), null);
    if (result.requiresEmailConfirmation) {
      setSettingFanRole(false);
      setAwaitingEmailVerification(true);
      setAuthTab("signin");
    }
  }

  useEffect(() => {
    if (step !== "payment" || clientSecret || fetchingIntent || !selectedPackage || !selectedDate || !selectedTime) {
      return;
    }
    if (authLoading) return;

    const nextPaymentInitKey = JSON.stringify({
      creatorId: creator?.id ?? "",
      packageId: selectedPackage.id,
      scheduledAtIso: parseSlotToIso(selectedDate, selectedTime),
      mode: user?.role === "fan" ? "authenticated" : "guest",
    } satisfies PaymentInitKey);

    if (paymentInitKeyRef.current === nextPaymentInitKey) {
      return;
    }

    let cancelled = false;

    async function initPayment() {
      try {
        setFetchingIntent(true);
        setPaymentError("");
        paymentInitKeyRef.current = nextPaymentInitKey;

        const scheduledAtIso = parseSlotToIso(selectedDate!, selectedTime!);
        const response = await fetch(user?.role === "fan" ? "/api/create-payment-intent" : "/api/public/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalCents,
            creatorId: creator?.id,
            packageId: selectedPackage?.id,
            scheduledAt: scheduledAtIso,
            creatorName: creator?.name,
            packageName: selectedPackage?.name ?? "Call",
            saveForFuture: false,
          }),
        });
        const data = await readJsonResponse<{ clientSecret?: string; error?: string }>(response);
        if (!response.ok || !data?.clientSecret) {
          throw new Error(data?.error ?? "Could not initialise payment.");
        }
        if (!cancelled) setClientSecret(data.clientSecret);
      } catch (error) {
        if (!cancelled) {
          setPaymentError(error instanceof Error ? error.message : "Could not initialise payment.");
          paymentInitKeyRef.current = null;
        }
      } finally {
        if (!cancelled) setFetchingIntent(false);
      }
    }

    void initPayment();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    clientSecret,
    creator?.name,
    creator?.id,
    selectedDate,
    selectedPackage,
    selectedTime,
    step,
    totalCents,
    user?.role,
  ]);

  useEffect(() => {
    if (authLoading) return;

    if (awaitingEmailVerification) return;

    if (liveIntentRequested && user?.role !== "fan" && (authIntent !== "live" || step !== "identity")) {
      setAuthIntent("live");
      setStep("identity");
    }

    if (!authIntent) return;

    if (user && !user.role && !settingFanRole) {
      let cancelled = false;

      const promoteToFan = async () => {
        try {
          setSettingFanRole(true);
          await setRole("fan");
        } finally {
          if (!cancelled) {
            setSettingFanRole(false);
          }
        }
      };

      void promoteToFan();
      return () => {
        cancelled = true;
      };
    }

    if (user?.role !== "fan") return;

    if (authIntent === "live" && creator?.isLive && creator.id && !hasHandledLiveIntentRef.current) {
      const liveHref = getLiveSessionPath({
        creatorId: creator.id,
        creatorUsername: creator.slug || creator.username,
        sessionId: creator.currentLiveSessionId,
      });
      hasHandledLiveIntentRef.current = true;
      setAuthIntent(null);
      router.replace(liveHref);
      return;
    }

    if (authIntent === "booking" && step !== "payment") {
      setAuthIntent(null);
      setStep("payment");
    }
  }, [
    authIntent,
    authLoading,
    awaitingEmailVerification,
    creator?.id,
    creator?.isLive,
    creator?.currentLiveSessionId,
    creator?.slug,
    creator?.username,
    liveIntentRequested,
    router,
    setRole,
    settingFanRole,
    step,
    user,
  ]);

  useEffect(() => {
    if (authLoading || !creator?.isLive || !liveIntentRequested || hasHandledLiveIntentRef.current) {
      return;
    }

    if (user?.role === "fan") {
      const liveHref = getLiveSessionPath({
        creatorId: creator.id,
        creatorUsername: creator.slug || creator.username,
        sessionId: creator.currentLiveSessionId,
      });
      hasHandledLiveIntentRef.current = true;
      router.replace(liveHref);
    }
  }, [authLoading, creator?.currentLiveSessionId, creator?.id, creator?.isLive, creator?.slug, creator?.username, liveIntentRequested, router, user?.role]);

  // Handle return from a Stripe redirect (e.g. Link authentication or bank redirect).
  // Stripe appends ?payment_intent=...&redirect_status=succeeded to the return_url.
  useEffect(() => {
    if (loading || !creator || authLoading || user?.role !== "fan") return;
    if (hasHandledRedirectRef.current) return;

    const paymentIntentId = searchParams.get("payment_intent");
    const redirectStatus = searchParams.get("redirect_status");
    if (!paymentIntentId || redirectStatus !== "succeeded") return;

    hasHandledRedirectRef.current = true;
    router.replace(`/book/${creatorSlug}`, { scroll: false });

    const rawDraft = window.sessionStorage.getItem(draftKey);
    let draft: DraftState | null = null;
    if (rawDraft) {
      try { draft = JSON.parse(rawDraft) as DraftState; } catch { /* ignore */ }
    }

    if (!draft?.packageId || !draft?.selectedDateIso || !draft?.selectedTime) return;

    const scheduledAt = parseSlotToIso(new Date(draft.selectedDateIso), draft.selectedTime);

    async function finalizeRedirectBooking() {
      try {
        setIsSubmitting(true);
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorId: creator!.id,
            packageId: draft!.packageId,
            scheduledAt,
            topic: draft!.topic ?? "",
            paymentIntentId,
          }),
        });
        const data = await readJsonResponse<{ error?: string }>(response);
        if (!response.ok) {
          setPaymentError(data?.error ?? "Could not complete booking after payment. Please contact support.");
          setStep("payment");
          return;
        }
        window.sessionStorage.removeItem(draftKey);
        setSuccessMessage(`Your call with ${creator!.name} is confirmed.`);
        setStep("success");
      } catch {
        setPaymentError("Could not complete booking after payment. Please contact support.");
        setStep("payment");
      } finally {
        setIsSubmitting(false);
      }
    }

    void finalizeRedirectBooking();
  }, [authLoading, creator, creatorSlug, draftKey, loading, router, searchParams, user?.role]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (loadError || !creator) {
    return (
      <div className="rounded-3xl border border-red-300/40 bg-red-50 px-6 py-8 text-center text-red-700">
        {loadError || "Could not load this booking page."}
      </div>
    );
  }

  const socialLinks = [
    {
      key: "instagram",
      label: "Instagram",
      href: sanitizeSocialUrl(creator.instagramUrl ?? ""),
      icon: Instagram,
    },
    {
      key: "tiktok",
      label: "TikTok",
      href: sanitizeSocialUrl(creator.tiktokUrl ?? ""),
      icon: Music2,
    },
    {
      key: "x",
      label: "X",
      href: sanitizeSocialUrl(creator.xUrl ?? ""),
      icon: ExternalLink,
    },
  ].filter((link) => link.href);

  const reviewCount = creator.reviewCount ?? reviews.length;
  const creatorRating = Number(creator.rating ?? 0);
  const liveCard = showLivePanel ? (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-card",
        creator.isLive
          ? "border-brand-live/25 bg-brand-live/5"
          : "border-brand-border bg-brand-surface"
      )}
    >
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-brand-live px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
        <Radio className="h-3 w-3" />
        Join Friendsly Live
      </div>
      <h2 className="mt-3 text-base font-bold text-brand-ink md:text-xl md:font-serif md:font-normal">
        Free to watch
      </h2>
      <p className="mt-1 text-sm text-brand-ink-muted">
        {creator.isLive
          ? `Jump into ${creator.name.split(" ")[0]}'s live room from this link.`
          : scheduledLiveLabel
          ? `Next live starts ${scheduledLiveLabel}.`
          : `${creator.name.split(" ")[0]}'s live room will appear here when it opens.`}
      </p>
      <Button
        variant={liveButtonDisabled ? "surface" : "live"}
        className="mt-3 min-h-11 w-full min-w-0 whitespace-normal px-3 text-center leading-tight"
        onClick={handleJoinLive}
        disabled={liveButtonDisabled}
      >
        <Radio className="w-4 h-4" />
        {liveButtonLabel}
      </Button>
    </div>
  ) : null;

  const reviewsSection = (
    <section className="rounded-3xl border border-brand-border bg-brand-surface p-5 shadow-card md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-brand-ink">
          Reviews <span className="font-normal text-brand-ink-subtle">({reviewCount})</span>
        </h2>
        {creatorRating > 0 && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn(
                  "h-4 w-4",
                  n <= Math.round(creatorRating) ? "fill-brand-gold text-brand-gold" : "text-brand-ink-subtle"
                )}
              />
            ))}
            <span className="ml-2 text-sm font-bold text-brand-gold">{creatorRating}</span>
          </div>
        )}
      </div>

      <div className="space-y-3 md:space-y-4">
        {reviews.length === 0 && (
          <div className="rounded-2xl border border-brand-border bg-brand-elevated p-8 text-center">
            <Star className="mx-auto mb-3 h-8 w-8 text-brand-ink-subtle" />
            <p className="text-brand-ink-subtle">No reviews yet.</p>
            <p className="mt-1 text-sm text-brand-ink-subtle">Be the first to leave a review!</p>
          </div>
        )}
        {reviews.map((review) => (
          <div key={review.id} className="rounded-2xl border border-brand-border bg-brand-elevated p-4 md:p-5">
            <div className="flex items-start gap-3">
              <Avatar initials={review.initials} color={review.color} imageUrl={review.imageUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-brand-ink">{review.fan}</p>
                  <span className="shrink-0 text-xs text-brand-ink-subtle">
                    {new Date(review.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="mb-1 mt-0.5 flex items-center gap-0.5 md:mb-2">
                  {Array.from({ length: review.rating }).map((_, index) => (
                    <Star key={index} className="h-3 w-3 fill-brand-gold text-brand-gold md:h-3.5 md:w-3.5" />
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-brand-ink-muted md:text-sm">{review.comment}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const exampleQuestions = [
    "Build a realistic weekly fitness plan around your schedule.",
    "Review your nutrition habits and identify simple upgrades.",
    "Ask about form, recovery, consistency, or getting unstuck.",
    "Leave with practical next steps you can start this week.",
  ];

  const exampleQuestionsSection = packages.length > 0 ? (
    <section className="mt-5 rounded-2xl border border-brand-border bg-brand-elevated p-4">
      <p className="text-sm font-bold text-brand-ink">What you can ask</p>
      <ul className="mt-3 space-y-2">
        {exampleQuestions.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-5 text-brand-ink-muted">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary-light" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

  const howItWorksSection = (
    <section className="rounded-3xl border border-brand-border bg-brand-surface p-6 shadow-card md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary-light">How it works</p>
      <h2 className="mt-2 text-2xl font-serif font-normal text-brand-ink">Simple, personal, and live.</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["1", "Pick a time", "Choose a time that works and share what you want to cover."],
          ["2", "Meet live", "Join the video call from Friendsly when your session starts."],
          ["3", "Leave with next steps", "Get specific advice you can use after the call."],
        ].map(([number, title, body]) => (
          <div key={number} className="rounded-2xl border border-brand-border bg-brand-elevated p-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-ink text-sm font-bold text-white">
              {number}
            </div>
            <p className="mt-4 font-bold text-brand-ink">{title}</p>
            <p className="mt-2 text-sm leading-6 text-brand-ink-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-5xl overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="mb-4 flex justify-start">
        <Button
          variant="outline"
          className="min-h-11 whitespace-normal px-4 text-sm md:min-h-0"
          onClick={() => router.push("/discover")}
        >
          <Home className="h-4 w-4" />
          Back to Discover
        </Button>
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:gap-7">
        <section className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-brand-border bg-brand-elevated md:rounded-3xl">
            {creator.avatarUrl ? (
              <img src={creator.avatarUrl} alt={creator.name} className="h-full w-full object-cover" />
            ) : (
              <div className={cn("flex h-full w-full items-center justify-center", creator.avatarColor ?? "bg-brand-primary")}>
                <span className="text-8xl font-bold text-white/70">{creator.avatarInitials}</span>
              </div>
            )}
            {creator.isLive && (
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-brand-live px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.18)]" />
                LIVE NOW
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold leading-tight text-brand-ink md:text-[2rem] md:font-serif md:font-normal">
              {creator.name}
              <CheckCircle2 className="hidden h-5 w-5 text-brand-primary md:block" />
            </h1>
            {creator.category && (
              <p className="mt-1 text-sm text-brand-ink-muted">{creator.category}</p>
            )}
            <p className="mt-1 text-xs text-brand-ink-subtle">@{creator.username}</p>
            {creatorRating > 0 && (
              <div className="mt-2 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn(
                      "h-4 w-4",
                      n <= Math.round(creatorRating) ? "fill-brand-gold text-brand-gold" : "text-brand-border"
                    )}
                  />
                ))}
                <span className="ml-1 text-sm font-bold text-brand-gold">{creatorRating}</span>
                <span className="text-xs text-brand-ink-subtle">({reviewCount})</span>
              </div>
            )}

            {(creator.bio || socialLinks.length > 0 || (creator.tags?.length ?? 0) > 0) && (
              <div className="mt-4 border-t border-brand-border pb-1 pt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-brand-ink">About</h2>
                  {socialLinks.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {socialLinks.map(({ key, label, href, icon: Icon }) => (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={label}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-border bg-brand-elevated text-brand-ink-muted transition-colors hover:border-brand-primary/40 hover:text-brand-ink"
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {creator.bio && (
                  <p className="whitespace-pre-line break-words text-sm leading-relaxed text-brand-ink-muted [overflow-wrap:anywhere]">
                    {creator.bio}
                  </p>
                )}
                {(creator.tags?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {creator.tags?.slice(0, 6).map((tag) => (
                      <span key={tag} className="rounded-full border border-brand-border bg-brand-elevated px-2.5 py-1 text-[11px] font-medium text-brand-ink-subtle">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="min-w-0 space-y-5">
          {creator.isLive ? liveCard : null}

          <section className="min-w-0">
          <div className="max-w-full overflow-hidden rounded-3xl border border-brand-border bg-brand-surface p-5 shadow-card md:p-6">
            <div className="flex min-w-0 flex-col gap-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                  <Video className="h-3 w-3" />
                  Book a video call
                </div>
                <h2 className="text-xl font-serif font-normal text-brand-ink">Book a Session</h2>
                <p className="mt-1 text-sm text-brand-ink-muted">
                  Book a 1:1 live video consultation &amp; get personalized advice.
                </p>
              </div>
            </div>

            {packages.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-brand-border bg-brand-elevated py-8 text-center">
                <p className="text-sm text-brand-ink-subtle">No booking packages available yet.</p>
                <p className="mt-1 text-xs text-brand-ink-subtle">Check back soon or watch their public live.</p>
              </div>
            ) : (
              <>
                <Button variant="primary" size="lg" className="mt-5 w-full" onClick={handleSeeTimes}>
                  See times
                </Button>
                {exampleQuestionsSection}
              </>
            )}
          </div>
        </section>

          {!creator.isLive ? liveCard : null}
          {reviewsSection}
        </div>

        <div className="hidden">
          <div className="hidden">
            <h2 className="text-lg font-bold text-brand-ink">Booking summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-elevated p-3">
                <Avatar initials={creator.avatarInitials} color={creator.avatarColor} imageUrl={creator.avatarUrl} size="sm" />
                <div>
                  <p className="font-semibold text-brand-ink">{creator.name}</p>
                  <p className="text-xs text-brand-ink-muted">{creator.category}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4">
                <div className="flex justify-between">
                  <span className="text-brand-ink-muted">Session</span>
                  <span className="font-medium text-brand-ink">{selectedPackage?.name ?? "Choose a package"}</span>
                </div>
                {selectedPackage?.description && (
                  <p className="mt-2 text-xs leading-relaxed text-brand-ink-subtle">
                    {selectedPackage.description}
                  </p>
                )}
                <div className="mt-2 flex justify-between">
                  <span className="text-brand-ink-muted">When</span>
                  <span className="font-medium text-brand-ink">
                    {selectedDate && selectedTime ? `${formatShortDate(selectedDate)} at ${selectedTime}` : "Select a date and time"}
                  </span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-brand-ink-muted">Duration</span>
                  <span className="font-medium text-brand-ink">{selectedPackage ? `${selectedPackage.duration} min` : "—"}</span>
                </div>
              </div>

              {selectedPackage && (
                <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-ink-subtle">Session fee</span>
                    <span className="text-brand-ink">{formatCurrency(sessionPrice)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-brand-ink-subtle">Platform fee (2.5%)</span>
                    <span className="text-brand-ink">{formatCurrency(platformFeeAmount)}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-brand-border pt-3 text-base font-bold">
                    <span className="text-brand-ink">Total</span>
                    <span className="text-amber-600 font-bold">{formatCurrency(sessionGrossPrice)}</span>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-brand-border bg-brand-surface p-4">
                <RefundPolicyModal
                  trigger="inline"
                  title="Booking refund policy"
                  description="Review the cancellation and no-show rules tied to this booking before you pay."
                />
                <p className="mt-3 text-xs leading-relaxed text-brand-ink-subtle">
                  You&apos;ll sign in or create a Friendsly fan account here before payment, then we&apos;ll keep you in this flow.
                </p>
              </div>
            </div>
          </div>

          {(step === "select" || step === "details") && (
            <div className="hidden">
              <Button
                variant="gold"
                className="w-full"
                onClick={handleContinueFromDetails}
                disabled={!canReviewAndPay}
              >
                Review and pay
              </Button>
              {!canReviewAndPay && (
                <p className="mt-3 text-xs text-brand-ink-muted">
                  Select a package, date, and time to continue.
                </p>
              )}
            </div>
          )}

          {step === "identity" && (
            <div ref={authCardRef} className="rounded-3xl border border-brand-border bg-brand-surface p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-brand-ink">Continue with a fan account</h2>
                <p className="mt-1 text-sm text-brand-ink-subtle">
                  {authIntent === "live"
                    ? "Sign in below. New accounts need email verification before we can take you into the live room."
                    : "Sign in below. New accounts need email verification before we can bring you back to payment."}
                </p>
              </div>
              {user?.role === "fan" ? (
                <Button
                  variant="gold"
                  className="w-full"
                  onClick={() => {
                    if (authIntent === "live") {
                      void handleJoinLive();
                      return;
                    }
                    setStep("payment");
                  }}
                >
                  Continue as {user.full_name}
                </Button>
              ) : settingFanRole ? (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-brand-border bg-brand-elevated px-4 py-5 text-sm text-brand-ink-subtle">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-primary" />
                  Finalising your fan account...
                </div>
              ) : (
                <>
                  <div className="flex rounded-2xl border border-brand-border bg-brand-elevated p-1">
                    {(["signin", "signup"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setAuthTab(tab)}
                        className={cn(
                          "flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all",
                          authTab === tab
                            ? "bg-brand-primary/15 text-brand-primary-light"
                            : "text-brand-ink-muted hover:text-brand-ink"
                        )}
                      >
                        {tab === "signin" ? "Sign in" : "Create account"}
                      </button>
                    ))}
                  </div>

                  {authError && !awaitingEmailVerification && (
                    <div className="rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {authError}
                    </div>
                  )}

                  {awaitingEmailVerification && (
                    <div className="rounded-2xl border border-brand-primary/25 bg-brand-primary/10 px-4 py-3 text-sm text-brand-ink-subtle">
                      Check your email to verify your account, then sign in here to continue.
                    </div>
                  )}

                  {authTab === "signin" ? (
                    <form className="space-y-3 rounded-2xl border border-brand-border bg-brand-elevated p-4" onSubmit={handleSignInSubmit}>
                      <Input
                        label="Email"
                        type="email"
                        value={signInEmail}
                        onChange={(event) => setSignInEmail(event.target.value)}
                        icon={<Mail className="w-4 h-4" />}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      <Input
                        label="Password"
                        type="password"
                        value={signInPassword}
                        onChange={(event) => setSignInPassword(event.target.value)}
                        icon={<Lock className="w-4 h-4" />}
                        placeholder="Your password"
                        autoComplete="current-password"
                      />
                      <Button
                        type="submit"
                        variant="gold"
                        className="w-full"
                        disabled={authLoading || !signInEmail.trim() || !signInPassword}
                      >
                        {authLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                        ) : (
                          "Sign in and continue"
                        )}
                      </Button>
                    </form>
                  ) : (
                    <form className="space-y-3 rounded-2xl border border-brand-border bg-brand-elevated p-4" onSubmit={handleSignUpSubmit}>
                      <Input
                        label="Full Name"
                        value={signUpName}
                        onChange={(event) => setSignUpName(event.target.value)}
                        icon={<User className="w-4 h-4" />}
                        placeholder="Jordan Kim"
                        autoComplete="name"
                      />
                      <Input
                        label="Email"
                        type="email"
                        value={signUpEmail}
                        onChange={(event) => setSignUpEmail(event.target.value)}
                        icon={<Mail className="w-4 h-4" />}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      <Input
                        label="Password"
                        type="password"
                        value={signUpPassword}
                        onChange={(event) => setSignUpPassword(event.target.value)}
                        icon={<Lock className="w-4 h-4" />}
                        placeholder="Create a password"
                        autoComplete="new-password"
                      />
                      <p className="text-xs leading-relaxed text-brand-ink-subtle">
                        Password must be at least 8 characters and include an uppercase letter and a special character.
                      </p>
                      <Button
                        type="submit"
                        variant="gold"
                        className="w-full"
                        disabled={authLoading || !signUpName.trim() || !signUpEmail.trim() || !signUpPassword}
                      >
                        {authLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                        ) : (
                          <><BadgeCheck className="w-4 h-4" /> Create account and continue</>
                        )}
                      </Button>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {step === "payment" && (
            <div className="rounded-3xl border border-brand-border bg-brand-surface p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-brand-ink">Complete payment</h2>
                <RefundPolicyModal trigger="link" />
              </div>
              {paymentError && (
                <div className="rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {paymentError}
                </div>
              )}
              {fetchingIntent ? (
                <div className="flex items-center justify-center gap-3 py-8 text-brand-ink-subtle">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading payment form...</span>
                </div>
              ) : clientSecret ? (
                <Elements stripe={stripePromise} options={{ ...STRIPE_OPTIONS, clientSecret }}>
                  <PaymentForm
                    onBack={() => setStep("select")}
                    onSubmit={user?.role === "fan" ? handleAuthenticatedBookingSuccess : handleGuestBookingSuccess}
                    canSubmit={user?.role === "fan" || guestAccountReady}
                    submitDisabledReason="Add your name, email, password, and confirmations under the card details."
                    accountFields={user?.role === "fan" ? null : (
                      <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4">
                        <p className="text-sm font-semibold text-brand-ink">Create your account after payment</p>
                        <p className="mt-1 text-xs leading-5 text-brand-ink-subtle">
                          Your paid checkout confirms this fan account. No email confirmation step is required.
                        </p>
                        <div className="mt-4 space-y-3">
                          <Input
                            label="Full Name"
                            type="text"
                            value={signUpName}
                            onChange={(event) => setSignUpName(event.target.value)}
                            icon={<User className="h-4 w-4" />}
                            placeholder="Jordan Kim"
                            required
                            autoComplete="name"
                          />
                          <Input
                            label="Email"
                            type="email"
                            value={signUpEmail}
                            onChange={(event) => setSignUpEmail(event.target.value)}
                            icon={<Mail className="h-4 w-4" />}
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                          />
                          <Input
                            label="Password"
                            type="password"
                            value={signUpPassword}
                            onChange={(event) => setSignUpPassword(event.target.value)}
                            icon={<Lock className="h-4 w-4" />}
                            placeholder="Create a password"
                            required
                            autoComplete="new-password"
                          />
                          <p className="text-xs leading-relaxed text-brand-ink-subtle">
                            Password must be at least 8 characters and include an uppercase letter and a special character.
                          </p>
                          <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-brand-border bg-white px-3 py-3 text-xs leading-relaxed text-brand-ink-subtle">
                            <input
                              type="checkbox"
                              checked={guestAgreedToTerms}
                              onChange={(event) => setGuestAgreedToTerms(event.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary/30"
                            />
                            <span>I agree to the Terms of Service and Privacy Policy.</span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-brand-border bg-white px-3 py-3 text-xs leading-relaxed text-brand-ink-subtle">
                            <input
                              type="checkbox"
                              checked={guestConfirmedAge}
                              onChange={(event) => setGuestConfirmedAge(event.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary/30"
                            />
                            <span>I confirm that I am 18 years of age or older.</span>
                          </label>
                        </div>
                      </div>
                    )}
                    isSubmitting={isSubmitting}
                    setIsSubmitting={setIsSubmitting}
                    setError={setPaymentError}
                  />
                </Elements>
              ) : null}
            </div>
          )}

          {step === "success" && (
            <div className="rounded-3xl border border-brand-live/30 bg-brand-live/10 p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-live/20">
                  <CheckCircle2 className="w-6 h-6 text-brand-live" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-brand-ink">You&apos;re booked</h2>
                  <p className="text-sm text-brand-ink-subtle">{successMessage}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-brand-border bg-brand-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">Refund policy available any time</p>
                    <p className="mt-1 text-xs leading-relaxed text-brand-ink-subtle">
                      Your booking is confirmed. You can reopen the policy here if you need the cancellation, no-show, or late-fee details.
                    </p>
                  </div>
                  <RefundPolicyModal
                    trigger="icon"
                    open={showRefundPolicyOnSuccess}
                    onOpenChange={setShowRefundPolicyOnSuccess}
                    title="Booking refund policy"
                    description="This policy applies to the booking you just confirmed."
                  />
                </div>
              </div>
              <Button variant="gold" className="w-full" onClick={() => router.push("/bookings")}>
                View your bookings
              </Button>
            </div>
          )}
        </div>

        <div className="hidden">
          {reviewsSection}
        </div>
      </div>
      <div className="mt-6">
        {howItWorksSection}
      </div>
      {bookingCreator && (
        <BookingModal
          creator={bookingCreator}
          open={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          packages={bookingPackages}
          availability={availability}
        />
      )}
    </div>
  );
}
