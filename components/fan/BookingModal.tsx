"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Calendar, Clock, MessageSquare, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { Creator, CallPackage } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { getAvailableStartTimesForViewerDate, getBrowserTimeZone, getTimeZoneAbbreviation } from "@/lib/timezones";

interface AvailabilitySlot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  package_id?: string | null;
}

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface ExistingBookingWindow {
  scheduledAt: string;
  duration: number;
}

// Initialise Stripe once (outside component so it's not recreated on render)
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// Stripe Elements appearance — matches the dark brand theme
const STRIPE_APPEARANCE = {
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
};

const STRIPE_OPTIONS = {
  appearance: STRIPE_APPEARANCE,
};

function getAvailableDates(weekOffset: number) {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 8; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i + (weekOffset * 7));
    dates.push(d);
  }
  return dates;
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getPackageAvailability(
  availability: AvailabilitySlot[],
  packageId?: string
) {
  return availability.filter((slot) => {
    if (!packageId) {
      return slot.package_id == null;
    }

    return slot.package_id == null || slot.package_id === packageId;
  });
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

// ── Inner payment form (needs to live inside <Elements>) ───────────────

interface PaymentFormProps {
  onSuccess: (paymentIntentId: string) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  setPayError: (v: string) => void;
}

function PaymentForm({ onSuccess, onBack, isSubmitting, setIsSubmitting, setPayError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  async function handlePay() {
    if (!stripe || !elements || !isReady) return;
    setIsSubmitting(true);
    setPayError("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setPayError(error.message ?? "Payment failed. Please try again.");
      setIsSubmitting(false);
    } else if (paymentIntent) {
      try {
        await onSuccess(paymentIntent.id);
      } catch (bookingError) {
        setPayError(bookingError instanceof Error ? bookingError.message : "Could not create booking.");
        setIsSubmitting(false);
      }
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
        onReady={() => setIsReady(true)}
      />
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={isSubmitting}>
          ← Back
        </Button>
          <Button
            variant="gold"
            className="flex-1 gap-2"
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

// ── Main modal ─────────────────────────────────────────────────────────

type Step = "package" | "select" | "details" | "confirm" | "success";

interface BookingModalProps {
  creator: Creator;
  open: boolean;
  onClose: () => void;
  packages?: CallPackage[];
  availability?: AvailabilitySlot[];
  initialPackageId?: string;
}

export function BookingModal({
  creator,
  open,
  onClose,
  packages = [],
  availability = [],
  initialPackageId,
}: BookingModalProps) {
  const { user } = useAuthContext();
  const [step, setStep] = useState<Step>("select");
  const [selectedPackage, setSelectedPackage] = useState<CallPackage | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingIntent, setFetchingIntent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [loadingSavedPaymentMethods, setLoadingSavedPaymentMethods] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [saveNewCard, setSaveNewCard] = useState(false);
  const [existingBookingWindows, setExistingBookingWindows] = useState<ExistingBookingWindow[]>([]);
  const [loadingExistingBookings, setLoadingExistingBookings] = useState(false);

  const availableDates = getAvailableDates(weekOffset);
  const sessionPrice = selectedPackage?.price ?? creator.callPrice;
  const sessionDuration = selectedPackage?.duration ?? creator.callDuration;
  const packageAvailability = getPackageAvailability(availability, selectedPackage?.id ?? initialPackageId);
  const viewerTimeZone = getBrowserTimeZone();
  const bookingIntervalMinutes = creator.bookingIntervalMinutes ?? 30;
  const availableDateKeys = new Set(
    availableDates
      .filter((date) => {
        const rawSlots = getAvailableStartTimesForViewerDate({
          date,
          availability: packageAvailability,
          creatorTimeZone: creator.timeZone ?? "America/New_York",
          durationMinutes: sessionDuration,
          incrementMinutes: bookingIntervalMinutes,
        });

        return rawSlots.some((slot) => {
          const timeParts = slot.match(/(\d+):(\d+)\s+(AM|PM)/);
          let hours = 12;
          let mins = 0;
          if (timeParts) {
            hours = parseInt(timeParts[1]);
            mins = parseInt(timeParts[2]);
            if (timeParts[3] === "PM" && hours !== 12) hours += 12;
            if (timeParts[3] === "AM" && hours === 12) hours = 0;
          }

          const scheduledDate = new Date(date);
          scheduledDate.setHours(hours, mins, 0, 0);
          const candidateIso = scheduledDate.toISOString();

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
        creatorTimeZone: creator.timeZone ?? "America/New_York",
        durationMinutes: sessionDuration,
        incrementMinutes: bookingIntervalMinutes,
      })
        .filter((slot) => {
          const timeParts = slot.match(/(\d+):(\d+)\s+(AM|PM)/);
          let hours = 12;
          let mins = 0;
          if (timeParts) {
            hours = parseInt(timeParts[1]);
            mins = parseInt(timeParts[2]);
            if (timeParts[3] === "PM" && hours !== 12) hours += 12;
            if (timeParts[3] === "AM" && hours === 12) hours = 0;
          }

          const scheduledDate = new Date(selectedDate);
          scheduledDate.setHours(hours, mins, 0, 0);
          const candidateIso = scheduledDate.toISOString();

          return !existingBookingWindows.some((booking) =>
            rangesOverlap(candidateIso, sessionDuration, booking.scheduledAt, booking.duration)
          );
        })
    : [];
  // Fan pays a 2.5% platform fee
  const totalCents = Math.round(sessionPrice * 1.025 * 100);
  const sessionGrossPrice = totalCents / 100;
  const platformFeeAmount = sessionGrossPrice - sessionPrice;

  async function handlePaymentSuccess(paymentIntentId: string) {
    if (!user || !selectedDate || !selectedTime || !selectedPackage) return;
    
    const timeParts = selectedTime.match(/(\d+):(\d+)\s+(AM|PM)/);
    let hours = 12;
    let mins = 0;
    if (timeParts) {
      hours = parseInt(timeParts[1]);
      mins = parseInt(timeParts[2]);
      if (timeParts[3] === "PM" && hours !== 12) hours += 12;
      if (timeParts[3] === "AM" && hours === 12) hours = 0;
    }
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours, mins, 0, 0);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorId: creator.id,
        packageId: selectedPackage.id,
        scheduledAt: scheduledDate.toISOString(),
        topic,
        paymentIntentId,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error ?? "Could not create booking.");
    }

    setStep("success");
  }

  // Reset state whenever the modal opens
  useEffect(() => {
    if (open) {
      const initialPackage = initialPackageId
        ? packages.find((pkg) => pkg.id === initialPackageId) ?? null
        : packages.length === 1
        ? packages[0]
        : null;
      setStep(initialPackage ? "select" : packages.length > 1 ? "package" : "select");
      setSelectedPackage(initialPackage);
      setSelectedDate(null);
      setSelectedTime(null);
      setTopic("");
      setWeekOffset(0);
      setClientSecret(null);
      setPayError("");
      setIsSubmitting(false);
      setSelectedPaymentMethodId(null);
      setSaveNewCard(false);
    }
  }, [open, packages, initialPackageId]);

  useEffect(() => {
    setSelectedDate(null);
    setSelectedTime(null);
  }, [selectedPackage?.id]);

  useEffect(() => {
    if (!open || !user) return;

    setLoadingSavedPaymentMethods(true);
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((data) => {
        const methods = data.paymentMethods ?? [];
        setSavedPaymentMethods(methods);
        setSelectedPaymentMethodId(methods[0]?.id ?? null);
      })
      .catch(() => {
        setSavedPaymentMethods([]);
        setSelectedPaymentMethodId(null);
      })
      .finally(() => setLoadingSavedPaymentMethods(false));
  }, [open, user]);

  useEffect(() => {
    if (!open || !user) return;

    setLoadingExistingBookings(true);

    fetch(`/api/bookings/availability?creatorId=${creator.id}`)
      .then((response) => response.json())
      .then((data) => {
        setExistingBookingWindows(
          ((data.bookings ?? []) as { scheduledAt: string; duration: number }[]).map((booking) => ({
            scheduledAt: booking.scheduledAt,
            duration: Number(booking.duration ?? 0),
          }))
        );
      })
      .catch(() => {
        setExistingBookingWindows([]);
      })
      .finally(() => setLoadingExistingBookings(false));
  }, [open, creator.id, user]);

  useEffect(() => {
    setClientSecret(null);
    setPayError("");
  }, [selectedPaymentMethodId, saveNewCard]);

  // Create a PaymentIntent when the user reaches the confirm step
  useEffect(() => {
    if (step !== "confirm" || clientSecret || selectedPaymentMethodId) return;

    setFetchingIntent(true);
    fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: totalCents,
        packageId: selectedPackage?.id,
        creatorName: creator.name,
        packageName: selectedPackage?.name ?? "Call",
        saveForFuture: saveNewCard,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setPayError(data.error ?? "Could not initialise payment.");
      })
      .catch(() => setPayError("Network error. Please try again."))
      .finally(() => setFetchingIntent(false));
  }, [step, clientSecret, totalCents, creator.name, selectedPackage, saveNewCard, selectedPaymentMethodId]);

  async function handleSavedPaymentSubmit() {
    if (!selectedPaymentMethodId) return;
    setIsSubmitting(true);
    setPayError("");

    try {
      const res = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totalCents,
          packageId: selectedPackage?.id,
          creatorName: creator.name,
          packageName: selectedPackage?.name ?? "Call",
          paymentMethodId: selectedPaymentMethodId,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.paymentIntentId) {
        throw new Error(data.error ?? "Could not charge saved payment method.");
      }

      await handlePaymentSuccess(data.paymentIntentId);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Could not charge saved payment method.");
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setClientSecret(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleReset}>
      <DialogContent
        className="w-full max-w-md"
        onClose={step !== "success" ? handleReset : undefined}
        title={step === "success" ? "You're booked! 🎉" : `Book a call with ${creator.name}`}
        description={
          step === "package" ? "Choose a session type." :
          step === "select"  ? "Pick a date and time that works for you." :
          step === "details" ? "Tell them what you want to cover." :
          step === "confirm" ? "Review and pay to confirm your booking." :
          undefined
        }
      >
        {/* ── SUCCESS ── */}
        {step === "success" && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-brand-live/20 border border-brand-live/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-brand-live" />
            </div>
            <div>
              <p className="text-brand-ink-subtle text-sm leading-relaxed">
                Payment confirmed! Your call with{" "}
                <strong className="text-brand-ink">{creator.name}</strong> is booked for{" "}
                <strong className="text-brand-primary-light">
                  {selectedDate && formatShortDate(selectedDate)} at {selectedTime}
                </strong>.
              </p>
              <p className="text-brand-ink-muted text-xs mt-2">
                You'll receive a confirmation and a link to your session.
              </p>
            </div>
            <Button variant="primary" onClick={handleReset} className="w-full mt-2">
              Done
            </Button>
          </div>
        )}

        {/* ── STEP 0: Package picker ── */}
        {step === "package" && (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => { setSelectedPackage(pkg); setStep("select"); }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all",
                  selectedPackage?.id === pkg.id
                    ? "bg-brand-primary/20 border-brand-primary"
                    : "bg-brand-elevated border-brand-border hover:border-brand-primary/40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-brand-ink">{pkg.name}</p>
                    <p className="text-xs text-brand-ink-subtle mt-1">{pkg.description}</p>
                    <p className="text-xs text-brand-ink-muted mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{pkg.duration} min
                    </p>
                  </div>
                  <p className="text-lg font-black text-brand-gold shrink-0">
                    {formatCurrency(pkg.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 1: Date + Time ── */}
        {step === "select" && (
          <div className="space-y-3">
            {/* Compact session summary */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-brand-surface border border-brand-border">
              <Avatar initials={creator.avatarInitials} color={creator.avatarColor} imageUrl={creator.avatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-ink leading-tight">{creator.name}</p>
                <p className="text-xs text-brand-ink-muted truncate">
                  {selectedPackage ? `${selectedPackage.name} · ` : ""}
                  {sessionDuration} min · {formatCurrency(sessionPrice)}
                </p>
              </div>
            </div>

            {/* Date picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-primary-light" />
                  <span className="text-xs font-medium text-brand-ink-subtle">
                    Select Date
                  </span>
                  <span className="text-[10px] text-brand-ink-muted ml-1">
                    ({weekOffset === 0 ? "This week" : weekOffset === 1 ? "Next week" : `+${weekOffset}w`} · {getTimeZoneAbbreviation(new Date(), viewerTimeZone)})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                    disabled={weekOffset === 0}
                    className="p-1 rounded-md bg-brand-elevated border border-brand-border text-brand-ink-subtle hover:text-brand-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setWeekOffset((w) => Math.min(3, w + 1))}
                    disabled={weekOffset >= 3}
                    className="p-1 rounded-md bg-brand-elevated border border-brand-border text-brand-ink-subtle hover:text-brand-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {availableDates.map((date) => {
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  const hasTimes = availableDateKeys.has(date.toDateString());
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => {
                        if (!hasTimes) return;
                        setSelectedDate(date);
                      }}
                      disabled={!hasTimes}
                      className={cn(
                        "flex flex-col items-center py-1.5 rounded-xl border text-xs font-medium transition-all",
                        isSelected
                          ? "bg-brand-primary/20 border-brand-primary text-brand-primary-light ring-1 ring-brand-primary/30"
                          : hasTimes
                          ? "border-brand-primary/40 bg-white text-brand-ink font-semibold shadow-sm hover:border-brand-primary hover:bg-brand-primary/5"
                          : "border-brand-border/40 bg-brand-elevated/40 text-brand-ink-muted opacity-35 cursor-not-allowed"
                      )}
                    >
                      <span className="text-[9px] uppercase opacity-70">
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className="text-sm font-bold mt-0.5">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time picker — always rendered, prompts to pick date if none selected */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-brand-primary-light" />
                <span className="text-xs font-medium text-brand-ink-subtle">Select Time</span>
              </div>
              {!selectedDate ? (
                <p className="text-xs text-brand-ink-muted py-2 px-3 rounded-xl border border-brand-border bg-brand-elevated">
                  Pick a date above to see available times.
                </p>
              ) : availableTimeSlots.length === 0 ? (
                <p className="text-xs text-brand-ink-muted py-2 px-3 rounded-xl border border-brand-border bg-brand-elevated">
                  {loadingExistingBookings ? "Checking booked times…" : "No times available on that date."}
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {availableTimeSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={cn(
                        "py-1.5 px-2 rounded-xl border text-xs font-medium transition-all",
                        selectedTime === slot
                          ? "bg-brand-primary/20 border-brand-primary text-brand-primary-light"
                          : "border-brand-border bg-brand-elevated text-brand-ink-subtle hover:border-brand-primary/40 hover:text-brand-ink"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              {packages.length > 1 && (
                <Button variant="outline" className="flex-1" onClick={() => setStep("package")}>
                  ← Back
                </Button>
              )}
              <Button
                variant="primary"
                className="flex-1"
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep("details")}
              >
                Continue →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Topic / Message ── */}
        {step === "details" && (
          <div className="space-y-5">
            <div className="p-3 rounded-xl bg-brand-surface border border-brand-border text-sm text-brand-ink-subtle">
              <span className="text-brand-ink-muted">Booked for: </span>
              {selectedDate && formatShortDate(selectedDate)} at {selectedTime}
            </div>

            <div>
              <label className="text-sm font-medium text-brand-ink-subtle flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-brand-primary-light" />
                What do you want to cover?{" "}
                <span className="text-brand-ink-muted font-normal">(optional)</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`Give ${creator.name.split(" ")[0]} a heads-up so they can prepare...`}
                rows={3}
                className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-brand-ink placeholder:text-brand-ink-muted resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("select")}>
                ← Back
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => setStep("confirm")}>
                Review & Pay →
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm + Stripe Payment ── */}
        {step === "confirm" && (
          <div className="space-y-4">
            {/* Booking summary */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar initials={creator.avatarInitials} color={creator.avatarColor} imageUrl={creator.avatarUrl} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-brand-ink">{creator.name}</p>
                  <p className="text-xs text-brand-ink-muted">{creator.category}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand-border">
                {[
                  ["Date", selectedDate ? formatShortDate(selectedDate) : ""],
                  ["Time", selectedTime ?? ""],
                  ["Session", selectedPackage?.name ?? "Call"],
                  ["Duration", `${sessionDuration} min`],
                  ...(topic ? [["Topic", topic]] : []),
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[11px] text-brand-ink-muted uppercase tracking-wider">{k}</p>
                    <p className="text-sm text-brand-ink font-medium mt-0.5 truncate">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="rounded-xl border border-brand-border bg-brand-elevated p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-brand-ink-subtle">Session fee</span>
                <span className="text-brand-ink">{formatCurrency(sessionPrice)}</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-brand-ink-subtle">Platform fee (2.5%)</span>
                <span className="text-brand-ink">{formatCurrency(platformFeeAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-brand-border pt-3">
                <span className="text-brand-ink">Total</span>
                <span className="text-brand-gold">{formatCurrency(sessionGrossPrice)}</span>
              </div>
            </div>

            {/* Saved payments */}
            {loadingSavedPaymentMethods ? (
              <div className="flex items-center justify-center py-4 gap-2 text-brand-ink-subtle text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading saved payments...
              </div>
            ) : savedPaymentMethods.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-muted">Saved Payments</p>
                <div className="space-y-2">
                  {savedPaymentMethods.map((paymentMethod) => (
                    <label
                      key={paymentMethod.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                        selectedPaymentMethodId === paymentMethod.id
                          ? "border-brand-primary bg-brand-primary/10"
                          : "border-brand-border bg-brand-elevated"
                      )}
                    >
                      <input
                        type="radio"
                        name="saved-payment"
                        checked={selectedPaymentMethodId === paymentMethod.id}
                        onChange={() => setSelectedPaymentMethodId(paymentMethod.id)}
                      />
                      <div className="text-sm text-brand-ink capitalize">
                        {paymentMethod.brand} ending in {paymentMethod.last4}
                      </div>
                      <div className="ml-auto text-xs text-brand-ink-muted">
                        {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedPaymentMethodId(null)}
                  className="text-xs text-brand-primary-light hover:underline"
                >
                  Use a new card instead
                </button>
                <Button
                  variant="gold"
                  className="w-full gap-2"
                  onClick={handleSavedPaymentSubmit}
                  disabled={isSubmitting || !selectedPaymentMethodId}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    "Pay with Saved Card"
                  )}
                </Button>
              </div>
            ) : null}

            {/* Stripe Elements */}
            {selectedPaymentMethodId ? null : fetchingIntent ? (
              <div className="flex items-center justify-center py-8 gap-3 text-brand-ink-subtle">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading payment form...</span>
              </div>
            ) : payError && !clientSecret ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {payError}
              </div>
            ) : clientSecret ? (
              <>
                {payError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    {payError}
                  </div>
                )}
                <Elements
                  stripe={stripePromise}
                  options={{ ...STRIPE_OPTIONS, clientSecret }}
                >
                  <label className="flex items-center gap-2 text-xs text-brand-ink-subtle mb-3">
                    <input
                      type="checkbox"
                      checked={saveNewCard}
                      onChange={(e) => setSaveNewCard(e.target.checked)}
                      className="rounded border-brand-border bg-brand-elevated"
                    />
                    Save this payment method for future payments
                  </label>
                  <PaymentForm
                    onSuccess={handlePaymentSuccess}
                    onBack={() => setStep("details")}
                    isSubmitting={isSubmitting}
                    setIsSubmitting={setIsSubmitting}
                    setPayError={setPayError}
                  />
                </Elements>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
