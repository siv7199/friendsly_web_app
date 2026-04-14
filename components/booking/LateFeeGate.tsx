"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const STRIPE_OPTIONS = {
  appearance: {
    theme: "night" as const,
    variables: {
      colorPrimary: "#7C3AED",
      colorBackground: "#1A1535",
      colorText: "#f1f5f9",
      colorDanger: "#f87171",
      fontFamily: "inherit",
      borderRadius: "12px",
    },
  },
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
}: {
  amount: number;
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
  createIntent: () => Promise<{ clientSecret: string }>;
  confirmPayment: (paymentIntentId: string) => Promise<void>;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
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
  }, [createIntent]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4 py-8">
      <div className="w-full max-w-lg rounded-3xl border border-amber-500/20 bg-brand-surface p-6 md:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Late join fee</p>
            <h1 className="mt-2 text-2xl font-black text-slate-100">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p>
            <p className="mt-4 text-sm text-slate-400">
              Amount due: <span className="font-semibold text-slate-100">{formatCurrency(amount)}</span>
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-brand-border bg-brand-elevated p-4">
          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {loadingIntent ? (
            <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
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
              <p className="text-sm text-slate-400">We couldn't load the payment form.</p>
              <div className="flex gap-3">
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

        {clientSecret && (
          <div className="mt-4">
            <Button variant="outline" className="w-full" onClick={onBack} disabled={isSubmitting}>
              {backLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
