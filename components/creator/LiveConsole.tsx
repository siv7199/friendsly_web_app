"use client";

import Link from "next/link";

import { useState, useEffect, useRef } from "react";
import {
  Users, SkipForward, StopCircle, CalendarClock,
  Mic, MicOff, Video, VideoOff, Loader2, ChevronDown, ChevronUp, ShieldX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { WaitingRoom } from "@/components/fan/WaitingRoom";
import { useAuthContext } from "@/lib/context/AuthContext";
import { readJsonResponse } from "@/lib/http";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CallContainer } from "@/components/video/CallContainer";
import { useLocalSessionId, DailyAudioTrack, DailyVideo, useDaily } from "@daily-co/daily-react";
import {
  COMMON_TIME_ZONES,
  formatDateTimeLocalInTimeZone,
  formatTimeZoneLabel,
  getBrowserTimeZone,
  zonedTimeToUtc,
} from "@/lib/timezones";
import { LIVE_STAGE_MAX_MINUTES, LIVE_STAGE_MIN_SECONDS, LIVE_STAGE_SECONDS, getLiveStageElapsedSeconds, getLiveStageRemainingSeconds } from "@/lib/live";

const LIVE_SESSION_HEARTBEAT_MS = 15000;
const LIVE_SESSION_STALE_MS = 45000;

function shouldRefreshQueueFromLiveSessionChange(payload: any) {
  const previousSession = payload.old;
  const nextSession = payload.new;

  if (payload.eventType === "INSERT" || payload.eventType === "DELETE") return true;

  return (
    previousSession?.is_active !== nextSession?.is_active ||
    previousSession?.ended_at !== nextSession?.ended_at ||
    previousSession?.daily_room_url !== nextSession?.daily_room_url
  );
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatElapsed(totalSeconds: number) {
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

function isParticipantVideoActive(participant: any) {
  const videoState = participant?.tracks?.video?.state;
  return videoState === "playable" || videoState === "loading";
}

function resolveParticipant(params: {
  participants: any[];
  preferredUserName?: string | null;
  preferredSessionId?: string | null;
}) {
  const remoteParticipants = params.participants.filter((participant) => !participant?.local);

  const explicitParticipant = params.preferredSessionId
    ? remoteParticipants.find((participant) => participant?.session_id === params.preferredSessionId)
    : null;
  if (explicitParticipant?.session_id) {
    return explicitParticipant;
  }

  const fallbackSessionId = getBestParticipantSessionId({
    participants: remoteParticipants,
    preferredUserName: params.preferredUserName,
  });

  return remoteParticipants.find((participant) => participant?.session_id === fallbackSessionId) ?? null;
}

function getLiveAudienceCount(daily: ReturnType<typeof useDaily>, participants: any[]) {
  const visibleParticipants = participants.filter((participant) => !participant?.hidden).length;
  const hasLocalParticipant = participants.some((participant) => participant?.local);
  const joinedLocalCount = daily?.meetingState?.() === "joined-meeting" && !hasLocalParticipant ? 1 : 0;
  return Math.max(daily?.participantCounts?.().present ?? 0, visibleParticipants + joinedLocalCount);
}

function mapLiveQueuePerson(entry: any, fallbackName: string) {
  const profile = entry?.profiles;
  return {
    id: entry.id,
    fanId: entry.fan_id,
    fanName: profile?.full_name ?? fallbackName,
    fanUsername: profile?.username ? `@${profile.username}` : "@fan",
    avatarInitials: profile?.avatar_initials ?? "F",
    avatarColor: profile?.avatar_color ?? "bg-brand-primary",
    avatarUrl: profile?.avatar_url ?? undefined,
    admittedDailySessionId: entry.admitted_daily_session_id ?? undefined,
    topic: entry.topic || "Hi!",
    admittedAt: entry.admitted_at,
  };
}

function LiveVideoStage({
  queue,
  chatPanel,
  currentFan,
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  endSession,
  admitNext,
  kickCurrentFan,
  queueCount,
  initialMic,
  initialCam,
  activeFanRemainingSeconds,
  activeFanElapsedSeconds,
  creatorJoined,
}: any) {
  const localSessionId = useLocalSessionId();
  const daily = useDaily();
  const [fanSessionId, setFanSessionId] = useState<string | null>(null);
  const [fanVideoActive, setFanVideoActive] = useState(false);
  const [audienceCount, setAudienceCount] = useState(0);
  const [micOn, setMicOn] = useState(initialMic);
  const [camOn, setCamOn] = useState(initialCam);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const showActiveFanStage = Boolean(currentFan);
  const audibleSessionIds = Array.from(new Set([fanSessionId].filter((value): value is string => Boolean(value))));
  const dailyVideoFillStyles = {
    __html: `
      .daily-stage-video,
      .daily-stage-video > div,
      .daily-stage-video > div > div,
      .daily-stage-video video {
        width: 100% !important;
        height: 100% !important;
      }
      .daily-stage-video {
        position: relative;
      }
      .daily-stage-video video {
        display: block !important;
        object-fit: cover !important;
        transform: none !important;
      }
      .daily-stage-video div[style*='position: absolute'] {
        display: none !important;
      }
    `,
  };

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
      const participants = Object.values(daily.participants() ?? {});
      setAudienceCount(getLiveAudienceCount(daily, participants));

      if (!currentFan?.fanId) {
        setFanSessionId(null);
        setFanVideoActive(false);
        return;
      }

      const resolvedFanParticipant = resolveParticipant({
        participants,
        preferredUserName: currentFan.fanId,
        preferredSessionId: currentFan.admittedDailySessionId,
      });
      setFanSessionId(resolvedFanParticipant?.session_id ?? null);
      setFanVideoActive(isParticipantVideoActive(resolvedFanParticipant));
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
  }, [currentFan?.admittedDailySessionId, currentFan?.fanId, daily]);

  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-[28px] border border-brand-border bg-brand-surface p-3 flex flex-col gap-3 overflow-hidden lg:h-full lg:min-h-0">
        {audibleSessionIds.map((sessionId) => (
          <DailyAudioTrack key={sessionId} sessionId={sessionId} />
        ))}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge variant="live">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
              LIVE
            </Badge>
            <span className="text-sm text-brand-ink-muted">
              {currentFan ? `Now with ${currentFan.fanName}` : "Live is open"}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-elevated px-2.5 py-1 text-xs text-brand-ink-muted">
              <Users className="w-3.5 h-3.5" />
              {audienceCount} in live
            </span>
            <span className={cn("text-xs font-semibold", creatorJoined ? "text-emerald-400" : "text-amber-400")}>
              {creatorJoined ? "Creator connected" : "Joining room..."}
            </span>
            <button
              type="button"
              onClick={() => setChatCollapsed((v) => !v)}
              className="lg:hidden inline-flex h-7 items-center gap-1 rounded-full border border-brand-border bg-brand-elevated px-2.5 text-[11px] font-semibold text-brand-ink-muted transition-all active:scale-95"
              aria-label={chatCollapsed ? "Show chat" : "Hide chat"}
            >
              {chatCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {chatCollapsed ? "Show chat" : "Hide chat"}
            </button>
          </div>
          {currentFan?.admittedAt ? (
              <div className="rounded-xl border border-brand-live/30 bg-brand-live/10 px-3 py-1.5 text-left self-start md:self-auto md:text-right">
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-live">On Stage</p>
                <p className="text-base font-black text-brand-live tabular-nums">{formatElapsed(activeFanElapsedSeconds)}</p>
                <p className="text-[10px] text-brand-live/75">of {LIVE_STAGE_MAX_MINUTES}:00 max</p>
              </div>
            ) : null}
        </div>

        <div className={cn(
          "grid items-stretch gap-3 flex-1 min-h-0",
          showActiveFanStage
            ? "grid-rows-[minmax(280px,40vh)_minmax(280px,40vh)] lg:grid-rows-1 lg:grid-cols-2"
            : "grid-cols-1"
        )}>
          <div className={cn(
            "relative h-full rounded-[20px] bg-[#0f0f1a] overflow-hidden flex items-center justify-center",
            showActiveFanStage ? "min-h-[280px] lg:min-h-0" : "min-h-[340px] lg:min-h-0"
          )}>
            {localSessionId && camOn ? (
              <div className="daily-stage-video w-full h-full relative overflow-hidden">
                <DailyVideo sessionId={localSessionId} type="video" className="w-full h-full object-cover z-10" />
                <style dangerouslySetInnerHTML={dailyVideoFillStyles} />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_55%)]">
                <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="xl" />
                <p className="text-sm text-slate-400">
                  {camOn ? "Connecting camera..." : "Camera is off"}
                </p>
              </div>
            )}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
            <div className="absolute left-3 bottom-3 rounded-xl bg-black/45 px-3 py-2 text-white z-20 max-w-[calc(100%-1.5rem)] md:left-4 md:bottom-4 md:max-w-[calc(100%-2rem)]">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Host</p>
              <p className="text-sm font-semibold">{creatorName}</p>
            </div>
            <div className="absolute right-4 bottom-4 hidden items-center gap-2 z-20 md:flex">
              <button onClick={toggleMic} className={cn("w-11 h-11 rounded-full border flex items-center justify-center transition-colors backdrop-blur-sm", micOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-red-500/40 bg-red-500/20 text-red-400")}>{micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</button>
              <button onClick={toggleCam} className={cn("w-11 h-11 rounded-full border flex items-center justify-center transition-colors backdrop-blur-sm", camOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-red-500/40 bg-red-500/20 text-red-400")}>{camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}</button>
            </div>
          </div>

          {showActiveFanStage ? (
            <div className="relative h-full min-h-[280px] lg:min-h-0 rounded-[20px] bg-[#0f0f1a] overflow-hidden">
              {fanSessionId && fanVideoActive ? (
                <div className="daily-stage-video w-full h-full relative overflow-hidden">
                  <DailyVideo sessionId={fanSessionId} type="video" className="w-full h-full object-cover z-10" />
                  <style dangerouslySetInnerHTML={dailyVideoFillStyles} />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_55%)] text-center">
                  <Avatar
                    initials={currentFan?.avatarInitials ?? "F"}
                    color={currentFan?.avatarColor ?? "bg-brand-primary"}
                    imageUrl={currentFan?.avatarUrl}
                    size="xl"
                  />
                  <p className="text-sm text-slate-400">
                    {fanSessionId
                      ? `${currentFan?.fanName ?? "Fan"} is on stage, but their camera is off or unavailable.`
                      : `Connecting ${currentFan?.fanName ?? "fan"} to the stage...`}
                  </p>
                </div>
              )}
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
              <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-slate-300 z-20">
                Current Fan
              </div>
              <div className="absolute left-4 bottom-4 rounded-xl bg-black/45 px-3 py-2 text-white z-20">
                <p className="text-sm font-semibold">{currentFan?.fanName || "Fan"}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Mobile queue + controls — below video, hidden on desktop */}
        <div className="lg:hidden shrink-0">
          <div className="rounded-[22px] border border-[rgba(184,146,255,0.34)] bg-[linear-gradient(135deg,rgba(96,43,141,0.48),rgba(58,17,90,0.24))] p-2.5 shadow-[0_18px_40px_rgba(32,10,55,0.28)] backdrop-blur-sm">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/78">
                <span className="h-2 w-2 rounded-full bg-brand-live" />
                Queue · {queueCount}
              </div>
              {queue.length > 0 ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex items-center -space-x-2">
                    {queue.slice(0, 3).map((entry: any) => (
                      <div key={entry.id} className="rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(26,12,42,0.86)] p-0.5">
                        <Avatar initials={entry.avatarInitials} color={entry.avatarColor} imageUrl={entry.avatarUrl} size="sm" />
                      </div>
                    ))}
                  </div>
                  <p className="truncate text-xs font-medium text-white/86">
                    {queue.slice(0, 3).map((entry: any) => entry.fanName).join(" / ")}
                  </p>
                </div>
              ) : (
                <p className="min-w-0 flex-1 truncate text-xs text-white/72">
                  No fans yet
                </p>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={toggleMic}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
                  micOn ? "border-white/20 bg-[rgba(22,8,34,0.56)] text-white" : "border-red-500/35 bg-red-500/20 text-red-300"
                )}
              >
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleCam}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors",
                  camOn ? "border-white/20 bg-[rgba(22,8,34,0.56)] text-white" : "border-red-500/35 bg-red-500/20 text-red-300"
                )}
              >
                {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
              <button
                onClick={admitNext}
                disabled={queueCount < 1 || (Boolean(currentFan) && activeFanElapsedSeconds < LIVE_STAGE_MIN_SECONDS)}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-white/20 bg-[rgba(22,8,34,0.56)] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[rgba(22,8,34,0.8)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SkipForward className="w-3.5 h-3.5" />
                {currentFan && activeFanElapsedSeconds < LIVE_STAGE_MIN_SECONDS
                  ? `Min ${formatCountdown(LIVE_STAGE_MIN_SECONDS - activeFanElapsedSeconds)}`
                  : "Admit"}
              </button>
              <button
                onClick={kickCurrentFan}
                disabled={!currentFan}
                className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full border border-brand-gold/35 bg-brand-gold/15 px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-brand-gold/25 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ShieldX className="w-3.5 h-3.5" />
                Kick
              </button>
              <button
                onClick={endSession}
                className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full border border-red-500/40 bg-red-500/30 px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-red-500/50"
              >
                <StopCircle className="w-3.5 h-3.5" />
                End
              </button>
            </div>
          </div>
        </div>

      </div>

      <div className={cn(
        "min-h-[420px] rounded-[28px] border border-brand-border bg-brand-surface p-3 flex flex-col gap-3 overflow-hidden lg:h-full lg:min-h-0 lg:min-h-0",
        chatCollapsed && "hidden lg:flex"
      )}>
        {/* Queue strip at top of chat column — xl+ desktop sidebar only */}
        <div className="hidden lg:block rounded-[20px] border border-brand-border bg-brand-elevated p-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-brand-ink-muted">
              Queue · {queueCount}
            </p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={admitNext} disabled={queueCount < 1 || (Boolean(currentFan) && activeFanElapsedSeconds < LIVE_STAGE_MIN_SECONDS)} className="h-8 gap-1 px-2.5 text-[11px]">
                <SkipForward className="w-3.5 h-3.5" />
                {currentFan && activeFanElapsedSeconds < LIVE_STAGE_MIN_SECONDS
                  ? `Min ${formatCountdown(LIVE_STAGE_MIN_SECONDS - activeFanElapsedSeconds)}`
                  : "Admit"}
              </Button>
              <Button variant="outline" size="sm" onClick={kickCurrentFan} disabled={!currentFan} className="h-8 gap-1 px-2.5 text-[11px]">
                <ShieldX className="w-3.5 h-3.5" />
                Kick
              </Button>
              <Button variant="danger" size="sm" onClick={endSession} className="h-8 gap-1 px-2.5 text-[11px]">
                <StopCircle className="w-3.5 h-3.5" />
                End
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {queue.length > 0 ? queue.slice(0, 4).map((entry: any, index: number) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-[12px] border px-2 py-1",
                  index === 0 ? "border-brand-live/30 bg-brand-live/10" : "border-brand-border bg-brand-surface"
                )}
              >
                <Avatar initials={entry.avatarInitials} color={entry.avatarColor} imageUrl={entry.avatarUrl} size="xs" />
                <span className="truncate text-[11px] font-semibold text-brand-ink">{entry.fanName}</span>
              </div>
            )) : (
              <span className="text-[11px] text-brand-ink-subtle">No fans yet</span>
            )}
            {queue.length > 4 ? (
              <div className="rounded-[12px] border border-brand-border bg-brand-surface px-2 py-1 text-[11px] font-semibold text-brand-ink-muted">
                +{queue.length - 4} more
              </div>
            ) : null}
          </div>
        </div>

        <p className="text-[11px] uppercase tracking-[0.25em] text-brand-ink-muted shrink-0">Live Chat</p>
        <div className="flex-1 min-h-0">
          {chatPanel}
        </div>
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
  const [creatorProfileAvatarUrl, setCreatorProfileAvatarUrl] = useState<string | undefined>();
  const finishingFanRef = useRef(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const initStartedRef = useRef(false);
  const endingSessionRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const creatorName = user?.full_name ?? "You";
  const creatorInitials = user?.avatar_initials ?? "??";
  const creatorColor = user?.avatar_color ?? "bg-violet-600";
  const creatorAvatarUrl = creatorProfileAvatarUrl ?? user?.avatar_url ?? undefined;
  const activeFanRemainingSeconds = getLiveStageRemainingSeconds(currentFan?.admittedAt, currentTime);
  const activeFanElapsedSeconds = getLiveStageElapsedSeconds(currentFan?.admittedAt, currentTime);

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
    const { data: publicProfile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    setCreatorProfileAvatarUrl(publicProfile?.avatar_url ?? undefined);

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
          .select("id, daily_room_url, last_heartbeat_at, started_at")
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
            const tokenData = await readJsonResponse<{ token?: string }>(tokenRes);
            if (tokenData?.token) setToken(tokenData.token);
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
      const activeRemainingSeconds = getLiveStageRemainingSeconds(active?.admitted_at, Date.now());
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
        setCurrentFan(mapLiveQueuePerson(active, "Current Fan"));
      } else {
        setCurrentFan(null);
      }
    }

    fetchQueue(sessionId);
    const channel = supabase
      .channel(`lq-${currentUser.id}-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_queue_entries", filter: `session_id=eq.${sessionId}` }, () => fetchQueue(sessionId))
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` }, (payload: any) => {
        if (shouldRefreshQueueFromLiveSessionChange(payload)) {
          void fetchQueue(sessionId);
        }
      })
      .subscribe();

    function refreshIfVisible() {
      if (document.visibilityState !== "visible") return;
      if (!sessionId) return;
      void fetchQueue(sessionId);
    }

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      supabase.removeChannel(channel);
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
      setStartError("Set an amount per minute in Management before going live.");
      return;
    }
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }
    try {
      const res = await fetch("/api/daily/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userName: user.id }) });
      const data = await readJsonResponse<{ url?: string; token?: string }>(res);
      if (data?.url && data?.token) {
        const supabase = createClient();

        await supabase
          .from("live_sessions")
          .update({ is_active: false, ended_at: new Date().toISOString(), last_heartbeat_at: null })
          .eq("creator_id", user.id)
          .eq("is_active", true);

        const { data: newSession } = await supabase
          .from("live_sessions")
          .insert({ creator_id: user.id, join_fee: latestSettings.liveRate ?? 0, is_active: false, daily_room_url: data.url, last_heartbeat_at: null })
          .select("id")
          .single();

        if (newSession?.id) {
          const sid = newSession.id;
          applySessionId(sid);
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
    if (currentFan && activeFanElapsedSeconds < LIVE_STAGE_MIN_SECONDS) return;
    const supabase = createClient();
    const nextFan = queue[0];
    if (currentFan) {
      await finalizeQueueEntry(currentFan, "completed");
    }
    const { error } = await supabase
      .from("live_queue_entries")
      .update({
        status: "active",
        admitted_at: new Date().toISOString(),
        admitted_daily_session_id: null,
      })
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

  async function kickCurrentFan() {
    if (!currentFan) return;
    try {
      await fetch("/api/live/kick-fan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueEntryId: currentFan.id }),
      });
    } catch {}
    setCurrentFan(null);
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
      <p className="text-brand-ink font-bold text-lg">Resuming Session...</p>
      <p className="text-brand-ink-subtle text-sm mt-1">Please wait while we sync your queue.</p>
    </div>
  );

  if (loadingRate) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" /></div>;

  return (
    <div className="h-full min-h-0 w-full flex flex-col gap-4 overflow-hidden">
      {sessionState === "idle" ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left — full-height camera preview */}
          <div className="rounded-[28px] border border-brand-border bg-brand-surface p-3 md:p-4 flex flex-col gap-3 lg:h-full lg:min-h-0 overflow-hidden">
            <div className="relative flex-1 min-h-[320px] lg:min-h-0 rounded-[20px] bg-[#0f0f1a] overflow-hidden flex items-center justify-center">
              {camOn
                ? <video ref={previewVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                : <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="xl" />}
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
              <div className="absolute left-4 bottom-4 rounded-xl bg-black/45 px-3 py-2 text-white">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Host</p>
                <p className="text-sm font-semibold">{creatorName}</p>
              </div>
              <div className="absolute right-4 bottom-4 flex items-center gap-2">
                <button onClick={() => setMicOn(!micOn)} className={cn("w-11 h-11 rounded-full border flex items-center justify-center backdrop-blur-sm transition-colors", micOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-red-500/40 bg-red-500/20 text-red-400")}>{micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</button>
                <button onClick={() => setCamOn(!camOn)} className={cn("w-11 h-11 rounded-full border flex items-center justify-center backdrop-blur-sm transition-colors", camOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-red-500/40 bg-red-500/20 text-red-400")}>{camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}</button>
              </div>
            </div>
          </div>
          {/* Right — schedule + start */}
          <div className="rounded-[28px] border border-brand-border bg-brand-surface p-5 flex flex-col gap-5 overflow-y-auto lg:h-full lg:min-h-0">
            <div className="rounded-2xl border border-brand-border bg-brand-elevated p-4 text-left">
              <div className="flex items-center gap-2 text-brand-ink">
                <CalendarClock className="w-4 h-4 text-brand-primary" />
                <p className="text-sm font-semibold">Schedule your next live</p>
              </div>
              <p className="mt-3 text-sm text-brand-ink-muted">
                Set your next live time from the dashboard, then come back here when you're ready to go live.
              </p>
              <Link href="/dashboard" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-primary-light hover:underline">
                Open dashboard
              </Link>
            </div>
            {!hasConfiguredLiveRate(liveRate) ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium leading-5 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                Set an amount per minute in Management before going live.
              </div>
            ) : null}
            <Button variant="live" size="xl" onClick={startSession} className="shadow-glow-live w-full">Start Live Session</Button>
            {startError && <p className="text-red-400 text-sm">{startError}</p>}
          </div>
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
          <div className="h-full min-h-0 w-full flex-1">
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
                  creatorAvatarUrl={creatorAvatarUrl}
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
              creatorAvatarUrl={creatorAvatarUrl}
              endSession={endSession}
              admitNext={admitNext}
              kickCurrentFan={kickCurrentFan}
              queueCount={queue.length}
              initialMic={micOn}
              initialCam={camOn}
              activeFanRemainingSeconds={activeFanRemainingSeconds}
              activeFanElapsedSeconds={activeFanElapsedSeconds}
              creatorJoined={creatorJoined}
            />
          </div>
        </CallContainer>
      )}
    </div>
  );
}
