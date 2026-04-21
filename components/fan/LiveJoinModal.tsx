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
import { LIVE_PREAUTH_MINUTES, LIVE_STAGE_MAX_MINUTES } from "@/lib/live";
import { STRIPE_OPTIONS } from "@/lib/stripe-ui";
import { getLiveSessionPath } from "@/lib/routes";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const LIVE_SESSION_STALE_MS = 45000;

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
      <Button variant="live" size="lg" className="w-full gap-2 whitespace-normal text-center leading-tight" onClick={handleSubmit} disabled={isSubmitting || !stripe || !isReady}>
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Placing hold...</>
        ) : !isReady ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
        ) : (
          <><Zap className="w-4 h-4" /> Place Hold And Join Queue</>
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
  const liveHref = getLiveSessionPath({
    creatorId: creator.id,
    creatorUsername: creator.username,
    sessionId: currentSessionId ?? creator.currentLiveSessionId,
  });

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
        creatorId: creator.id,
        currentSessionId,
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
        router.push(liveHref);
      }, 400);
      return;
    }

    const response = await fetch("/api/live/join-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSessionId,
        paymentIntentId: intentId,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Could not join the live queue.");
    }

    setStep("success");
    window.setTimeout(() => {
      onClose();
      router.push(liveHref);
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
          creatorId: creator.id,
          currentSessionId,
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
        className="mx-auto w-[calc(100vw-1rem)] max-w-md"
        title={step === "success" ? "You're In The Queue" : `Join ${creator.name}'s Live`}
        description={
          step === "info"
            ? "Watch for free, then place a temporary card hold at the per-minute rate if you want to join on stage."
            : step === "payment"
            ? "A temporary hold is placed at the per-minute rate. You are charged only for time actually used on stage."
            : undefined
        }
      >
        {step === "success" ? (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-brand-live/20 border border-brand-live/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-brand-live" />
            </div>
            <div>
              <p className="text-brand-ink-muted text-sm leading-relaxed">
                You&apos;re in the queue for <strong className="text-brand-ink">{creator.name}</strong>.
                The creator can admit you live for between 30 seconds and {LIVE_STAGE_MAX_MINUTES} minutes when it&apos;s your turn.
              </p>
              <p className="text-brand-ink-subtle text-xs mt-2">Redirecting you back to the live...</p>
            </div>
          </div>
        ) : null}

        {step === "info" ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface border border-brand-border">
              <Avatar initials={creator.avatarInitials} color={creator.avatarColor} imageUrl={creator.avatarUrl} size="sm" />
              <div>
                <p className="text-sm font-semibold text-brand-ink">{creator.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                  <span className="text-xs text-brand-live font-medium">LIVE NOW</span>
                  {creator.queueCount > 0 ? (
                    <span className="text-xs text-brand-ink-subtle ml-1">· {creator.queueCount} ahead</span>
                  ) : null}
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-serif font-semibold text-brand-live">{formatCurrency(joinFee)}</p>
                <p className="text-[11px] text-brand-ink-subtle">per minute</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-subtle">How it works</p>
              {[
                {
                  icon: Zap,
                  title: "Place a temporary hold",
                  desc: "You can already watch and chat for free. Joining the queue only places a temporary hold on your card at the per-minute rate.",
                },
                {
                  icon: Clock,
                  title: "Wait in the live",
                  desc: "Your queue position updates live while the creator brings guests on one by one.",
                },
                {
                  icon: Info,
                  title: "Go live when admitted",
                  desc: `If admitted, you go live with the creator for at least 30 seconds and up to ${LIVE_STAGE_MAX_MINUTES} minutes, and are billed only for the time you actually spend on stage.`,
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3 p-3 rounded-xl bg-brand-elevated border border-brand-border">
                  <div className="w-8 h-8 rounded-lg bg-brand-live/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-brand-live" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">{title}</p>
                    <p className="text-xs text-brand-ink-subtle mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-brand-live/20 bg-brand-live/10 p-3 text-[11px] text-brand-ink-muted">
              If the live ends before you&apos;re admitted, the hold is released automatically. If you go on stage, your final charge is based only on the time you actually use.
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button variant="live" className="flex-1 gap-2" onClick={() => setStep("payment")} disabled={joinFee <= 0}>
                <Zap className="w-4 h-4" />
                Continue
              </Button>
            </div>
          </div>
        ) : null}

        {step === "payment" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-brand-border bg-brand-surface p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-brand-ink-muted">Rate</span>
                <span className="text-sm font-semibold text-brand-ink">{formatCurrency(joinFee)} / min</span>
              </div>
              <div className="pt-2 border-t border-brand-border/60">
                <p className="text-xs text-brand-ink-subtle leading-relaxed">
                  A temporary hold is placed on your card at the per-minute rate for up to {LIVE_PREAUTH_MINUTES} minutes. You are charged only for the time you actually spend on stage, and any unused hold is released automatically.
                </p>
              </div>
            </div>

            {payError && !clientSecret ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {payError}
              </div>
            ) : null}

            {loadingSavedPaymentMethods ? (
              <div className="flex items-center justify-center py-4 gap-2 text-brand-ink-subtle text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading saved payments...
              </div>
            ) : savedPaymentMethods.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-subtle">Saved Payments</p>
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
                      <div className="text-sm text-brand-ink capitalize">
                        {paymentMethod.brand} ending in {paymentMethod.last4}
                      </div>
                      <div className="ml-auto text-xs text-brand-ink-subtle">
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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Placing hold...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Place Hold And Join Queue</>
                  )}
                </Button>
              </div>
            ) : null}

            {selectedPaymentMethodId ? null : fetchingIntent ? (
              <div className="flex items-center justify-center py-8 gap-3 text-brand-ink-subtle">
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
                  <label className="flex items-center gap-2 text-xs text-brand-ink-subtle mb-3">
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

            <button onClick={() => setStep("info")} className="text-xs text-brand-ink-subtle hover:text-brand-ink-muted w-full text-center">
              Back to details
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
