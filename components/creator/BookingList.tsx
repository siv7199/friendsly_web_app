import { Star, Clock, Calendar } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Booking } from "@/types";
import { formatCurrency, formatDate, statusColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface BookingListProps {
  bookings: Booking[];
  title?: string;
}

export function BookingList({ bookings, title }: BookingListProps) {
  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
      {title && (
        <div className="px-5 py-4 border-b border-brand-border">
          <h3 className="font-semibold text-slate-100">{title}</h3>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-slate-500 text-sm">No bookings yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-brand-border">
          {bookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  // Generate initials from fan name
  const initials = booking.fanName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // Pick a deterministic color for the fan avatar
  const colors = [
    "bg-violet-500", "bg-sky-500", "bg-pink-500",
    "bg-emerald-500", "bg-amber-500", "bg-rose-500",
  ];
  const color = colors[booking.id.charCodeAt(1) % colors.length];

  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-brand-elevated/50 transition-colors">
      <Avatar initials={initials} color={color} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-100 truncate">{booking.fanName}</p>
          {booking.rating && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: booking.rating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-brand-gold text-brand-gold" />
              ))}
            </div>
          )}
        </div>
        {booking.topic && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{booking.topic}</p>
        )}
      </div>

      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(booking.date)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          <span>{booking.time} · {booking.duration} min</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="text-sm font-bold text-slate-100">{formatCurrency(booking.price)}</span>
        <span
          className={cn(
            "text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize",
            statusColor(booking.status)
          )}
        >
          {booking.status}
        </span>
      </div>
    </div>
  );
}
