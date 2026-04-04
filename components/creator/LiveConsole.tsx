"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users, SkipForward, StopCircle,
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
import { useLocalSessionId, useParticipantIds, DailyVideo, useDaily } from "@daily-co/daily-react";

const MAX_LIVE_CALL_SECONDS = 3 * 60;

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function LiveVideoStage({
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
}: any) {
  const localSessionId = useLocalSessionId();
  const daily = useDaily();
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const fanId = remoteParticipantIds[0];
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

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="live">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
            LIVE
          </Badge>
          <span className="text-sm text-slate-400">
            {currentFan ? `Session with ${currentFan.fanName}` : "Waiting for fans..."}
          </span>
          <span className={cn("text-xs font-semibold", creatorJoined ? "text-emerald-400" : "text-amber-400")}>
            {creatorJoined ? "Creator connected" : "Joining room..."}
          </span>
          {currentFan ? (
            <span className="text-sm font-semibold text-brand-primary-light tabular-nums">
              {formatCountdown(activeFanRemainingSeconds)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
          {localSessionId ? (
            <div className="w-full h-full relative overflow-hidden">
              <DailyVideo sessionId={localSessionId} type="video" className="w-full h-full object-cover z-10" />
              <style dangerouslySetInnerHTML={{ __html: ".daily-video-container div[style*='position: absolute'] { display: none !important; } .daily-video-container video { transform: none !important; }" }} />
            </div>
          ) : <Avatar initials={creatorInitials} color={creatorColor} size="xl" />}
          <div className="absolute bottom-3 right-3 text-[10px] font-semibold text-white bg-black/50 rounded-lg px-2 py-1 z-20">You ({creatorName})</div>
        </div>

        <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
          {fanId ? (
            <>
              <DailyVideo sessionId={fanId} type="video" className="w-full h-full object-cover z-10" />
              <div className="absolute bottom-3 right-3 text-[10px] font-semibold text-white bg-black/50 rounded-lg px-2 py-1 z-20">{currentFan?.fanName || "Fan"}</div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center z-10">
              <Users className="w-8 h-8 opacity-20 mb-3" />
              <p className="text-sm font-medium text-slate-400">No fan currently admitted</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <button onClick={toggleMic} className={cn("w-10 h-10 rounded-full border flex items-center justify-center transition-colors", micOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-red-500/40 bg-red-500/20 text-red-400")}>{micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</button>
          <button onClick={toggleCam} className={cn("w-10 h-10 rounded-full border flex items-center justify-center transition-colors", camOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-red-500/40 bg-red-500/20 text-red-400")}>{camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}</button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={admitNext} disabled={queueCount < 1} className="gap-1.5"><SkipForward className="w-4 h-4" />Admit Next ({queueCount})</Button>
          <Button variant="danger" size="sm" onClick={endSession} className="gap-1.5"><StopCircle className="w-4 h-4" />End Session</Button>
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
  const finishingFanRef = useRef(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const initStartedRef = useRef(false);

  const creatorName = user?.full_name ?? "You";
  const creatorInitials = user?.avatar_initials ?? "??";
  const creatorColor = user?.avatar_color ?? "bg-violet-600";
  const activeFanRemainingSeconds = currentFan?.admittedAt
    ? Math.max(0, MAX_LIVE_CALL_SECONDS - Math.floor((currentTime - new Date(currentFan.admittedAt).getTime()) / 1000))
    : MAX_LIVE_CALL_SECONDS;

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
        const { data: profile } = await supabase.from("creator_profiles").select("live_rate_per_minute").eq("id", currentUser.id).single();
        if (profile) setLiveRate(profile.live_rate_per_minute);
        setLoadingRate(false);

        const { data: activeSessions } = await supabase
          .from("live_sessions")
          .select("*")
          .eq("creator_id", currentUser.id)
          .eq("is_active", true)
          .order("started_at", { ascending: false });

        const existingSession = activeSessions?.find((s: any) => !!s.daily_room_url) ?? null;
        if (existingSession) {
          setSessionId(existingSession.id);
          await supabase.from("creator_profiles").update({ current_live_session_id: existingSession.id, is_live: true }).eq("id", currentUser.id);
          setRoomUrl(existingSession.daily_room_url);
          try {
            const tokenRes = await fetch("/api/daily/token", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomName: existingSession.daily_room_url.split("/").pop(), isOwner: true }),
            });
            const tokenData = await tokenRes.json();
            if (tokenData.token) setToken(tokenData.token);
          } catch {}
          setSessionState("live");
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
    const supabase = createClient();
    const endedAt = new Date().toISOString();
    const duration = entry.admittedAt
      ? Math.max(0, (Date.now() - new Date(entry.admittedAt).getTime()) / 1000)
      : 0;

    await supabase
      .from("live_queue_entries")
      .update({
        status,
        ended_at: endedAt,
        duration_seconds: Math.floor(duration),
        amount_charged: Number(((duration / 60) * (liveRate || 0)).toFixed(2)),
      })
      .eq("id", entry.id);
  }

  useEffect(() => {
    if (!user || !sessionId) return;
    const currentUser = user;
    const supabase = createClient();

    async function fetchQueue(targetSid: string) {
      const { data } = await supabase
        .from("live_queue_entries")
        .select("id, topic, joined_at, status, admitted_at, profiles:fan_id(full_name, username, avatar_initials, avatar_color)")
        .eq("session_id", targetSid)
        .in("status", ["waiting", "active"])
        .order("joined_at", { ascending: true });

      if (!data) return;

      const active = data.find((e: any) => e.status === "active");
      const activeRemainingSeconds = active?.admitted_at
        ? Math.max(0, MAX_LIVE_CALL_SECONDS - Math.floor((Date.now() - new Date(active.admitted_at).getTime()) / 1000))
        : 0;
      const waiting = data.filter((e: any) => e.status === "waiting");

      setQueue(waiting.map((e: any, idx: number) => ({
        id: e.id,
        fanName: e.profiles.full_name,
        fanUsername: `@${e.profiles.username}`,
        avatarInitials: e.profiles.avatar_initials,
        avatarColor: e.profiles.avatar_color,
        position: idx + 1,
        waitTime: "",
        waitSeconds: activeRemainingSeconds + (idx * MAX_LIVE_CALL_SECONDS),
        topic: e.topic ?? undefined,
        joinedAt: e.joined_at,
        creator_id: currentUser.id,
      })));

      if (active) {
        setCurrentFan({
          id: active.id,
          fanName: active.profiles.full_name,
          fanUsername: `@${active.profiles.username}`,
          avatarInitials: active.profiles.avatar_initials,
          avatarColor: active.profiles.avatar_color,
          topic: active.topic || "Hi!",
          admittedAt: active.admitted_at,
        });
      } else {
        setCurrentFan(null);
      }
    }

    fetchQueue(sessionId);
    const channel = supabase.channel(`lq-${currentUser.id}-${sessionId}`).on("postgres_changes", { event: "*", schema: "public", table: "live_queue_entries", filter: `session_id=eq.${sessionId}` }, () => fetchQueue(sessionId)).subscribe();
    const hb = setInterval(() => fetchQueue(sessionId), 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(hb);
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
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }
    try {
      const res = await fetch("/api/daily/room", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.url && data.token) {
        const supabase = createClient();
        let sid = sessionId;

        await supabase.from("live_sessions").update({ is_active: false }).eq("creator_id", user.id).eq("is_active", true);
        if (sid) {
          await supabase.from("live_sessions").update({ daily_room_url: data.url, is_active: true }).eq("id", sid);
        } else {
          const { data: newSession } = await supabase.from("live_sessions").insert({ creator_id: user.id, rate_per_minute: liveRate ?? 0, is_active: true, daily_room_url: data.url }).select("id").single();
          if (newSession) {
            sid = newSession.id;
            setSessionId(newSession.id);
          }
        }

        if (sid) {
          setRoomUrl(data.url);
          setToken(data.token);
          await supabase.from("creator_profiles").update({ is_live: true, current_live_session_id: sid }).eq("id", user.id);
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
    const admittedAt = new Date().toISOString();
    if (currentFan) {
      await finalizeQueueEntry(currentFan, "completed");
    }
    const { error } = await supabase.from("live_queue_entries").update({ status: "active", admitted_at: admittedAt }).eq("id", nextFan.id);
    if (!error) setCurrentFan({ ...nextFan, admittedAt });
  }

  async function endSession() {
    if (!user || !sessionId) return;
    const supabase = createClient();
    if (currentFan) {
      await finalizeQueueEntry(currentFan, "completed");
    }
    setSessionState("idle");
    setCreatorJoined(false);
    setRoomUrl("");
    setToken("");
    setSessionId(null);
    setQueue([]);
    setCurrentFan(null);
    await supabase.from("live_sessions").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", sessionId);
    await supabase.from("creator_profiles").update({ is_live: false, current_live_session_id: null }).eq("id", user.id);
  }

  if (initializing) return (
    <div className="h-full flex flex-col items-center justify-center bg-brand-surface rounded-2xl border border-brand-border p-12">
      <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
      <p className="text-slate-300 font-bold text-lg">Resuming Session...</p>
      <p className="text-slate-500 text-sm mt-1">Please wait while we sync your queue.</p>
    </div>
  );

  if (loadingRate) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" /></div>;

  if (!liveRate && liveRate !== 0) return (
    <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-brand-border bg-brand-surface p-8 text-center text-slate-100 font-bold">
      Live Rate Required in Management first.
    </div>
  );

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
          <Button variant="live" size="xl" onClick={startSession} className="shadow-glow-live">Start Live Session</Button>
          {startError && <p className="text-red-400 text-sm mt-4">{startError}</p>}
        </div>
      ) : (
        <CallContainer
          url={roomUrl}
          token={token}
          startVideo={camOn}
          startAudio={micOn}
          onJoin={() => setCreatorJoined(true)}
          onLeave={() => setCreatorJoined(false)}
        >
          <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
            <LiveVideoStage
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
            />
            <div className="w-full lg:w-72 shrink-0 min-h-0 flex flex-col gap-2">
              <WaitingRoom
                key={sessionId}
                queue={queue}
                currentUserPosition={0}
                creatorName={creatorName}
                creatorInitials={creatorInitials}
                creatorColor={creatorColor}
                creatorId={user?.id ?? ""}
                sessionId={sessionId ?? undefined}
                showQueueTab
                activeFanAdmittedAt={currentFan?.admittedAt ?? null}
              />
              <div className="px-3 py-1 bg-brand-surface rounded border border-brand-border text-[10px] text-slate-500 font-mono truncate">Session: {sessionId}</div>
            </div>
          </div>
        </CallContainer>
      )}
    </div>
  );
}
