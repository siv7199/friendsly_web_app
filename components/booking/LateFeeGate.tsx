"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/lib/context/AuthContext";
import { readJsonResponse } from "@/lib/http";
import { formatCurrency } from "@/lib/utils";
import { STRIPE_OPTIONS } from "@/lib/stripe-ui";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

function LateFeePaymentForm({
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
      setError(submitError instanceof Error ? submitError.message : "Could not confirm the late fee payment.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} onReady={() => setIsReady(true)} />
      <div className="flex flex-col gap-3 min-[420px]:flex-row">
        <Button variant="outline" className="flex-1" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          variant="gold"
          className="flex-1 whitespace-normal text-center leading-tight"
          onClick={handlePay}
          disabled={isSubmitting || !stripe || !isReady}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : !isReady ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Initialising...</>
          ) : (
            "Pay late fee"
          )}
        </Button>
      </div>
    </div>
  );
}

export function LateFeeGate({
  amount,
  title,
  description,
  backLabel,
  onBack,
  createIntent,
  confirmPayment,
  chargeSavedPaymentMethod,
}: {
  amount: number;
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
  createIntent: () => Promise<{ clientSecret: string }>;
  confirmPayment: (paymentIntentId: string) => Promise<void>;
  chargeSavedPaymentMethod?: (paymentMethodId: string) => Promise<void>;
}) {
  const { user } = useAuthContext();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [loadingSavedPaymentMethods, setLoadingSavedPaymentMethods] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !chargeSavedPaymentMethod) {
      setSavedPaymentMethods([]);
      setSelectedPaymentMethodId(null);
      setLoadingSavedPaymentMethods(false);
      return;
    }

    let cancelled = false;

    async function loadSavedPaymentMethods() {
      try {
        setLoadingSavedPaymentMethods(true);
        const response = await fetch("/api/payment-methods");
        const data = await readJsonResponse<{ paymentMethods?: SavedPaymentMethod[]; error?: string }>(response);
        if (!response.ok) {
          throw new Error(data?.error ?? "Could not load saved payment methods.");
        }

        if (!cancelled) {
          const methods = data?.paymentMethods ?? [];
          setSavedPaymentMethods(methods);
          setSelectedPaymentMethodId(methods[0]?.id ?? null);
        }
      } catch {
        if (!cancelled) {
          setSavedPaymentMethods([]);
          setSelectedPaymentMethodId(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingSavedPaymentMethods(false);
        }
      }
    }

    void loadSavedPaymentMethods();
    return () => {
      cancelled = true;
    };
  }, [chargeSavedPaymentMethod, user]);

  useEffect(() => {
    if (loadingSavedPaymentMethods) return;
    if (selectedPaymentMethodId) {
      setLoadingIntent(false);
      return;
    }

    let cancelled = false;

    async function initIntent() {
      try {
        setLoadingIntent(true);
        setError("");
        const data = await createIntent();
        if (!cancelled) {
          setClientSecret(data.clientSecret);
        }
      } catch (intentError) {
        if (!cancelled) {
          setError(intentError instanceof Error ? intentError.message : "Could not initialise the late fee payment.");
        }
      } finally {
        if (!cancelled) setLoadingIntent(false);
      }
    }

    void initIntent();
    return () => {
      cancelled = true;
    };
  }, [createIntent, loadingSavedPaymentMethods, selectedPaymentMethodId]);

  async function handleSavedPaymentSubmit() {
    if (!selectedPaymentMethodId || !chargeSavedPaymentMethod) return;

    try {
      setIsSubmitting(true);
      setError("");
      await chargeSavedPaymentMethod(selectedPaymentMethodId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not charge saved payment method.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl border border-amber-500/20 bg-brand-surface p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Late join fee</p>
            <h1 className="mt-1.5 text-xl font-black text-brand-ink">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-brand-ink-subtle">{description}</p>
            <p className="mt-3 text-sm text-brand-ink-subtle">
              Amount due: <span className="font-semibold text-brand-ink">{formatCurrency(amount)}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-border bg-brand-elevated p-3">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loadingSavedPaymentMethods ? (
            <div className="flex items-center justify-center gap-3 py-8 text-brand-ink-subtle">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading saved payments...</span>
            </div>
          ) : selectedPaymentMethodId && savedPaymentMethods.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-ink-muted">Saved Payments</p>
              <div className="space-y-2">
                {savedPaymentMethods.map((paymentMethod) => (
                  <label
                    key={paymentMethod.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                      selectedPaymentMethodId === paymentMethod.id
                        ? "border-brand-primary bg-brand-primary/10"
                        : "border-brand-border bg-brand-elevated"
                    }`}
                  >
                    <input
                      type="radio"
                      name="saved-late-fee-payment"
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
          ) : loadingIntent ? (
            <div className="flex items-center justify-center gap-3 py-8 text-brand-ink-subtle">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading payment form...</span>
            </div>
          ) : clientSecret ? (
            <Elements stripe={stripePromise} options={{ ...STRIPE_OPTIONS, clientSecret }}>
              <LateFeePaymentForm
                onBack={onBack}
                onSubmit={confirmPayment}
                isSubmitting={isSubmitting}
                setIsSubmitting={setIsSubmitting}
                setError={setError}
              />
            </Elements>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-brand-ink-subtle">We couldn't load the payment form.</p>
              <div className="flex flex-col gap-3 min-[420px]:flex-row">
                <Button variant="outline" className="flex-1" onClick={onBack}>
                  {backLabel}
                </Button>
                <Button
                  variant="gold"
                  className="flex-1"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>

        {clientSecret || selectedPaymentMethodId ? (
          <div className="mt-4">
            <Button variant="outline" className="w-full" onClick={onBack} disabled={isSubmitting}>
              {backLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
