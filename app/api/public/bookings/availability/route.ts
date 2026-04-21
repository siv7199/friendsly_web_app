import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const AVAILABILITY_CACHE_CONTROL = "public, max-age=15, s-maxage=15, stale-while-revalidate=30";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const creatorId = url.searchParams.get("creatorId");

    if (!creatorId) {
      return NextResponse.json(
        { error: "Missing creatorId." },
        { status: 400, headers: { "Cache-Control": AVAILABILITY_CACHE_CONTROL } }
      );
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("scheduled_at, duration")
      .eq("creator_id", creatorId)
      .in("status", ["upcoming", "live"]);

    if (error) {
      return NextResponse.json(
        { error: "Could not load booked times." },
        { status: 500, headers: { "Cache-Control": AVAILABILITY_CACHE_CONTROL } }
      );
    }

    return NextResponse.json(
      {
        bookings: (data ?? []).map((booking: any) => ({
          scheduledAt: booking.scheduled_at,
          duration: Number(booking.duration ?? 0),
        })),
      },
      { headers: { "Cache-Control": AVAILABILITY_CACHE_CONTROL } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load booked times.";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": AVAILABILITY_CACHE_CONTROL } }
    );
  }
}
