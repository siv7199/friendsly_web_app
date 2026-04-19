"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { LIVE_STAGE_SECONDS } from "@/lib/live";

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
        ? {
            fanId: activeEntry.fan_id,
            fanName: activeEntry.fan.full_name,
            avatarInitials: activeEntry.fan.avatar_initials,
            avatarColor: activeEntry.fan.avatar_color,
            avatarUrl: activeEntry.fan.avatar_url ?? undefined,
            admittedDailySessionId: activeEntry.admitted_daily_session_id ?? undefined,
          }
        : null
    );

    const waitingEntries = (entries ?? []).filter((entry: any) => entry.status === "waiting");
    const activeRemainingSeconds = activeEntry?.admitted_at
      ? Math.max(0, LIVE_STAGE_SECONDS - Math.floor((Date.now() - new Date(activeEntry.admitted_at).getTime()) / 1000))
      : LIVE_STAGE_SECONDS;

    const nextQueue: QueueEntry[] = (entries ?? []).map((entry: any) => {
      const position = waitingEntries.findIndex((candidate: any) => candidate.id === entry.id) + 1;
      return {
        id: entry.id,
        fanId: entry.fan_id,
        fanName: entry.fan.full_name,
        fanUsername: `@${entry.fan.username}`,
        avatarInitials: entry.fan.avatar_initials,
        avatarColor: entry.fan.avatar_color,
        avatarUrl: entry.fan.avatar_url ?? undefined,
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
  }, [liveSessionId, roomUrl, user]);

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

  const myWaitingEntry = useMemo(
    () => queue.find((entry) => entry.status === "waiting" && user && entry.fanId === user.id),
    [queue, user]
  );

  const myActiveEntry = useMemo(
    () => queue.find((entry) => entry.status === "active" && user && entry.fanId === user.id),
    [queue, user]
  );

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

  const secondsRemaining = activeFanAdmittedAt
    ? Math.max(0, LIVE_STAGE_SECONDS - Math.floor((Date.now() - new Date(activeFanAdmittedAt).getTime()) / 1000))
    : LIVE_STAGE_SECONDS;
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
          <h1 className="text-3xl font-black font-display text-white mb-2">
            {creatorState.name}&apos;s live has ended
          </h1>
          <p className="text-white/60 max-w-sm mx-auto">
            Any paid queue spots that were never admitted are automatically refunded in full.
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
      <div className="px-4 md:px-6 py-4 md:py-5 h-[100dvh] overflow-hidden flex flex-col gap-4">
        <Link href={`/profile/${creatorState.id}`} className="inline-flex items-center gap-2 text-sm text-brand-ink-subtle hover:text-brand-ink transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
          Back to {creatorState.name}&apos;s profile
        </Link>

        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_420px]">
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
                secondsRemaining={secondsRemaining}
                onJoinQueue={() => setShowJoinModal(true)}
                joinDisabled={Boolean(myWaitingEntry || myActiveEntry)}
                queueCount={waitingQueue.length}
                queuePreview={waitingQueue}
                onStageSessionReady={reportActiveJoin}
                activeFan={myActiveEntry ? null : activeFan}
              />
            ) : (
              <div className="rounded-[28px] border border-brand-border bg-brand-surface h-full flex items-center justify-center p-10 text-center">
                <div>
                  <p className="text-2xl font-black text-brand-ink">Waiting for the live to start</p>
                  <p className="mt-2 text-sm text-brand-ink-subtle">
                    This page will update automatically when {creatorState.name} goes live.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0">
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
