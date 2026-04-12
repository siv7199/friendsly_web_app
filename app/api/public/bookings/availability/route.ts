import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const creatorId = url.searchParams.get("creatorId");

    if (!creatorId) {
      return NextResponse.json({ error: "Missing creatorId." }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("scheduled_at, duration")
      .eq("creator_id", creatorId)
      .in("status", ["upcoming", "live"]);

    if (error) {
      return NextResponse.json({ error: "Could not load booked times." }, { status: 500 });
    }

    return NextResponse.json({
      bookings: (data ?? []).map((booking: any) => ({
        scheduledAt: booking.scheduled_at,
        duration: Number(booking.duration ?? 0),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load booked times.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
