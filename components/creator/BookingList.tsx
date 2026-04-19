import { Star, Clock, Calendar, XCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Booking } from "@/types";
import { formatCurrency, formatDate, statusColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { isBookingJoinable } from "@/lib/bookings";

interface BookingListProps {
  bookings: Booking[];
  title?: string;
  onClickJoin?: (booking: Booking) => void;
  onClickCancel?: (booking: Booking) => void;
  cancellingId?: string | null;
}

export function BookingList({ bookings, title, onClickJoin, onClickCancel, cancellingId }: BookingListProps) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
      {title && (
        <div className="px-5 py-4 border-b border-brand-border">
          <h3 className="font-semibold text-brand-ink">{title}</h3>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-brand-ink-subtle text-sm">No bookings yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-brand-border">
          {bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              onClickJoin={onClickJoin ? () => onClickJoin(booking) : undefined}
              onClickCancel={onClickCancel ? () => onClickCancel(booking) : undefined}
              cancelling={cancellingId === booking.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  onClickJoin,
  onClickCancel,
  cancelling,
}: {
  booking: Booking;
  onClickJoin?: () => void;
  onClickCancel?: () => void;
  cancelling?: boolean;
}) {
  const initials = booking.fanInitials || booking.fanName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const color = booking.fanAvatarColor || "bg-violet-500";
  const router = useRouter();

  const bookingStart = new Date(`${booking.date} ${booking.time}`);
  const isJoinable = isBookingJoinable(booking.status, bookingStart, booking.duration);
  const canCancel = booking.status === "upcoming";

  function handleJoin() {
    router.push(`/room/${booking.id}`);
  }

  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-brand-elevated/50 transition-colors">
      <Avatar initials={initials} color={color} imageUrl={booking.fanAvatarUrl} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-brand-ink truncate">{booking.fanName}</p>
          {booking.rating && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: booking.rating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-brand-gold text-brand-gold" />
              ))}
            </div>
          )}
        </div>
        {booking.topic && (
          <p className="text-xs text-brand-ink-subtle truncate mt-0.5">{booking.topic}</p>
        )}
      </div>

      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-brand-ink-subtle">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(booking.date)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-brand-ink-subtle">
          <Clock className="w-3 h-3" />
          <span>{booking.time} · {booking.duration} min</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-sm font-bold text-brand-ink">{formatCurrency(booking.price)}</span>
        <span
          className={cn(
            "text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize",
            statusColor(booking.status)
          )}
        >
          {booking.status}
        </span>
        {canCancel && onClickCancel && (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-7 text-[10px] gap-1 px-3 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40"
            onClick={onClickCancel}
            disabled={cancelling}
          >
            <XCircle className="w-3 h-3" />
            {cancelling ? "CANCELLING..." : "CANCEL"}
          </Button>
        )}
        {isJoinable && (
          <Button
            variant="live"
            size="sm"
            className="mt-1 h-7 text-[10px] gap-1 px-3 shadow-glow-live"
            onClick={onClickJoin || handleJoin}
          >
            <Video className="w-3 h-3" />
            START SESSION
          </Button>
        )}
      </div>
    </div>
  );
}
