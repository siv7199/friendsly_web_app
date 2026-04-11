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
import { useLocalSessionId, useParticipantIds, DailyVideo, useDaily } from "@daily-co/daily-react";
import {
  COMMON_TIME_ZONES,
  formatDateTimeLocalInTimeZone,
  formatTimeZoneLabel,
  getBrowserTimeZone,
  zonedTimeToUtc,
} from "@/lib/timezones";

const MAX_LIVE_CALL_SECONDS = 3 * 60;
const LIVE_SESSION_HEARTBEAT_MS = 15000;
const LIVE_SESSION_STALE_MS = 45000;

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
          {currentFan?.admittedAt ? (
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
    ? Math.max(0, MAX_LIVE_CALL_SECONDS - Math.floor((currentTime - new Date(currentFan.admittedAt).getTime()) / 1000))
    : MAX_LIVE_CALL_SECONDS;

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
      .select("live_rate_per_minute, scheduled_live_at, scheduled_live_timezone, timezone")
      .eq("id", userId)
      .maybeSingle();

    const parsedRate = profile?.live_rate_per_minute != null
      ? Number(profile.live_rate_per_minute)
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
              body: JSON.stringify({ roomName: existingSession.daily_room_url.split("/").pop(), isOwner: true }),
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
        .select("id, topic, joined_at, status, admitted_at, profiles:fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)")
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
        avatarUrl: e.profiles.avatar_url ?? undefined,
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
          avatarUrl: active.profiles.avatar_url ?? undefined,
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
      setStartError("You must set a live rate in Management first.");
      return;
    }
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
          await supabase
            .from("live_sessions")
            .update({ daily_room_url: data.url, is_active: false, ended_at: null, last_heartbeat_at: null })
            .eq("id", sid);
        } else {
          const { data: newSession } = await supabase
            .from("live_sessions")
            .insert({ creator_id: user.id, rate_per_minute: latestSettings.liveRate ?? 0, is_active: false, daily_room_url: data.url, last_heartbeat_at: null })
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
      .update({ status: "active", admitted_at: null })
      .eq("id", nextFan.id);
    if (!error) setCurrentFan({ ...nextFan, admittedAt: undefined });
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
              Set a live rate in Management before going live.
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
                creatorAvatarUrl={user?.avatar_url ?? undefined}
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
