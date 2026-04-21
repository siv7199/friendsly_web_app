"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Home, Loader2 } from "lucide-react";
import { notFound } from "next/navigation";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { WaitingRoom } from "@/components/fan/WaitingRoom";
import { PublicLiveRoom } from "@/components/fan/PublicLiveRoom";
import { LiveJoinModal } from "@/components/fan/LiveJoinModal";
import type { QueueEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds, getLiveStageRemainingSeconds } from "@/lib/live";

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

export default function WaitingRoomPage({ params }: { params: { id: string } }) {
  const { user } = useAuthContext();
  const [creatorState, setCreatorState] = useState<CreatorState | null>(null);
  const [loading, setLoading] = useState(true);
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
    const supabase = createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_initials, avatar_color, avatar_url, creator_profiles(live_join_fee)")
      .eq("id", params.id)
      .maybeSingle();

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
    }

    const { data: session } = await supabase
      .from("live_sessions")
      .select("id, daily_room_url")
      .eq("creator_id", params.id)
      .eq("is_active", true)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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

    const { data: entries } = await supabase
      .from("live_queue_entries")
      .select(`
        id, fan_id, topic, joined_at, admitted_at, admitted_daily_session_id, status,
        fan:profiles!fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)
      `)
      .eq("session_id", session.id)
      .in("status", ["waiting", "active"])
      .order("joined_at", { ascending: true });

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
    setLoading(false);
  }, [liveSessionId, params.id]);

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
      .then((response) => response.json())
      .then((data) => setToken(data.token ?? null))
      .catch(() => setToken(null));
  }, [liveSessionId, roomUrl, user, Boolean(myActiveEntry)]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`public-live:${params.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "creator_profiles", filter: `id=eq.${params.id}` }, () => { void loadLiveState(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions" }, () => { void loadLiveState(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_queue_entries" }, () => { void loadLiveState(); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLiveState, params.id]);

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
      const data = await response.json();
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

  if (!creatorState) return notFound();

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
          <Link href={`/profile/${params.id}`}>
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
      <div className="mx-auto flex min-h-screen w-full max-w-[1320px] flex-col gap-4 overflow-x-hidden px-4 py-4 md:px-6 md:py-5 xl:h-[100dvh] xl:max-h-[100dvh] xl:overflow-hidden">
        <Link href={`/profile/${creatorState.id}`} className="inline-flex items-center gap-2 text-sm text-brand-ink-subtle hover:text-brand-ink transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
          Back to {creatorState.name}&apos;s profile
        </Link>

        <div className="grid gap-3 xl:flex-1 xl:min-h-0 xl:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="xl:min-h-0">
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
                onLeaveStage={async () => {
                  if (!myActiveEntry?.id) return;
                  await leaveActiveStage(myActiveEntry.id);
                }}
                joinDisabled={Boolean(myWaitingEntry || myActiveEntry)}
                queueCount={waitingQueue.length}
                queuePreview={waitingQueue}
                onStageSessionReady={reportActiveJoin}
                activeFan={myActiveEntry ? null : activeFan}
              />
            ) : (
              <div className="rounded-[28px] border border-brand-border bg-brand-surface h-full flex items-center justify-center p-10 text-center">
                <div>
                  <p className="text-2xl font-serif font-normal text-brand-ink">Waiting for the live to start</p>
                  <p className="mt-2 text-sm text-brand-ink-subtle">
                    This page will update automatically when {creatorState.name} goes live.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-[360px] xl:min-h-0">
            <WaitingRoom
              queue={[]}
              currentUserPosition={0}
              creatorName={creatorState.name}
              creatorInitials={creatorState.avatarInitials}
              creatorColor={creatorState.avatarColor}
              creatorAvatarUrl={creatorState.avatarUrl}
              creatorId={params.id}
              sessionId={liveSessionId ?? undefined}
              showQueueTab={false}
              activeFanAdmittedAt={activeFanAdmittedAt}
              queuePreview={waitingQueue.slice(0, 5).map((e) => ({ id: e.id, fanName: e.fanName, avatarInitials: e.avatarInitials, avatarColor: e.avatarColor, avatarUrl: e.avatarUrl }))}
              totalQueueCount={waitingQueue.length}
            />
          </div>
        </div>
      </div>

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
