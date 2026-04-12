"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Calendar, Clock, Loader2, Video, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getTimeZoneAbbreviation } from "@/lib/timezones";

type AccessPayload = {
  booking: {
    id: string;
    status: string;
    scheduledAt: string;
    duration: number;
    topic: string | null;
    guestName: string;
    guestEmail: string | null;
    canJoinNow: boolean;
    canCancel: boolean;
    joinOpensAt: string;
    endsAt: string;
    refundAmount: number;
    refundPolicyText: string;
    creator: {
      full_name?: string;
      username?: string;
      avatar_initials?: string;
      avatar_color?: string;
      avatar_url?: string;
    } | null;
  };
};

export default function BookingAccessPage() {
  const params = useParams();
  const router = useRouter();
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<AccessPayload | null>(null);
  const [clientTimeZone, setClientTimeZone] = useState("America/New_York");
  const [cancelling, setCancelling] = useState(false);

  async function loadBooking() {
    if (!rawToken) return;

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/public/booking-access/${rawToken}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not load booking.");
      }
      setPayload(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load booking.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setClientTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBookingSafe() {
      try {
        setLoading(true);
        setError("");
        const response = await fetch(`/api/public/booking-access/${rawToken}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Could not load booking.");
        }
        if (!cancelled) {
          setPayload(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load booking.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (rawToken) {
      void loadBookingSafe();
    }

    return () => {
      cancelled = true;
    };
  }, [rawToken]);

  if (loading) {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-8 text-center text-red-200">
          {error || "Could not load booking."}
        </div>
      </main>
    );
  }

  const booking = payload.booking;
  const scheduledDate = new Date(booking.scheduledAt);
  const joinOpensAt = new Date(booking.joinOpensAt);
  const isCancelled = booking.status === "cancelled";
  const isCompleted = booking.status === "completed";
  const canRebook = Boolean(booking.creator?.username);

  async function handleCancel() {
    try {
      setCancelling(true);
      setError("");
      const response = await fetch(`/api/public/booking-access/${rawToken}/cancel`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not cancel booking.");
      }

      setPayload((current) =>
        current
          ? {
              booking: {
                ...current.booking,
                status: "cancelled",
                canJoinNow: false,
                canCancel: false,
              },
            }
          : current
      );
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel booking.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-3xl border border-brand-border bg-brand-surface p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-primary-light">
            Guest Booking Access
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-100">
            {isCancelled
              ? "This booking was cancelled"
              : isCompleted
              ? "This booking has ended"
              : "Your booking is ready"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {isCancelled
              ? "You can use the link below to book a new call with this creator."
              : isCompleted
              ? "This session is finished. You can book a new call with this creator below."
              : "This page lets you return later and join your call without creating a Friendsly account."}
          </p>
        </div>

        {!isCancelled && !isCompleted && (
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              Booking policies
            </p>
            <p className="text-sm text-amber-100">
              Cancel more than 24 hours before the call for a full refund. Cancel within 24 hours for a 50% refund.
            </p>
            <p className="text-sm text-amber-100">
              Auto-cancel after 5 minutes: if neither participant joins, the booking is cancelled automatically and the fan gets a full refund.
            </p>
            <p className="text-sm text-amber-100">
              Auto-cancel after 5 minutes: if only the creator joins, the fan gets a 50% refund. If only the fan joins, the fan gets a full refund.
            </p>
            <p className="text-sm text-amber-200/90">
              If you cancel now, your refund will be {formatCurrency(booking.refundAmount)}.
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-brand-border bg-brand-surface p-6 space-y-5">
          <div className="flex items-center gap-3 rounded-2xl border border-brand-border bg-brand-elevated p-4">
            <Avatar
              initials={booking.creator?.avatar_initials ?? "CR"}
              color={booking.creator?.avatar_color ?? "bg-violet-600"}
              imageUrl={booking.creator?.avatar_url}
              size="sm"
            />
            <div>
              <p className="font-semibold text-slate-100">{booking.creator?.full_name ?? "Creator"}</p>
              <p className="text-xs text-slate-500">Booked for {booking.guestName}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">When</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                <Calendar className="w-4 h-4 text-brand-primary-light" />
                {scheduledDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-200">
                <Clock className="w-4 h-4 text-brand-primary-light" />
                {scheduledDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} {getTimeZoneAbbreviation(scheduledDate, clientTimeZone)}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
              <p className="mt-2 text-sm font-medium text-slate-100 capitalize">{booking.status}</p>
              <p className="mt-2 text-sm text-slate-400">
                {isCancelled
                  ? "This call was cancelled, so the join link is no longer active."
                  : isCompleted
                  ? "This call has ended, so the join link is no longer active."
                  : booking.canJoinNow
                  ? "Your room is open now."
                  : `Join opens at ${joinOpensAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.`}
              </p>
            </div>
          </div>

          {booking.topic && (
            <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Topic</p>
              <p className="mt-2 text-sm text-slate-200">{booking.topic}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {isCancelled || isCompleted ? (
              <Button
                variant="gold"
                className="flex-1"
                disabled={!canRebook}
                onClick={() => {
                  if (!booking.creator?.username) return;
                  router.push(`/book/${booking.creator.username}`);
                }}
              >
                Rebook call
              </Button>
            ) : (
              <>
                <div className="flex flex-1 flex-col gap-3">
                  <Button
                    variant="gold"
                    className="w-full"
                    disabled={!booking.canJoinNow}
                    onClick={() => router.push(`/guest-room/${rawToken}`)}
                  >
                    <Video className="w-4 h-4" />
                    {booking.canJoinNow ? "Join call" : "Join not open yet"}
                  </Button>
                  {booking.canCancel && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40"
                      disabled={cancelling}
                      onClick={handleCancel}
                    >
                      <XCircle className="w-4 h-4" />
                      {cancelling ? "Cancelling..." : "Cancel booking"}
                    </Button>
                  )}
                </div>
                <Button variant="outline" className="flex-1" onClick={() => void loadBooking()}>
                  Refresh booking
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
