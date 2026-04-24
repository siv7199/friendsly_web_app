import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const creatorId = url.searchParams.get("creatorId");

    if (!creatorId) {
      return NextResponse.json({ error: "Missing creatorId." }, { status: 400 });
    }

    const { data, error } = await serviceSupabase
      .from("bookings")
      .select("scheduled_at, duration")
      .in("status", ["upcoming", "live"])
      .or(`creator_id.eq.${creatorId},fan_id.eq.${user.id}`);

    if (error) {
      return NextResponse.json({ error: "Could not load booked times." }, { status: 500 });
    }

    return NextResponse.json(
      {
        bookings: (data ?? []).map((booking: any) => ({
          scheduledAt: booking.scheduled_at,
          duration: Number(booking.duration ?? 0),
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load booked times.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
