import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { present } = await request.json();
    if (typeof present !== "boolean") {
      return NextResponse.json({ error: "Presence state is required." }, { status: 400 });
    }

    const { data: booking, error } = await serviceSupabase
      .from("bookings")
      .select("id, creator_id, fan_id, status, creator_joined_at, fan_joined_at")
      .eq("id", params.id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    const isCreator = booking.creator_id === user.id;
    const isFan = booking.fan_id === user.id;
    if (!isCreator && !isFan) {
      return NextResponse.json({ error: "Unauthorized participant." }, { status: 403 });
    }

    const updates = isCreator
      ? {
          creator_present: present,
          creator_joined_at: present && !booking.creator_joined_at ? new Date().toISOString() : undefined,
        }
      : {
          fan_present: present,
          fan_joined_at: present && !booking.fan_joined_at ? new Date().toISOString() : undefined,
        };

    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    const { data: updatedBooking, error: updateError } = await serviceSupabase
      .from("bookings")
      .update(payload)
      .eq("id", params.id)
      .in("status", ["upcoming", "live"])
      .select("*")
      .single();

    if (updateError || !updatedBooking) {
      return NextResponse.json({ error: "Could not update booking presence." }, { status: 400 });
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update booking presence.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
