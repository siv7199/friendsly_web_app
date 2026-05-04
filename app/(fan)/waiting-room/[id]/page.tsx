"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Home, Loader2, MessageSquare } from "lucide-react";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { WaitingRoom } from "@/components/fan/WaitingRoom";
import { PublicLiveRoom } from "@/components/fan/PublicLiveRoom";
import { LiveJoinModal } from "@/components/fan/LiveJoinModal";
import { PostLiveCallModal } from "@/components/fan/PostLiveCallModal";
import type { QueueEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { readJsonResponse } from "@/lib/http";
import { LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds, getLiveStageRemainingSeconds } from "@/lib/live";
import { getCreatorProfilePath, parseLiveRouteParam, isUuidLike } from "@/lib/routes";

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

function MobileLiveChatSheet({
  creatorName,
  queueCount,
  children,
}: {
  creatorName: string;
  queueCount: number;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const movedDuringDragRef = useRef(false);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    startYRef.current = event.clientY;
    draggingRef.current = true;
    movedDuringDragRef.current = false;
    setDragOffset(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || startYRef.current == null) return;
    const delta = event.clientY - startYRef.current;
    if (Math.abs(delta) > 4) movedDuringDragRef.current = true;
    setDragOffset(isOpen ? Math.max(0, delta) : Math.min(0, delta));
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const startY = startYRef.current;
    draggingRef.current = false;
    startYRef.current = null;

    if (startY != null) {
      const delta = event.clientY - startY;
      if (!isOpen && delta < -36) setIsOpen(true);
      if (isOpen && delta > 48) setIsOpen(false);
    }

    setDragOffset(0);
  }

  const closedOffsetExpression = dragOffset >= 0 ? `+ ${dragOffset}px` : `- ${Math.abs(dragOffset)}px`;
  const transform = isOpen
    ? `translateY(${dragOffset}px)`
    : `translateY(calc(100% - 68px ${closedOffsetExpression}))`;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 h-[min(72dvh,620px)] px-3 pb-3 lg:hidden"
      style={{
        transform,
        paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
        transition: draggingRef.current ? "none" : "transform 180ms ease-out",
      }}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-t-[24px] border border-brand-dark-border/70 bg-brand-dark-surface shadow-[0_-18px_44px_rgba(16,8,26,0.28)]">
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={() => {
            if (movedDuringDragRef.current) {
              movedDuringDragRef.current = false;
              return;
            }
            setIsOpen((current) => !current);
          }}
          className="flex h-[68px] shrink-0 touch-none items-center justify-between gap-3 border-b border-brand-dark-border/60 px-4 text-left text-white"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse live chat" : "Open live chat"}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
              <MessageSquare className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">Live chat</span>
              <span className="block truncate text-xs text-white/50">
                {queueCount > 0 ? `${queueCount} waiting for ${creatorName}` : `Watching ${creatorName}`}
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/55">
            <span className="h-1.5 w-10 rounded-full bg-white/25" />
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </span>
        </button>
        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function WaitingRoomPage({ params }: { params: { id: string } }) {
  const router = useRouter();
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
  const [showPostCallModal, setShowPostCallModal] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [reportedDailySessionId, setReportedDailySessionId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const waitingEntryIdRef = useRef<string | null>(null);
  const activeEntryIdRef = useRef<string | null>(null);
  const previousActiveEntryIdRef = useRef<string | null>(null);
  const finalizedReceiptEntryIdRef = useRef<string | null>(null);
  const hasSeenActiveSessionRef = useRef(false);

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
        let endedDetected = hasSeenActiveSessionRef.current;

        if (!endedDetected && routeTarget.sessionId) {
          const { data: targetedSession } = await supabase
            .from("live_sessions")
            .select("id, is_active")
            .eq("id", routeTarget.sessionId)
            .maybeSingle();
          if (targetedSession && targetedSession.is_active === false) {
            endedDetected = true;
          }
        }

        if (endedDetected) setSessionEnded(true);
        setLiveSessionId(null);
        setRoomUrl(null);
        setQueue([]);
        setActiveFanAdmittedAt(null);
        setActiveFan(null);
        setLoading(false);
        return;
      }

      hasSeenActiveSessionRef.current = true;
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

      const activeEntry = (entries ?? []).find((entry: any) => entry.status === "active");
      setActiveFanAdmittedAt(activeEntry?.admitted_at ?? null);
      setActiveFan(
        activeEntry
          ? mapQueueProfile(activeEntry, "Current Fan")
          : null
      );

      const waitingEntries = (entries ?? []).filter((entry: any) => entry.status === "waiting");
      const activeRemainingSeconds = getLiveStageRemainingSeconds(activeEntry?.admitted_at, Date.now()) || LIVE_STAGE_SECONDS;

      const nextQueue: QueueEntry[] = (entries ?? []).map((entry: any) => {
        const position = waitingEntries.findIndex((candidate: any) => candidate.id === entry.id) + 1;
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
          waitSeconds: position > 0 ? activeRemainingSeconds + ((position - 1) * LIVE_STAGE_SECONDS) : 0,
          topic: entry.topic ?? undefined,
          joinedAt: entry.joined_at,
          admittedAt: entry.admitted_at ?? undefined,
          status: entry.status,
        };
      });

      setQueue(nextQueue);

      const hasOpenEntryForCurrentUser = Boolean(
        user?.id && (entries ?? []).some((entry: any) => entry.fan_id === user.id)
      );
      if (user?.id && !hasOpenEntryForCurrentUser) {
        const { data: finalizedEntry } = await supabase
          .from("live_queue_entries")
          .select("id, ended_at")
          .eq("session_id", session.id)
          .eq("fan_id", user.id)
          .in("status", ["completed", "skipped"])
          .not("ended_at", "is", null)
          .order("ended_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const endedAtMs = finalizedEntry?.ended_at ? new Date(finalizedEntry.ended_at).getTime() : 0;
        const finalizedRecently = endedAtMs > 0 && Date.now() - endedAtMs <= 10 * 60 * 1000;
        if (
          finalizedEntry?.id &&
          finalizedRecently &&
          finalizedReceiptEntryIdRef.current !== finalizedEntry.id
        ) {
          finalizedReceiptEntryIdRef.current = finalizedEntry.id;
          setShowPostCallModal(true);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to load live waiting room", error);
      setLoadError("We couldn't load this live room right now. Please try again.");
      setLoading(false);
    }
  }, [routeTarget.creatorRef, routeTarget.sessionId, user?.id]);

  useEffect(() => {
    void loadLiveState();
  }, [loadLiveState]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const myWaitingEntry = useMemo(
    () => queue.find((entry) => entry.status === "waiting" && user && entry.fanId === user.id),
    [queue, user]
  );

  const myActiveEntry = useMemo(
    () => queue.find((entry) => entry.status === "active" && user && entry.fanId === user.id),
    [queue, user]
  );

  useEffect(() => {
    waitingEntryIdRef.current = myWaitingEntry?.id ?? null;
    activeEntryIdRef.current = myActiveEntry?.id ?? null;
  }, [myActiveEntry?.id, myWaitingEntry?.id]);

  useEffect(() => {
    const previousActiveEntryId = previousActiveEntryIdRef.current;
    const currentActiveEntryId = myActiveEntry?.id ?? null;

    if (previousActiveEntryId && !currentActiveEntryId && !sessionEnded) {
      setShowPostCallModal(true);
    }

    previousActiveEntryIdRef.current = currentActiveEntryId;
  }, [myActiveEntry?.id, sessionEnded]);

  useEffect(() => {
    if (!liveSessionId || !roomUrl || !user) {
      setToken(null);
      return;
    }

    fetch("/api/daily/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomName: roomUrl.split("/").pop(),
        isOwner: false,
        userName: user.id,
      }),
    })
      .then((response) => readJsonResponse<{ token?: string }>(response))
      .then((data) => setToken(data?.token ?? null))
      .catch(() => setToken(null));
  }, [liveSessionId, roomUrl, user, Boolean(myActiveEntry)]);

  useEffect(() => {
    const supabase = createClient();
    if (!creatorState?.id) return;
    let channel = supabase
      .channel(`public-live:${creatorState.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "creator_profiles", filter: `id=eq.${creatorState.id}` }, () => { void loadLiveState(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: `creator_id=eq.${creatorState.id}` }, (payload: any) => {
        const nextRow = payload?.new;
        if (nextRow && nextRow.is_active === false) {
          setSessionEnded(true);
        }
        void loadLiveState();
      });

    if (liveSessionId) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_queue_entries", filter: `session_id=eq.${liveSessionId}` },
        () => { void loadLiveState(); }
      );
    }

    channel = channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [creatorState?.id, liveSessionId, loadLiveState]);

  useEffect(() => {
    setReportedDailySessionId(null);
  }, [myActiveEntry?.id]);

  const reportActiveJoin = useCallback(async (dailySessionId: string) => {
    if (!liveSessionId || !myActiveEntry || reportedDailySessionId === dailySessionId) return;

    try {
      const response = await fetch("/api/live/mark-active-joined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: liveSessionId,
          dailySessionId,
        }),
      });
      const data = await readJsonResponse<{ admittedAt?: string }>(response);
      if (response.ok) {
        setReportedDailySessionId(dailySessionId);
        if (data?.admittedAt) {
          setActiveFanAdmittedAt(data.admittedAt);
        }
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
  const waitingQueue = queue.filter((entry) => entry.status === "waiting");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-brand-ink">Live room unavailable</p>
        <p className="max-w-md text-sm text-brand-ink-subtle">{loadError}</p>
        <Button onClick={() => { setLoading(true); void loadLiveState(); }} variant="primary">
          Try Again
        </Button>
      </div>
    );
  }

  if (creatorMissing || !creatorState) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-brand-ink">Creator not found</p>
        <p className="max-w-md text-sm text-brand-ink-subtle">
          This live link may be invalid, or the creator profile is no longer available.
        </p>
        <Link href="/discover">
          <Button variant="outline">Browse creators</Button>
        </Link>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-2rem)] space-y-6 text-center px-6">
        <div className="w-20 h-20 rounded-full bg-brand-primary/25 flex items-center justify-center mb-2">
          <CheckCircle2 className="w-10 h-10 text-brand-primary-light" />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-normal text-white mb-2">
            {creatorState.name}&apos;s live has ended
          </h1>
          <p className="text-white/60 max-w-sm mx-auto">
            Any holds for fans who were never admitted are released automatically.
          </p>
        </div>
        <div className="flex flex-col w-full max-w-xs gap-3">
          <Link href={getCreatorProfilePath({ id: creatorState.id, username: creatorState.username })}>
            <Button className="w-full h-12 text-base font-bold shadow-glow-primary" variant="primary">
              Back to Profile
            </Button>
          </Link>
          <Link href="/discover">
            <Button className="w-full h-12 text-base font-bold border-white/20 text-white/80 hover:bg-white/10" variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Discover Creators
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-[1320px] flex-col gap-2 overflow-hidden px-3 py-3 md:gap-4 md:px-6 md:py-5">
        <Link href={getCreatorProfilePath({ id: creatorState.id, username: creatorState.username })} className="inline-flex items-center gap-2 text-sm text-brand-ink-subtle hover:text-brand-ink transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
          Back to {creatorState.name}&apos;s profile
        </Link>

        <div className="grid flex-1 min-h-0 gap-3 lg:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="min-h-0">
            {roomUrl && token ? (
              <PublicLiveRoom
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
                isAdmitted={Boolean(myActiveEntry)}
                stageElapsedSeconds={stageElapsedSeconds}
                onJoinQueue={() => setShowJoinModal(true)}
                onLeaveQueue={async () => {
                  if (!myWaitingEntry?.id) return;
                  await leaveWaitingQueue(myWaitingEntry.id);
                }}
                onLeaveStage={async () => {
                  if (!myActiveEntry?.id) return;
                  await leaveActiveStage(myActiveEntry.id);
                }}
                joinDisabled={Boolean(myWaitingEntry || myActiveEntry)}
                isQueued={Boolean(myWaitingEntry)}
                queueCount={waitingQueue.length}
                queuePreview={waitingQueue}
                onStageSessionReady={reportActiveJoin}
                activeFan={myActiveEntry ? null : activeFan}
              />
            ) : (
              <div className="rounded-[28px] border border-brand-border bg-brand-surface h-full flex items-center justify-center p-10 text-center">
                <div>
                  <p className="text-2xl font-serif font-normal text-brand-ink">Waiting for {creatorState.name} to go live</p>
                  <p className="mt-2 text-sm text-brand-ink-subtle">
                    This page will update automatically when {creatorState.name} goes live.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="hidden min-h-[360px] lg:block lg:min-h-0">
            <WaitingRoom
              queue={[]}
              currentUserPosition={0}
              creatorName={creatorState.name}
              creatorInitials={creatorState.avatarInitials}
              creatorColor={creatorState.avatarColor}
              creatorAvatarUrl={creatorState.avatarUrl}
              creatorId={creatorState.id}
              sessionId={liveSessionId ?? undefined}
              showQueueTab={false}
              activeFanAdmittedAt={activeFanAdmittedAt}
              queuePreview={waitingQueue.slice(0, 5).map((e) => ({ id: e.id, fanName: e.fanName, avatarInitials: e.avatarInitials, avatarColor: e.avatarColor, avatarUrl: e.avatarUrl }))}
              totalQueueCount={waitingQueue.length}
            />
          </div>
        </div>
      </div>

      {liveSessionId ? (
        <MobileLiveChatSheet creatorName={creatorState.name} queueCount={waitingQueue.length}>
          <WaitingRoom
            queue={[]}
            currentUserPosition={0}
            creatorName={creatorState.name}
            creatorInitials={creatorState.avatarInitials}
            creatorColor={creatorState.avatarColor}
            creatorAvatarUrl={creatorState.avatarUrl}
            creatorId={creatorState.id}
            sessionId={liveSessionId}
            showQueueTab={false}
            activeFanAdmittedAt={activeFanAdmittedAt}
            queuePreview={waitingQueue.slice(0, 5).map((e) => ({ id: e.id, fanName: e.fanName, avatarInitials: e.avatarInitials, avatarColor: e.avatarColor, avatarUrl: e.avatarUrl }))}
            totalQueueCount={waitingQueue.length}
          />
        </MobileLiveChatSheet>
      ) : null}

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

      <PostLiveCallModal
        open={showPostCallModal}
        onContinueWatching={() => setShowPostCallModal(false)}
        onViewReceipts={() => {
          setShowPostCallModal(false);
          router.push("/payments");
        }}
      />
    </>
  );
}
