"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff, X } from "lucide-react";
import {
  DailyAudioTrack,
  DailyVideo,
  useDaily,
  useLocalSessionId,
  useParticipantIds,
} from "@daily-co/daily-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CallContainer } from "@/components/video/CallContainer";
import { LateFeeGate } from "@/components/booking/LateFeeGate";
import { useAuthContext } from "@/lib/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { readJsonResponse } from "@/lib/http";
import { getBookingWindow } from "@/lib/bookings";
import { cn } from "@/lib/utils";

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

const MOBILE_BOOKING_VIEWPORT_STYLE = {
  height: "100dvh",
  maxHeight: "100dvh",
  backgroundColor: "#0b0b1f",
};

const VIDEO_FILL = {
  __html: `
    .m-booking-video, .m-booking-video > div, .m-booking-video > div > div, .m-booking-video video {
      width: 100% !important;
      height: 100% !important;
    }
    .m-booking-video { position: relative; }
    .m-booking-video video {
      display: block !important;
      object-fit: cover !important;
      transform: none !important;
    }
    .m-booking-video div[style*='position: absolute'] {
      display: none !important;
    }
  `,
};

function formatCallTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function MobileBookingStage({
  booking,
  isCreator,
  canUseMedia,
  currentTime,
  scheduledAt,
  onEndCall,
  onExit,
}: {
  booking: BookingDetails | null;
  isCreator: boolean;
  canUseMedia: boolean;
  currentTime: number;
  scheduledAt: string | null;
  onEndCall: () => Promise<void>;
  onExit: () => void;
}) {
  const daily = useDaily();
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
    ? booking?.fan?.avatar_color ?? "bg-brand-primary"
    : booking?.creator?.avatar_color ?? "bg-brand-primary";
  const remoteImageUrl = isCreator ? booking?.fan?.avatar_url : booking?.creator?.avatar_url;
  const bookingDurationSeconds = Math.max(0, Number(booking?.duration ?? 0) * 60);
  const elapsedSeconds = scheduledAt
    ? Math.min(
        bookingDurationSeconds || Number.MAX_SAFE_INTEGER,
        Math.max(0, Math.floor((currentTime - new Date(scheduledAt).getTime()) / 1000))
      )
    : 0;
  const remainingSeconds = Math.max(0, bookingDurationSeconds - elapsedSeconds);

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

  const creatorStatusLine = remoteParticipantId
    ? `On call with ${remoteName} · ${formatCallTimer(elapsedSeconds)}`
    : `Waiting for ${remoteName} · ${formatCallTimer(elapsedSeconds)}`;

  const hasRemote = Boolean(remoteParticipantId);

  return (
    <div
      className="relative h-[100dvh] max-h-[100dvh] w-full overflow-hidden overscroll-none bg-[#0b0b1f]"
      style={MOBILE_BOOKING_VIEWPORT_STYLE}
    >
      {remoteParticipantId ? <DailyAudioTrack sessionId={remoteParticipantId} /> : null}
      <style dangerouslySetInnerHTML={VIDEO_FILL} />

      {/* Full-screen remote video (or waiting state) */}
      <div className="absolute inset-0">
        {hasRemote ? (
          <div className="m-booking-video h-full w-full">
            <DailyVideo sessionId={remoteParticipantId!} type="video" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#2e1065,transparent_60%)] px-8 text-center">
            <Avatar
              initials={remoteInitials}
              color={remoteColor}
              imageUrl={remoteImageUrl}
              size="xl"
            />
            <p className="text-sm text-white/75">Waiting for {remoteName} to join...</p>
          </div>
        )}
      </div>

      {/* Top gradient + overlay row */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/55 to-transparent" />
      <div
        className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pb-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onExit}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-all active:scale-95"
            aria-label="Leave booking room"
          >
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="pointer-events-auto rounded-full bg-black/45 px-3 py-1.5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold text-white">
              {hasRemote ? remoteName : `Waiting for ${remoteName}`}
            </p>
            {booking?.topic ? (
              <p className="text-[10px] text-white/65">{booking.topic}</p>
            ) : null}
          </div>
        </div>
        <div className="pointer-events-auto rounded-2xl bg-black/45 px-3 py-2 text-center text-white backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/65">Session</p>
          <p className="text-base font-black tabular-nums leading-tight">{formatCallTimer(elapsedSeconds)}</p>
          {bookingDurationSeconds > 0 ? (
            <p className="text-[9px] text-white/65">{formatCallTimer(remainingSeconds)} left</p>
          ) : null}
        </div>
      </div>

      {/* Local self-view PiP (FaceTime-style) */}
      <div
        className="absolute right-3 h-[150px] w-[110px] overflow-hidden rounded-[18px] border border-white/15 bg-[#1a1a3e] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
        style={{ top: "calc(env(safe-area-inset-top) + 72px)" }}
      >
        {localSessionId && camOn ? (
          <div className="m-booking-video h-full w-full">
            <DailyVideo sessionId={localSessionId} type="video" mirror className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,#4c1d95,transparent_70%)] px-2 text-center">
            <Avatar initials="You" size="lg" />
            <p className="text-[10px] leading-4 text-white/70">
              {!canUseMedia ? "Unlocks at start" : camOn ? "Connecting…" : "Camera off"}
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2 pb-1.5 pt-5">
          <p className="truncate text-[10px] font-semibold text-white">{localName}</p>
        </div>
      </div>

      {/* Bottom gradient + controls overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/70 to-transparent" />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
      >
        {!canUseMedia ? (
          <p className="pointer-events-none rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/80 backdrop-blur-sm">
            Camera and mic unlock at the scheduled start time.
          </p>
        ) : null}
        <div className="pointer-events-auto flex items-center justify-center gap-3">
          <button
            onClick={toggleMic}
            disabled={!canUseMedia}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md transition-all active:scale-95",
              !canUseMedia
                ? "cursor-not-allowed border-white/10 bg-white/10 text-white/35"
                : micOn
                ? "border-white/20 bg-white/15 text-white"
                : "border-red-400/60 bg-red-500/25 text-red-200"
            )}
            aria-label={micOn ? "Mute" : "Unmute"}
          >
            {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
          <button
            onClick={toggleCam}
            disabled={!canUseMedia}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md transition-all active:scale-95",
              !canUseMedia
                ? "cursor-not-allowed border-white/10 bg-white/10 text-white/35"
                : camOn
                ? "border-white/20 bg-white/15 text-white"
                : "border-red-400/60 bg-red-500/25 text-red-200"
            )}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          >
            {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
          <button
            onClick={() => {
              void (async () => {
                if (isCreator) {
                  await onEndCall();
                  if (daily && typeof daily.leave === "function") {
                    try { await daily.leave(); } catch {}
                  }
                  return;
                }
                onExit();
              })();
            }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_18px_40px_rgba(239,68,68,0.45)] transition-all active:scale-95"
            aria-label={isCreator ? "End call" : "Leave call"}
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MobileBookingRoom() {
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
  const canUseMedia = bookingHasStarted;

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
  }, [bookingId, user]);

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
    const data = await readJsonResponse<{
      error?: string;
      requiresLateFee?: boolean;
      lateFeeAmount?: number;
      url?: string;
      token?: string;
      isCreator?: boolean;
    }>(res);

    if (!res.ok || data?.error) {
      if (data?.requiresLateFee) {
        setLateFeeAmount(Number(data.lateFeeAmount ?? 0));
        setError(null);
        setLoading(false);
        return;
      }
      setError(data?.error ?? "Failed to connect to the video room.");
      setLoading(false);
      return;
    }

    setLateFeeAmount(null);
    setError(null);
    setRejoining(false);
    setRoomUrl(data?.url ?? "");
    setToken(data?.token ?? "");
    setIsCreator(Boolean(data?.isCreator));
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
          setError(
            err instanceof Error && err.name === "AbortError"
              ? "Connecting to the secure room timed out. Please try joining again."
              : "Failed to connect to the video room."
          );
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

  const exitPath = isCreator ? "/dashboard" : "/bookings";

  const handleExit = useCallback(() => {
    if (selfLeaveRequestedRef.current) {
      if (isCreator) {
        setCreatorPresent(false);
      } else {
        setFanPresent(false);
      }
      void markPresence(false);
      router.push(exitPath);
      return;
    }

    if (isCreator) {
      selfLeaveRequestedRef.current = true;
      void markPresence(false);
    }
    router.push(exitPath);
  }, [exitPath, isCreator, markPresence, router]);

  const handleLeave = useCallback(() => {
    if (selfLeaveRequestedRef.current) {
      if (isCreator) {
        setCreatorPresent(false);
      } else {
        setFanPresent(false);
      }
      void markPresence(false);
      router.push(exitPath);
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
  }, [exitPath, initCall, isCreator, markPresence, router]);

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
    router.push(exitPath);
  }, [exitPath, remoteEnded, router]);

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
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-violet-500 px-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
        <p className="text-sm text-white/75">Connecting to secure room...</p>
      </div>
    );
  }

  if (rejoining) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-violet-500 px-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
        <p className="text-sm text-white/75">Reconnecting to the video room...</p>
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
            const data = await readJsonResponse<{ clientSecret?: string; error?: string }>(response);
            if (!response.ok || !data?.clientSecret) {
              throw new Error(data?.error ?? "Could not initialise the late fee payment.");
            }
            return { clientSecret: data.clientSecret as string };
          }}
          confirmPayment={async (paymentIntentId) => {
            const response = await fetch(`/api/bookings/${bookingId}/late-fee`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "confirm", paymentIntentId }),
            });
            const data = await readJsonResponse<{ error?: string }>(response);
            if (!response.ok) {
              throw new Error(data?.error ?? "Could not confirm the late fee payment.");
            }
            setLoading(true);
            await initCall();
          }}
        />
      );
    }

    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-violet-500 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
          <PhoneOff className="h-8 w-8 text-white" />
        </div>
        <div>
          <p className="text-xl font-semibold text-white">Room unavailable</p>
          <p className="mt-2 text-sm text-white/70">{error ?? "Missing booking room details."}</p>
        </div>
        <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" onClick={() => router.push(exitPath)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
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
      <MobileBookingStage
        booking={booking}
        isCreator={isCreator}
        canUseMedia={canUseMedia}
        currentTime={currentTime}
        scheduledAt={scheduledAt}
        onEndCall={handleEndCall}
        onExit={handleExit}
      />
    </CallContainer>
  );
}
