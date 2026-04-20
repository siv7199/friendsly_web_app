"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Radio,
  User,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn, formatCurrency } from "@/lib/utils";
import { getAvailableStartTimesForViewerDate, getBrowserTimeZone, getTimeZoneAbbreviation } from "@/lib/timezones";
import { RefundPolicyModal } from "@/components/shared/RefundPolicyModal";

type CreatorPayload = {
  id: string;
  slug: string;
  name: string;
  username: string;
  bio: string;
  category: string;
  avatarInitials: string;
  avatarColor: string;
  avatarUrl?: string;
  timeZone: string;
  bookingIntervalMinutes: number;
  isLive: boolean;
};

type PackagePayload = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
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
};

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const STRIPE_OPTIONS = {
  appearance: {
    theme: "night" as const,
    variables: {
      colorPrimary: "#7C3AED",
      colorBackground: "#1e1b3a",
      colorText: "#f1f5f9",
      colorTextSecondary: "#c4b5fd",
      colorTextPlaceholder: "#7c6fa0",
      colorDanger: "#f87171",
      fontFamily: "inherit",
      borderRadius: "12px",
    },
    rules: {
      ".Label": {
        color: "#c4b5fd",
        fontWeight: "500",
      },
      ".Input": {
        borderColor: "rgba(124,92,231,0.35)",
        color: "#f1f5f9",
      },
      ".Input--focused": {
        borderColor: "#7C3AED",
        boxShadow: "0 0 0 2px rgba(124,92,231,0.2)",
      },
      ".Input--invalid": {
        borderColor: "#f87171",
        color: "#fca5a5",
      },
      ".Error": {
        color: "#fca5a5",
      },
    },
  },
};

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

function getDraftKey(slug: string) {
  return `shareable-booking-draft:${slug}`;
}

function PaymentForm({
  onBack,
  onSubmit,
  isSubmitting,
  setIsSubmitting,
  setError,
}: {
  onBack: () => void;
  onSubmit: (paymentIntentId: string) => Promise<void>;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setError: (value: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  async function handlePay() {
    if (!stripe || !elements || !isReady) return;
    setIsSubmitting(true);
    setError("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
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
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          variant="gold"
          className="flex-1"
          onClick={handlePay}
          disabled={isSubmitting || !stripe || !isReady}
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
  const [existingBookingWindows, setExistingBookingWindows] = useState<ExistingBookingWindow[]>([]);

  const [step, setStep] = useState<Step>("select");
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

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
  const [settingFanRole, setSettingFanRole] = useState(false);
  const paymentInitKeyRef = useRef<string | null>(null);
  const hasHandledLiveIntentRef = useRef(false);
  const authCardRef = useRef<HTMLDivElement | null>(null);

  const draftKey = getDraftKey(creatorSlug);
  const viewerTimeZone = getBrowserTimeZone();
  const liveIntentRequested = searchParams.get("intent") === "live";

  const selectedPackage = useMemo(
    () => packages.find((pkg) => pkg.id === selectedPackageId) ?? (packages.length === 1 ? packages[0] : null),
    [packages, selectedPackageId]
  );

  const sessionPrice = selectedPackage?.price ?? 0;
  const sessionDuration = selectedPackage?.duration ?? 15;
  const totalCents = Math.round(sessionPrice * 1.025 * 100);
  const sessionGrossPrice = totalCents / 100;
  const platformFeeAmount = sessionGrossPrice - sessionPrice;
  const availableDates = getAvailableDates(weekOffset);
  const canReviewAndPay = Boolean(selectedPackage && selectedDate && selectedTime);
  const needsPackageSelection = packages.length > 1 && !selectedPackage;
  const currentStepLabel = step === "success" ? "Done" : step === "payment" ? "3" : step === "identity" ? "2" : "1";
  const packageAvailability = availability.filter((slot) =>
    !selectedPackage?.id ? slot.package_id == null : slot.package_id == null || slot.package_id === selectedPackage.id
  );

  useEffect(() => {
    let cancelled = false;

    async function refreshLiveStatus() {
      try {
        const creatorRes = await fetch(`/api/public/creators/${encodeURIComponent(creatorSlug)}`, {
          cache: "no-store",
        });
        const creatorData = await creatorRes.json();
        if (!creatorRes.ok || cancelled) return;

        setCreator((current) => current ? { ...current, ...creatorData.creator } : creatorData.creator);
      } catch {
        // Ignore lightweight live-status refresh failures and preserve the page state.
      }
    }

    function refreshIfVisible() {
      if (document.visibilityState === "visible") {
        void refreshLiveStatus();
      }
    }

    const interval = window.setInterval(refreshIfVisible, 15000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
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

        const creatorRes = await fetch(`/api/public/creators/${encodeURIComponent(creatorSlug)}`, {
          cache: "no-store",
        });
        const creatorData = await creatorRes.json();
        if (!creatorRes.ok) {
          throw new Error(creatorData.error ?? "Could not load creator.");
        }

        if (cancelled) return;
        setCreator(creatorData.creator);
        setPackages(creatorData.packages ?? []);
        setAvailability(creatorData.availability ?? []);
        setSelectedPackageId((current) => current ?? (creatorData.packages?.length === 1 ? creatorData.packages[0].id : null));

        const bookedRes = await fetch(
          `/api/public/bookings/availability?creatorId=${encodeURIComponent(creatorData.creator.id)}`,
          { cache: "no-store" }
        );
        const bookedData = await bookedRes.json();
        if (!cancelled && bookedRes.ok) {
          setExistingBookingWindows((bookedData.bookings ?? []) as ExistingBookingWindow[]);
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
  }, [selectedPackage?.id, selectedDate?.toISOString(), selectedTime, topic, user?.id]);

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
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Could not create booking.");
    }

    window.sessionStorage.removeItem(draftKey);
    setSuccessMessage(`Your call with ${creator.name} is confirmed.`);
    setShowRefundPolicyOnSuccess(true);
    setStep("success");
  }

  function focusAuthCard() {
    window.requestAnimationFrame(() => {
      authCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleJoinLive() {
    if (!creator?.isLive) return;

    if (user?.role === "fan") {
      router.push(`/waiting-room/${creator.id}`);
      return;
    }

    setAuthIntent("live");
    setAuthTab("signin");
    setStep("identity");
    focusAuthCard();
  }

  function handleContinueFromDetails() {
    if (user?.role === "fan") {
      setStep("payment");
      return;
    }

    setAuthIntent("booking");
    setAuthTab("signin");
    setStep("identity");
    focusAuthCard();
  }

  async function handleSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signInEmail.trim() || !signInPassword) return;
    await login(signInEmail.trim(), signInPassword);
  }

  async function handleSignUpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPassword) return;
    await signup(signUpEmail.trim(), signUpPassword, signUpName.trim(), null);
  }

  useEffect(() => {
    if (step !== "payment" || clientSecret || fetchingIntent || !selectedPackage || !selectedDate || !selectedTime) {
      return;
    }
    if (authLoading) return;

    if (user?.role !== "fan") return;

    const nextPaymentInitKey = JSON.stringify({
      creatorId: creator?.id ?? "",
      packageId: selectedPackage.id,
      scheduledAtIso: parseSlotToIso(selectedDate, selectedTime),
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

        const response = await fetch("/api/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalCents,
            packageId: selectedPackage?.id,
            creatorName: creator?.name,
            packageName: selectedPackage?.name ?? "Call",
            saveForFuture: false,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.clientSecret) {
          throw new Error(data.error ?? "Could not initialise payment.");
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
    topic,
    totalCents,
    user?.role,
  ]);

  useEffect(() => {
    if (authLoading) return;

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
      hasHandledLiveIntentRef.current = true;
      setAuthIntent(null);
      router.replace(`/waiting-room/${creator.id}`);
      return;
    }

    if (authIntent === "booking" && step !== "payment") {
      setAuthIntent(null);
      setStep("payment");
    }
  }, [
    authIntent,
    authLoading,
    creator?.id,
    creator?.isLive,
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
      hasHandledLiveIntentRef.current = true;
      router.replace(`/waiting-room/${creator.id}`);
    }
  }, [authLoading, creator?.id, creator?.isLive, liveIntentRequested, router, user?.role]);

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

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-5">
          <div className="rounded-3xl border border-brand-border bg-brand-surface p-6 md:p-8">
            <div className="flex items-start gap-4">
              <Avatar
                initials={creator.avatarInitials}
                color={creator.avatarColor}
                imageUrl={creator.avatarUrl}
                size="xl"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-primary-light">
                  Shareable Booking Link
                </p>
                <h1 className="mt-2 text-3xl font-serif font-normal text-brand-ink">{creator.name}</h1>
                <p className="mt-1 text-sm text-brand-ink-subtle">{creator.category}</p>
                {creator.bio && (
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-brand-ink-subtle">
                    {creator.bio}
                  </p>
                )}
                {creator.isLive && (
                  <div className="mt-4 rounded-2xl border border-brand-live/20 bg-brand-live/10 p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-live animate-pulse" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-live">
                          Live on Friendsly now
                        </p>
                        <p className="mt-1 text-sm text-brand-ink-subtle">
                          Jump into {creator.name.split(" ")[0]}&apos;s live room from this link.
                        </p>
                      </div>
                    </div>
                    <Button variant="live" className="mt-3 w-full gap-2" onClick={handleJoinLive}>
                      <Radio className="w-4 h-4" />
                      {user?.role === "fan" ? "Join Live Now" : "Sign in or create account to join"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-brand-border bg-brand-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-ink">Choose your session</h2>
              <span className="text-xs text-brand-ink-muted">
                Step {currentStepLabel} of 3
              </span>
            </div>

            {packages.length > 1 && (
              <div className="mt-5 space-y-3">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setSelectedDate(null);
                      setSelectedTime(null);
                    }}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition-all",
                      selectedPackage?.id === pkg.id
                        ? "border-brand-primary bg-brand-primary/10"
                        : "border-brand-border bg-brand-elevated hover:border-brand-primary/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-brand-ink">{pkg.name}</p>
                        <p className="mt-1 text-sm text-brand-ink-subtle">{pkg.description}</p>
                        <p className="mt-2 text-xs text-brand-ink-muted">{pkg.duration} min</p>
                      </div>
                      <p className="text-lg font-black text-amber-600 font-bold">{formatCurrency(pkg.price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedPackage && (
              <div className="mt-6 rounded-2xl border border-brand-border bg-brand-elevated p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">{selectedPackage.name}</p>
                    <p className="text-xs text-brand-ink-muted">{selectedPackage.duration} min</p>
                  </div>
                  <p className="text-base font-bold text-brand-ink">{formatCurrency(selectedPackage.price)}</p>
                </div>
              </div>
            )}

            {needsPackageSelection && (
              <div className="mt-6 rounded-2xl border border-dashed border-brand-primary/35 bg-brand-primary/5 p-4">
                <p className="text-sm font-semibold text-brand-ink">Choose a booking type first</p>
                <p className="mt-1 text-sm leading-relaxed text-brand-ink-subtle">
                  Pick the kind of session you want, then we&apos;ll show the available dates and times for that option.
                </p>
              </div>
            )}

            {(step === "select" || step === "details" || step === "identity" || step === "payment") && (
              <div className="mt-6 min-w-0 space-y-5">
                {selectedPackage && (
                  <>
                    <div className="min-w-0">
                      <p className="mb-2 text-xs text-brand-ink-muted">
                        Times shown in your local time ({getTimeZoneAbbreviation(new Date(), viewerTimeZone)}).
                      </p>
                      <div className="mb-3 flex flex-col gap-2 min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
                        <label className="flex items-center gap-2 text-sm font-medium text-brand-ink-subtle">
                          <Calendar className="w-4 h-4 text-brand-primary-light" />
                          Select Date
                        </label>
                        <div className="flex shrink-0 items-center gap-1.5 self-end min-[380px]:self-auto">
                          <button
                            onClick={() => setWeekOffset((value) => Math.max(0, value - 1))}
                            disabled={weekOffset === 0}
                            className="rounded-md border border-brand-border bg-brand-elevated p-1 text-brand-ink-subtle transition-colors hover:text-brand-ink disabled:opacity-30"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setWeekOffset((value) => Math.min(3, value + 1))}
                            disabled={weekOffset >= 3}
                            className="rounded-md border border-brand-border bg-brand-elevated p-1 text-brand-ink-subtle transition-colors hover:text-brand-ink disabled:opacity-30"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid min-w-0 grid-cols-4 gap-1 min-[380px]:gap-2">
                        {availableDates.map((date) => {
                          const isSelected = selectedDate?.toDateString() === date.toDateString();
                          const hasTimes = availableDateKeys.has(date.toDateString());
                          return (
                            <button
                              key={date.toISOString()}
                              onClick={() => {
                                if (!hasTimes) return;
                                setSelectedDate(date);
                                setSelectedTime(null);
                              }}
                              disabled={!hasTimes}
                              className={cn(
                                "flex min-w-0 flex-col items-center rounded-xl border px-1 py-2 text-xs font-medium transition-all min-[380px]:p-2",
                                isSelected
                                  ? "border-brand-primary bg-brand-primary/20 text-brand-primary-light ring-1 ring-brand-primary/30"
                                  : hasTimes
                                  ? "border-brand-primary/40 bg-white text-brand-ink font-semibold shadow-sm hover:border-brand-primary hover:bg-brand-primary/5"
                                  : "cursor-not-allowed border-brand-border/40 bg-brand-elevated/40 text-brand-ink-muted opacity-35"
                              )}
                            >
                              <span className="text-[10px] uppercase opacity-70">
                                {date.toLocaleDateString("en-US", { weekday: "short" })}
                              </span>
                              <span className="mt-0.5 text-base font-bold">{date.getDate()}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {selectedDate && (
                      <div className="min-w-0">
                        <label className="mb-3 flex items-center gap-2 text-sm font-medium text-brand-ink-subtle">
                          <Clock className="w-4 h-4 text-brand-primary-light" />
                          Select Time
                        </label>
                        {availableTimeSlots.length === 0 ? (
                          <p className="rounded-xl border border-brand-border bg-brand-elevated px-4 py-3 text-sm text-brand-ink-muted">
                            No times available on that date.
                          </p>
                        ) : (
                          <div className="grid min-w-0 grid-cols-2 gap-2 min-[380px]:grid-cols-3">
                            {availableTimeSlots.map((slot) => (
                              <button
                                key={slot}
                                onClick={() => setSelectedTime(slot)}
                                className={cn(
                                  "min-w-0 rounded-xl border px-2 py-2 text-xs font-medium transition-all min-[380px]:px-3",
                                  selectedTime === slot
                                    ? "border-brand-primary bg-brand-primary/20 text-brand-primary-light"
                                    : "border-brand-border bg-brand-elevated text-brand-ink-subtle hover:border-brand-primary/40 hover:text-brand-ink"
                                )}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedDate && selectedTime && (
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-brand-ink-subtle">
                            <MessageSquare className="w-4 h-4 text-brand-primary-light" />
                            What do you want to cover?
                          </label>
                          <textarea
                            value={topic}
                            onChange={(event) => setTopic(event.target.value)}
                            rows={3}
                            placeholder={`Let ${creator.name.split(" ")[0]} know what you'd like to talk about.`}
                            className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                          />
                        </div>

                        <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4 lg:hidden">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink-muted">Your booking</p>
                          <div className="mt-3 space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-brand-ink-muted">Session</span>
                              <span className="text-right font-medium text-brand-ink">{selectedPackage.name}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-brand-ink-muted">When</span>
                              <span className="text-right font-medium text-brand-ink">{`${formatShortDate(selectedDate)} at ${selectedTime}`}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-brand-ink-muted">Total</span>
                              <span className="font-bold text-amber-600">{formatCurrency(sessionGrossPrice)}</span>
                            </div>
                          </div>
                        </div>

                        {(step === "select" || step === "details") && (
                          <div className="min-w-0 rounded-2xl border border-brand-border bg-brand-surface p-4 lg:hidden">
                            <Button
                              variant="gold"
                              className="w-full min-w-0 px-3"
                              onClick={handleContinueFromDetails}
                              disabled={!canReviewAndPay}
                            >
                              Review and pay
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <div className="hidden rounded-3xl border border-brand-border bg-brand-surface p-6 lg:block">
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
            <div className="hidden rounded-3xl border border-brand-border bg-brand-surface p-6 lg:block">
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
                    ? "Sign in or create your fan account below. As soon as you&apos;re in, we&apos;ll take you straight into the live room."
                    : "Sign in or create your fan account below. As soon as you&apos;re in, we&apos;ll bring you right back to payment."}
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

                  {authError && (
                    <div className="rounded-2xl border border-red-300/40 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {authError}
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
                    onSubmit={handleAuthenticatedBookingSuccess}
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
        </aside>
      </div>
    </div>
  );
}
