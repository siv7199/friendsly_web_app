"use client";

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
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";

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

const STRIPE_OPTIONS = {
  appearance: STRIPE_APPEARANCE,
};

const PREAUTH_MINUTES = 10;
const LIVE_SESSION_STALE_MS = 45000;

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface PaymentFormProps {
  onSuccess: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setPayError: (value: string) => void;
}

function PaymentForm({ onSuccess, isSubmitting, setIsSubmitting, setPayError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  async function handleAuthorize() {
    if (!stripe || !elements || !isReady) return;
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
      <PaymentElement
        options={{ layout: "tabs" }}
        onReady={() => setIsReady(true)}
      />
      <Button
        variant="live"
        size="lg"
        className="w-full gap-2"
        onClick={handleAuthorize}
        disabled={isSubmitting || !stripe || !isReady}
      >
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Authorizing...</>
        ) : !isReady ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Initialising...</>
        ) : (
          <><Zap className="w-4 h-4" /> Join Queue</>
        )}
      </Button>
    </div>
  );
}

interface LiveJoinModalProps {
  creator: Creator;
  open: boolean;
  onClose: () => void;
}

type Step = "info" | "payment" | "success";

export function LiveJoinModal({ creator, open, onClose }: LiveJoinModalProps) {
  const router = useRouter();
  const { user } = useAuthContext();
  const [step, setStep] = useState<Step>("info");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [fetchingIntent, setFetchingIntent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payError, setPayError] = useState("");
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [loadingSavedPaymentMethods, setLoadingSavedPaymentMethods] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [saveNewCard, setSaveNewCard] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(creator.currentLiveSessionId);

  const rate = creator.liveRatePerMinute ?? 0;
  const preAuthAmount = rate * PREAUTH_MINUTES;

  async function fetchSavedPaymentMethods() {
    if (!user) return;
    setLoadingSavedPaymentMethods(true);
    try {
      const res = await fetch("/api/payment-methods");
      const data = await res.json();
      const methods = data.paymentMethods ?? [];
      setSavedPaymentMethods(methods);
      setSelectedPaymentMethodId(methods[0]?.id ?? null);
    } catch {
      setSavedPaymentMethods([]);
      setSelectedPaymentMethodId(null);
    } finally {
      setLoadingSavedPaymentMethods(false);
    }
  }

  async function fetchFreshStatus() {
    const supabase = createClient();
    const { data } = await supabase
      .from("creator_profiles")
      .select("current_live_session_id, is_live")
      .eq("id", creator.id)
      .single();

    if (!data?.is_live) {
      setCurrentSessionId(undefined);
      return;
    }

    if (data.current_live_session_id) {
      const { data: currentSession } = await supabase
        .from("live_sessions")
        .select("id, last_heartbeat_at")
        .eq("id", data.current_live_session_id)
        .eq("creator_id", creator.id)
        .eq("is_active", true)
        .not("daily_room_url", "is", null)
        .maybeSingle();

      if (
        currentSession?.id &&
        currentSession.last_heartbeat_at &&
        Date.now() - new Date(currentSession.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
      ) {
        setCurrentSessionId(currentSession.id);
        return;
      }
    }

    const { data: liveSession } = await supabase
      .from("live_sessions")
      .select("id, last_heartbeat_at")
      .eq("creator_id", creator.id)
      .eq("is_active", true)
      .not("daily_room_url", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      liveSession?.id &&
      liveSession.last_heartbeat_at &&
      Date.now() - new Date(liveSession.last_heartbeat_at).getTime() <= LIVE_SESSION_STALE_MS
    ) {
      setCurrentSessionId(liveSession.id);
      return;
    }

    setCurrentSessionId(undefined);
  }

  useEffect(() => {
    if (!open) return;

    setStep("info");
    setClientSecret(null);
    setPaymentIntentId(null);
    setPayError("");
    setIsSubmitting(false);
    setSelectedPaymentMethodId(null);
    setSaveNewCard(false);

    fetchFreshStatus();
    if (user) {
      fetchSavedPaymentMethods();
    }
  }, [open, creator.id, user]);

  useEffect(() => {
    setClientSecret(null);
    setPayError("");
  }, [selectedPaymentMethodId, saveNewCard]);

  useEffect(() => {
    if (step !== "payment" || clientSecret || selectedPaymentMethodId) return;

    setFetchingIntent(true);
    fetch("/api/create-live-preauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ratePerMinute: rate,
        creatorName: creator.name,
        preAuthMinutes: PREAUTH_MINUTES,
        saveForFuture: saveNewCard,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId ?? null);
        } else {
          setPayError(data.error ?? "Could not initialise payment.");
        }
      })
      .catch(() => setPayError("Network error. Please try again."))
      .finally(() => setFetchingIntent(false));
  }, [step, clientSecret, rate, creator.name, saveNewCard, selectedPaymentMethodId]);

  async function joinQueueWithPaymentIntent(intentId: string) {
    if (!user) {
      setStep("success");
      return;
    }

    const targetSessionId = currentSessionId;
    if (!targetSessionId) {
      setPayError("Creator is currently offline or setting up. Please try again in a moment.");
      setIsSubmitting(false);
      setStep("info");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("live_queue_entries").insert({
      session_id: targetSessionId,
      fan_id: user.id,
      status: "waiting",
      position: 0,
      amount_pre_authorized: preAuthAmount,
      stripe_pre_auth_id: intentId,
      joined_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    setStep("success");
    setTimeout(() => {
      onClose();
      router.push(`/waiting-room/${creator.id}`);
    }, 1800);
  }

  async function handleSuccess() {
    if (!paymentIntentId) {
      setPayError("Missing payment authorization.");
      setIsSubmitting(false);
      return;
    }

    try {
      await joinQueueWithPaymentIntent(paymentIntentId);
    } catch (error) {
      console.error("Failed to insert queue entry:", error);
      setPayError("Payment succeeded but queue join failed. Please contact support.");
      setIsSubmitting(false);
      setStep("info");
    }
  }

  async function handleSavedPaymentSubmit() {
    if (!selectedPaymentMethodId) return;
    setIsSubmitting(true);
    setPayError("");

    try {
      const res = await fetch("/api/create-live-preauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratePerMinute: rate,
          creatorName: creator.name,
          preAuthMinutes: PREAUTH_MINUTES,
          paymentMethodId: selectedPaymentMethodId,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.paymentIntentId) {
        throw new Error(data.error ?? "Could not authorize saved payment method.");
      }

      setPaymentIntentId(data.paymentIntentId);
      await joinQueueWithPaymentIntent(data.paymentIntentId);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Could not authorize saved payment method.");
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent
        className="w-full max-w-md"
        title={step === "success" ? "You're in the queue!" : `Join ${creator.name}'s Live`}
        description={
          step === "info"
            ? "Here's how live queue billing works."
            : step === "payment"
            ? "Your card will be held - you only pay for time on the call."
            : undefined
        }
      >
        {step === "success" && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-brand-live/20 border border-brand-live/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-brand-live" />
            </div>
            <div>
              <p className="text-slate-300 text-sm leading-relaxed">
                You're in the queue for <strong className="text-slate-100">{creator.name}</strong>.
                Hang tight - you'll be admitted when it's your turn.
              </p>
              <p className="text-slate-500 text-xs mt-2">
                Redirecting you to the waiting room...
              </p>
            </div>
          </div>
        )}

        {step === "info" && (
          <div className="space-y-5">
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

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">How it works</p>
              {[
                {
                  icon: Zap,
                  title: "Join the queue",
                  desc: "Wait your turn - no charge while you wait.",
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

        {step === "payment" && (
          <div className="space-y-4">
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
                You'll only be charged for the seconds you actually spend on the call.
                Any unused amount is released automatically.
              </p>
            </div>

            {payError && !clientSecret && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {payError}
              </div>
            )}

            {loadingSavedPaymentMethods ? (
              <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading saved payments...
              </div>
            ) : savedPaymentMethods.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Saved Payments</p>
                <div className="space-y-2">
                  {savedPaymentMethods.map((paymentMethod) => (
                    <label
                      key={paymentMethod.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        selectedPaymentMethodId === paymentMethod.id
                          ? "border-brand-live bg-brand-live/10"
                          : "border-brand-border bg-brand-elevated"
                      }`}
                    >
                      <input
                        type="radio"
                        name="saved-live-payment"
                        checked={selectedPaymentMethodId === paymentMethod.id}
                        onChange={() => setSelectedPaymentMethodId(paymentMethod.id)}
                      />
                      <div className="text-sm text-slate-200 capitalize">
                        {paymentMethod.brand} ending in {paymentMethod.last4}
                      </div>
                      <div className="ml-auto text-xs text-slate-500">
                        {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
                      </div>
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedPaymentMethodId(null)}
                  className="text-xs text-brand-live hover:underline"
                >
                  Use a new card instead
                </button>
                <Button
                  variant="live"
                  size="lg"
                  className="w-full gap-2"
                  onClick={handleSavedPaymentSubmit}
                  disabled={isSubmitting || !selectedPaymentMethodId}
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Authorizing...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Join Queue</>
                  )}
                </Button>
              </div>
            ) : null}

            {selectedPaymentMethodId ? null : fetchingIntent ? (
              <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading payment form...</span>
              </div>
            ) : clientSecret ? (
              <>
                {payError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    {payError}
                  </div>
                )}
                <Elements stripe={stripePromise} options={{ ...STRIPE_OPTIONS, clientSecret }}>
                  <label className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                    <input
                      type="checkbox"
                      checked={saveNewCard}
                      onChange={(e) => setSaveNewCard(e.target.checked)}
                      className="rounded border-brand-border bg-brand-elevated"
                    />
                    Save this payment method for future payments
                  </label>
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
