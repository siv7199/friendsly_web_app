import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { deriveBookingStatus } from "@/lib/bookings";
import { checkRateLimit, isUuid, numberField, readJsonBody, stringField } from "@/lib/server/request-security";

async function getEligibleReviewBooking(serviceSupabase: ReturnType<typeof createServiceClient>, fanId: string, creatorId: string) {
  const { data: bookings, error: bookingError } = await serviceSupabase
    .from("bookings")
    .select("id, status, scheduled_at, duration, creator_present, fan_present")
    .eq("creator_id", creatorId)
    .eq("fan_id", fanId)
    .order("scheduled_at", { ascending: false });

  if (bookingError) {
    throw new Error("Could not verify review eligibility.");
  }

  const bookingIds = (bookings ?? []).map((booking: any) => booking.id);
  const { data: existingReviews } = bookingIds.length > 0
    ? await serviceSupabase
        .from("reviews")
        .select("booking_id")
        .in("booking_id", bookingIds)
    : { data: [] as any[] };
  const reviewedBookingIds = new Set((existingReviews ?? []).map((review: any) => review.booking_id));

  const now = new Date();
  return (bookings ?? []).find((booking: any) => {
    const nextStatus = deriveBookingStatus(
      booking.status,
      booking.scheduled_at,
      booking.duration,
      now,
      booking.creator_present,
      booking.fan_present
    );
    return nextStatus === "completed" && !reviewedBookingIds.has(booking.id);
  }) ?? null;
}

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

    const { searchParams } = new URL(request.url);
    const creatorId = searchParams.get("creatorId");

    if (!creatorId || !isUuid(creatorId)) {
      return NextResponse.json({ error: "Creator id is required." }, { status: 400 });
    }

    const eligibleBooking = await getEligibleReviewBooking(serviceSupabase, user.id, creatorId);
    return NextResponse.json({ canReview: Boolean(eligibleBooking), bookingId: eligibleBooking?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify review eligibility.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const serviceSupabase = createServiceClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = checkRateLimit(request, "reviews-create", {
      key: user.id,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const creatorId = stringField(body, "creatorId", 80);
    const nextRating = numberField(body, "rating");
    const nextComment = stringField(body, "comment", 1000);

    if (!isUuid(creatorId) || !nextRating || nextRating < 1 || nextRating > 5 || !nextComment) {
      return NextResponse.json({ error: "Invalid review details." }, { status: 400 });
    }

    const eligibleBooking = await getEligibleReviewBooking(serviceSupabase, user.id, creatorId);

    if (!eligibleBooking) {
      return NextResponse.json({ error: "You can only review after a completed booking, once per booking." }, { status: 400 });
    }

    const { data: review, error: reviewError } = await serviceSupabase
      .from("reviews")
      .insert({
        booking_id: eligibleBooking.id,
        creator_id: creatorId,
        fan_id: user.id,
        rating: nextRating,
        comment: nextComment,
      })
      .select("id, rating, comment, created_at")
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: "Could not save review." }, { status: 400 });
    }

    return NextResponse.json({ review });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save review.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
