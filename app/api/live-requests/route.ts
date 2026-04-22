import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, isUuid, readJsonBody, stringField } from "@/lib/server/request-security";

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isDateKey(value: string) {
  return DATE_KEY_REGEX.test(value);
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
    const requestDate = searchParams.get("date");

    if (creatorId) {
      if (!isUuid(creatorId)) {
        return NextResponse.json({ error: "Invalid creator." }, { status: 400 });
      }

      const todayKey = isDateKey(requestDate ?? "") ? requestDate! : new Date().toISOString().slice(0, 10);

      const [{ data: profile }, { data: creatorProfile }, { data: existingRequest }] = await Promise.all([
        serviceSupabase
          .from("profiles")
          .select("id, role")
          .eq("id", user.id)
          .maybeSingle(),
        serviceSupabase
          .from("profiles")
          .select("id, role, creator_profiles(scheduled_live_at, current_live_session_id, is_live, live_join_fee)")
          .eq("id", creatorId)
          .eq("role", "creator")
          .maybeSingle(),
        serviceSupabase
          .from("live_requests")
          .select("id, requested_at")
          .eq("creator_id", creatorId)
          .eq("fan_id", user.id)
          .eq("request_date", todayKey)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const isFan = profile?.role === "fan";
      const creatorDetails = Array.isArray(creatorProfile?.creator_profiles)
        ? creatorProfile?.creator_profiles[0]
        : creatorProfile?.creator_profiles;
      const creatorCanAcceptRequests = Boolean(
        creatorProfile &&
        !creatorDetails?.is_live &&
        !creatorDetails?.current_live_session_id &&
        !creatorDetails?.scheduled_live_at &&
        creatorDetails?.live_join_fee &&
        Number(creatorDetails.live_join_fee) > 0
      );

      return NextResponse.json({
        canRequest: isFan && user.id !== creatorId && creatorCanAcceptRequests,
        hasRequestedToday: Boolean(existingRequest),
        requestedAt: existingRequest?.requested_at ?? null,
      });
    }

    const todayKey = isDateKey(requestDate ?? "") ? requestDate! : new Date().toISOString().slice(0, 10);
    const { data: requests, error } = await serviceSupabase
      .from("live_requests")
      .select(`
        id,
        requested_at,
        fan:profiles!fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)
      `)
      .eq("creator_id", user.id)
      .eq("request_date", todayKey)
      .order("requested_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Could not load live requests." }, { status: 500 });
    }

    const normalizedRequests = (requests ?? []).map((requestRow: any) => {
      const fan = Array.isArray(requestRow.fan) ? requestRow.fan[0] : requestRow.fan;
      return {
        id: requestRow.id,
        requestedAt: requestRow.requested_at,
        fanName: fan?.full_name ?? "Fan",
        fanUsername: fan?.username ? `@${fan.username}` : "@fan",
        fanInitials: fan?.avatar_initials ?? "F",
        fanAvatarColor: fan?.avatar_color ?? "bg-violet-600",
        fanAvatarUrl: fan?.avatar_url ?? undefined,
      };
    });

    return NextResponse.json({
      requests: normalizedRequests,
      requestCount: normalizedRequests.length,
      requestDate: todayKey,
    });
  } catch (error) {
    console.error("live-requests:get", error);
    return NextResponse.json({ error: "Could not load live requests." }, { status: 500 });
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

    const limited = checkRateLimit(request, "live-request-create", {
      key: user.id,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await readJsonBody(request);
    const creatorId = stringField(body, "creatorId", 80);
    const requestDate = stringField(body, "requestDate", 20);

    if (!isUuid(creatorId) || !isDateKey(requestDate)) {
      return NextResponse.json({ error: "Missing live request details." }, { status: 400 });
    }

    if (creatorId === user.id) {
      return NextResponse.json({ error: "You cannot request your own live." }, { status: 400 });
    }

    const [{ data: viewerProfile }, { data: creatorProfile }] = await Promise.all([
      serviceSupabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle(),
      serviceSupabase
        .from("profiles")
        .select("id, role, creator_profiles(scheduled_live_at, current_live_session_id, is_live, live_join_fee)")
        .eq("id", creatorId)
        .eq("role", "creator")
        .maybeSingle(),
    ]);

    if (viewerProfile?.role !== "fan") {
      return NextResponse.json({ error: "Only fans can request a live." }, { status: 403 });
    }

    const creatorDetails = Array.isArray(creatorProfile?.creator_profiles)
      ? creatorProfile?.creator_profiles[0]
      : creatorProfile?.creator_profiles;

    if (!creatorProfile) {
      return NextResponse.json({ error: "Creator not found." }, { status: 404 });
    }

    if (creatorDetails?.is_live || creatorDetails?.current_live_session_id) {
      return NextResponse.json({ error: "This creator is already live." }, { status: 400 });
    }

    if (creatorDetails?.scheduled_live_at) {
      return NextResponse.json({ error: "A live has already been scheduled." }, { status: 400 });
    }

    if (!creatorDetails?.live_join_fee || Number(creatorDetails.live_join_fee) <= 0) {
      return NextResponse.json({ error: "This creator is not accepting live requests right now." }, { status: 400 });
    }

    const { data: existingRequest } = await serviceSupabase
      .from("live_requests")
      .select("id, requested_at")
      .eq("creator_id", creatorId)
      .eq("fan_id", user.id)
      .eq("request_date", requestDate)
      .limit(1)
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json({
        created: false,
        alreadyRequested: true,
        requestedAt: existingRequest.requested_at,
      });
    }

    const { data: insertedRequest, error } = await serviceSupabase
      .from("live_requests")
      .insert({
        creator_id: creatorId,
        fan_id: user.id,
        request_date: requestDate,
      })
      .select("id, requested_at")
      .single();

    if (error || !insertedRequest) {
      return NextResponse.json({ error: "Could not save live request." }, { status: 500 });
    }

    return NextResponse.json({
      created: true,
      alreadyRequested: false,
      requestedAt: insertedRequest.requested_at,
    });
  } catch (error) {
    console.error("live-requests:post", error);
    return NextResponse.json({ error: "Could not send live request." }, { status: 500 });
  }
}
