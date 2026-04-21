"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CreditCard,
  Loader2,
  Radio,
  Receipt,
  Video,
} from "lucide-react";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";

type PaymentType = "booking" | "live";

interface PaymentItem {
  id: string;
  type: PaymentType;
  creatorId: string;
  creatorName: string;
  creatorUsername: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  amount: number;
  date: string;
  status: string;
  description: string;
  meta?: string;
}

function formatPaymentDate(date: string) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PaymentsPage() {
  const { user } = useAuthContext();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const userId = user.id;

    async function loadPayments() {
      setLoading(true);

      const [bookingsResult, liveResult] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            `id, scheduled_at, created_at, duration, price, status, late_fee_amount, late_fee_paid_at,
             creator:profiles!creator_id(id, full_name, username, avatar_initials, avatar_color, avatar_url),
             package:call_packages!package_id(name)`
          )
          .eq("fan_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("live_queue_entries")
          .select(
            `id, joined_at, ended_at, amount_charged, duration_seconds, status,
             session:live_sessions!session_id(
               creator:profiles!creator_id(id, full_name, username, avatar_initials, avatar_color, avatar_url)
             )`
          )
          .eq("fan_id", userId)
          .not("amount_charged", "is", null)
          .order("ended_at", { ascending: false }),
      ]);

      const bookingItems: PaymentItem[] = ((bookingsResult.data ?? []) as any[])
        .filter((booking) => Number(booking.price) > 0)
        .map((booking) => {
          const creator = Array.isArray(booking.creator) ? booking.creator[0] : booking.creator;
          const pkg = Array.isArray(booking.package) ? booking.package[0] : booking.package;

          return {
            id: `booking-${booking.id}`,
            type: "booking",
            creatorId: creator?.id ?? "",
            creatorName: creator?.full_name ?? "Creator",
            creatorUsername: creator?.username ?? "",
            creatorInitials: creator?.avatar_initials ?? "?",
            creatorColor: creator?.avatar_color ?? "bg-violet-600",
            creatorAvatarUrl: creator?.avatar_url ?? undefined,
            amount: Number(booking.price ?? 0) + Number(booking.late_fee_paid_at ? booking.late_fee_amount ?? 0 : 0),
            date: booking.late_fee_paid_at ?? booking.created_at ?? booking.scheduled_at,
            status: booking.status ?? "completed",
            description: pkg?.name ? `Booked call: ${pkg.name}` : "Booked 1-on-1 call",
            meta: booking.late_fee_paid_at
              ? `${booking.duration ?? 0} min session · includes ${formatCurrency(Number(booking.late_fee_amount ?? 0))} late fee`
              : `${booking.duration ?? 0} min session`,
          };
        });

      const liveItems: PaymentItem[] = ((liveResult.data ?? []) as any[])
        .filter((entry) => Number(entry.amount_charged) > 0)
        .map((entry) => {
          const session = Array.isArray(entry.session) ? entry.session[0] : entry.session;
          const creator = Array.isArray(session?.creator) ? session.creator[0] : session?.creator;
          const seconds = Number(entry.duration_seconds ?? 0);
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;

          return {
            id: `live-${entry.id}`,
            type: "live",
            creatorId: creator?.id ?? "",
            creatorName: creator?.full_name ?? "Creator",
            creatorUsername: creator?.username ?? "",
            creatorInitials: creator?.avatar_initials ?? "?",
            creatorColor: creator?.avatar_color ?? "bg-violet-600",
            creatorAvatarUrl: creator?.avatar_url ?? undefined,
            amount: Number(entry.amount_charged ?? 0),
            date: entry.ended_at ?? entry.joined_at,
            status: entry.status ?? "completed",
            description: "Live session charge",
            meta: `${mins}m ${secs}s used`,
          };
        });

      const merged = [...bookingItems, ...liveItems].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setPayments(merged);
      setLoading(false);
    }

    loadPayments();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-3 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-[1.65rem] font-serif font-normal text-brand-ink tracking-tight">Payment History</h1>
        <p className="text-brand-ink-subtle mt-1">Every booking and live-session charge tied to your fan account.</p>
        {payments.length > 0 && (
          <p className="mt-2 text-sm text-brand-ink-muted">
            {payments.length} receipt{payments.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-12 text-center">
          <Receipt className="w-12 h-12 text-brand-ink-muted mx-auto mb-4" />
          <p className="text-lg font-semibold text-brand-ink-muted">No payment history yet</p>
          <p className="text-sm text-brand-ink-muted mt-1 mb-6">
            Once you book a call or finish a live session, your charges will show up here.
          </p>
          <Link href="/discover">
            <Button variant="primary" size="md" className="gap-2">
              <Video className="w-4 h-4" />
              Discover Creators
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => {
            const isLive = payment.type === "live";

            return (
              <div
                key={payment.id}
                className="rounded-2xl border border-brand-border bg-brand-surface p-5 hover:border-brand-primary/30 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <Link href={`/profile/${payment.creatorId}`}>
                    <Avatar
                      initials={payment.creatorInitials}
                      color={payment.creatorColor}
                      size="md"
                      imageUrl={payment.creatorAvatarUrl}
                      className="cursor-pointer"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/profile/${payment.creatorId}`}
                          className="font-bold text-brand-ink hover:text-brand-primary-light transition-colors"
                        >
                          {payment.creatorName}
                        </Link>
                        <p className="text-sm text-brand-ink-muted">@{payment.creatorUsername}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-xl font-display font-bold text-brand-ink">{formatCurrency(payment.amount)}</p>
                        <Badge
                          variant="default"
                          className={cn(
                            "mt-2 border",
                            isLive
                              ? "text-brand-live bg-brand-live/10 border-brand-live/20"
                              : "text-brand-primary-light bg-brand-primary/10 border-brand-primary/20"
                          )}
                        >
                          {isLive ? "Live Receipt" : "Booking Charge"}
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-brand-ink-subtle">
                      <span className="flex items-center gap-1">
                        {isLive ? <Radio className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                        {payment.description}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {formatPaymentDate(payment.date)}
                      </span>
                    </div>

                    {payment.meta && (
                      <p className="mt-2 text-sm text-brand-ink-muted">{payment.meta}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
