"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CheckCircle2, Clock, Loader2, Lock, Mail, User, Zap } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import type { Creator } from "@/types";
import { readJsonResponse } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import { getLiveFanChargeAmount, LIVE_STAGE_MAX_MINUTES } from "@/lib/live";
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
  accountFields,
  canSubmit = true,
  submitDisabledReason,
  isSubmitting,
  setIsSubmitting,
  setPayError,
}: {
  onSuccess: () => void;
  accountFields?: ReactNode;
  canSubmit?: boolean;
  submitDisabledReason?: string;
  isSubmitting: boolean;
  setIsSubmitting: (value: boolean) => void;
  setPayError: (value: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isReady, setIsReady] = useState(false);

  async function handleSubmit() {
    if (!stripe || !elements || !isReady) return;
    if (!canSubmit) {
      setPayError(submitDisabledReason ?? "Complete all required details before paying.");
      return;
    }
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
      {accountFields}
      <Button variant="live" size="lg" className="w-full gap-2 whitespace-normal text-center leading-tight" onClick={handleSubmit} disabled={isSubmitting || !stripe || !isReady || !canSubmit}>
        {isSubmitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
        ) : !isReady ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
        ) : (
          <><Zap className="w-4 h-4" /> Join Call</>
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
  const { user, login } = useAuthContext();
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
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestAgreedToTerms, setGuestAgreedToTerms] = useState(false);
  const [guestConfirmedAge, setGuestConfirmedAge] = useState(false);
  const liveHref = getLiveSessionPath({
    creatorId: creator.id,
    creatorUsername: creator.username,
    sessionId: currentSessionId ?? creator.currentLiveSessionId,
  });

  const joinFee = creator.liveJoinFee ?? 0;
  const fanPerMinuteCharge = getLiveFanChargeAmount(joinFee);
  const liveProcessingFee = Math.max(0, fanPerMinuteCharge - joinFee);
  const guestAccountReady = Boolean(
    user ||
    (
      guestName.trim() &&
      guestEmail.trim() &&
      guestEmail.includes("@") &&
      guestPassword.length >= 8 &&
      /[A-Z]/.test(guestPassword) &&
      /[^A-Za-z0-9]/.test(guestPassword) &&
      guestAgreedToTerms &&
      guestConfirmedAge
    )
  );

  function handleModalClose() {
    onClose();
    if (step === "success") {
      router.push(liveHref);
    }
  }

  function handleJoinSignup() {
    setStep("payment");
  }

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
      const data = await readJsonResponse<{ paymentMethods?: SavedPaymentMethod[] }>(res);
      const methods = data?.paymentMethods ?? [];
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
    fetch(user ? "/api/create-live-preauth" : "/api/public/live/preauth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creatorId: creator.id,
        currentSessionId,
        creatorName: creator.name,
        saveForFuture: saveNewCard,
      }),
    })
      .then((response) => readJsonResponse<{ clientSecret?: string; paymentIntentId?: string; error?: string }>(response))
      .then((data) => {
        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId ?? null);
          return;
        }
        setPayError(data?.error ?? "Could not initialise payment.");
      })
      .catch(() => setPayError("Network error. Please try again."))
      .finally(() => setFetchingIntent(false));
  }, [clientSecret, creator.id, creator.name, currentSessionId, joinFee, saveNewCard, selectedPaymentMethodId, step, user]);

  async function finishQueueJoin(intentId: string) {
    if (!user) {
      if (!currentSessionId) {
        setPayError("Creator is offline or still setting up. Please try again in a moment.");
        setIsSubmitting(false);
        setStep("info");
        return;
      }

      const response = await fetch("/api/public/live/join-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          paymentIntentId: intentId,
          fullName: guestName.trim(),
          email: guestEmail.trim(),
          password: guestPassword,
        }),
      });
      const data = await readJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not join the live queue.");
      }

      const loginResult = await login(guestEmail.trim(), guestPassword);
      if (!loginResult.success) {
        throw new Error("You're in the queue, but we could not sign you in automatically. Please sign in with the email and password you just used.");
      }

      setStep("success");
      setIsSubmitting(false);
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
      setIsSubmitting(false);
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
    const data = await readJsonResponse<{ error?: string }>(response);
    if (!response.ok) {
      throw new Error(data?.error ?? "Could not join the live queue.");
    }

    setStep("success");
    setIsSubmitting(false);
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
      const data = await readJsonResponse<{ paymentIntentId?: string; error?: string }>(res);
      if (!res.ok || !data?.paymentIntentId) {
        throw new Error(data?.error ?? "Could not charge the saved card.");
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
    <>
    <Dialog open={open} onClose={handleModalClose}>
      <DialogContent
        className="mx-auto w-[calc(100vw-1rem)] max-w-md"
        title={step === "success" ? "You're In Line" : `Join ${creator.name}'s Live`}
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
              <p className="text-brand-ink-subtle text-xs mt-2">You can close this whenever you&apos;re ready.</p>
            </div>
            <Button variant="live" className="w-full" onClick={handleModalClose}>
              Close
            </Button>
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
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-brand-border bg-brand-elevated px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-ink-subtle">Creator live rate</span>
                  <span className="font-semibold text-brand-ink">{formatCurrency(joinFee)} / min</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-brand-ink-subtle">Processing fee</span>
                  <span className="font-semibold text-brand-ink">{formatCurrency(liveProcessingFee)} / min</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-brand-border pt-2 text-sm">
                  <span className="font-medium text-brand-ink">Fan total</span>
                  <span className="font-semibold text-brand-live">{formatCurrency(fanPerMinuteCharge)} / min</span>
                </div>
                <p className="mt-2 text-xs text-brand-ink-subtle">
                  You only pay for the time you are admitted live with the creator.
                </p>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-subtle">How it works</p>
              {[
                {
                  icon: Clock,
                  title: "Wait in the live",
                  desc: "Your queue position updates live while the creator brings guests on one by one.",
                },
                {
                  icon: Zap,
                  title: "Go live when admitted",
                  desc: `If admitted, you go live with the creator for between 30 seconds and ${LIVE_STAGE_MAX_MINUTES} minutes when it is your turn.`,
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

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={handleModalClose}>Cancel</Button>
              {user ? (
                <Button variant="live" className="flex-1 gap-2" onClick={() => setStep("payment")} disabled={joinFee <= 0}>
                  <Zap className="w-4 h-4" />
                  Continue
                </Button>
              ) : (
                <Button variant="live" className="flex-1 gap-2" onClick={handleJoinSignup}>
                  <Zap className="w-4 h-4" />
                  Continue
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {step === "payment" ? (
          <div className="space-y-3">
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
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Join Call</>
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
                  {user ? (
                    <label className="flex items-center gap-2 text-xs text-brand-ink-subtle mb-3">
                      <input
                        type="checkbox"
                        checked={saveNewCard}
                        onChange={(event) => setSaveNewCard(event.target.checked)}
                        className="rounded border-brand-border bg-brand-elevated"
                      />
                      Save this payment method for future payments
                    </label>
                  ) : null}
                  <PaymentForm
                    onSuccess={handlePaymentSuccess}
                    canSubmit={user ? true : guestAccountReady}
                    submitDisabledReason="Add your name, email, password, and confirmations under the card details."
                    accountFields={user ? null : (
                      <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4">
                        <p className="text-sm font-semibold text-brand-ink">Create your account after payment</p>
                        <p className="mt-1 text-xs leading-5 text-brand-ink-subtle">
                          Your paid live join confirms this fan account. No email confirmation step is required.
                        </p>
                        <div className="mt-4 space-y-3">
                          <Input
                            label="Full Name"
                            type="text"
                            value={guestName}
                            onChange={(event) => setGuestName(event.target.value)}
                            icon={<User className="h-4 w-4" />}
                            required
                            autoComplete="name"
                          />
                          <Input
                            label="Email"
                            type="email"
                            value={guestEmail}
                            onChange={(event) => setGuestEmail(event.target.value)}
                            icon={<Mail className="h-4 w-4" />}
                            required
                            autoComplete="email"
                          />
                          <Input
                            label="Password"
                            type="password"
                            value={guestPassword}
                            onChange={(event) => setGuestPassword(event.target.value)}
                            icon={<Lock className="h-4 w-4" />}
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
                    setPayError={setPayError}
                  />
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
    </>
  );
}
