"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { DailyVideo, useDaily, useLocalSessionId, useParticipantIds } from "@daily-co/daily-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CallContainer } from "@/components/video/CallContainer";
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
  creator?: BookingParticipant | null;
  fan?: BookingParticipant | null;
};

function BookingVideoStage({
  booking,
  isCreator,
  onEndCall,
}: {
  booking: BookingDetails | null;
  isCreator: boolean;
  onEndCall: () => Promise<void>;
}) {
  const daily = useDaily();
  const router = useRouter();
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const remoteParticipantId = remoteParticipantIds[0];
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const localName = isCreator ? booking?.creator?.full_name ?? "You" : booking?.fan?.full_name ?? "You";
  const remoteName = isCreator ? booking?.fan?.full_name ?? "Fan" : booking?.creator?.full_name ?? "Creator";
  const remoteInitials = isCreator
    ? booking?.fan?.avatar_initials ?? "F"
    : booking?.creator?.avatar_initials ?? "C";
  const remoteColor = isCreator
    ? booking?.fan?.avatar_color ?? "bg-violet-600"
    : booking?.creator?.avatar_color ?? "bg-violet-600";
  const remoteImageUrl = isCreator ? booking?.fan?.avatar_url : booking?.creator?.avatar_url;

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

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="live">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
            LIVE
          </Badge>
          <span className="text-sm text-slate-400">
            Session with {remoteName}
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 min-h-[420px]">
        <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
          {localSessionId ? (
            <div className="w-full h-full relative overflow-hidden">
              <DailyVideo sessionId={localSessionId} type="video" mirror className="w-full h-full object-cover z-10" />
              <style dangerouslySetInnerHTML={{ __html: ".daily-video-container div[style*='position: absolute'] { display: none !important; } .daily-video-container video { transform: none !important; }" }} />
            </div>
          ) : (
            <Avatar initials="You" size="xl" />
          )}
          <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-2 py-1 z-20">
            You ({localName})
          </div>
        </div>

        <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
          {remoteParticipantId ? (
            <>
              <DailyVideo sessionId={remoteParticipantId} type="video" className="w-full h-full object-cover z-10" />
              <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-2 py-1 z-20">
                {remoteName}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center z-10">
              <Avatar
                initials={remoteInitials}
                color={remoteColor}
                imageUrl={remoteImageUrl}
                size="xl"
                className="opacity-60 mb-3"
              />
              <p className="text-sm font-medium text-slate-400">Waiting for {remoteName}...</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-1 mt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            className={cn(
              "w-12 h-12 rounded-full border flex items-center justify-center transition-colors",
              micOn
                ? "border-brand-border bg-brand-surface text-slate-300"
                : "border-red-500/40 bg-red-500/20 text-red-400"
            )}
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleCam}
            className={cn(
              "w-12 h-12 rounded-full border flex items-center justify-center transition-colors",
              camOn
                ? "border-brand-border bg-brand-surface text-slate-300"
                : "border-red-500/40 bg-red-500/20 text-red-400"
            )}
          >
            {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
        </div>

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
          <Button
            variant="outline"
            onClick={() => router.push("/bookings")}
            className="gap-2"
          >
            Back To Bookings
          </Button>
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
  const selfLeaveRequestedRef = useRef(false);
  const [remoteEnded, setRemoteEnded] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [creatorPresent, setCreatorPresent] = useState(false);
  const [fanPresent, setFanPresent] = useState(false);
  const autoCancelRequestedRef = useRef(false);

  const loadBooking = useCallback(async (bId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("bookings")
      .select("id, topic, scheduled_at, creator_present, fan_present, creator:profiles!creator_id(full_name, avatar_initials, avatar_color, avatar_url), fan:profiles!fan_id(full_name, avatar_initials, avatar_color, avatar_url)")
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

  useEffect(() => {
    if (!user || !bookingId) return;

    let cancelled = false;

    async function initCall() {
      try {
        const joinController = new AbortController();
        const joinTimeout = window.setTimeout(() => joinController.abort(), 15000);
        const res = await fetch(`/api/bookings/${bookingId}/join`, {
          method: "POST",
          signal: joinController.signal,
        });
        window.clearTimeout(joinTimeout);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || data.error) {
          setError(data.error ?? "Failed to connect to the video room.");
          setLoading(false);
          return;
        }

        setRoomUrl(data.url);
        setToken(data.token);
        setIsCreator(Boolean(data.isCreator));
        setLoading(false);
        void loadBooking(bookingId);
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

    void initCall();

    return () => {
      cancelled = true;
    };
  }, [user, bookingId, loadBooking]);

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
    if (isCreator) {
      setCreatorPresent(false);
    } else {
      setFanPresent(false);
    }
    void markPresence(false);

    if (selfLeaveRequestedRef.current) {
      router.push(isCreator ? "/dashboard" : "/bookings");
      return;
    }

    setError("Disconnected from the video room. If the booking is still active, you can rejoin from your dashboard or bookings.");
  }, [isCreator, markPresence, router]);

  useEffect(() => {
    if (!remoteEnded) return;

    router.push(isCreator ? "/dashboard" : "/bookings");
  }, [isCreator, remoteEnded, router]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg gap-4">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
        <p className="text-slate-400 animate-pulse">Connecting to secure room...</p>
      </div>
    );
  }

  if (error || !roomUrl || !token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <PhoneOff className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Room Unavailable</h1>
          <p className="text-slate-400 max-w-md">{error ?? "Missing booking room details."}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(isCreator ? "/dashboard" : "/bookings")}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-live animate-pulse" />
            {isCreator ? `Session with ${booking?.fan?.full_name}` : `Session with ${booking?.creator?.full_name}`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {booking?.topic || "No topic specified"} · Locked Room
          </p>
        </div>
      </div>

      <CallContainer
        url={roomUrl}
        token={token}
        startAudio
        startVideo
        onJoin={() => {
          if (isCreator) {
            setCreatorPresent(true);
          } else {
            setFanPresent(true);
          }
          void markPresence(true);
        }}
        onLeave={handleLeave}
      >
        <BookingVideoStage booking={booking} isCreator={isCreator} onEndCall={handleEndCall} />
      </CallContainer>

      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
          Secure end-to-end encrypted session
        </p>
      </div>
    </div>
  );
}
