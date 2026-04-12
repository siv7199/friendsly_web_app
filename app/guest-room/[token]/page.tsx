"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DailyVideo, useDaily, useLocalSessionId, useParticipantIds } from "@daily-co/daily-react";
import { Loader2, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { CallContainer } from "@/components/video/CallContainer";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type AccessPayload = {
  booking: {
    id: string;
    topic: string | null;
    guestName: string;
    creator: {
      full_name?: string;
      avatar_initials?: string;
      avatar_color?: string;
      avatar_url?: string;
    } | null;
  };
};

function GuestVideoStage({
  accessPayload,
  onLeaveClick,
}: {
  accessPayload: AccessPayload | null;
  onLeaveClick: () => void;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const remoteParticipantId = remoteParticipantIds[0];
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

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
  }, [camOn, daily, micOn]);

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
    <div className="flex flex-1 flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="live">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
            LIVE
          </Badge>
          <span className="text-sm text-slate-400">
            Session with {accessPayload?.booking.creator?.full_name ?? "Creator"}
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
            <Avatar initials="GU" size="xl" />
          )}
          <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-2 py-1 z-20">
            You ({accessPayload?.booking.guestName ?? "Guest"})
          </div>
        </div>

        <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
          {remoteParticipantId ? (
            <>
              <DailyVideo sessionId={remoteParticipantId} type="video" className="w-full h-full object-cover z-10" />
              <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-2 py-1 z-20">
                {accessPayload?.booking.creator?.full_name ?? "Creator"}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 p-6 text-center z-10">
              <Avatar
                initials={accessPayload?.booking.creator?.avatar_initials ?? "CR"}
                color={accessPayload?.booking.creator?.avatar_color ?? "bg-violet-600"}
                imageUrl={accessPayload?.booking.creator?.avatar_url}
                size="xl"
                className="opacity-60 mb-3"
              />
              <p className="text-sm font-medium text-slate-400">
                Waiting for {accessPayload?.booking.creator?.full_name ?? "Creator"}...
              </p>
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

        <button
          onClick={onLeaveClick}
          className="w-12 h-12 rounded-full border border-red-500/40 bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default function GuestRoomPage() {
  const params = useParams();
  const router = useRouter();
  const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roomUrl, setRoomUrl] = useState("");
  const [token, setToken] = useState("");
  const [accessPayload, setAccessPayload] = useState<AccessPayload | null>(null);
  const [remoteEnded, setRemoteEnded] = useState(false);

  const markPresence = useCallback(async (present: boolean) => {
    if (!rawToken) return;
    await fetch(`/api/public/booking-access/${rawToken}/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ present }),
    });
  }, [rawToken]);

  useEffect(() => {
    let cancelled = false;

    async function initRoom() {
      try {
        setLoading(true);
        setError("");
        const [accessRes, joinRes] = await Promise.all([
          fetch(`/api/public/booking-access/${rawToken}`, { cache: "no-store" }),
          fetch(`/api/public/booking-access/${rawToken}/join`, { method: "POST" }),
        ]);

        const accessData = await accessRes.json();
        if (!accessRes.ok) {
          throw new Error(accessData.error ?? "Could not load booking.");
        }

        const joinData = await joinRes.json();
        if (!joinRes.ok) {
          throw new Error(joinData.error ?? "Could not join room.");
        }

        if (!cancelled) {
          setAccessPayload(accessData);
          setRoomUrl(joinData.url);
          setToken(joinData.token);
        }
      } catch (joinError) {
        if (!cancelled) {
          setError(joinError instanceof Error ? joinError.message : "Could not join room.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (rawToken) {
      void initRoom();
    }

    return () => {
      cancelled = true;
    };
  }, [rawToken]);

  useEffect(() => {
    const bookingId = accessPayload?.booking.id;
    if (!bookingId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`guest-booking-room-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload: any) => {
          const nextStatus = payload.new?.status;
          if (nextStatus === "completed" || nextStatus === "cancelled") {
            setRemoteEnded(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accessPayload?.booking.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-bg">
        <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
        <p className="text-slate-400 animate-pulse">Connecting to secure room...</p>
      </div>
    );
  }

  if (error || !roomUrl || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-bg px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <PhoneOff className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Room Unavailable</h1>
          <p className="mt-2 max-w-md text-slate-400">{error || "Missing booking room details."}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/booking-access/${rawToken}`)}>
          Back to booking
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <div className="flex items-center gap-3">
          <Avatar
            initials={accessPayload?.booking.creator?.avatar_initials ?? "CR"}
            color={accessPayload?.booking.creator?.avatar_color ?? "bg-violet-600"}
            imageUrl={accessPayload?.booking.creator?.avatar_url}
            size="sm"
          />
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Session with {accessPayload?.booking.creator?.full_name ?? "Creator"}
            </h2>
            <p className="text-xs text-slate-500">
              {accessPayload?.booking.topic || "No topic specified"} · Guest room
            </p>
          </div>
        </div>
      </div>

      <CallContainer
        url={roomUrl}
        token={token}
        startAudio
        startVideo
        onJoin={() => {
          void markPresence(true);
        }}
        onLeave={() => {
          void markPresence(false);
          router.push(`/booking-access/${rawToken}`);
        }}
      >
        <GuestRoomStatusHandler
          remoteEnded={remoteEnded}
          onExit={() => {
            void markPresence(false);
            router.push(`/booking-access/${rawToken}`);
          }}
        />
        <GuestVideoStage
          accessPayload={accessPayload}
          onLeaveClick={() => router.push(`/booking-access/${rawToken}`)}
        />
      </CallContainer>
    </div>
  );
}

function GuestRoomStatusHandler({
  remoteEnded,
  onExit,
}: {
  remoteEnded: boolean;
  onExit: () => void;
}) {
  const daily = useDaily();

  useEffect(() => {
    if (!remoteEnded || !daily) return;

    let cancelled = false;
    const call = daily;

    async function exitRoom() {
      try {
        if (typeof call.leave === "function") {
          await call.leave();
        }
      } catch {}

      if (!cancelled) {
        onExit();
      }
    }

    void exitRoom();

    return () => {
      cancelled = true;
    };
  }, [daily, onExit, remoteEnded]);

  return null;
}
