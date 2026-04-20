"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Send, Users, X } from "lucide-react";
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
  onStageSessionReady?: (id: string) => void;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const { user } = useAuthContext();

  const [creatorParticipant, setCreatorParticipant] = useState<any>(null);
  const [activeFanParticipant, setActiveFanParticipant] = useState<any>(null);
  const [localVideoActive, setLocalVideoActive] = useState(false);
  const [micOn, setMicOn] = useState(isAdmitted);
  const [camOn, setCamOn] = useState(isAdmitted);

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
      const local = all.find((p: any) => p?.local || p?.session_id === localSessionId);
      setLocalVideoActive(isVideoPlayable(local));
      const fanP = resolveActiveFanSession(all, creator?.session_id ?? null, activeFan);
      setActiveFanParticipant(isAdmitted ? null : fanP);
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
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", payload.new.user_id).single();
          setMessages((prev) => [...prev, {
            id: payload.new.id,
            senderName: profile?.full_name ?? "Fan",
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
    <div className="flex flex-col min-h-[100dvh] bg-violet-500 overflow-hidden">
      {audibleIds.map((id) => (
        <DailyAudioTrack key={id} sessionId={id} />
      ))}
      <style dangerouslySetInnerHTML={VIDEO_FILL} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
        <span className="text-white text-xl font-brand tracking-tight select-none">friendsly</span>
        <div className="flex items-center gap-1.5 bg-[#1a1a3e] rounded-full px-3.5 py-1.5">
          <span className="text-white text-sm font-semibold tabular-nums">
            {isAdmitted ? formatElapsed(stageElapsedSeconds) : `${queueCount} live`}
          </span>
        </div>
      </div>

      {/* ── Pulsating status ── */}
      <div className="px-5 pb-2 shrink-0">
        <p className={cn("text-white font-semibold text-sm m-pulse", isAdmitted ? "text-violet-100" : "text-white")}>
          {isAdmitted ? "You're on camera" : myQueuePosition > 0 ? `You're in line  ·  #${myQueuePosition}` : "Watching live"}
        </p>
      </div>

      {/* ── Video card ── */}
      <div className="relative mx-4 shrink-0" style={{ height: "42vh" }}>
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
                {creatorParticipant ? `${creatorName}'s camera is off` : `Connecting…`}
              </p>
            </div>
          )}
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/25 to-transparent pointer-events-none" />

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

      {/* ── Queue avatar row ── */}
      <div className="px-5 pt-3 pb-1 shrink-0">
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {queueEntries.length === 0 && (
            <p className="text-white/50 text-xs">No one else in line</p>
          )}
          {queueEntries.slice(0, 9).map((entry) => {
            const isMe = entry.fanId === user?.id;
            return (
              <div key={entry.id} className="flex flex-col items-center gap-1 shrink-0">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  isMe ? "ring-2 ring-white bg-violet-300" : "bg-white/20"
                )}>
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt={entry.fanName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className={cn("text-xs font-bold", isMe ? "text-violet-700" : "text-white")}>
                      {entry.avatarInitials ?? entry.fanName[0]}
                    </span>
                  )}
                </div>
                <span className={cn("text-[10px] font-medium", isMe ? "text-white" : "text-white/60")}>
                  {isMe ? "You" : entry.fanName.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── White panel ── */}
      <div className="flex-1 rounded-t-3xl bg-white overflow-hidden flex flex-col min-h-0 mt-2">

        {/* Join / Leave button at top of chat panel */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          {isAdmitted ? (
            <button
              onClick={onLeaveStage}
              className="w-full py-2.5 rounded-full bg-red-500 text-white font-semibold text-sm transition-all active:scale-[0.98]"
            >
              End Call
            </button>
          ) : inQueue ? (
            <button
              onClick={onLeaveQueue}
              className="w-full py-2.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-sm transition-all active:scale-[0.98]"
            >
              Leave Queue
            </button>
          ) : (
            <button
              onClick={onJoinQueue}
              className="w-full py-2.5 rounded-full bg-violet-500 text-white font-semibold text-sm transition-all active:scale-[0.98]"
            >
              Join Queue
            </button>
          )}
        </div>

        {/* Chat messages — last 5, oldest fades */}
        <div className="flex-1 overflow-hidden relative px-5 min-h-0">
          <div className="flex flex-col justify-end h-full gap-2 pb-2">
            {visibleMessages.length === 0 && (
              <p className="text-center text-slate-400 text-xs py-2">Say something!</p>
            )}
            {visibleMessages.map((msg, i) => {
              const isFaded = i === 0 && visibleMessages.length >= 5;
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2 transition-opacity", msg.isMe && "justify-end", isFaded && "opacity-25")}
                >
                  {!msg.isMe && (
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-slate-500">{msg.senderName[0]}</span>
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
        <div className="px-4 pt-2 pb-6 flex items-center gap-2 shrink-0">
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
        onStageSessionReady={onStageSessionReady}
      />
    </CallContainer>
  );
}
