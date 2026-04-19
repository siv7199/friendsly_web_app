"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { DailyVideo, useDaily, useLocalSessionId, useParticipantIds } from "@daily-co/daily-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CallContainer } from "@/components/video/CallContainer";
import { LateFeeGate } from "@/components/booking/LateFeeGate";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";
import { getBookingWindow } from "@/lib/bookings";

type BookingParticipant = {
  full_name?: string;
  avatar_initials?: string;
  avatar_color?: string;
  avatar_url?: string;
};

type BookingDetails = {
  id: string;
  topic?: string | null;
  status?: string | null;
  duration?: number | null;
  creator?: BookingParticipant | null;
  fan?: BookingParticipant | null;
};

function formatCallTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function BookingVideoStage({
  booking,
  isCreator,
  canUseMedia,
  currentTime,
  scheduledAt,
  onEndCall,
}: {
  booking: BookingDetails | null;
  isCreator: boolean;
  canUseMedia: boolean;
  currentTime: number;
  scheduledAt: string | null;
  onEndCall: () => Promise<void>;
}) {
  const daily = useDaily();
  const router = useRouter();
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const remoteParticipantId = remoteParticipantIds[0];
  const [micOn, setMicOn] = useState(canUseMedia);
  const [camOn, setCamOn] = useState(canUseMedia);

  const localName = isCreator ? booking?.creator?.full_name ?? "You" : booking?.fan?.full_name ?? "You";
  const remoteName = isCreator ? booking?.fan?.full_name ?? "Fan" : booking?.creator?.full_name ?? "Creator";
  const remoteInitials = isCreator
    ? booking?.fan?.avatar_initials ?? "F"
    : booking?.creator?.avatar_initials ?? "C";
  const remoteColor = isCreator
    ? booking?.fan?.avatar_color ?? "bg-violet-600"
    : booking?.creator?.avatar_color ?? "bg-violet-600";
  const remoteImageUrl = isCreator ? booking?.fan?.avatar_url : booking?.creator?.avatar_url;
  const bookingDurationSeconds = Math.max(0, Number(booking?.duration ?? 0) * 60);
  const elapsedSeconds = scheduledAt
    ? Math.min(
        bookingDurationSeconds || Number.MAX_SAFE_INTEGER,
        Math.max(0, Math.floor((currentTime - new Date(scheduledAt).getTime()) / 1000))
      )
    : 0;
  const remainingSeconds = Math.max(0, bookingDurationSeconds - elapsedSeconds);
  const showCreatorControlStrip = isCreator;
  const dailyVideoFillStyles = {
    __html: `
      .booking-stage-video,
      .booking-stage-video > div,
      .booking-stage-video > div > div,
      .booking-stage-video video {
        width: 100% !important;
        height: 100% !important;
      }
      .booking-stage-video video {
        display: block !important;
        object-fit: cover !important;
        transform: none !important;
      }
      .booking-stage-video div[style*='position: absolute'] {
        display: none !important;
      }
    `,
  };

  useEffect(() => {
    if (!daily || typeof daily.meetingState !== "function") return;

    const sync = () => {
      if (daily.meetingState() === "joined-meeting") {
        try { daily.setLocalAudio(micOn); } catch {}
        try { daily.setLocalVideo(camOn); } catch {}
      }
    };

    sync();
    daily.on("joined-meeting", sync);
    return () => {
      daily.off("joined-meeting", sync);
    };
  }, [daily, micOn, camOn]);

  useEffect(() => {
    if (canUseMedia) return;

    setMicOn(false);
    setCamOn(false);
    if (daily && typeof daily.setLocalAudio === "function") {
      try { daily.setLocalAudio(false); } catch {}
    }
    if (daily && typeof daily.setLocalVideo === "function") {
      try { daily.setLocalVideo(false); } catch {}
    }
  }, [canUseMedia, daily]);

  const toggleMic = () => {
    if (!canUseMedia) return;
    const next = !micOn;
    setMicOn(next);
    if (daily && typeof daily.setLocalAudio === "function") {
      try { daily.setLocalAudio(next); } catch {}
    }
  };

  const toggleCam = () => {
    if (!canUseMedia) return;
    const next = !camOn;
    setCamOn(next);
    if (daily && typeof daily.setLocalVideo === "function") {
      try { daily.setLocalVideo(next); } catch {}
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="live">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
            LIVE
          </Badge>
          <span className="text-sm text-brand-ink-subtle">
            Session with {remoteName}
          </span>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 gap-3 auto-rows-fr md:grid-cols-2 md:items-stretch">
        <div className={cn("flex min-h-0 flex-col", showCreatorControlStrip ? "gap-3" : "")}>
        <div className="relative min-h-[240px] flex-1 md:min-h-0 rounded-[24px] bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center">
          {localSessionId && camOn ? (
            <div className="booking-stage-video w-full h-full relative overflow-hidden">
              <DailyVideo sessionId={localSessionId} type="video" mirror className="w-full h-full object-cover z-10" />
              <style dangerouslySetInnerHTML={dailyVideoFillStyles} />
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center px-4 bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_55%)]">
              <Avatar initials="You" size="xl" />
              {!canUseMedia ? (
                <p className="text-xs text-brand-ink-muted">Camera and mic are locked until the scheduled start.</p>
              ) : (
                <p className="text-xs text-brand-ink-muted">Your camera is off.</p>
              )}
            </div>
          )}
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
          <div className="absolute left-3 bottom-3 rounded-xl bg-black/50 px-3 py-2 text-white z-20 max-w-[calc(100%-7rem)]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">You</p>
            <p className="text-sm font-semibold truncate">{localName}</p>
          </div>
          <div className={cn("absolute right-3 bottom-3 flex items-center gap-2 z-20", showCreatorControlStrip && "md:hidden")}>
            <button
              onClick={toggleMic}
              disabled={!canUseMedia}
              title={canUseMedia ? "Toggle microphone" : "Microphone unlocks at the scheduled start time"}
              className={cn(
                "w-11 h-11 rounded-full border flex items-center justify-center transition-colors backdrop-blur-sm",
                !canUseMedia
                  ? "cursor-not-allowed border-brand-border bg-brand-surface/70 text-brand-ink-muted opacity-60"
                  : micOn
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light"
                  : "border-red-500/40 bg-red-500/20 text-red-400"
              )}
            >
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleCam}
              disabled={!canUseMedia}
              title={canUseMedia ? "Toggle camera" : "Camera unlocks at the scheduled start time"}
              className={cn(
                "w-11 h-11 rounded-full border flex items-center justify-center transition-colors backdrop-blur-sm",
                !canUseMedia
                  ? "cursor-not-allowed border-brand-border bg-brand-surface/70 text-brand-ink-muted opacity-60"
                  : camOn
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light"
                  : "border-red-500/40 bg-red-500/20 text-red-400"
              )}
            >
              {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {showCreatorControlStrip ? (
          <div className="hidden md:flex items-center justify-center gap-3 rounded-2xl border border-brand-border bg-brand-surface/80 px-4 py-3">
            <button
              onClick={toggleMic}
              disabled={!canUseMedia}
              title={canUseMedia ? "Toggle microphone" : "Microphone unlocks at the scheduled start time"}
              className={cn(
                "w-11 h-11 rounded-full border flex items-center justify-center transition-colors",
                !canUseMedia
                  ? "cursor-not-allowed border-brand-border bg-brand-surface/70 text-brand-ink-muted opacity-60"
                  : micOn
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light"
                  : "border-red-500/40 bg-red-500/20 text-red-400"
              )}
            >
              {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleCam}
              disabled={!canUseMedia}
              title={canUseMedia ? "Toggle camera" : "Camera unlocks at the scheduled start time"}
              className={cn(
                "w-11 h-11 rounded-full border flex items-center justify-center transition-colors",
                !canUseMedia
                  ? "cursor-not-allowed border-brand-border bg-brand-surface/70 text-brand-ink-muted opacity-60"
                  : camOn
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light"
                  : "border-red-500/40 bg-red-500/20 text-red-400"
              )}
            >
              {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
            <div className="min-w-[120px] rounded-xl border border-brand-live/25 bg-brand-live/10 px-4 py-2 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-brand-live">Session Time</p>
              <p className="text-lg font-black tabular-nums text-brand-live">{formatCallTimer(elapsedSeconds)}</p>
              {bookingDurationSeconds > 0 ? (
                <p className="text-[10px] text-brand-live/75">{formatCallTimer(remainingSeconds)} remaining</p>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>

        <div className="relative min-h-[240px] md:min-h-0 rounded-[24px] bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center">
          {remoteParticipantId ? (
            <>
              <div className="booking-stage-video w-full h-full relative overflow-hidden">
                <DailyVideo sessionId={remoteParticipantId} type="video" className="w-full h-full object-cover z-10" />
                <style dangerouslySetInnerHTML={dailyVideoFillStyles} />
              </div>
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
              <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-3 py-2 z-20">
                {remoteName}
              </div>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-brand-ink-muted p-6 text-center z-10 bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_55%)]">
              <Avatar
                initials={remoteInitials}
                color={remoteColor}
                imageUrl={remoteImageUrl}
                size="xl"
                className="opacity-60 mb-3"
              />
              <p className="text-sm font-medium text-brand-ink-subtle">Waiting for {remoteName} to join...</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3 px-1">
        {!canUseMedia ? (
          <p className="text-xs text-brand-ink-muted">
            Camera and mic unlock at the scheduled start time.
          </p>
        ) : <div />}

        {isCreator ? (
          <button
            onClick={() => {
              void (async () => {
                await onEndCall();
                if (daily && typeof daily.leave === "function") {
                  try { await daily.leave(); } catch {}
                }
              })();
            }}
            className="w-12 h-12 rounded-full border border-red-500/40 bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/bookings")}
              className="gap-2"
            >
              Back To Bookings
            </Button>
            <button
              onClick={() => router.push("/bookings")}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/40 bg-red-500 text-white transition-colors hover:bg-red-600"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoomPage() {
  const { id: rawBookingId } = useParams();
  const bookingId = Array.isArray(rawBookingId) ? rawBookingId[0] : rawBookingId;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [roomUrl, setRoomUrl] = useState("");
  const [token, setToken] = useState("");
  const [rejoining, setRejoining] = useState(false);
  const selfLeaveRequestedRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const [remoteEnded, setRemoteEnded] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [creatorPresent, setCreatorPresent] = useState(false);
  const [fanPresent, setFanPresent] = useState(false);
  const [lateFeeAmount, setLateFeeAmount] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const autoCancelRequestedRef = useRef(false);
  const bookingHasStarted = scheduledAt ? currentTime >= new Date(scheduledAt).getTime() : true;
  const canUseMedia = isCreator || bookingHasStarted;

  const loadBooking = useCallback(async (bId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bookings")
      .select("id, topic, status, duration, scheduled_at, creator_present, fan_present, creator:profiles!creator_id(full_name, avatar_initials, avatar_color, avatar_url), fan:profiles!fan_id(full_name, avatar_initials, avatar_color, avatar_url)")
      .eq("id", bId)
      .single();

    if (data) {
      setBooking(data as BookingDetails);
      setScheduledAt((data as any).scheduled_at ?? null);
      setCreatorPresent(Boolean((data as any).creator_present));
      setFanPresent(Boolean((data as any).fan_present));
    }
  }, []);

  const markPresence = useCallback(async (present: boolean) => {
    if (!bookingId || !user) return;
    await fetch(`/api/bookings/${bookingId}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ present }),
    });
  }, [bookingId, isCreator, user]);

  const autoCancelBooking = useCallback(async () => {
    if (!bookingId || autoCancelRequestedRef.current) return;

    autoCancelRequestedRef.current = true;
    await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto" }),
    });
  }, [bookingId]);

  const completeBooking = useCallback(async () => {
    if (!bookingId) return;
    await fetch(`/api/bookings/${bookingId}/complete`, {
      method: "POST",
    });
  }, [bookingId]);

  const initCall = useCallback(async (signal?: AbortSignal) => {
    if (!bookingId) return;

    const res = await fetch(`/api/bookings/${bookingId}/join`, {
      method: "POST",
      signal,
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      if (data.requiresLateFee) {
        setLateFeeAmount(Number(data.lateFeeAmount ?? 0));
        setError(null);
        setLoading(false);
        return;
      }
      setError(data.error ?? "Failed to connect to the video room.");
      setLoading(false);
      return;
    }

    setLateFeeAmount(null);
    setError(null);
    setRejoining(false);
    setRoomUrl(data.url);
    setToken(data.token);
    setIsCreator(Boolean(data.isCreator));
    setLoading(false);
    await loadBooking(bookingId);
  }, [bookingId, loadBooking]);

  useEffect(() => {
    if (!user || !bookingId) return;

    let cancelled = false;

    async function start() {
      try {
        const joinController = new AbortController();
        const joinTimeout = window.setTimeout(() => joinController.abort(), 15000);
        await initCall(joinController.signal);
        window.clearTimeout(joinTimeout);
      } catch (err) {
        console.error("Call init error:", err);
        if (!cancelled) {
          setError(err instanceof Error && err.name === "AbortError"
            ? "Connecting to the secure room timed out. Please try joining again."
            : "Failed to connect to the video room.");
          setLoading(false);
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
    };
  }, [user, bookingId, initCall]);

  useEffect(() => {
    if (!authLoading && !user) {
      setError("You need to be signed in to join this booking room.");
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!bookingId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`booking-room-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload: any) => {
          const nextStatus = payload.new?.status;
          setCreatorPresent(Boolean(payload.new?.creator_present));
          setFanPresent(Boolean(payload.new?.fan_present));
          if ((nextStatus === "completed" || nextStatus === "cancelled") && !selfLeaveRequestedRef.current) {
            setRemoteEnded(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  const handleEndCall = useCallback(async () => {
    selfLeaveRequestedRef.current = true;
    if (isCreator) {
      setCreatorPresent(false);
    } else {
      setFanPresent(false);
    }
    await markPresence(false);
    await completeBooking();
  }, [completeBooking, isCreator, markPresence]);

  const handleLeave = useCallback(() => {
    if (selfLeaveRequestedRef.current) {
      if (isCreator) {
        setCreatorPresent(false);
      } else {
        setFanPresent(false);
      }
      void markPresence(false);
      router.push(isCreator ? "/dashboard" : "/bookings");
      return;
    }

    setRejoining(true);
    setRoomUrl("");
    setToken("");
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = window.setTimeout(() => {
      void initCall();
    }, 500);
  }, [initCall, isCreator, markPresence, router]);

  const handleJoinError = useCallback(() => {
    if (selfLeaveRequestedRef.current) {
      return;
    }
    setRejoining(true);
    setRoomUrl("");
    setToken("");
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = window.setTimeout(() => {
      void initCall();
    }, 1500);
  }, [initCall]);

  useEffect(() => {
    if (!remoteEnded) return;

    router.push(isCreator ? "/dashboard" : "/bookings");
  }, [isCreator, remoteEnded, router]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!scheduledAt) return;

    const { noShowDeadline } = getBookingWindow(scheduledAt, 0);
    const delay = noShowDeadline.getTime() - Date.now();

    const checkAndCancel = () => {
      if (!(creatorPresent && fanPresent)) {
        void autoCancelBooking();
      }
    };

    if (delay <= 0) {
      checkAndCancel();
      return;
    }

    const timer = window.setTimeout(checkAndCancel, delay + 250);
    return () => window.clearTimeout(timer);
  }, [autoCancelBooking, creatorPresent, fanPresent, scheduledAt]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!scheduledAt || bookingHasStarted) return;

    const startTime = new Date(scheduledAt).getTime();
    const delay = Math.max(1000, startTime - Date.now() + 250);
    const timer = window.setTimeout(() => setCurrentTime(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [bookingHasStarted, scheduledAt]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg gap-4">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
        <p className="text-brand-ink-subtle animate-pulse">Connecting to secure room...</p>
      </div>
    );
  }

  if (rejoining) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg gap-4">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
        <p className="text-brand-ink-subtle animate-pulse">Reconnecting to the video room...</p>
      </div>
    );
  }

  if (error || !roomUrl || !token) {
    if (lateFeeAmount) {
      return (
        <LateFeeGate
          amount={lateFeeAmount}
          title="Late fee required before joining"
          description="The creator is already waiting and this booking is more than 5 minutes past its start time. Pay the 10% late fee to enter the room."
          backLabel="Back to bookings"
          onBack={() => router.push("/bookings")}
          createIntent={async () => {
            const response = await fetch(`/api/bookings/${bookingId}/late-fee`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "create" }),
            });
            const data = await response.json();
            if (!response.ok || !data.clientSecret) {
              throw new Error(data.error ?? "Could not initialise the late fee payment.");
            }
            return { clientSecret: data.clientSecret as string };
          }}
          confirmPayment={async (paymentIntentId) => {
            const response = await fetch(`/api/bookings/${bookingId}/late-fee`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "confirm", paymentIntentId }),
            });
            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.error ?? "Could not confirm the late fee payment.");
            }
            setLoading(true);
            await initCall();
          }}
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <PhoneOff className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-brand-ink mb-2">Room Unavailable</h1>
          <p className="text-brand-ink-subtle max-w-md">{error ?? "Missing booking room details."}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(isCreator ? "/dashboard" : "/bookings")}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg p-4 md:p-6">
      <div className="mb-3 md:mb-4">
        <div>
          <h2 className="text-lg font-bold text-brand-ink flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-live animate-pulse" />
            {isCreator ? `Session with ${booking?.fan?.full_name}` : `Session with ${booking?.creator?.full_name}`}
          </h2>
          <p className="text-xs text-brand-ink-muted mt-0.5">
            {booking?.topic || "No topic specified"} · Locked Room
          </p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col">
        <CallContainer
          url={roomUrl}
          token={token}
          startAudio={canUseMedia}
          startVideo={canUseMedia}
          onJoin={() => {
            if (isCreator) {
              setCreatorPresent(true);
            } else {
              setFanPresent(true);
            }
            void markPresence(true);
          }}
          onLeave={handleLeave}
          onError={handleJoinError}
        >
          <BookingVideoStage
            booking={booking}
            isCreator={isCreator}
            canUseMedia={canUseMedia}
            currentTime={currentTime}
            scheduledAt={scheduledAt}
            onEndCall={handleEndCall}
          />
        </CallContainer>
      </div>

      <div className="mt-3 text-center">
        {rejoining ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary-light">
            Reconnecting to the video room...
          </p>
        ) : null}
        <p className="text-[10px] text-brand-ink-muted uppercase tracking-widest font-medium">
          Secure end-to-end encrypted session
        </p>
      </div>
    </div>
  );
}
