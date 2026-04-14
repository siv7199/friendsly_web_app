"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users, SkipForward, StopCircle, CalendarClock,
  Mic, MicOff, Video, VideoOff, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { WaitingRoom } from "@/components/fan/WaitingRoom";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CallContainer } from "@/components/video/CallContainer";
import { useLocalSessionId, DailyVideo, useDaily } from "@daily-co/daily-react";
import {
  COMMON_TIME_ZONES,
  formatDateTimeLocalInTimeZone,
  formatTimeZoneLabel,
  getBrowserTimeZone,
  zonedTimeToUtc,
} from "@/lib/timezones";
import { LIVE_MIN_JOIN_FEE, LIVE_STAGE_SECONDS } from "@/lib/live";

const LIVE_SESSION_HEARTBEAT_MS = 15000;
const LIVE_SESSION_STALE_MS = 45000;

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getBestParticipantSessionId(params: {
  participants: any[];
  preferredUserName?: string | null;
}) {
  const remoteParticipants = params.participants.filter((participant) => !participant?.local);
  if (remoteParticipants.length === 0) return null;

  const exactMatch = params.preferredUserName
    ? remoteParticipants.find((participant) => participant?.user_name === params.preferredUserName)
    : null;
  if (exactMatch?.session_id) return exactMatch.session_id;

  const playableVideo = remoteParticipants.find((participant) => {
    const videoState = participant?.tracks?.video?.state;
    return videoState === "playable" || videoState === "loading";
  });
  if (playableVideo?.session_id) return playableVideo.session_id;

  return remoteParticipants[0]?.session_id ?? null;
}

function LiveVideoStage({
  queue,
  chatPanel,
  currentFan,
  creatorName,
  creatorInitials,
  creatorColor,
  endSession,
  admitNext,
  queueCount,
  initialMic,
  initialCam,
  activeFanRemainingSeconds,
  creatorJoined,
  sessionId,
}: any) {
  const localSessionId = useLocalSessionId();
  const daily = useDaily();
  const [fanSessionId, setFanSessionId] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(initialMic);
  const [camOn, setCamOn] = useState(initialCam);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    if (daily && typeof daily.setLocalAudio === "function") {
      try { daily.setLocalAudio(next); } catch {}
    }
  };

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    if (daily && typeof daily.setLocalVideo === "function") {
      try { daily.setLocalVideo(next); } catch {}
    }
  };

  useEffect(() => {
    if (!daily || typeof daily.meetingState !== "function") return;
    const sync = () => {
      if (daily.meetingState() === "joined-meeting") {
        daily.setLocalAudio(initialMic);
        daily.setLocalVideo(initialCam);
      }
    };
    sync();
    daily.on("joined-meeting", sync);
    return () => {
      daily.off("joined-meeting", sync);
    };
  }, [daily, initialMic, initialCam]);

  useEffect(() => {
    if (!daily) return;

    const syncFanParticipant = () => {
      if (!currentFan?.fanId) {
        setFanSessionId(null);
        return;
      }

      if (currentFan?.admittedDailySessionId) {
        setFanSessionId(currentFan.admittedDailySessionId);
        return;
      }

      const participants = Object.values(daily.participants() ?? {});
      setFanSessionId(getBestParticipantSessionId({
        participants,
        preferredUserName: currentFan.fanId,
      }));
    };

    syncFanParticipant();
    daily.on("participant-joined", syncFanParticipant);
    daily.on("participant-updated", syncFanParticipant);
    daily.on("participant-left", syncFanParticipant);
    return () => {
      daily.off("participant-joined", syncFanParticipant);
      daily.off("participant-updated", syncFanParticipant);
      daily.off("participant-left", syncFanParticipant);
    };
  }, [currentFan?.fanId, daily]);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_380px_360px] gap-4">
      <div className="min-h-0 rounded-[28px] border border-brand-border bg-brand-surface p-4 md:p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="live">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
              LIVE
            </Badge>
            <span className="text-sm text-slate-300">
              {currentFan ? `Now with ${currentFan.fanName}` : "Public live is open"}
            </span>
            <span className={cn("text-xs font-semibold", creatorJoined ? "text-emerald-400" : "text-amber-400")}>
              {creatorJoined ? "Creator connected" : "Joining room..."}
            </span>
          </div>
          {currentFan?.admittedAt ? (
            <div className="rounded-xl border border-brand-live/30 bg-brand-live/10 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-brand-live">On Stage</p>
              <p className="text-lg font-black text-brand-live tabular-nums">{formatCountdown(activeFanRemainingSeconds)}</p>
            </div>
          ) : null}
        </div>

        <div className="relative flex-1 min-h-[420px] rounded-[24px] bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center">
          {localSessionId ? (
            <div className="w-full h-full relative overflow-hidden">
              <DailyVideo sessionId={localSessionId} type="video" className="w-full h-full object-cover z-10" />
              <style dangerouslySetInnerHTML={{ __html: ".daily-video-container div[style*='position: absolute'] { display: none !important; } .daily-video-container video { transform: none !important; }" }} />
            </div>
          ) : <Avatar initials={creatorInitials} color={creatorColor} size="xl" />}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
          <div className="absolute left-4 bottom-4 right-4 flex items-end justify-between gap-3 z-20">
            <div className="rounded-xl bg-black/45 px-3 py-2 text-white">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Host</p>
              <p className="text-sm font-semibold">{creatorName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleMic} className={cn("w-11 h-11 rounded-full border flex items-center justify-center transition-colors", micOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-red-500/40 bg-red-500/20 text-red-400")}>{micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</button>
              <button onClick={toggleCam} className={cn("w-11 h-11 rounded-full border flex items-center justify-center transition-colors", camOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-red-500/40 bg-red-500/20 text-red-400")}>{camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}</button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-400">
            {queueCount > 0 ? `${queueCount} fans waiting for a 30-second turn` : "No one is waiting right now"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={admitNext} disabled={queueCount < 1} className="gap-1.5"><SkipForward className="w-4 h-4" />Admit Next ({queueCount})</Button>
            <Button variant="danger" size="sm" onClick={endSession} className="gap-1.5"><StopCircle className="w-4 h-4" />End Session</Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 rounded-[28px] border border-brand-border bg-brand-surface p-4 md:p-5 flex flex-col gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Queue Line</p>
          <p className="mt-1 text-sm text-slate-300">Fans are stacked here in admission order.</p>
        </div>

        <div className="rounded-[22px] border border-brand-border bg-brand-elevated p-4">
          {queue.length > 0 ? (
            <>
              <div className="relative px-4 py-3 rounded-[20px] border border-brand-live/20 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.14),transparent_58%)]">
                <div className="absolute left-10 right-10 top-[42px] h-px bg-gradient-to-r from-transparent via-brand-live/35 to-transparent" />
                <div className="relative flex items-start justify-between gap-3">
                  {queue.slice(0, 5).map((entry: any, index: number) => (
                    <div key={entry.id} className="flex min-w-0 flex-1 flex-col items-center text-center">
                      <div className={cn(
                        "relative rounded-full p-1.5 border",
                        index === 0 ? "border-brand-live/60 bg-brand-live/10 shadow-[0_0_30px_rgba(34,197,94,0.18)]" : "border-brand-border bg-brand-surface"
                      )}>
                        <Avatar initials={entry.avatarInitials} color={entry.avatarColor} imageUrl={entry.avatarUrl} size="sm" />
                        <div className={cn(
                          "absolute -right-1 -top-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-brand-elevated",
                          index === 0 ? "bg-brand-live text-brand-bg" : "bg-slate-700 text-slate-100"
                        )}>
                          {index + 1}
                        </div>
                      </div>
                      <p className={cn(
                        "mt-2 text-xs font-semibold truncate max-w-full",
                        index === 0 ? "text-brand-live" : "text-slate-200"
                      )}>
                        {entry.fanName}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {index === 0 ? "Up next" : `${index + 1} in line`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {queue.slice(0, 4).map((entry: any, index: number) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors",
                      index === 0
                        ? "border-brand-live/30 bg-brand-live/10"
                        : "border-brand-border bg-brand-surface"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0 ? "bg-brand-live text-brand-bg" : "bg-brand-elevated text-slate-300"
                    )}>
                      {index + 1}
                    </div>
                    <Avatar initials={entry.avatarInitials} color={entry.avatarColor} imageUrl={entry.avatarUrl} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100 truncate">{entry.fanName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{entry.topic || "Ready to join live"}</p>
                    </div>
                    {index === 0 ? (
                      <Badge variant="live" className="shrink-0">Next</Badge>
                    ) : (
                      <span className="text-[11px] text-slate-500 shrink-0">{index + 1}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-brand-surface border border-brand-border flex items-center justify-center">
                <Users className="w-7 h-7 text-slate-600" />
              </div>
              <p className="mt-4 text-sm text-slate-300">Queue is empty</p>
              <p className="mt-1 text-xs text-slate-500">Fans who pay to join live will appear here in order.</p>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-[280px] rounded-[22px] border border-brand-border bg-brand-elevated overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-brand-border">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Guest Stage</p>
            <p className="mt-1 text-sm text-slate-300">
              {currentFan ? `${currentFan.fanName} is live with you now.` : "The next admitted fan appears here."}
            </p>
          </div>
          <div className="flex-1 relative flex items-center justify-center">
            {fanSessionId ? (
              <>
                <DailyVideo sessionId={fanSessionId} type="video" className="w-full h-full object-cover z-10" />
                <div className="absolute left-4 bottom-4 rounded-xl bg-black/45 px-3 py-2 text-white z-20">
                  <p className="text-sm font-semibold">{currentFan?.fanName || "Fan"}</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center z-10">
                <Users className="w-9 h-9 opacity-20 mb-3" />
                <p className="text-sm font-medium text-slate-300">No fan currently admitted</p>
                <p className="mt-1 text-xs text-slate-500">Use the queue above to bring the next person on stage.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 rounded-[28px] border border-brand-border bg-brand-surface p-4 md:p-5 flex flex-col gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Live Chat</p>
          <p className="mt-1 text-sm text-slate-300">Keep the room moving while you manage the stage.</p>
        </div>
        <div className="flex-1 min-h-0">
          {chatPanel}
        </div>
        <div className="px-3 py-1 bg-brand-elevated rounded border border-brand-border text-[10px] text-slate-500 font-mono truncate">Session: {sessionId}</div>
      </div>
    </div>
  );
}

type SessionState = "idle" | "live";

export function LiveConsole() {
  const { user } = useAuthContext();
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [roomUrl, setRoomUrl] = useState("");
  const [token, setToken] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [liveRate, setLiveRate] = useState<number | null>(null);
  const [currentFan, setCurrentFan] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [loadingRate, setLoadingRate] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setStartError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [creatorJoined, setCreatorJoined] = useState(false);
  const [scheduledLiveAt, setScheduledLiveAt] = useState("");
  const [scheduledLiveTimeZone, setScheduledLiveTimeZone] = useState(getBrowserTimeZone());
  const [savingScheduledLive, setSavingScheduledLive] = useState(false);
  const finishingFanRef = useRef(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const initStartedRef = useRef(false);
  const endingSessionRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const creatorName = user?.full_name ?? "You";
  const creatorInitials = user?.avatar_initials ?? "??";
  const creatorColor = user?.avatar_color ?? "bg-violet-600";
  const activeFanRemainingSeconds = currentFan?.admittedAt
    ? Math.max(0, LIVE_STAGE_SECONDS - Math.floor((currentTime - new Date(currentFan.admittedAt).getTime()) / 1000))
    : LIVE_STAGE_SECONDS;

  function isRecentHeartbeat(value?: string | null) {
    if (!value) return false;
    return Date.now() - new Date(value).getTime() <= LIVE_SESSION_STALE_MS;
  }

  function hasConfiguredLiveRate(value: number | null | undefined) {
    return typeof value === "number" && !Number.isNaN(value) && value > 0;
  }

  function applySessionId(nextSessionId: string | null) {
    sessionIdRef.current = nextSessionId;
    setSessionId(nextSessionId);
  }

  async function fetchLatestLiveSettings(userId: string) {
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("live_join_fee, scheduled_live_at, scheduled_live_timezone, timezone")
      .eq("id", userId)
      .maybeSingle();

    const parsedRate = profile?.live_join_fee != null
      ? Number(profile.live_join_fee)
      : null;
    const nextScheduledTimeZone = profile?.scheduled_live_timezone || profile?.timezone || getBrowserTimeZone();

    setLiveRate(parsedRate);
    setScheduledLiveTimeZone(nextScheduledTimeZone);
    setScheduledLiveAt(
      profile?.scheduled_live_at
        ? formatDateTimeLocalInTimeZone(profile.scheduled_live_at, nextScheduledTimeZone)
        : ""
    );

    return {
      liveRate: parsedRate,
      scheduledLiveAt: profile?.scheduled_live_at ?? null,
      scheduledLiveTimeZone: nextScheduledTimeZone,
    };
  }

  useEffect(() => {
    if (sessionState !== "idle") return;
    async function startPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: camOn, audio: false });
        previewStreamRef.current = stream;
        if (previewVideoRef.current) previewVideoRef.current.srcObject = stream;
      } catch {}
    }
    if (camOn) startPreview();
    else {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
      if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    }
    return () => { previewStreamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [sessionState, camOn]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initStartedRef.current || !user) return;
    initStartedRef.current = true;
    const currentUser = user;
    const supabase = createClient();

    async function init() {
      try {
        await fetchLatestLiveSettings(currentUser.id);
        setLoadingRate(false);

        const { data: activeSessions } = await supabase
          .from("live_sessions")
          .select("*")
          .eq("creator_id", currentUser.id)
          .eq("is_active", true)
          .order("started_at", { ascending: false });

        const existingSession = activeSessions?.find((s: any) => !!s.daily_room_url) ?? null;
        if (existingSession && isRecentHeartbeat(existingSession.last_heartbeat_at)) {
          applySessionId(existingSession.id);
          setRoomUrl(existingSession.daily_room_url);
          try {
            const tokenRes = await fetch("/api/daily/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomName: existingSession.daily_room_url.split("/").pop(), isOwner: true, userName: currentUser.id }),
            });
            const tokenData = await tokenRes.json();
            if (tokenData.token) setToken(tokenData.token);
          } catch {}
          setSessionState("live");
        } else if (existingSession) {
          await supabase
            .from("live_sessions")
            .update({ is_active: false, ended_at: new Date().toISOString(), last_heartbeat_at: null })
            .eq("id", existingSession.id);
          await supabase
            .from("creator_profiles")
            .update({ is_live: false, current_live_session_id: null })
            .eq("id", currentUser.id);
        }
      } catch {
      } finally {
        setInitializing(false);
      }
    }
    init();
  }, [user]);

  async function finalizeQueueEntry(entry: any, status: "completed" | "skipped") {
    if (!entry) return;
    try {
      await fetch("/api/live/finalize-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueEntryId: entry.id, status }),
      });
    } catch {}
  }

  useEffect(() => {
    if (!user || !sessionId) return;
    const currentUser = user;
    const supabase = createClient();

    async function fetchQueue(targetSid: string) {
      const { data } = await supabase
        .from("live_queue_entries")
        .select("id, topic, joined_at, status, admitted_at, admitted_daily_session_id, fan_id, profiles:fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)")
        .eq("session_id", targetSid)
        .in("status", ["waiting", "active"])
        .order("joined_at", { ascending: true });

      if (!data) return;

      const active = data.find((e: any) => e.status === "active");
      const activeRemainingSeconds = active?.admitted_at
        ? Math.max(0, LIVE_STAGE_SECONDS - Math.floor((Date.now() - new Date(active.admitted_at).getTime()) / 1000))
        : 0;
      const waiting = data.filter((e: any) => e.status === "waiting");

      setQueue(waiting.map((e: any, idx: number) => ({
        id: e.id,
        fanId: e.fan_id,
        fanName: e.profiles.full_name,
        fanUsername: `@${e.profiles.username}`,
        avatarInitials: e.profiles.avatar_initials,
        avatarColor: e.profiles.avatar_color,
        avatarUrl: e.profiles.avatar_url ?? undefined,
        admittedDailySessionId: e.admitted_daily_session_id ?? undefined,
        position: idx + 1,
        waitTime: "",
        waitSeconds: activeRemainingSeconds + (idx * LIVE_STAGE_SECONDS),
        topic: e.topic ?? undefined,
        joinedAt: e.joined_at,
        creator_id: currentUser.id,
      })));

      if (active) {
        setCurrentFan({
          id: active.id,
          fanId: active.fan_id,
          fanName: active.profiles.full_name,
          fanUsername: `@${active.profiles.username}`,
          avatarInitials: active.profiles.avatar_initials,
          avatarColor: active.profiles.avatar_color,
          avatarUrl: active.profiles.avatar_url ?? undefined,
          admittedDailySessionId: active.admitted_daily_session_id ?? undefined,
          topic: active.topic || "Hi!",
          admittedAt: active.admitted_at,
        });
      } else {
        setCurrentFan(null);
      }
    }

    fetchQueue(sessionId);
    const channel = supabase
      .channel(`lq-${currentUser.id}-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_queue_entries", filter: `session_id=eq.${sessionId}` }, () => fetchQueue(sessionId))
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` }, () => fetchQueue(sessionId))
      .subscribe();

    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      if (!sessionId) return;
      void fetchQueue(sessionId);
    }

    const hb = window.setInterval(refreshIfVisible, 15000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(hb);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [user, sessionId]);

  useEffect(() => {
    if (sessionState !== "live" || !user) return;
    const handleUnload = () => {
      if (sessionId) {
        navigator.sendBeacon("/api/live/disconnect", new Blob([JSON.stringify({ creatorId: user.id, sessionId })], { type: "application/json" }));
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [user, sessionId, sessionState]);

  useEffect(() => {
    if (!creatorJoined || !user || !sessionId) return;

    const supabase = createClient();
    const heartbeat = async () => {
      await supabase
        .from("live_sessions")
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("creator_id", user.id)
        .eq("is_active", true);
    };

    heartbeat();
    const interval = window.setInterval(heartbeat, LIVE_SESSION_HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [creatorJoined, user, sessionId]);

  useEffect(() => {
    if (!currentFan?.admittedAt || finishingFanRef.current) return;
    if (activeFanRemainingSeconds > 0) return;

    finishingFanRef.current = true;
    finalizeQueueEntry(currentFan, "completed").finally(() => {
      setCurrentFan(null);
      finishingFanRef.current = false;
    });
  }, [activeFanRemainingSeconds, currentFan, liveRate]);

  async function startSession() {
    if (!user) return;
    setStartError("");
    setCreatorJoined(false);
    const latestSettings = await fetchLatestLiveSettings(user.id);
    if (!hasConfiguredLiveRate(latestSettings.liveRate)) {
      setStartError(`Set a live join fee of at least $${LIVE_MIN_JOIN_FEE} in Management first.`);
      return;
    }
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }
    try {
      const res = await fetch("/api/daily/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: user.id }) });
      const data = await res.json();
      if (data.url && data.token) {
        const supabase = createClient();
        let sid = sessionId;

        await supabase.from("live_sessions").update({ is_active: false }).eq("creator_id", user.id).eq("is_active", true);
        if (sid) {
          await supabase
            .from("live_sessions")
            .update({ daily_room_url: data.url, is_active: false, ended_at: null, last_heartbeat_at: null })
            .eq("id", sid);
        } else {
          const { data: newSession } = await supabase
            .from("live_sessions")
            .insert({ creator_id: user.id, join_fee: latestSettings.liveRate ?? 0, is_active: false, daily_room_url: data.url, last_heartbeat_at: null })
            .select("id")
            .single();
          if (newSession) {
            sid = newSession.id;
            applySessionId(newSession.id);
          }
        }

        if (sid) {
          const heartbeatAt = new Date().toISOString();
          await supabase
            .from("live_sessions")
            .update({ is_active: true, ended_at: null, last_heartbeat_at: heartbeatAt })
            .eq("id", sid);
          await supabase
            .from("creator_profiles")
            .update({ is_live: true, current_live_session_id: sid, scheduled_live_at: null, scheduled_live_timezone: null })
            .eq("id", user.id);

          setRoomUrl(data.url);
          setToken(data.token);
          setScheduledLiveAt("");
          setSessionState("live");
        }
      }
    } catch {
      setStartError("Failed to start session.");
    }
  }

  async function admitNext() {
    if (queue.length === 0 || !user || !sessionId || finishingFanRef.current || !creatorJoined) return;
    const supabase = createClient();
    const nextFan = queue[0];
    if (currentFan) {
      await finalizeQueueEntry(currentFan, "completed");
    }
    const { error } = await supabase
      .from("live_queue_entries")
      .update({ status: "active", admitted_at: new Date().toISOString() })
      .eq("id", nextFan.id);
    if (!error) setCurrentFan({ ...nextFan, admittedAt: new Date().toISOString() });
  }

  async function endSession() {
    if (!user || !sessionId) return;
    endingSessionRef.current = true;
    if (currentFan) {
      await finalizeQueueEntry(currentFan, "completed");
    }
    try {
      await fetch("/api/live/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: user.id, sessionId }),
      });
    } catch {}
    setSessionState("idle");
    setCreatorJoined(false);
    setRoomUrl("");
    setToken("");
    applySessionId(null);
    setQueue([]);
    setCurrentFan(null);
    window.setTimeout(() => {
      endingSessionRef.current = false;
    }, 1000);
  }

  async function handleCreatorJoined() {
    setCreatorJoined(true);
    const activeSessionId = sessionIdRef.current;
    if (!user || !activeSessionId) return;

    const supabase = createClient();
    await supabase
      .from("live_sessions")
      .update({ is_active: true, ended_at: null, last_heartbeat_at: new Date().toISOString() })
      .eq("id", activeSessionId);
  }

  async function handleCreatorLeft() {
    setCreatorJoined(false);
    const activeSessionId = sessionIdRef.current;
    if (endingSessionRef.current || !user || !activeSessionId) return;

    try {
      await fetch("/api/live/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: user.id, sessionId: activeSessionId }),
      });
    } catch {}
  }

  async function saveScheduledLive(nextValue?: string) {
    if (!user) return;
    setSavingScheduledLive(true);
    const supabase = createClient();
    let scheduledLiveIso: string | null = null;

    if (nextValue) {
      const [datePart, timePart] = nextValue.split("T");
      if (datePart && timePart) {
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute] = timePart.split(":").map(Number);
        scheduledLiveIso = zonedTimeToUtc(
          { year, month, day, hour, minute },
          scheduledLiveTimeZone
        ).toISOString();
      }
    }

    await supabase
      .from("creator_profiles")
      .update({
        scheduled_live_at: scheduledLiveIso,
        scheduled_live_timezone: nextValue ? scheduledLiveTimeZone : null,
      })
      .eq("id", user.id);
    setScheduledLiveAt(nextValue ?? "");
    setSavingScheduledLive(false);
  }

  if (initializing) return (
    <div className="h-full flex flex-col items-center justify-center bg-brand-surface rounded-2xl border border-brand-border p-12">
      <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
      <p className="text-slate-300 font-bold text-lg">Resuming Session...</p>
      <p className="text-slate-500 text-sm mt-1">Please wait while we sync your queue.</p>
    </div>
  );

  if (loadingRate) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" /></div>;

  return (
    <div className="h-full flex flex-col gap-4">
      {sessionState === "idle" ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-brand-border bg-brand-surface p-8 text-center">
          <div className="w-full max-w-sm aspect-video rounded-2xl bg-brand-elevated border border-brand-border mb-8 relative overflow-hidden flex items-center justify-center">
            {camOn ? <video ref={previewVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" /> : <Avatar initials={creatorInitials} color={creatorColor} size="lg" />}
          </div>
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setMicOn(!micOn)} className={cn("w-12 h-12 rounded-full border flex items-center justify-center", micOn ? "bg-brand-surface border-brand-border text-slate-300" : "bg-red-500/20 border-red-500/40 text-red-400")}>{micOn ? <Mic /> : <MicOff />}</button>
            <button onClick={() => setCamOn(!camOn)} className={cn("w-12 h-12 rounded-full border flex items-center justify-center", camOn ? "bg-brand-surface border-brand-border text-slate-300" : "bg-red-500/20 border-red-500/40 text-red-400")}>{camOn ? <Video /> : <VideoOff />}</button>
          </div>
          <div className="w-full max-w-sm rounded-2xl border border-brand-border bg-brand-elevated p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-slate-200 mb-3">
              <CalendarClock className="w-4 h-4 text-brand-primary-light" />
              <p className="text-sm font-semibold">Announce when you’re going live</p>
            </div>
            <input
              type="datetime-local"
              value={scheduledLiveAt}
              onChange={(e) => setScheduledLiveAt(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-brand-border bg-brand-surface text-slate-100 text-sm focus:outline-none focus:border-brand-primary"
            />
            <select
              value={scheduledLiveTimeZone}
              onChange={(e) => setScheduledLiveTimeZone(e.target.value)}
              className="w-full h-11 mt-3 px-3 rounded-xl border border-brand-border bg-brand-surface text-slate-100 text-sm focus:outline-none focus:border-brand-primary"
            >
              {COMMON_TIME_ZONES.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {formatTimeZoneLabel(timeZone)}
                </option>
              ))}
            </select>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" className="flex-1" onClick={() => saveScheduledLive("")}>
                Clear
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => saveScheduledLive(scheduledLiveAt)} disabled={savingScheduledLive}>
                {savingScheduledLive ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          {!hasConfiguredLiveRate(liveRate) ? (
            <p className="text-sm text-amber-300 mb-4">
              Set a live join fee in Management before going live.
            </p>
          ) : null}
          <Button variant="live" size="xl" onClick={startSession} className="shadow-glow-live">Start Live Session</Button>
          {startError && <p className="text-red-400 text-sm mt-4">{startError}</p>}
        </div>
      ) : (
        <CallContainer
          url={roomUrl}
          token={token}
          startVideo={camOn}
          startAudio={micOn}
          onJoin={handleCreatorJoined}
          onLeave={handleCreatorLeft}
        >
          <div className="flex-1 min-h-0">
            <LiveVideoStage
              queue={queue}
              chatPanel={(
                <WaitingRoom
                  key={sessionId}
                  queue={[]}
                  currentUserPosition={0}
                  creatorName={creatorName}
                  creatorInitials={creatorInitials}
                  creatorColor={creatorColor}
                  creatorAvatarUrl={user?.avatar_url ?? undefined}
                  creatorId={user?.id ?? ""}
                  sessionId={sessionId ?? undefined}
                  showQueueTab={false}
                  activeFanAdmittedAt={currentFan?.admittedAt ?? null}
                />
              )}
              currentFan={currentFan}
              creatorName={creatorName}
              creatorInitials={creatorInitials}
              creatorColor={creatorColor}
              endSession={endSession}
              admitNext={admitNext}
              queueCount={queue.length}
              initialMic={micOn}
              initialCam={camOn}
              activeFanRemainingSeconds={activeFanRemainingSeconds}
              creatorJoined={creatorJoined}
              sessionId={sessionId}
            />
          </div>
        </CallContainer>
      )}
    </div>
  );
}
