"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Flag, Loader2, Mic, MicOff, Send, Users, Video, VideoOff, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CallContainer } from "@/components/video/CallContainer";
import { RemoteAudioTracks } from "@/components/video/RemoteAudioTracks";
import { useDailyLocalMediaState } from "@/components/video/useDailyLocalMediaState";
import { cn } from "@/lib/utils";
import { LIVE_STAGE_MAX_MINUTES } from "@/lib/live";
import {
  DailyVideo,
  useDaily,
  useLocalSessionId,
} from "@daily-co/daily-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";

// ─── helpers ──────────────────────────────────────────────────────────────

function formatElapsed(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

type QueueEntry = {
  id: string;
  fanId: string;
  fanName: string;
  avatarInitials?: string;
  avatarColor?: string;
  avatarUrl?: string;
};

type ActiveFan = {
  fanId: string;
  fanName: string;
  avatarInitials: string;
  avatarColor: string;
  avatarUrl?: string;
  admittedDailySessionId?: string;
};

function isVideoPlayable(p: any) {
  const s = p?.tracks?.video?.state;
  return s === "playable" || s === "loading";
}

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

function formatQueueStrip(queueEntries: QueueEntry[], queueCount: number) {
  if (queueCount <= 0 || queueEntries.length === 0) return "Queue: No one waiting";

  const names = queueEntries.slice(0, 3).map((entry) => getFirstName(entry.fanName));
  const remainingCount = Math.max(queueCount - names.length, 0);
  const suffix = remainingCount > 0 ? ` · +${remainingCount}` : "";
  return `Queue: ${names.join(" · ")}${suffix}`;
}

function resolveCreatorSession(participants: any[], creatorId: string) {
  const remote = participants.filter((p) => !p?.local);
  return (
    remote.find((p) => p?.user_name === creatorId) ??
    remote.find((p) => isVideoPlayable(p)) ??
    remote[0] ??
    null
  );
}

function resolveActiveFanSession(
  participants: any[],
  creatorSessionId: string | null,
  activeFan: ActiveFan | null
) {
  if (!activeFan) return null;
  const remote = participants.filter(
    (p) => !p?.local && p?.session_id !== creatorSessionId
  );
  if (activeFan.admittedDailySessionId) {
    const explicit = remote.find(
      (p) => p?.session_id === activeFan.admittedDailySessionId
    );
    if (explicit) return explicit;
  }
  return (
    remote.find((p) => p?.user_name === activeFan.fanId) ??
    remote.find((p) => isVideoPlayable(p)) ??
    null
  );
}

const VIDEO_FILL = {
  __html: `
    .m-video, .m-video > div, .m-video > div > div, .m-video video {
      width: 100% !important; height: 100% !important;
    }
    .m-video { position: relative; }
    .m-video video { display: block !important; object-fit: cover !important; transform: none !important; }
    .m-video div[style*='position: absolute'] { display: none !important; }
    @keyframes m-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }
    .m-pulse { animation: m-pulse 2.4s ease-in-out infinite; }
  `,
};

// ─── Inner stage ──────────────────────────────────────────────────────────

function MobileLiveInner({
  creatorId,
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  viewerInitials,
  viewerColor,
  viewerAvatarUrl,
  activeFan,
  isAdmitted,
  stageElapsedSeconds,
  queueCount,
  queueEntries,
  myQueuePosition,
  inQueue,
  sessionId,
  onJoinQueue,
  onLeaveQueue,
  onLeaveStage,
  onExit,
  onStageSessionReady,
}: {
  creatorId: string;
  creatorName: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  viewerInitials: string;
  viewerColor?: string;
  viewerAvatarUrl?: string;
  activeFan: ActiveFan | null;
  isAdmitted: boolean;
  stageElapsedSeconds: number;
  queueCount: number;
  queueEntries: QueueEntry[];
  myQueuePosition: number;
  inQueue: boolean;
  sessionId: string | null;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  onLeaveStage: () => void;
  onExit: () => void;
  onStageSessionReady?: (id: string) => void;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const { user } = useAuthContext();

  const [creatorParticipant, setCreatorParticipant] = useState<any>(null);
  const [activeFanParticipant, setActiveFanParticipant] = useState<any>(null);
  const [localVideoActive, setLocalVideoActive] = useState(false);
  const [audienceCount, setAudienceCount] = useState(0);
  const [micOn, setMicOn] = useState(isAdmitted);
  const [camOn, setCamOn] = useState(isAdmitted);

  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [reportDeliveryState, setReportDeliveryState] = useState<"sent" | "stored_only" | "delivery_failed" | null>(null);
  const queuePreview = useMemo(() => queueEntries.slice(0, 4), [queueEntries]);
  const remainingQueueCount = Math.max(queueCount - queuePreview.length, 0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const profileNameCacheRef = useRef<Record<string, string>>({});
  const [messages, setMessages] = useState<
    { id: string; senderName: string; message: string; isMe: boolean }[]
  >([]);

  useDailyLocalMediaState({
    daily,
    enabled: isAdmitted,
    micOn,
    camOn,
    setMicOn,
    setCamOn,
  });

  // ── sync Daily participants ──────────────────────────────────────────────
  useEffect(() => {
    if (!daily) return;
    const sync = () => {
      const all = Object.values(daily.participants() ?? {}) as any[];
      const creator = resolveCreatorSession(all, creatorId);
      setCreatorParticipant(creator);
      const local = all.find((p: any) => p?.local || p?.session_id === localSessionId);
      setLocalVideoActive(isVideoPlayable(local));
      const fanP = resolveActiveFanSession(all, creator?.session_id ?? null, activeFan);
      setActiveFanParticipant(isAdmitted ? null : fanP);
      const visible = all.filter((p: any) => !p?.hidden).length;
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
  }, [daily, creatorId, activeFan?.admittedDailySessionId, activeFan?.fanId, isAdmitted, localSessionId]);

  async function applyMedia(v: boolean, a: boolean) {
    if (!daily) return;
    try { await daily.startCamera({ startVideoOff: !v, startAudioOff: !a }); } catch {}
    try { daily.setLocalVideo(v); daily.setLocalAudio(a); } catch {}
  }

  useEffect(() => {
    setMicOn(isAdmitted);
    setCamOn(isAdmitted);
    if (isAdmitted) {
      setShowReportForm(false);
      setReportDescription("");
      setReportError(null);
      setReportSent(false);
      setReportDeliveryState(null);
    }
    if (isAdmitted) void applyMedia(true, true);
    else if (daily) { try { daily.setLocalAudio(false); daily.setLocalVideo(false); } catch {} }
  }, [isAdmitted, daily]);

  useEffect(() => {
    if (!isAdmitted || !localSessionId || !onStageSessionReady) return;
    onStageSessionReady(localSessionId);
  }, [isAdmitted, localSessionId, onStageSessionReady]);

  // ── chat ────────────────────────────────────────────────────────────────
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `session_id=eq.${sessionId}` },
        async (payload: any) => {
          let senderName = profileNameCacheRef.current[payload.new.user_id];
          if (!senderName) {
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", payload.new.user_id).single();
            senderName = profile?.full_name ?? "Fan";
            profileNameCacheRef.current[payload.new.user_id] = senderName;
          }
          setMessages((prev) => [...prev, {
            id: payload.new.id,
            senderName,
            message: payload.new.message,
            isMe: payload.new.user_id === user?.id,
          }]);
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
      creator_id: creatorId, session_id: sessionId, user_id: user.id, message: text,
    });
    setSending(false);
  }

  async function sendReport() {
    if (!user?.full_name || !user.email || !reportDescription.trim()) return;

    setReportSubmitting(true);
    setReportError(null);
    setReportDeliveryState(null);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: user.full_name,
          email: user.email,
          subject: "Live call report",
          description: reportDescription.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not send report.");
      }

      setReportSent(true);
      setReportDeliveryState(
        data.emailNotificationConfigured === false
          ? "stored_only"
          : data.emailNotificationSent === false
          ? "delivery_failed"
          : "sent"
      );
      setReportDescription("");
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Could not send report.");
    } finally {
      setReportSubmitting(false);
    }
  }

  // ── derived ──────────────────────────────────────────────────────────────
  const audibleIds = useMemo(() =>
    [creatorParticipant?.session_id, !isAdmitted ? activeFanParticipant?.session_id : null]
      .filter((id): id is string => Boolean(id)),
    [creatorParticipant?.session_id, activeFanParticipant?.session_id, isAdmitted]
  );

  const creatorVideoActive = isVideoPlayable(creatorParticipant);
  const activeFanVideoActive = isVideoPlayable(activeFanParticipant);

  // Show last N messages; 5th-from-bottom fades out
  const visibleMessages = messages.slice(-5);

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-none bg-violet-500" style={MOBILE_LIVE_VIEWPORT_STYLE}>
      <RemoteAudioTracks
        sessionIds={audibleIds}
        className="px-4 pb-1 text-white/70"
        buttonClassName="border-white/20 bg-white/15 text-white hover:bg-white/20"
      />
      <style dangerouslySetInnerHTML={VIDEO_FILL} />

      {/* ── Header ── */}
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
        <div className="flex items-center gap-2">
          {!isAdmitted ? (
            <button
              onClick={() => {
                setShowReportForm((current) => !current);
                setReportError(null);
                setReportSent(false);
                setReportDeliveryState(null);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold text-white transition-all active:scale-95"
              aria-label="Report live call"
            >
              <Flag className="h-3.5 w-3.5" />
              Report
            </button>
          ) : null}
          <div className="flex items-center gap-1.5 bg-[#1a1a3e] rounded-full px-3.5 py-1.5">
            <Users className="w-3 h-3 text-white/60" />
            <span className="text-white text-sm font-semibold tabular-nums">
              {audienceCount > 0 ? audienceCount : queueCount}
            </span>
          </div>
        </div>
      </div>

      {!isAdmitted && showReportForm ? (
        <div className="mx-4 mb-2 rounded-2xl bg-[#1a1a3e] px-4 py-4 text-white shrink-0">
          <p className="text-sm font-semibold">Report this live call</p>
          <p className="mt-1 text-xs leading-5 text-white/65">
            This sends a support request with the subject Live call report.
          </p>
          <textarea
            value={reportDescription}
            onChange={(event) => setReportDescription(event.target.value)}
            rows={4}
            placeholder="Tell us what happened so our team can review it."
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/25"
          />
          {reportError ? <p className="mt-2 text-xs text-red-200">{reportError}</p> : null}
          {reportSent && reportDeliveryState === "sent" ? (
            <p className="mt-2 text-xs text-emerald-200">Report sent and forwarded to support.</p>
          ) : null}
          {reportSent && reportDeliveryState === "stored_only" ? (
            <p className="mt-2 text-xs text-amber-200">Report saved, but support email forwarding is not configured yet.</p>
          ) : null}
          {reportSent && reportDeliveryState === "delivery_failed" ? (
            <p className="mt-2 text-xs text-amber-200">Report saved, but the support email did not send successfully.</p>
          ) : null}
          {!user?.full_name || !user.email ? (
            <p className="mt-2 text-xs text-amber-200">You need a signed-in account email to send a report.</p>
          ) : null}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowReportForm(false);
                setReportError(null);
                setReportSent(false);
                setReportDeliveryState(null);
              }}
              className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white transition-all active:scale-95"
            >
              Close
            </button>
            <button
              onClick={() => void sendReport()}
              disabled={reportSubmitting || !reportDescription.trim() || !user?.full_name || !user.email}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-violet-700 transition-all active:scale-95 disabled:opacity-50"
            >
              {reportSubmitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</> : "Send report"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Pulsating status ── */}
      <div className="shrink-0 px-4 pb-1.5">
        <p className={cn("text-xs font-semibold text-white m-pulse", isAdmitted ? "text-violet-100" : "text-white")}>
          {isAdmitted ? "You're on camera" : myQueuePosition > 0 ? `You're in line · #${myQueuePosition}` : "Watching live"}
        </p>
      </div>

      {/* ── Video card ── */}
      <div
        className={cn("relative mx-3", chatCollapsed ? "flex-1 min-h-0 mb-5" : "shrink-0 mb-4")}
        style={chatCollapsed ? undefined : { height: "min(36dvh, 320px)" }}
      >
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ boxShadow: "0 0 0 2px rgba(192,132,252,0.7), 0 0 24px 4px rgba(168,85,247,0.35)" }}
        />
        <div className="relative h-full w-full rounded-2xl overflow-hidden bg-[#1a1a3e]">
          {creatorParticipant?.session_id && creatorVideoActive ? (
            <div className="m-video h-full w-full">
              <DailyVideo sessionId={creatorParticipant.session_id} type="video" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3">
              <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="xl" />
              <p className="text-white/50 text-xs">
                {creatorParticipant ? `${creatorName}'s camera is off` : "Connecting..."}
              </p>
            </div>
          )}
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent pointer-events-none" />

          {/* Chat collapse/expand toggle */}
          <button
            onClick={() => setChatCollapsed((v) => !v)}
            className="absolute top-2.5 right-2.5 z-10 flex h-8 items-center gap-1 rounded-full bg-black/40 px-2.5 text-[11px] font-semibold text-white backdrop-blur-sm active:scale-95 transition-all"
            aria-label={chatCollapsed ? "Show chat" : "Hide chat"}
          >
            {chatCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span>{chatCollapsed ? "Chat" : "Hide"}</span>
          </button>

          {/* PiP — bottom right */}
          <div className="absolute bottom-2.5 right-2.5 w-[28%] aspect-video rounded-xl overflow-hidden bg-[#2d2d5e] shadow-md">
            {isAdmitted && localSessionId && camOn && localVideoActive ? (
              <div className="m-video h-full w-full">
                <DailyVideo sessionId={localSessionId} type="video" mirror className="h-full w-full object-cover" />
              </div>
            ) : !isAdmitted && activeFanParticipant && activeFanVideoActive ? (
              <div className="m-video h-full w-full">
                <DailyVideo sessionId={activeFanParticipant.session_id} type="video" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                {isAdmitted
                  ? <Avatar initials={viewerInitials} color={viewerColor} size="sm" />
                  : activeFan
                  ? <Avatar initials={activeFan.avatarInitials} color={activeFan.avatarColor} imageUrl={activeFan.avatarUrl} size="sm" />
                  : <Users className="w-4 h-4 text-white/30" />}
              </div>
            )}
          </div>

          {/* mic/cam + X controls when admitted */}
          {isAdmitted && (
            <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
              <button
                onClick={async () => { const n = !micOn; setMicOn(n); await applyMedia(camOn, n); }}
                className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border backdrop-blur-sm",
                  micOn ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-red-400/50 bg-red-500/20 text-red-300")}
              >{micOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}</button>
              <button
                onClick={async () => { const n = !camOn; setCamOn(n); await applyMedia(n, micOn); }}
                className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border backdrop-blur-sm",
                  camOn ? "border-violet-400/50 bg-violet-500/20 text-white" : "border-red-400/50 bg-red-500/20 text-red-300")}
              >{camOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}</button>
              <button
                onClick={onLeaveStage}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border border-white/20 bg-black/30 backdrop-blur-sm text-white"
                title="Return to spectator"
              ><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      </div>

      {/* ── Queue strip ── */}
      

      {/* ── Action buttons ── */}
      

      {/* ── White panel ── */}
      <div
        className={cn(
          "mt-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[32px] border-t border-white/70 bg-white shadow-[0_-18px_40px_rgba(15,23,42,0.18)]",
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
                    {queuePreview.map((entry, index) => (
                      <Avatar
                        key={entry.id}
                        initials={entry.avatarInitials || getDisplayInitial(entry.fanName)}
                        color={entry.avatarColor}
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
                      {myQueuePosition > 0
                        ? `You're in line at #${myQueuePosition}.`
                        : "Fans will appear here as they join the live queue."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No one is waiting yet.</p>
              )}
            </div>

            <div className="w-[140px] shrink-0">
              {isAdmitted ? (
                <button
                  onClick={onLeaveStage}
                  className="w-full rounded-full bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                >
                  End Call
                </button>
              ) : inQueue ? (
                <button
                  onClick={onLeaveQueue}
                  className="w-full rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all active:scale-[0.98]"
                >
                  Leave Queue
                </button>
              ) : (
                <button
                  onClick={onJoinQueue}
                  className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                >
                  Join Queue
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Chat messages — last 5, oldest fades via gradient overlay */}
        <div className="relative min-h-0 flex-1 overflow-hidden px-4 pt-4">
          {/* White gradient fade over top messages */}
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
          <div className="flex h-full flex-col justify-end gap-1.5 pb-1.5">
            {visibleMessages.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-2">Say something!</p>
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
                  <div className={cn(
                    "max-w-[72%] rounded-2xl px-3 py-1.5 text-sm",
                    msg.isMe ? "bg-violet-500 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  )}>
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
            placeholder="Say something..."
            style={{ fontSize: '16px', touchAction: 'manipulation' }}
            className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-violet-300 transition-all"
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

// ─── Public wrapper ────────────────────────────────────────────────────────

export function MobilePublicLiveRoom({
  roomUrl,
  token,
  creatorId,
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  viewerInitials,
  viewerColor,
  viewerAvatarUrl,
  activeFan,
  isAdmitted,
  stageElapsedSeconds,
  queueCount,
  queueEntries,
  myQueuePosition,
  inQueue,
  sessionId,
  onJoinQueue,
  onLeaveQueue,
  onLeaveStage,
  onExit,
  onStageSessionReady,
}: {
  roomUrl: string;
  token: string;
  creatorId: string;
  creatorName: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  viewerInitials: string;
  viewerColor?: string;
  viewerAvatarUrl?: string;
  activeFan: ActiveFan | null;
  isAdmitted: boolean;
  stageElapsedSeconds: number;
  queueCount: number;
  queueEntries: QueueEntry[];
  myQueuePosition: number;
  inQueue: boolean;
  sessionId: string | null;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  onLeaveStage: () => void;
  onExit: () => void;
  onStageSessionReady?: (dailySessionId: string) => void;
}) {
  return (
    <CallContainer url={roomUrl} token={token} startVideo={false} startAudio={false}>
      <MobileLiveInner
        creatorId={creatorId}
        creatorName={creatorName}
        creatorInitials={creatorInitials}
        creatorColor={creatorColor}
        creatorAvatarUrl={creatorAvatarUrl}
        viewerInitials={viewerInitials}
        viewerColor={viewerColor}
        viewerAvatarUrl={viewerAvatarUrl}
        activeFan={activeFan}
        isAdmitted={isAdmitted}
        stageElapsedSeconds={stageElapsedSeconds}
        queueCount={queueCount}
        queueEntries={queueEntries}
        myQueuePosition={myQueuePosition}
        inQueue={inQueue}
        sessionId={sessionId}
        onJoinQueue={onJoinQueue}
        onLeaveQueue={onLeaveQueue}
        onLeaveStage={onLeaveStage}
        onExit={onExit}
        onStageSessionReady={onStageSessionReady}
      />
    </CallContainer>
  );
}
