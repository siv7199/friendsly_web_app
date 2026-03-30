"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Calendar, Clock, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { Creator, CallPackage } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

// Initialise Stripe once (outside component so it's not recreated on render)
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// Stripe Elements appearance — matches the dark brand theme
const STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#7C3AED",
    colorBackground: "#1A1535",
    colorText: "#f1f5f9",
    colorDanger: "#f87171",
    fontFamily: "inherit",
    borderRadius: "12px",
  },
};

// Mock available time slots
const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "2:00 PM", "2:30 PM", "3:00 PM",
  "3:30 PM", "4:00 PM", "5:00 PM", "5:30 PM",
];

function getAvailableDates() {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Inner payment form (needs to live inside <Elements>) ───────────────

interface PaymentFormProps {
  onSuccess: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  setPayError: (v: string) => void;
}

function PaymentForm({ onSuccess, onBack, isSubmitting, setIsSubmitting, setPayError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  async function handlePay() {
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setPayError("");

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setPayError(error.message ?? "Payment failed. Please try again.");
      setIsSubmitting(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={isSubmitting}>
          ← Back
        </Button>
        <Button
          variant="gold"
          className="flex-1 gap-2"
          onClick={handlePay}
          disabled={isSubmitting || !stripe}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
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
}

export function BookingModal({ creator, open, onClose, packages = [] }: BookingModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedPackage, setSelectedPackage] = useState<CallPackage | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingIntent, setFetchingIntent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  const availableDates = getAvailableDates();
  const sessionPrice = selectedPackage?.price ?? creator.callPrice;
  const sessionDuration = selectedPackage?.duration ?? creator.callDuration;
  // Stripe works in cents
  const totalCents = Math.round(sessionPrice * 1.05 * 100);

  // Reset state whenever the modal opens
  useEffect(() => {
    if (open) {
      setStep(packages.length > 1 ? "package" : "select");
      setSelectedPackage(packages.length === 1 ? packages[0] : null);
      setSelectedDate(null);
      setSelectedTime(null);
      setTopic("");
      setClientSecret(null);
      setPayError("");
      setIsSubmitting(false);
    }
  }, [open, packages]);

  // Create a PaymentIntent when the user reaches the confirm step
  useEffect(() => {
    if (step !== "confirm" || clientSecret) return;

    setFetchingIntent(true);
    fetch("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: totalCents,
        creatorName: creator.name,
        packageName: selectedPackage?.name ?? "Call",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setPayError(data.error ?? "Could not initialise payment.");
      })
      .catch(() => setPayError("Network error. Please try again."))
      .finally(() => setFetchingIntent(false));
  }, [step, clientSecret, totalCents, creator.name, selectedPackage]);

  function handleReset() {
    setClientSecret(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleReset}>
      <DialogContent
        className="w-full max-w-md"
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
              <p className="text-slate-300 text-sm leading-relaxed">
                Payment confirmed! Your call with{" "}
                <strong className="text-slate-100">{creator.name}</strong> is booked for{" "}
                <strong className="text-brand-primary-light">
                  {selectedDate && formatShortDate(selectedDate)} at {selectedTime}
                </strong>.
              </p>
              <p className="text-slate-500 text-xs mt-2">
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
                    <p className="font-bold text-slate-100">{pkg.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{pkg.description}</p>
                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{pkg.duration} min
                    </p>
                  </div>
                  <p className="text-lg font-black text-gradient-gold shrink-0">
                    {formatCurrency(pkg.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 1: Date + Time ── */}
        {step === "select" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface border border-brand-border">
              <Avatar initials={creator.avatarInitials} color={creator.avatarColor} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-100">{creator.name}</p>
                <p className="text-xs text-slate-500">
                  {selectedPackage ? `${selectedPackage.name} · ` : ""}
                  {sessionDuration} min · {formatCurrency(sessionPrice)}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-brand-primary-light" />
                Select Date
              </label>
              <div className="grid grid-cols-4 gap-2">
                {availableDates.map((date) => {
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        "flex flex-col items-center p-2 rounded-xl border text-xs font-medium transition-all",
                        isSelected
                          ? "bg-brand-primary/20 border-brand-primary text-brand-primary-light"
                          : "border-brand-border bg-brand-elevated text-slate-400 hover:border-brand-primary/40 hover:text-slate-200"
                      )}
                    >
                      <span className="text-[10px] uppercase opacity-70">
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className="text-base font-bold mt-0.5">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div>
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-brand-primary-light" />
                  Select Time
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={cn(
                        "py-2 px-3 rounded-xl border text-xs font-medium transition-all",
                        selectedTime === slot
                          ? "bg-brand-primary/20 border-brand-primary text-brand-primary-light"
                          : "border-brand-border bg-brand-elevated text-slate-400 hover:border-brand-primary/40 hover:text-slate-200"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
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
            <div className="p-3 rounded-xl bg-brand-surface border border-brand-border text-sm text-slate-300">
              <span className="text-slate-500">Booked for: </span>
              {selectedDate && formatShortDate(selectedDate)} at {selectedTime}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-brand-primary-light" />
                What do you want to cover?{" "}
                <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`Give ${creator.name.split(" ")[0]} a heads-up so they can prepare...`}
                rows={3}
                className="w-full rounded-xl border border-brand-border bg-brand-elevated px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
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
                <Avatar initials={creator.avatarInitials} color={creator.avatarColor} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-slate-100">{creator.name}</p>
                  <p className="text-xs text-slate-500">{creator.category}</p>
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
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider">{k}</p>
                    <p className="text-sm text-slate-200 font-medium mt-0.5 truncate">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="rounded-xl border border-brand-border bg-brand-elevated p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Session fee</span>
                <span className="text-slate-200">{formatCurrency(sessionPrice)}</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-slate-400">Platform fee (5%)</span>
                <span className="text-slate-200">{formatCurrency(Math.round(sessionPrice * 0.05))}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-brand-border pt-3">
                <span className="text-slate-100">Total</span>
                <span className="text-gradient-gold">{formatCurrency(Math.round(sessionPrice * 1.05))}</span>
              </div>
            </div>

            {/* Stripe Elements */}
            {fetchingIntent ? (
              <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
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
                  options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
                >
                  <PaymentForm
                    onSuccess={() => setStep("success")}
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
