"use client";

/**
 * Mobile fan live queue page.
 * Data-fetching is identical to app/(fan)/waiting-room/[id]/page.tsx.
 * Renders MobilePublicLiveRoom instead of the desktop layout.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { LiveJoinModal } from "@/components/fan/LiveJoinModal";
import { MobilePublicLiveRoom } from "@/components/mobile/MobileLiveStage";
import { readJsonResponse } from "@/lib/http";
import { LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds, getLiveStageRemainingSeconds } from "@/lib/live";
import { getCreatorProfilePath, isUuidLike, parseLiveRouteParam } from "@/lib/routes";
import type { QueueEntry } from "@/types";

type CreatorState = {
  id: string;
  name: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  avatarUrl?: string;
  liveJoinFee?: number;
};

type ActiveFanState = {
  fanId: string;
  fanName: string;
  avatarInitials: string;
  avatarColor: string;
  avatarUrl?: string;
  admittedDailySessionId?: string;
};

function mapQueueProfile(entry: any, fallbackName: string) {
  const fan = entry?.fan;
  return {
    fanId: entry.fan_id,
    fanName: fan?.full_name ?? fallbackName,
    avatarInitials: fan?.avatar_initials ?? "F",
    avatarColor: fan?.avatar_color ?? "bg-brand-primary",
    avatarUrl: fan?.avatar_url ?? undefined,
    admittedDailySessionId: entry.admitted_daily_session_id ?? undefined,
  };
}

export default function MobileWaitingRoomPage({ params }: { params: { id: string } }) {
  const { user } = useAuthContext();
  const routeTarget = useMemo(() => parseLiveRouteParam(params.id), [params.id]);
  const [creatorState, setCreatorState] = useState<CreatorState | null>(null);
  const [creatorMissing, setCreatorMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [activeFanAdmittedAt, setActiveFanAdmittedAt] = useState<string | null>(null);
  const [activeFan, setActiveFan] = useState<ActiveFanState | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [reportedDailySessionId, setReportedDailySessionId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const waitingEntryIdRef = useRef<string | null>(null);
  const activeEntryIdRef = useRef<string | null>(null);

  const loadLiveState = useCallback(async () => {
    try {
      setLoadError(null);
      const supabase = createClient();
      const creatorLookupColumn = isUuidLike(routeTarget.creatorRef) ? "id" : "username";

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_initials, avatar_color, avatar_url, creator_profiles(live_join_fee)")
        .eq(creatorLookupColumn, creatorLookupColumn === "username" ? routeTarget.creatorRef.toLowerCase() : routeTarget.creatorRef)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profile) {
        const creatorProfile = Array.isArray((profile as any).creator_profiles)
          ? (profile as any).creator_profiles[0]
          : (profile as any).creator_profiles;

        setCreatorState({
          id: profile.id,
          name: profile.full_name,
          username: `@${profile.username}`,
          avatarInitials: profile.avatar_initials,
          avatarColor: profile.avatar_color,
          avatarUrl: profile.avatar_url ? `/api/public/avatar/${profile.id}` : undefined,
          liveJoinFee: creatorProfile?.live_join_fee != null
            ? Number(creatorProfile.live_join_fee)
            : undefined,
        });
        setCreatorMissing(false);
      }

      if (!profile) {
        setCreatorState(null);
        setCreatorMissing(true);
        setLiveSessionId(null);
        setRoomUrl(null);
        setToken(null);
        setQueue([]);
        setActiveFanAdmittedAt(null);
        setActiveFan(null);
        setSessionEnded(false);
        setLoading(false);
        return;
      }

      const sessionQuery = supabase
        .from("live_sessions")
        .select("id, daily_room_url")
        .eq("creator_id", profile.id)
        .eq("is_active", true);

      const { data: session, error: sessionError } = routeTarget.sessionId
        ? await sessionQuery.eq("id", routeTarget.sessionId).maybeSingle()
        : await sessionQuery.order("started_at", { ascending: false }).limit(1).maybeSingle();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        if (liveSessionId) setSessionEnded(true);
        setLiveSessionId(null);
        setRoomUrl(null);
        setQueue([]);
        setActiveFanAdmittedAt(null);
        setActiveFan(null);
        setLoading(false);
        return;
      }

      setSessionEnded(false);
      setLiveSessionId(session.id);
      setRoomUrl(session.daily_room_url ?? null);

      const { data: entries, error: entriesError } = await supabase
        .from("live_queue_entries")
        .select(`
          id, fan_id, topic, joined_at, admitted_at, admitted_daily_session_id, status,
          fan:profiles!fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)
        `)
        .eq("session_id", session.id)
        .in("status", ["waiting", "active"])
        .order("joined_at", { ascending: true });

      if (entriesError) {
        throw entriesError;
      }

      const activeEntry = (entries ?? []).find((e: any) => e.status === "active");
      setActiveFanAdmittedAt(activeEntry?.admitted_at ?? null);
      setActiveFan(activeEntry ? mapQueueProfile(activeEntry, "Current Fan") : null);

      const waitingEntries = (entries ?? []).filter((e: any) => e.status === "waiting");
      const activeRemainingSeconds =
        getLiveStageRemainingSeconds(activeEntry?.admitted_at, Date.now()) || LIVE_STAGE_SECONDS;

      const nextQueue: QueueEntry[] = (entries ?? []).map((entry: any) => {
        const position = waitingEntries.findIndex((c: any) => c.id === entry.id) + 1;
        return {
          id: entry.id,
          fanId: entry.fan_id,
          fanName: entry.fan?.full_name ?? "Fan",
          fanUsername: entry.fan?.username ? `@${entry.fan.username}` : "@fan",
          avatarInitials: entry.fan?.avatar_initials ?? "F",
          avatarColor: entry.fan?.avatar_color ?? "bg-brand-primary",
          avatarUrl: entry.fan?.avatar_url ?? undefined,
          position: position > 0 ? position : 0,
          waitTime: "",
          waitSeconds: position > 0 ? activeRemainingSeconds + (position - 1) * LIVE_STAGE_SECONDS : 0,
          topic: entry.topic ?? undefined,
          joinedAt: entry.joined_at,
          admittedAt: entry.admitted_at ?? undefined,
          status: entry.status,
        };
      });

      setQueue(nextQueue);
      setLoading(false);
    } catch (error) {
      console.error("Failed to load mobile live waiting room", error);
      setLoadError("We couldn't load this live room right now. Please try again.");
      setLoading(false);
    }
  }, [liveSessionId, routeTarget.creatorRef, routeTarget.sessionId]);

  useEffect(() => { void loadLiveState(); }, [loadLiveState]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const myWaitingEntry = useMemo(
    () => queue.find((e) => e.status === "waiting" && user && e.fanId === user.id),
    [queue, user]
  );

  const myActiveEntry = useMemo(
    () => queue.find((e) => e.status === "active" && user && e.fanId === user.id),
    [queue, user]
  );

  useEffect(() => {
    waitingEntryIdRef.current = myWaitingEntry?.id ?? null;
    activeEntryIdRef.current = myActiveEntry?.id ?? null;
  }, [myActiveEntry?.id, myWaitingEntry?.id]);

  useEffect(() => {
    if (!liveSessionId || !roomUrl || !user) { setToken(null); return; }
    fetch("/api/daily/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: roomUrl.split("/").pop(), isOwner: false, userName: user.id }),
    })
      .then((r) => readJsonResponse<{ token?: string }>(r))
      .then((d) => setToken(d?.token ?? null))
      .catch(() => setToken(null));
  }, [liveSessionId, roomUrl, user, Boolean(myActiveEntry)]);

  useEffect(() => {
    const supabase = createClient();
    if (!creatorState?.id) return;
    let channel = supabase
      .channel(`public-live:${creatorState.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "creator_profiles", filter: `id=eq.${creatorState.id}` }, () => { void loadLiveState(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: `creator_id=eq.${creatorState.id}` }, () => { void loadLiveState(); });

    if (liveSessionId) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_queue_entries", filter: `session_id=eq.${liveSessionId}` },
        () => { void loadLiveState(); }
      );
    }

    channel = channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [creatorState?.id, liveSessionId, loadLiveState]);

  useEffect(() => { setReportedDailySessionId(null); }, [myActiveEntry?.id]);

  const reportActiveJoin = useCallback(async (dailySessionId: string) => {
    if (!liveSessionId || !myActiveEntry || reportedDailySessionId === dailySessionId) return;
    try {
      const response = await fetch("/api/live/mark-active-joined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: liveSessionId, dailySessionId }),
      });
      const data = await readJsonResponse<{ admittedAt?: string }>(response);
      if (response.ok) {
        setReportedDailySessionId(dailySessionId);
        if (data?.admittedAt) setActiveFanAdmittedAt(data.admittedAt);
      }
    } catch {}
  }, [liveSessionId, myActiveEntry, reportedDailySessionId]);

  const leaveWaitingQueue = useCallback(async (queueEntryId: string) => {
    await fetch("/api/live/leave-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueEntryId }),
    });
  }, []);

  const leaveActiveStage = useCallback(async (queueEntryId: string) => {
    await fetch("/api/live/leave-stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueEntryId }),
    });
  }, []);

  useEffect(() => {
    function sendExitBeacon() {
      const activeQueueEntryId = activeEntryIdRef.current;
      const waitingQueueEntryId = waitingEntryIdRef.current;
      const queueEntryId = waitingQueueEntryId ?? activeQueueEntryId;
      const endpoint = waitingQueueEntryId ? "/api/live/leave-queue" : activeQueueEntryId ? "/api/live/leave-stage" : null;

      if (!queueEntryId || !endpoint) return;

      const payload = new Blob([JSON.stringify({ queueEntryId })], { type: "application/json" });
      navigator.sendBeacon(endpoint, payload);
    }

    window.addEventListener("pagehide", sendExitBeacon);
    window.addEventListener("beforeunload", sendExitBeacon);
    return () => {
      window.removeEventListener("pagehide", sendExitBeacon);
      window.removeEventListener("beforeunload", sendExitBeacon);
      sendExitBeacon();
    };
  }, []);

  const stageElapsedSeconds = getLiveStageElapsedSeconds(activeFanAdmittedAt, currentTime);
  const waitingQueue = queue.filter((e) => e.status === "waiting");
  const myQueuePosition = myWaitingEntry?.position ?? 0;

  // queue entries for the avatar row (all waiting fans)
  const queueEntries = waitingQueue
    .filter((e) => Boolean(e.fanId))
    .map((e) => ({
      id: e.id,
      fanId: e.fanId as string,
      fanName: e.fanName,
      avatarInitials: e.avatarInitials,
      avatarColor: e.avatarColor,
      avatarUrl: e.avatarUrl,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-violet-500">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-violet-500 px-6 text-center">
        <p className="text-white text-2xl font-brand">friendsly</p>
        <p className="text-base font-semibold text-white">Live room unavailable</p>
        <p className="max-w-sm text-sm text-white/70">{loadError}</p>
        <button
          onClick={() => { setLoading(true); void loadLiveState(); }}
          className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-violet-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (creatorMissing || !creatorState) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-violet-500 px-6 text-center">
        <p className="text-white text-2xl font-brand">friendsly</p>
        <p className="text-base font-semibold text-white">Creator not found</p>
        <p className="max-w-sm text-sm text-white/70">
          This live link may be invalid, or the creator profile is no longer available.
        </p>
        <a href="/discover" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-violet-600">
          Browse creators
        </a>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-violet-500 px-6 text-center gap-6">
        <p className="text-white text-2xl font-brand">friendsly</p>
        <div>
          <h1 className="text-white text-2xl font-bold mb-2">
            {creatorState.name}&apos;s live has ended
          </h1>
          <p className="text-white/60 text-sm">
            Any holds for fans who were never admitted are released automatically.
          </p>
        </div>
        <a
          href={getCreatorProfilePath({ id: creatorState.id, username: creatorState.username })}
          className="w-full max-w-xs bg-white text-violet-600 font-bold py-3 rounded-full text-center block"
        >
          Back to Profile
        </a>
      </div>
    );
  }

  // No live session yet — waiting state
  if (!roomUrl || !token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-violet-500 px-6 text-center gap-4">
        <p className="text-white text-2xl font-brand">friendsly</p>
        <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
        <p className="text-white/70 text-sm">
          Waiting for {creatorState.name} to go live…
        </p>
        <p className="text-white/40 text-xs">This page updates automatically.</p>
      </div>
    );
  }

  return (
    <>
      <MobilePublicLiveRoom
        roomUrl={roomUrl}
        token={token}
        creatorId={creatorState.id}
        creatorName={creatorState.name}
        creatorInitials={creatorState.avatarInitials}
        creatorColor={creatorState.avatarColor}
        creatorAvatarUrl={creatorState.avatarUrl}
        viewerInitials={user?.avatar_initials ?? "YO"}
        viewerColor={user?.avatar_color ?? "bg-brand-primary"}
        viewerAvatarUrl={user?.avatar_url ?? undefined}
        activeFan={myActiveEntry ? null : activeFan}
        isAdmitted={Boolean(myActiveEntry)}
        stageElapsedSeconds={stageElapsedSeconds}
        queueCount={waitingQueue.length}
        queueEntries={queueEntries}
        myQueuePosition={myQueuePosition}
        inQueue={Boolean(myWaitingEntry)}
        sessionId={liveSessionId}
        onJoinQueue={() => setShowJoinModal(true)}
        onLeaveQueue={async () => {
          if (!myWaitingEntry?.id) return;
          await leaveWaitingQueue(myWaitingEntry.id);
        }}
        onLeaveStage={async () => {
          if (!myActiveEntry?.id) return;
          await leaveActiveStage(myActiveEntry.id);
        }}
        onExit={async () => {
          if (myWaitingEntry?.id) {
            await leaveWaitingQueue(myWaitingEntry.id);
          } else if (myActiveEntry?.id) {
            await leaveActiveStage(myActiveEntry.id);
          }
          window.location.assign(
            getCreatorProfilePath({ id: creatorState.id, username: creatorState.username })
          );
        }}
        onStageSessionReady={reportActiveJoin}
      />

      {creatorState.liveJoinFee ? (
        <LiveJoinModal
          creator={{
            id: creatorState.id,
            name: creatorState.name,
            username: creatorState.username,
            bio: "",
            category: "",
            tags: [],
            followers: "",
            rating: 0,
            reviewCount: 0,
            avatarInitials: creatorState.avatarInitials,
            avatarColor: creatorState.avatarColor,
            avatarUrl: creatorState.avatarUrl,
            isLive: true,
            currentLiveSessionId: liveSessionId ?? undefined,
            queueCount: waitingQueue.length,
            callPrice: 0,
            callDuration: 0,
            nextAvailable: "",
            totalCalls: 0,
            responseTime: "",
            liveJoinFee: creatorState.liveJoinFee,
          }}
          open={showJoinModal}
          onClose={() => setShowJoinModal(false)}
        />
      ) : null}
    </>
  );
}
