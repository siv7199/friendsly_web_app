"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CheckCircle2, Clock, Info, Loader2, Zap } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { Creator } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import { LIVE_MIN_JOIN_FEE, LIVE_STAGE_SECONDS } from "@/lib/live";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const LIVE_SESSION_STALE_MS = 45000;

const STRIPE_OPTIONS = {
  appearance: {
    theme: "night" as const,
    variables: {
      colorPrimary: "#22C55E",
      colorBackground: "#1A1535",
      colorText: "#f1f5f9",
      colorDanger: "#f87171",
      fontFamily: "inherit",
      borderRadius: "12px",
    },
  },
};

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

function PaymentForm({
  onSuccess,
  isSubmitting,
  setIsSubmitting,
  setPayError,
}: {
  onSuccess: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setPayError: (value: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  async function handleSubmit() {
    if (!stripe || !elements || !isReady) return;
    setIsSubmitting(true);
    setPayError("");

    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setPayError(error.message ?? "Payment failed. Please try again.");
      setIsSubmitting(false);
      return;
    }

    onSuccess();
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} onReady={() => setIsReady(true)} />
      <Button variant="live" size="lg" className="w-full gap-2" onClick={handleSubmit} disabled={isSubmitting || !stripe || !isReady}>
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Paying...</>
        ) : !isReady ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
        ) : (
          <><Zap className="w-4 h-4" /> Pay And Join Queue</>
        )}
      </Button>
    </div>
  );
}

type Step = "info" | "payment" | "success";

export function LiveJoinModal({
  creator,
  open,
  onClose,
}: {
  creator: Creator;
  open: boolean;
  onClose: () => void;
}) {
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

  const joinFee = creator.liveJoinFee ?? 0;

  async function findExistingQueueEntry(sessionId: string) {
    if (!user) return null;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("live_queue_entries")
      .select("id, status")
      .eq("session_id", sessionId)
      .eq("fan_id", user.id)
      .in("status", ["waiting", "active"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

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
    void fetchFreshStatus();
    if (user) void fetchSavedPaymentMethods();
  }, [open, creator.id, user]);

  useEffect(() => {
    setClientSecret(null);
    setPayError("");
  }, [saveNewCard, selectedPaymentMethodId]);

  useEffect(() => {
    if (step !== "payment" || clientSecret || selectedPaymentMethodId) return;

    setFetchingIntent(true);
    fetch("/api/create-live-preauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ratePerMinute: joinFee,
        creatorName: creator.name,
        saveForFuture: saveNewCard,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId ?? null);
          return;
        }
        setPayError(data.error ?? "Could not initialise payment.");
      })
      .catch(() => setPayError("Network error. Please try again."))
      .finally(() => setFetchingIntent(false));
  }, [clientSecret, creator.name, joinFee, saveNewCard, selectedPaymentMethodId, step]);

  async function finishQueueJoin(intentId: string) {
    if (!user) {
      setStep("success");
      return;
    }

    if (!currentSessionId) {
      setPayError("Creator is offline or still setting up. Please try again in a moment.");
      setIsSubmitting(false);
      setStep("info");
      return;
    }

    const existingEntry = await findExistingQueueEntry(currentSessionId);
    if (existingEntry) {
      setStep("success");
      window.setTimeout(() => {
        onClose();
        router.push(`/waiting-room/${creator.id}`);
      }, 400);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("live_queue_entries").insert({
      session_id: currentSessionId,
      fan_id: user.id,
      status: "waiting",
      position: 0,
      amount_pre_authorized: joinFee,
      amount_charged: joinFee,
      stripe_pre_auth_id: intentId,
      joined_at: new Date().toISOString(),
    });

    if (error) throw error;

    setStep("success");
    window.setTimeout(() => {
      onClose();
      router.push(`/waiting-room/${creator.id}`);
    }, 1200);
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
          ratePerMinute: joinFee,
          creatorName: creator.name,
          paymentMethodId: selectedPaymentMethodId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentIntentId) {
        throw new Error(data.error ?? "Could not charge the saved card.");
      }
      await finishQueueJoin(data.paymentIntentId);
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Could not charge the saved card.");
      setIsSubmitting(false);
    }
  }

  async function handlePaymentSuccess() {
    if (!paymentIntentId) {
      setPayError("Missing payment confirmation.");
      setIsSubmitting(false);
      return;
    }

    try {
      await finishQueueJoin(paymentIntentId);
    } catch (error) {
      console.error("Failed to insert queue entry:", error);
      setPayError("Payment succeeded but queue join failed. Please contact support.");
      setIsSubmitting(false);
      setStep("info");
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent
        className="w-full max-w-md"
        title={step === "success" ? "You're In The Queue" : `Join ${creator.name}'s Live`}
        description={
          step === "info"
            ? "Watch for free, then pay once if you want the creator to bring you on stage."
            : step === "payment"
            ? "You pay the live join fee now. If the live ends before you're admitted, you receive a full refund."
            : undefined
        }
      >
        {step === "success" ? (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-brand-live/20 border border-brand-live/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-brand-live" />
            </div>
            <div>
              <p className="text-slate-300 text-sm leading-relaxed">
                You&apos;re in the queue for <strong className="text-slate-100">{creator.name}</strong>.
                The creator can admit you live for {LIVE_STAGE_SECONDS} seconds when it&apos;s your turn.
              </p>
              <p className="text-slate-500 text-xs mt-2">Redirecting you back to the live...</p>
            </div>
          </div>
        ) : null}

        {step === "info" ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface border border-brand-border">
              <Avatar initials={creator.avatarInitials} color={creator.avatarColor} imageUrl={creator.avatarUrl} size="sm" />
              <div>
                <p className="text-sm font-semibold text-slate-100">{creator.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                  <span className="text-xs text-brand-live font-medium">LIVE NOW</span>
                  {creator.queueCount > 0 ? (
                    <span className="text-xs text-slate-500 ml-1">· {creator.queueCount} ahead</span>
                  ) : null}
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-black text-brand-live">{formatCurrency(joinFee)}</p>
                <p className="text-[11px] text-slate-400">for {LIVE_STAGE_SECONDS} seconds</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">How it works</p>
              {[
                {
                  icon: Zap,
                  title: "Pay once to enter the queue",
                  desc: "You can already watch and chat for free. This fee is only for a chance to go on stage.",
                },
                {
                  icon: Clock,
                  title: "Wait in the public live",
                  desc: "Your queue position updates live while the creator admits guests one by one.",
                },
                {
                  icon: Info,
                  title: `${LIVE_STAGE_SECONDS} seconds on stage`,
                  desc: "If admitted, you go live with the creator for a single 30-second turn.",
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

            <div className="rounded-xl border border-brand-live/20 bg-brand-live/10 p-3 text-[11px] text-slate-300">
              If the live ends before you&apos;re admitted, your queue fee is refunded in full. If you are admitted for any amount of time, the fee is not refunded.
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button variant="live" className="flex-1 gap-2" onClick={() => setStep("payment")} disabled={joinFee < LIVE_MIN_JOIN_FEE}>
                <Zap className="w-4 h-4" />
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === "payment" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Live join fee</span>
                <span className="text-slate-200">{formatCurrency(joinFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">On-stage time</span>
                <span className="text-slate-200">{LIVE_STAGE_SECONDS} seconds</span>
              </div>
              <div className="border-t border-brand-border pt-2 flex justify-between text-sm font-bold">
                <span className="text-slate-300">Charged today</span>
                <span className="text-brand-live">{formatCurrency(joinFee)}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Friendsly requires live join fees to be at least {formatCurrency(LIVE_MIN_JOIN_FEE)}.
              </p>
            </div>

            {payError && !clientSecret ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {payError}
              </div>
            ) : null}

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
                <button onClick={() => setSelectedPaymentMethodId(null)} className="text-xs text-brand-live hover:underline">
                  Use a new card instead
                </button>
                <Button variant="live" size="lg" className="w-full gap-2" onClick={handleSavedPaymentSubmit} disabled={isSubmitting || !selectedPaymentMethodId}>
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Paying...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Pay And Join Queue</>
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
                {payError ? (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    {payError}
                  </div>
                ) : null}
                <Elements stripe={stripePromise} options={{ ...STRIPE_OPTIONS, clientSecret }}>
                  <label className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                    <input
                      type="checkbox"
                      checked={saveNewCard}
                      onChange={(event) => setSaveNewCard(event.target.checked)}
                      className="rounded border-brand-border bg-brand-elevated"
                    />
                    Save this payment method for future payments
                  </label>
                  <PaymentForm onSuccess={handlePaymentSuccess} isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} setPayError={setPayError} />
                </Elements>
              </>
            ) : null}

            <button onClick={() => setStep("info")} className="text-xs text-slate-500 hover:text-slate-300 w-full text-center">
              Back to details
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
