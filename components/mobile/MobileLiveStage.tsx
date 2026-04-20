"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Clock, Send, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CallContainer } from "@/components/video/CallContainer";
import { cn } from "@/lib/utils";
import { LIVE_STAGE_MAX_MINUTES } from "@/lib/live";
import {
  DailyAudioTrack,
  DailyVideo,
  useDaily,
  useLocalSessionId,
} from "@daily-co/daily-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";

// ─── helpers (mirrors PublicLiveRoom internals) ────────────────────────────

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

function resolveCreatorSession(participants: any[], creatorId: string) {
  const remote = participants.filter((p) => !p?.local);
  const byName = remote.find((p) => p?.user_name === creatorId);
  if (byName?.session_id) return byName;
  const withVideo = remote.find((p) => isVideoPlayable(p));
  return withVideo ?? remote[0] ?? null;
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
  const byName = remote.find((p) => p?.user_name === activeFan.fanId);
  if (byName) return byName;
  return remote.find((p) => isVideoPlayable(p)) ?? null;
}

// ─── Daily video fill CSS ──────────────────────────────────────────────────

const VIDEO_FILL = {
  __html: `
    .m-video, .m-video > div, .m-video > div > div, .m-video video {
      width: 100% !important; height: 100% !important;
    }
    .m-video { position: relative; }
    .m-video video { display: block !important; object-fit: cover !important; transform: none !important; }
    .m-video div[style*='position: absolute'] { display: none !important; }
  `,
};

// ─── Inner stage (rendered inside DailyProvider via CallContainer) ─────────

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
  sessionId,
  onLeaveQueue,
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
  sessionId: string | null;
  onLeaveQueue: () => void;
  onStageSessionReady?: (sessionId: string) => void;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const { user } = useAuthContext();

  const [creatorParticipant, setCreatorParticipant] = useState<any>(null);
  const [activeFanParticipant, setActiveFanParticipant] = useState<any>(null);
  const [localVideoActive, setLocalVideoActive] = useState(false);
  const [micOn, setMicOn] = useState(isAdmitted);
  const [camOn, setCamOn] = useState(isAdmitted);

  // chat
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<
    { id: string; senderName: string; message: string; isMe: boolean }[]
  >([]);

  // ── sync Daily participants ──────────────────────────────────────────────
  useEffect(() => {
    if (!daily) return;
    const sync = () => {
      const all = Object.values(daily.participants() ?? {}) as any[];
      const creator = resolveCreatorSession(all, creatorId);
      setCreatorParticipant(creator);

      const local = all.find((p) => p?.local || p?.session_id === localSessionId);
      setLocalVideoActive(isVideoPlayable(local));

      const fanParticipant = resolveActiveFanSession(
        all,
        creator?.session_id ?? null,
        activeFan
      );
      setActiveFanParticipant(isAdmitted ? null : fanParticipant);
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

  // ── media on admit ───────────────────────────────────────────────────────
  async function applyMedia(v: boolean, a: boolean) {
    if (!daily) return;
    try { await daily.startCamera({ startVideoOff: !v, startAudioOff: !a }); } catch {}
    try { daily.setLocalVideo(v); daily.setLocalAudio(a); } catch {}
  }

  useEffect(() => {
    setMicOn(isAdmitted);
    setCamOn(isAdmitted);
    if (isAdmitted) void applyMedia(true, true);
    else if (daily) { try { daily.setLocalAudio(false); daily.setLocalVideo(false); } catch {} }
  }, [isAdmitted, daily]);

  useEffect(() => {
    if (!isAdmitted || !localSessionId || !onStageSessionReady) return;
    onStageSessionReady(localSessionId);
  }, [isAdmitted, localSessionId, onStageSessionReady]);

  // ── chat subscription ────────────────────────────────────────────────────
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
        setMessages(
          data.map((m: any) => ({
            id: m.id,
            senderName: m.profiles?.full_name ?? "Fan",
            message: m.message,
            isMe: m.user_id === user?.id,
          }))
        );
      });

    const channel = supabase
      .channel(`chat:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `session_id=eq.${sessionId}` },
        async (payload: any) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", payload.new.user_id)
            .single();
          setMessages((prev) => [
            ...prev,
            {
              id: payload.new.id,
              senderName: profile?.full_name ?? "Fan",
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

  // ── derived ──────────────────────────────────────────────────────────────
  const audibleIds = useMemo(
    () =>
      [
        creatorParticipant?.session_id,
        !isAdmitted ? activeFanParticipant?.session_id : null,
      ].filter((id): id is string => Boolean(id)),
    [creatorParticipant?.session_id, activeFanParticipant?.session_id, isAdmitted]
  );

  const creatorVideoActive = isVideoPlayable(creatorParticipant);
  const activeFanVideoActive = isVideoPlayable(activeFanParticipant);
  const showActiveFanPip = !isAdmitted && activeFanParticipant;

  const statusLabel = isAdmitted
    ? "You're on stage"
    : myQueuePosition > 0
    ? `You're in line`
    : "Watching live";

  const statusSub = isAdmitted
    ? `${formatElapsed(stageElapsedSeconds)} of ${LIVE_STAGE_MAX_MINUTES}:00 max`
    : myQueuePosition > 0
    ? `Get ready! You'll be live with ${creatorName} soon`
    : `${queueCount} fan${queueCount !== 1 ? "s" : ""} in queue`;

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[100dvh] bg-violet-500 overflow-hidden">
      {audibleIds.map((id) => (
        <DailyAudioTrack key={id} sessionId={id} />
      ))}
      <style dangerouslySetInnerHTML={VIDEO_FILL} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <span className="text-white text-xl font-serif italic tracking-tight select-none">
          friendsly
        </span>
        <div className="flex items-center gap-1.5 bg-[#1a1a3e] rounded-full px-3.5 py-1.5">
          <Clock className="w-3 h-3 text-white/70" />
          <span className="text-white text-sm font-semibold tabular-nums">
            {isAdmitted ? formatElapsed(stageElapsedSeconds) : `${queueCount} live`}
          </span>
        </div>
      </div>

      {/* ── Video card ── */}
      <div className="relative mx-4 shrink-0" style={{ height: "52vh" }}>
        {/* glow border via box-shadow on wrapper */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            boxShadow:
              "0 0 0 2px rgba(192,132,252,0.7), 0 0 28px 6px rgba(168,85,247,0.4)",
          }}
        />
        {/* video area */}
        <div className="relative h-full w-full rounded-2xl overflow-hidden bg-[#1a1a3e]">
          {creatorParticipant?.session_id && creatorVideoActive ? (
            <div className="m-video h-full w-full">
              <DailyVideo
                sessionId={creatorParticipant.session_id}
                type="video"
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3">
              <Avatar
                initials={creatorInitials}
                color={creatorColor}
                imageUrl={creatorAvatarUrl}
                size="xl"
              />
              <p className="text-white/50 text-xs">
                {creatorParticipant
                  ? `${creatorName}'s camera is off`
                  : `Connecting to ${creatorName}…`}
              </p>
            </div>
          )}

          {/* top gradient scrim */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />

          {/* PiP — bottom right, shows fan's cam when admitted or active fan when waiting */}
          <div className="absolute bottom-3 right-3 w-[30%] aspect-video rounded-xl overflow-hidden bg-[#2d2d5e] shadow-lg">
            {isAdmitted && localSessionId && camOn && localVideoActive ? (
              <div className="m-video h-full w-full">
                <DailyVideo
                  sessionId={localSessionId}
                  type="video"
                  mirror
                  className="h-full w-full object-cover"
                />
              </div>
            ) : showActiveFanPip && activeFanVideoActive ? (
              <div className="m-video h-full w-full">
                <DailyVideo
                  sessionId={activeFanParticipant.session_id}
                  type="video"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                {isAdmitted ? (
                  <Avatar
                    initials={viewerInitials}
                    color={viewerColor}
                    size="sm"
                  />
                ) : activeFan ? (
                  <Avatar
                    initials={activeFan.avatarInitials}
                    color={activeFan.avatarColor}
                    imageUrl={activeFan.avatarUrl}
                    size="sm"
                  />
                ) : (
                  <Users className="w-5 h-5 text-white/30" />
                )}
              </div>
            )}
          </div>

          {/* mic/cam controls — only when admitted */}
          {isAdmitted && (
            <div className="absolute bottom-3 left-3 flex gap-2">
              <button
                onClick={async () => {
                  const next = !micOn;
                  setMicOn(next);
                  await applyMedia(camOn, next);
                }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95",
                  "border backdrop-blur-sm",
                  micOn
                    ? "border-violet-400/50 bg-violet-500/20 text-white"
                    : "border-red-400/50 bg-red-500/20 text-red-300"
                )}
              >
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={async () => {
                  const next = !camOn;
                  setCamOn(next);
                  await applyMedia(next, micOn);
                }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95",
                  "border backdrop-blur-sm",
                  camOn
                    ? "border-violet-400/50 bg-violet-500/20 text-white"
                    : "border-red-400/50 bg-red-500/20 text-red-300"
                )}
              >
                {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="px-5 pt-4 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/80" />
            <span className="text-white font-semibold text-base">{statusLabel}</span>
          </div>
          {myQueuePosition > 0 && !isAdmitted && (
            <span className="text-white font-bold text-xl">#{myQueuePosition}</span>
          )}
          {isAdmitted && (
            <span className="text-white/80 text-sm font-medium">On stage</span>
          )}
        </div>
        <p className="text-white/70 text-sm mt-0.5 leading-snug">{statusSub}</p>
      </div>

      {/* ── White panel ── */}
      <div className="flex-1 rounded-t-3xl bg-white overflow-hidden flex flex-col min-h-0">
        {/* Up Next row */}
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="font-bold text-slate-900 text-base">Up Next</span>
            <span className="text-slate-400 text-sm">{queueCount} in queue</span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
            {queueEntries.slice(0, 8).map((entry, i) => {
              const isMe = entry.fanId === user?.id;
              return (
                <div key={entry.id} className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                      isMe
                        ? "ring-2 ring-violet-500 bg-violet-100"
                        : "bg-slate-200"
                    )}
                  >
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt={entry.fanName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className={cn(
                          "text-xs font-bold",
                          isMe ? "text-violet-600" : "text-slate-500"
                        )}
                      >
                        {entry.avatarInitials ?? entry.fanName[0]}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium leading-none",
                      isMe ? "text-violet-600" : "text-slate-500"
                    )}
                  >
                    {isMe ? "You" : entry.fanName.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 mx-5 shrink-0" />

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2 min-h-0">
          {messages.length === 0 && (
            <p className="text-center text-slate-400 text-xs py-4">
              No messages yet. Say something!
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex gap-2", msg.isMe && "justify-end")}>
              {!msg.isMe && (
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-slate-500">
                    {msg.senderName[0]}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "max-w-[70%] rounded-2xl px-3 py-1.5 text-sm",
                  msg.isMe
                    ? "bg-violet-500 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                )}
              >
                {!msg.isMe && (
                  <p className="text-[10px] font-semibold text-slate-500 mb-0.5">
                    {msg.senderName}
                  </p>
                )}
                <p className="leading-snug">{msg.message}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Leave Queue / End Call button */}
        <div className="px-5 pt-2 shrink-0">
          <button
            onClick={onLeaveQueue}
            className={cn(
              "w-full py-3 rounded-full font-semibold text-sm transition-all active:scale-[0.98]",
              isAdmitted
                ? "bg-red-500 text-white"
                : "bg-slate-100 text-slate-700"
            )}
          >
            {isAdmitted ? "End Call" : "Leave Queue"}
          </button>
        </div>

        {/* Chat input */}
        <div className="px-5 pt-2 pb-6 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void sendChat(); }}
            placeholder="Say something..."
            className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-violet-300 transition-all"
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

// ─── Public wrapper (matches PublicLiveRoom API) ───────────────────────────

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
  sessionId,
  onLeaveQueue,
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
  sessionId: string | null;
  onLeaveQueue: () => void;
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
        sessionId={sessionId}
        onLeaveQueue={onLeaveQueue}
        onStageSessionReady={onStageSessionReady}
      />
    </CallContainer>
  );
}
