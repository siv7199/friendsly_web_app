"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, DollarSign, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn, formatCurrency } from "@/lib/utils";
import { isCreatorProfile } from "@/types";

type EarningsState = {
  available: number;
  stripeAvailable: number;
  withdrawable: number;
  pending: number;
  pendingPayouts: number;
  thisMonth: number;
  totalEarned: number;
};

const EMPTY_EARNINGS: EarningsState = {
  available: 0,
  stripeAvailable: 0,
  withdrawable: 0,
  pending: 0,
  pendingPayouts: 0,
  thisMonth: 0,
  totalEarned: 0,
};

type StripeConnectState = {
  accountId: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
};

const EMPTY_CONNECT_STATE: StripeConnectState = {
  accountId: null,
  detailsSubmitted: false,
  payoutsEnabled: false,
  chargesEnabled: false,
};

export default function EarningsPage() {
  const [stripeQueryState, setStripeQueryState] = useState("");
  const { user } = useAuthContext();
  const [earnings, setEarnings] = useState<EarningsState>(EMPTY_EARNINGS);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [connectState, setConnectState] = useState<StripeConnectState>(EMPTY_CONNECT_STATE);
  const [loadingFinancials, setLoadingFinancials] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isConnectingPayouts, setIsConnectingPayouts] = useState(false);
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const lastStatusLoadKeyRef = useRef<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStripeQueryState(params.get("stripe") ?? "");
  }, []);

  useEffect(() => {
    if (!user || !isCreatorProfile(user)) return;

    const loadKey = `${user.id}:${stripeQueryState}`;
    if (lastStatusLoadKeyRef.current === loadKey) return;
    lastStatusLoadKeyRef.current = loadKey;

    async function loadFinancials() {
      setLoadingFinancials(true);
      setPayoutError(null);
      try {
        const res = await fetch("/api/creator-payouts/status");
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Could not load payout data.");
        }

        setEarnings(data.earnings ?? EMPTY_EARNINGS);
        setPayouts(data.payouts ?? []);
        setConnectState(data.account ?? EMPTY_CONNECT_STATE);
      } catch (error) {
        setPayoutError(error instanceof Error ? error.message : "Could not load payout data.");
      } finally {
        setLoadingFinancials(false);
      }
    }

    void loadFinancials();
  }, [stripeQueryState, user]);

  useEffect(() => {
    if (stripeQueryState === "return") {
      setNotice("Stripe payout setup updated. Refreshing your payout status.");
    } else if (stripeQueryState === "refresh") {
      setNotice("Stripe asked to refresh onboarding details. You can continue setup below.");
    }
  }, [stripeQueryState]);

  async function handleConnectPayouts() {
    setIsConnectingPayouts(true);
    setPayoutError(null);

    try {
      const res = await fetch("/api/creator-payouts/onboarding", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Could not start Stripe onboarding.");
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setConnectState(data.account ?? EMPTY_CONNECT_STATE);
      setNotice("Stripe payouts are already connected.");
    } catch (error) {
      setPayoutError(error instanceof Error ? error.message : "Could not start Stripe onboarding.");
    } finally {
      setIsConnectingPayouts(false);
    }
  }

  async function handleOpenStripeDashboard() {
    setIsOpeningDashboard(true);
    setPayoutError(null);

    try {
      const res = await fetch("/api/creator-payouts/dashboard", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Could not open Stripe dashboard.");
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setPayoutError(error instanceof Error ? error.message : "Could not open Stripe dashboard.");
    } finally {
      setIsOpeningDashboard(false);
    }
  }

  async function handleWithdraw() {
    if (!user || !isCreatorProfile(user) || earnings.withdrawable <= 0 || !connectState.payoutsEnabled) return;

    setIsWithdrawing(true);
    setPayoutError(null);

    try {
      const res = await fetch("/api/creator-payouts/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: earnings.withdrawable }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Could not send payout.");
      }

      setPayouts((prev) => [data.payout, ...prev.filter((item) => item.id !== data.payout?.id)]);
      setNotice("Withdrawal submitted to Stripe.");

      const statusRes = await fetch("/api/creator-payouts/status");
      const statusData = await statusRes.json();
      if (statusRes.ok) {
        setEarnings(statusData.earnings ?? EMPTY_EARNINGS);
        setPayouts(statusData.payouts ?? []);
        setConnectState(statusData.account ?? EMPTY_CONNECT_STATE);
      }
    } catch (error) {
      setPayoutError(error instanceof Error ? error.message : "Could not send payout.");
    } finally {
      setIsWithdrawing(false);
    }
  }

  if (!user || !isCreatorProfile(user)) return null;

  const needsStripeSetup = !connectState.accountId || !connectState.detailsSubmitted || !connectState.payoutsEnabled;
  const withdrawDisabled = earnings.withdrawable <= 0 || isWithdrawing || loadingFinancials || needsStripeSetup;

  return (
    <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-black font-display text-brand-ink">Earnings</h1>
        <p className="text-brand-ink-subtle mt-1">Track your balance, payouts, and creator revenue in one place.</p>
      </div>

      <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-brand-ink">Earnings Summary</h2>
          {loadingFinancials && <Loader2 className="w-4 h-4 animate-spin text-brand-ink-subtle" />}
        </div>

        {notice && (
          <div className="mb-4 rounded-xl border border-brand-live/20 bg-brand-live/10 px-4 py-3 text-sm text-brand-live">
            {notice}
          </div>
        )}

            {payoutError && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-50 px-4 py-3 text-sm text-red-600">
            {payoutError}
          </div>
        )}

        {connectState.payoutsEnabled && earnings.available - earnings.withdrawable > 0.009 && !payoutError && (
          <div className="mb-4 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Some earnings are still clearing, so you can withdraw {formatCurrency(earnings.withdrawable)} right now.
          </div>
        )}

        {earnings.pending > 0.009 && (
          <div className="mb-4 rounded-xl border border-brand-primary/20 bg-brand-primary/10 px-4 py-3 text-sm text-brand-ink">
            {formatCurrency(earnings.pending)} is still pending and will only become withdrawable after the call outcome is finalized, like completion or a late-cancel/no-show result.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Available to Withdraw", value: formatCurrency(earnings.withdrawable), accent: "text-amber-600" },
            { label: "Pending Earnings", value: formatCurrency(earnings.pending), accent: "text-brand-live" },
            { label: "This Month", value: formatCurrency(earnings.thisMonth), accent: "text-brand-ink" },
            { label: "Total Earned", value: formatCurrency(earnings.totalEarned), accent: "text-brand-primary" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl bg-brand-elevated border border-brand-border">
              <p className={cn("text-xl font-black", s.accent)}>{s.value}</p>
              <p className="text-[11px] text-brand-ink-muted mt-1 uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-2xl border border-brand-border bg-brand-elevated p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-brand-ink">Stripe Connect</h3>
              <p className="mt-1 text-xs text-brand-ink-subtle">
                {connectState.payoutsEnabled
                  ? "Payouts are enabled and withdrawals can be sent to your connected account."
                  : connectState.accountId
                  ? "Finish Stripe onboarding to enable real withdrawals."
                  : "Set up Stripe Connect to receive real payouts."}
              </p>
            </div>
            <Badge variant={connectState.payoutsEnabled ? "live" : "default"} className="shrink-0">
              {connectState.payoutsEnabled ? "Ready" : "Setup Required"}
            </Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant={connectState.payoutsEnabled ? "outline" : "primary"}
              onClick={handleConnectPayouts}
              disabled={isConnectingPayouts}
            >
              {isConnectingPayouts
                ? "Opening Stripe..."
                : connectState.payoutsEnabled
                ? "Refresh Setup"
                : connectState.accountId
                ? "Finish Stripe Setup"
                : "Set Up Payouts"}
            </Button>
            {connectState.accountId && (
              <Button
                variant="outline"
                onClick={handleOpenStripeDashboard}
                disabled={isOpeningDashboard}
              >
                {isOpeningDashboard ? "Opening Dashboard..." : "Manage Stripe Account"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-brand-primary-light" />
            </div>
                  <div>
                    <h3 className="text-sm font-semibold text-brand-ink">Withdraw Funds</h3>
                    <p className="text-xs text-brand-ink-subtle mt-0.5">Transfer your currently withdrawable balance to your connected account</p>
                    {earnings.pendingPayouts > 0.009 && (
                      <p className="text-[11px] text-brand-ink-subtle mt-1">
                        {formatCurrency(earnings.pendingPayouts)} is already being transferred out.
                      </p>
                    )}
                  </div>
                </div>
          <Button
            variant="gold"
            size="sm"
            onClick={handleWithdraw}
            disabled={withdrawDisabled}
          >
            {isWithdrawing ? "Processing..." : needsStripeSetup ? "Connect Stripe First" : "Withdraw"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
        <h2 className="text-base font-semibold text-brand-ink mb-4">Payout History</h2>

        {loadingFinancials ? (
          <div className="text-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-brand-ink-subtle mx-auto" />
          </div>
        ) : payouts.length > 0 ? (
          <div className="space-y-3">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-brand-elevated border border-brand-border">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-brand-ink-subtle" />
                  <div>
                    <p className="text-sm font-semibold text-brand-ink">Withdrawal to Stripe</p>
                    <p className="text-[10px] text-brand-ink-subtle">
                      {new Date(p.created_at).toLocaleDateString()} at {new Date(p.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-ink">{formatCurrency(p.amount)}</p>
                  <Badge variant={p.status === "completed" ? "live" : p.status === "failed" ? "danger" : "default"} className="text-[10px] mt-1 capitalize">
                    {p.status}
                  </Badge>
                  {p.failure_reason && (
                    <p className="mt-1 max-w-[220px] text-[10px] text-red-600">{p.failure_reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <DollarSign className="w-8 h-8 text-brand-ink-subtle mx-auto mb-3" />
            <p className="text-brand-ink-subtle text-sm">No payouts yet.</p>
            <p className="text-brand-ink-subtle text-xs mt-1">When you withdraw your earnings, they will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
