"use client";

/**
 * LiveJoinModal
 *
 * Shown when a fan taps "Join Queue" on a creator who is live.
 *
 * FLOW:
 * 1. Explain the per-minute pricing model
 * 2. Show pre-auth amount (10 min × rate) — this is the hold on their card
 * 3. Fan enters card via Stripe Elements (PaymentIntent in manual-capture mode)
 * 4. On success → redirect to /waiting-room/[id]
 *
 * The actual charge is calculated server-side when the creator skips them.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Zap, Clock, Info, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { Creator } from "@/types";
import { formatCurrency } from "@/lib/utils";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#22C55E",
    colorBackground: "#1A1535",
    colorText: "#f1f5f9",
    colorDanger: "#f87171",
    fontFamily: "inherit",
    borderRadius: "12px",
  },
};

const PREAUTH_MINUTES = 10; // card hold = 10 min × rate

// ── Inner payment form ────────────────────────────────────────────────────────

interface PaymentFormProps {
  onSuccess: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  setPayError: (v: string) => void;
}

function PaymentForm({ onSuccess, isSubmitting, setIsSubmitting, setPayError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  async function handleAuthorize() {
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setPayError("");

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setPayError(error.message ?? "Authorization failed. Please try again.");
      setIsSubmitting(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <Button
        variant="live"
        size="lg"
        className="w-full gap-2"
        onClick={handleAuthorize}
        disabled={isSubmitting || !stripe}
      >
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Authorizing...</>
        ) : (
          <><Zap className="w-4 h-4" /> Join Queue</>
        )}
      </Button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface LiveJoinModalProps {
  creator: Creator;
  open: boolean;
  onClose: () => void;
}

type Step = "info" | "payment" | "success";

export function LiveJoinModal({ creator, open, onClose }: LiveJoinModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("info");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingIntent, setFetchingIntent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  const rate = creator.liveRatePerMinute ?? 0;
  const preAuthAmount = rate * PREAUTH_MINUTES;

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("info");
      setClientSecret(null);
      setPayError("");
      setIsSubmitting(false);
    }
  }, [open]);

  // Fetch PaymentIntent when moving to payment step
  useEffect(() => {
    if (step !== "payment" || clientSecret) return;

    setFetchingIntent(true);
    fetch("/api/create-live-preauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ratePerMinute: rate,
        creatorName: creator.name,
        preAuthMinutes: PREAUTH_MINUTES,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setPayError(data.error ?? "Could not initialise payment.");
      })
      .catch(() => setPayError("Network error. Please try again."))
      .finally(() => setFetchingIntent(false));
  }, [step, clientSecret, rate, creator.name]);

  function handleSuccess() {
    setStep("success");
    // Give the user a moment to see the success state, then redirect
    setTimeout(() => {
      onClose();
      router.push(`/waiting-room/${creator.id}`);
    }, 1800);
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent
        className="w-full max-w-md"
        title={
          step === "success"
            ? "You're in the queue!"
            : `Join ${creator.name}'s Live`
        }
        description={
          step === "info"
            ? "Here's how live queue billing works."
            : step === "payment"
            ? "Your card will be held — you only pay for time on the call."
            : undefined
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
                You&apos;re in the queue for{" "}
                <strong className="text-slate-100">{creator.name}</strong>.
                Hang tight — you&apos;ll be admitted when it&apos;s your turn.
              </p>
              <p className="text-slate-500 text-xs mt-2">
                Redirecting you to the waiting room…
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 1: How it works ── */}
        {step === "info" && (
          <div className="space-y-5">
            {/* Creator strip */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface border border-brand-border">
              <Avatar initials={creator.avatarInitials} color={creator.avatarColor} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-100">{creator.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                  <span className="text-xs text-brand-live font-medium">LIVE NOW</span>
                  {creator.queueCount > 0 && (
                    <span className="text-xs text-slate-500 ml-1">· {creator.queueCount} ahead</span>
                  )}
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-black text-brand-live">{formatCurrency(rate)}</p>
                <p className="text-[11px] text-slate-400">per minute</p>
              </div>
            </div>

            {/* How billing works */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">How it works</p>
              {[
                {
                  icon: Zap,
                  title: "Join the queue",
                  desc: `Wait your turn — no charge while you wait.`,
                },
                {
                  icon: Clock,
                  title: "Pay only for your time",
                  desc: `Charged at ${formatCurrency(rate)}/min. 30 seconds = ${formatCurrency(rate * 0.5)}.`,
                },
                {
                  icon: Info,
                  title: `${formatCurrency(preAuthAmount)} pre-authorization`,
                  desc: `We hold ${PREAUTH_MINUTES} min worth on your card. You're charged only what you use.`,
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 p-3 rounded-xl bg-brand-elevated border border-brand-border">
                  <div className="w-8 h-8 rounded-lg bg-brand-live/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-brand-live" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button variant="live" className="flex-1 gap-2" onClick={() => setStep("payment")}>
                <Zap className="w-4 h-4" />
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Stripe Payment ── */}
        {step === "payment" && (
          <div className="space-y-4">
            {/* Pre-auth summary */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Rate</span>
                <span className="text-slate-200">{formatCurrency(rate)}/min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Pre-auth hold ({PREAUTH_MINUTES} min)</span>
                <span className="text-slate-200">{formatCurrency(preAuthAmount)}</span>
              </div>
              <div className="border-t border-brand-border pt-2 flex justify-between text-sm font-bold">
                <span className="text-slate-300">Max charge</span>
                <span className="text-brand-live">{formatCurrency(preAuthAmount)}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                You&apos;ll only be charged for the seconds you actually spend on the call.
                Any unused amount is released automatically.
              </p>
            </div>

            {payError && !clientSecret && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {payError}
              </div>
            )}

            {fetchingIntent ? (
              <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading payment form…</span>
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
                    onSuccess={handleSuccess}
                    isSubmitting={isSubmitting}
                    setIsSubmitting={setIsSubmitting}
                    setPayError={setPayError}
                  />
                </Elements>
              </>
            ) : null}

            <button
              onClick={() => setStep("info")}
              className="text-xs text-slate-500 hover:text-slate-300 w-full text-center"
            >
              ← Back to details
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
