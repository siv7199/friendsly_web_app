"use client";

import Link from "next/link";

// MobileLiveConsole — iPhone-only creator Go-Live screen.
// Mirrors the visual language of components/mobile/MobileLiveStage.tsx (the fan
// mobile live page). The session lifecycle is duplicated from
// components/creator/LiveConsole.tsx to keep desktop behavior untouched; if the
// desktop logic changes, this file needs the same change.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Mic, MicOff, Send, ShieldX, SkipForward, StopCircle, Users, Video, VideoOff, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CallContainer } from "@/components/video/CallContainer";
import { useAuthContext } from "@/lib/context/AuthContext";
import { readJsonResponse } from "@/lib/http";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LIVE_STAGE_MAX_MINUTES,
  LIVE_STAGE_MIN_SECONDS,
  LIVE_STAGE_SECONDS,
  getLiveStageElapsedSeconds,
  getLiveStageRemainingSeconds,
} from "@/lib/live";
import {
  DailyAudioTrack,
  DailyVideo,
  useDaily,
  useLocalSessionId,
} from "@daily-co/daily-react";

const LIVE_SESSION_HEARTBEAT_MS = 15000;
const LIVE_SESSION_STALE_MS = 45000;

const MOBILE_LIVE_VIEWPORT_STYLE = {
  height: "100dvh",
  maxHeight: "100dvh",
  paddingTop: "calc(env(safe-area-inset-top) + 6px)",
  backgroundColor: "#8b5cf6",
};

function getDisplayInitial(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed?.[0]?.toUpperCase() ?? "F";
}

function getFirstName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.split(" ")[0] : "Fan";
}

function isVideoPlayable(p: any) {
  const s = p?.tracks?.video?.state;
  return s === "playable" || s === "loading";
}

function formatCountdown(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

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

function mapLiveQueuePerson(entry: any, fallbackName: string) {
  const profile = entry?.profiles;
  return {
    id: entry.id,
    fanId: entry.fan_id,
    fanName: profile?.full_name ?? fallbackName,
    avatarInitials: profile?.avatar_initials ?? "F",
    avatarColor: profile?.avatar_color ?? "bg-brand-primary",
    avatarUrl: profile?.avatar_url ?? undefined,
    admittedDailySessionId: entry.admitted_daily_session_id ?? undefined,
    admittedAt: entry.admitted_at,
  };
}

const VIDEO_FILL = {
  __html: `
    .m-live-video, .m-live-video > div, .m-live-video > div > div, .m-live-video video {
      width: 100% !important; height: 100% !important;
    }
    .m-live-video { position: relative; }
    .m-live-video video { display: block !important; object-fit: cover !important; transform: none !important; }
    .m-live-video div[style*='position: absolute'] { display: none !important; }
    @keyframes m-live-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }
    .m-live-pulse { animation: m-live-pulse 2.4s ease-in-out infinite; }
  `,
};

// ─── Live stage (creator side) ───────────────────────────────────────────

function CreatorMobileLiveStage({
  creatorId,
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  currentFan,
  queue,
  queueCount,
  activeFanElapsedSeconds,
  initialMic,
  initialCam,
  onAdmitNext,
  onKickCurrentFan,
  onEndSession,
  onExit,
  sessionId,
}: {
  creatorId: string;
  creatorName: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  currentFan: any;
  queue: any[];
  queueCount: number;
  activeFanElapsedSeconds: number;
  initialMic: boolean;
  initialCam: boolean;
  onAdmitNext: () => void;
  onKickCurrentFan: () => void;
  onEndSession: () => void;
  onExit: () => void;
  sessionId: string | null;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const { user } = useAuthContext();

  const [micOn, setMicOn] = useState(initialMic);
  const [camOn, setCamOn] = useState(initialCam);
  const [localVideoActive, setLocalVideoActive] = useState(false);
  const [fanParticipant, setFanParticipant] = useState<any>(null);
  const [audienceCount, setAudienceCount] = useState(0);

  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const profileNameCacheRef = useRef<Record<string, string>>({});
  const [messages, setMessages] = useState<
    { id: string; senderName: string; message: string; isMe: boolean }[]
  >([]);

  // Sync media when mic/cam toggled
  useEffect(() => {
    if (!daily) return;
    try { daily.setLocalAudio(micOn); } catch {}
  }, [daily, micOn]);

  useEffect(() => {
    if (!daily) return;
    try { daily.setLocalVideo(camOn); } catch {}
  }, [daily, camOn]);

  // Daily participant sync
  useEffect(() => {
    if (!daily) return;
    const sync = () => {
      const all = Object.values(daily.participants() ?? {}) as any[];
      const local = all.find((p) => p?.local || p?.session_id === localSessionId);
      setLocalVideoActive(isVideoPlayable(local));

      const remote = all.filter((p) => !p?.local);
      let fanP: any = null;
      if (currentFan?.fanId) {
        if (currentFan.admittedDailySessionId) {
          fanP = remote.find((p) => p?.session_id === currentFan.admittedDailySessionId) ?? null;
        }
        if (!fanP) {
          fanP = remote.find((p) => p?.user_name === currentFan.fanId) ?? null;
        }
        if (!fanP) {
          fanP = remote.find((p) => isVideoPlayable(p)) ?? null;
        }
      }
      setFanParticipant(fanP);

      const visible = all.filter((p) => !p?.hidden).length;
      setAudienceCount(Math.max(daily?.participantCounts?.().present ?? 0, visible));
    };
    sync();
    daily.on("participant-joined", sync);
    daily.on("participant-updated", sync);
    daily.on("participant-left", sync);
    return () => {
      daily.off("participant-joined", sync);
      daily.off("participant-updated", sync);
      daily.off("participant-left", sync);
    };
  }, [daily, currentFan?.fanId, currentFan?.admittedDailySessionId, localSessionId]);

  // Chat (same wiring as MobileLiveStage)
  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();
    supabase
      .from("live_chat_messages")
      .select("id, message, user_id, profiles(full_name)")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }: { data: any[] | null }) => {
        if (!data) return;
        profileNameCacheRef.current = data.reduce((cache, message: any) => {
          if (message.user_id) {
            cache[message.user_id] = message.profiles?.full_name ?? "Fan";
          }
          return cache;
        }, {} as Record<string, string>);
        setMessages(data.map((m: any) => ({
          id: m.id,
          senderName: m.profiles?.full_name ?? "Fan",
          message: m.message,
          isMe: m.user_id === user?.id,
        })));
      });
    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `session_id=eq.${sessionId}` },
        async (payload: any) => {
          let senderName = profileNameCacheRef.current[payload.new.user_id];
          if (!senderName) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", payload.new.user_id)
              .single();
            senderName = profile?.full_name ?? "Fan";
            profileNameCacheRef.current[payload.new.user_id] = senderName;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: payload.new.id,
              senderName,
              message: payload.new.message,
              isMe: payload.new.user_id === user?.id,
            },
          ]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, user?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendChat() {
    const text = chatText.trim();
    if (!text || !sessionId || !user) return;
    setSending(true);
    setChatText("");
    const supabase = createClient();
    await supabase.from("live_chat_messages").insert({
      creator_id: creatorId,
      session_id: sessionId,
      user_id: user.id,
      message: text,
    });
    setSending(false);
  }

  const audibleIds = useMemo(
    () => [fanParticipant?.session_id].filter((id): id is string => Boolean(id)),
    [fanParticipant?.session_id]
  );

  const fanVideoActive = isVideoPlayable(fanParticipant);
  const visibleMessages = messages.slice(-5);
  const admitDisabledByMin = Boolean(currentFan) && activeFanElapsedSeconds < LIVE_STAGE_MIN_SECONDS;
  const queuePreview = queue.slice(0, 4);
  const remainingQueueCount = Math.max(queueCount - queuePreview.length, 0);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-none bg-violet-500" style={MOBILE_LIVE_VIEWPORT_STYLE}>
      {audibleIds.map((id) => (
        <DailyAudioTrack key={id} sessionId={id} />
      ))}
      <style dangerouslySetInnerHTML={VIDEO_FILL} />

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-1.5">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-all"
            aria-label="Leave live"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <span className="text-white text-xl font-brand tracking-tight select-none">friendsly</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#1a1a3e] rounded-full px-3.5 py-1.5">
          <Users className="w-3 h-3 text-white/60" />
          <span className="text-white text-sm font-semibold tabular-nums">
            {audienceCount > 0 ? audienceCount : queueCount}
          </span>
        </div>
      </div>

      {/* Status line */}
      <div className="shrink-0 px-4 pb-1.5">
        <p className="text-xs font-semibold text-white m-live-pulse">
          {currentFan
            ? `On stage with ${currentFan.fanName} · ${formatCountdown(activeFanElapsedSeconds)} / ${LIVE_STAGE_MAX_MINUTES}:00`
            : queueCount > 0
              ? `${queueCount} ${queueCount === 1 ? "fan" : "fans"} in line`
              : "No one in line"}
        </p>
      </div>

      {/* Video card */}
      <div
        className={cn("relative mx-3", chatCollapsed ? "mb-5 flex-1 min-h-0" : "mb-4 shrink-0")}
        style={chatCollapsed ? undefined : { height: "min(36dvh, 320px)" }}
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ boxShadow: "0 0 0 2px rgba(192,132,252,0.7), 0 0 24px 4px rgba(168,85,247,0.35)" }}
        />
        <div className="relative h-full w-full rounded-2xl overflow-hidden bg-[#1a1a3e]">
          {localSessionId && camOn && localVideoActive ? (
            <div className="m-live-video h-full w-full">
              <DailyVideo sessionId={localSessionId} type="video" mirror className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3">
              <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="xl" />
              <p className="text-white/50 text-xs">{camOn ? "Connecting camera…" : "Camera is off"}</p>
            </div>
          )}
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent pointer-events-none" />
          <button
            onClick={() => setChatCollapsed((value) => !value)}
            className="absolute right-2.5 top-2.5 z-10 flex h-8 items-center gap-1 rounded-full bg-black/40 px-2.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-all active:scale-95"
            aria-label={chatCollapsed ? "Show chat" : "Hide chat"}
          >
            {chatCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>{chatCollapsed ? "Chat" : "Hide"}</span>
          </button>

          {/* PiP — current fan */}
          <div className="absolute bottom-2.5 right-2.5 w-[28%] aspect-video rounded-xl overflow-hidden bg-[#2d2d5e] shadow-md">
            {currentFan && fanParticipant && fanVideoActive ? (
              <div className="m-live-video h-full w-full">
                <DailyVideo sessionId={fanParticipant.session_id} type="video" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                {currentFan ? (
                  <Avatar initials={currentFan.avatarInitials} color={currentFan.avatarColor} imageUrl={currentFan.avatarUrl} size="sm" />
                ) : (
                  <Users className="w-4 h-4 text-white/30" />
                )}
              </div>
            )}
          </div>

          {/* Mic / Cam controls */}
          <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
            <button
              onClick={() => setMicOn((v) => !v)}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border backdrop-blur-sm",
                micOn ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-red-400/50 bg-red-500/20 text-red-300"
              )}
            >
              {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setCamOn((v) => !v)}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border backdrop-blur-sm",
                camOn ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-red-400/50 bg-red-500/20 text-red-300"
              )}
            >
              {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* White panel */}
      <div
        className={cn(
          "mt-0 flex min-h-[36dvh] flex-1 flex-col overflow-hidden rounded-t-[32px] border-t border-white/70 bg-white shadow-[0_-18px_40px_rgba(15,23,42,0.18)]",
          chatCollapsed && "hidden"
        )}
      >
        <div className="shrink-0 border-b border-slate-200/80 px-4 pb-3 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Queue
              </p>
              {queueCount > 0 ? (
                <div className="mt-2 flex items-center">
                  <div className="flex items-center">
                    {queuePreview.map((entry: any, index: number) => (
                      <Avatar
                        key={entry.id}
                        initials={entry.avatarInitials ?? getDisplayInitial(entry.fanName)}
                        color={entry.avatarColor ?? "bg-brand-primary"}
                        imageUrl={entry.avatarUrl}
                        size="sm"
                        className={cn(index > 0 ? "-ml-2 ring-2 ring-white" : "ring-2 ring-white")}
                      />
                    ))}
                    {remainingQueueCount > 0 ? (
                      <div className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white ring-2 ring-white">
                        +{remainingQueueCount}
                      </div>
                    ) : null}
                  </div>
                  <div className="ml-3 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {queueCount} {queueCount === 1 ? "person" : "people"} waiting
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {currentFan
                        ? `${getFirstName(currentFan.fanName)} is on stage right now.`
                        : "Fans will appear here as they join the live queue."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No one is waiting yet.</p>
              )}
            </div>

            <div className="flex w-[144px] shrink-0 flex-col gap-2">
              <button
                onClick={onAdmitNext}
                disabled={queueCount < 1 || admitDisabledByMin}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50"
              >
                <SkipForward className="w-3.5 h-3.5" />
                {admitDisabledByMin
                  ? `Min ${formatCountdown(LIVE_STAGE_MIN_SECONDS - activeFanElapsedSeconds)}`
                  : currentFan ? "Next fan" : "Admit"}
              </button>
              <button
                onClick={onKickCurrentFan}
                disabled={!currentFan}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40"
              >
                <ShieldX className="w-3.5 h-3.5" />
                Kick fan
              </button>
              <button
                onClick={onEndSession}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
              >
                <StopCircle className="w-3.5 h-3.5" />
                End
              </button>
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="relative min-h-0 flex-1 overflow-hidden px-4">
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
          <div className="flex h-full flex-col justify-end gap-1.5 pb-1.5">
            {visibleMessages.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-2">Chat is quiet — say hi to your fans</p>
            )}
            {visibleMessages.map((msg, i) => {
              const isFaded = i === 0 && visibleMessages.length >= 5;
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2", msg.isMe && "justify-end", isFaded && "opacity-20")}
                >
                  {!msg.isMe && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-slate-500">{getDisplayInitial(msg.senderName)}</span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[72%] rounded-2xl px-3 py-1.5 text-sm",
                      msg.isMe ? "bg-violet-500 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
                    )}
                  >
                    {!msg.isMe && (
                      <p className="text-[10px] font-semibold text-slate-500 mb-0.5">{msg.senderName}</p>
                    )}
                    <p className="leading-snug">{msg.message}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Chat input */}
        <div
          className="flex shrink-0 items-center gap-2 px-4 pt-1.5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
        >
          <input
            type="text"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void sendChat(); }}
            placeholder="Reply to your fans…"
            style={{ fontSize: "16px", touchAction: "manipulation" }}
            className="flex-1 min-w-0 bg-slate-100 rounded-full px-4 py-2.5 text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-violet-300 transition-all"
          />
          <button
            onClick={() => void sendChat()}
            disabled={!chatText.trim() || sending}
            className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Top-level container ─────────────────────────────────────────────────

type SessionState = "idle" | "live";

export function MobileLiveConsole() {
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
      .select("live_join_fee")
      .eq("id", userId)
      .maybeSingle();
    const { data: publicProfile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", userId)
      .maybeSingle();

    setCreatorProfileAvatarUrl(publicProfile?.avatar_url ?? undefined);

    const parsedRate = profile?.live_join_fee != null ? Number(profile.live_join_fee) : null;

    setLiveRate(parsedRate);

    return {
      liveRate: parsedRate,
    };
  }

  // Camera preview while idle
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

  // Tick clock
  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Initial load — resume an active session if one exists
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
              body: JSON.stringify({
                roomName: existingSession.daily_room_url.split("/").pop(),
                isOwner: true,
                userName: currentUser.id,
              }),
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
      } catch {} finally {
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

  // Queue subscription
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
        avatarInitials: e.profiles.avatar_initials,
        avatarColor: e.profiles.avatar_color,
        avatarUrl: e.profiles.avatar_url ?? undefined,
        admittedDailySessionId: e.admitted_daily_session_id ?? undefined,
        position: idx + 1,
        waitSeconds: activeRemainingSeconds + (idx * LIVE_STAGE_SECONDS),
        topic: e.topic ?? undefined,
        joinedAt: e.joined_at,
        creator_id: currentUser.id,
      })));

      if (active) setCurrentFan(mapLiveQueuePerson(active, "Current Fan"));
      else setCurrentFan(null);
    }

    fetchQueue(sessionId);
    const channel = supabase
      .channel(`lq-mobile-${currentUser.id}-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_queue_entries", filter: `session_id=eq.${sessionId}` }, () => fetchQueue(sessionId))
      .on("postgres_changes", { event: "*", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` }, (payload: any) => {
        if (shouldRefreshQueueFromLiveSessionChange(payload)) void fetchQueue(sessionId);
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

  // Beforeunload disconnect
  useEffect(() => {
    if (sessionState !== "live" || !user) return;
    const handleUnload = () => {
      if (sessionId) {
        navigator.sendBeacon(
          "/api/live/disconnect",
          new Blob([JSON.stringify({ creatorId: user.id, sessionId })], { type: "application/json" })
        );
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [user, sessionId, sessionState]);

  // Heartbeat
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

  // Auto-finish on stage timeout
  useEffect(() => {
    if (!currentFan?.admittedAt || finishingFanRef.current) return;
    if (activeFanRemainingSeconds > 0) return;
    finishingFanRef.current = true;
    finalizeQueueEntry(currentFan, "completed").finally(() => {
      setCurrentFan(null);
      finishingFanRef.current = false;
    });
  }, [activeFanRemainingSeconds, currentFan]);

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
      const res = await fetch("/api/daily/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: user.id }),
      });
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
    if (currentFan) await finalizeQueueEntry(currentFan, "completed");
    const { error } = await supabase
      .from("live_queue_entries")
      .update({ status: "active", admitted_at: new Date().toISOString(), admitted_daily_session_id: null })
      .eq("id", nextFan.id);
    if (!error) setCurrentFan({ ...nextFan, admittedAt: new Date().toISOString() });
  }

  async function endSession() {
    if (!user || !sessionId) return;
    endingSessionRef.current = true;
    if (currentFan) await finalizeQueueEntry(currentFan, "completed");
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
    window.setTimeout(() => { endingSessionRef.current = false; }, 1000);
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

  async function handleExitLive() {
    if (sessionState === "live" && sessionId) {
      await endSession();
    }
    window.location.replace("/dashboard");
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

  if (initializing) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] flex-col items-center justify-center bg-violet-500 px-6 text-center overflow-hidden" style={MOBILE_LIVE_VIEWPORT_STYLE}>
        <Loader2 className="w-10 h-10 text-white animate-spin mb-4" />
        <p className="text-white font-bold text-base">Resuming session…</p>
        <p className="text-white/70 text-sm mt-1">Syncing your live queue.</p>
      </div>
    );
  }

  if (loadingRate) {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] items-center justify-center overflow-hidden bg-violet-500" style={MOBILE_LIVE_VIEWPORT_STYLE}>
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Idle (pre-live) ───────────────────────────────────────────────
  if (sessionState === "idle") {
    return (
      <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-none bg-violet-500" style={MOBILE_LIVE_VIEWPORT_STYLE}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 pb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.replace("/dashboard")}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center active:scale-95 transition-all"
              aria-label="Back"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <span className="text-white text-xl font-brand tracking-tight select-none">friendsly</span>
          </div>
        </div>

        {/* Camera preview card */}
        <div className="relative mx-3 shrink-0" style={{ height: "min(36dvh, 320px)" }}>
          <div
            className="absolute inset-0 rounded-2xl"
            style={{ boxShadow: "0 0 0 2px rgba(192,132,252,0.7), 0 0 24px 4px rgba(168,85,247,0.35)" }}
          />
          <div className="relative h-full w-full rounded-2xl overflow-hidden bg-[#1a1a3e] flex items-center justify-center">
            {camOn ? (
              <video ref={previewVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="xl" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
            <div className="absolute left-3 bottom-3 rounded-xl bg-black/45 px-3 py-1.5 text-white">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Host</p>
              <p className="text-sm font-semibold">{creatorName}</p>
            </div>
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
              <button
                onClick={() => setMicOn((v) => !v)}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border backdrop-blur-sm",
                  micOn ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-red-400/50 bg-red-500/20 text-red-300"
                )}
              >
                {micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setCamOn((v) => !v)}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border backdrop-blur-sm",
                  camOn ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-red-400/50 bg-red-500/20 text-red-300"
                )}
              >
                {camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* White panel — schedule + start */}
        <div
          className="mt-3 shrink-0 rounded-t-3xl bg-white/98 px-4 pt-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Mobile Live</p>
            <p className="mt-2 text-sm text-slate-700">
              Check your framing, then start your live. Scheduling now lives on the dashboard.
            </p>
            <Link
              href="/dashboard"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline"
            >
              Go to dashboard
            </Link>
          </div>

          {!hasConfiguredLiveRate(liveRate) ? (
            <div className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium leading-5 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
              Set an amount per minute in Management before going live.
            </div>
          ) : null}

          <button
            onClick={startSession}
            className="mt-3 w-full rounded-full bg-red-500 py-3 text-base font-semibold text-white transition-all active:scale-[0.98] shadow-[0_18px_40px_rgba(239,68,68,0.35)]"
          >
            Start Live Session
          </button>
          {startError ? <p className="text-red-500 text-sm text-center">{startError}</p> : null}
        </div>
      </div>
    );
  }

  // ── Live ──────────────────────────────────────────────────────────
  return (
    <CallContainer
      url={roomUrl}
      token={token}
      startVideo={camOn}
      startAudio={micOn}
      onJoin={handleCreatorJoined}
      onLeave={handleCreatorLeft}
    >
      <CreatorMobileLiveStage
        creatorId={user?.id ?? ""}
        creatorName={creatorName}
        creatorInitials={creatorInitials}
        creatorColor={creatorColor}
        creatorAvatarUrl={creatorAvatarUrl}
        currentFan={currentFan}
        queue={queue}
        queueCount={queue.length}
        activeFanElapsedSeconds={activeFanElapsedSeconds}
        initialMic={micOn}
        initialCam={camOn}
        onAdmitNext={admitNext}
        onKickCurrentFan={kickCurrentFan}
        onEndSession={endSession}
        onExit={handleExitLive}
        sessionId={sessionId}
      />
    </CallContainer>
  );
}
