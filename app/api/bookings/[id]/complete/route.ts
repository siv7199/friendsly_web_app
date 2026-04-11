import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
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

    const { data: booking, error } = await serviceSupabase
      .from("bookings")
      .select("id, creator_id")
      .eq("id", params.id)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.creator_id !== user.id) {
      return NextResponse.json({ error: "Only the creator can end this booking." }, { status: 403 });
    }

    const { data: updatedBooking, error: updateError } = await serviceSupabase
      .from("bookings")
      .update({ status: "completed", creator_present: false, fan_present: false })
      .eq("id", params.id)
      .select("*")
      .single();

    if (updateError || !updatedBooking) {
      return NextResponse.json({ error: "Could not complete booking." }, { status: 400 });
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not complete booking.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
