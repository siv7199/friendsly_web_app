"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import DailyIframe from "@daily-co/daily-js";
import { Loader2, PhoneOff, Maximize2, Mic, MicOff, Video, VideoOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/lib/context/AuthContext";

export default function RoomPage() {
  const { id: bookingId } = useParams();
  const router = useRouter();
  const { user } = useAuthContext();
  
  const [callFrame, setCallFrame] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [booking, setBooking] = useState<any>(null);

  const cleanup = useCallback(async (bId: string, asCreator: boolean) => {
    if (asCreator) {
      const supabase = createClient();
      await supabase
        .from("bookings")
        .update({ status: "completed" })
        .eq("id", bId);
    }
  }, []);

  useEffect(() => {
    if (!user || !bookingId) return;

    async function initCall() {
      try {
        const res = await fetch(`/api/bookings/${bookingId}/join`, {
          method: "POST"
        });
        const data = await res.json();

        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        setIsCreator(data.isCreator);
        
        // Fetch booking info for display
        const supabase = createClient();
        const { data: bData } = await supabase
          .from("bookings")
          .select("*, creator:profiles!creator_id(full_name), fan:profiles!fan_id(full_name)")
          .eq("id", bookingId)
          .single();
        setBooking(bData);

        const frame = DailyIframe.createFrame(
          document.getElementById("call-container") as HTMLElement,
          {
            showLeaveButton: false,
            showFullscreenButton: true,
            iframeStyle: {
              width: "100%",
              height: "100%",
              border: "0",
              borderRadius: "12px",
            },
          }
        );

        await frame.join({
          url: data.url,
          token: data.token,
        });

        setCallFrame(frame);
        setLoading(false);

        frame.on("left-meeting", () => {
          cleanup(bookingId as string, data.isCreator);
          router.push(data.isCreator ? "/dashboard" : "/bookings");
        });

      } catch (err) {
        console.error("Call init error:", err);
        setError("Failed to connect to the video room.");
        setLoading(false);
      }
    }

    initCall();

    return () => {
      if (callFrame) {
        callFrame.destroy();
      }
    };
  }, [user, bookingId, router, cleanup]);

  const handleEndCall = async () => {
    if (callFrame) {
      await callFrame.leave();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg gap-4">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
        <p className="text-slate-400 animate-pulse">Connecting to secure room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg gap-6 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <PhoneOff className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Room Unavailable</h1>
          <p className="text-slate-400 max-w-md">{error}</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg p-4 md:p-6">
      {/* Header */}
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
        
        <Button 
          variant="danger" 
          onClick={handleEndCall}
          className="gap-2 px-6 shadow-lg shadow-red-500/20"
        >
          <PhoneOff className="w-4 h-4" />
          End Call
        </Button>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 min-h-0 relative bg-brand-surface rounded-2xl border border-brand-border overflow-hidden shadow-2xl">
        <div id="call-container" className="absolute inset-0 w-full h-full" />
        <style dangerouslySetInnerHTML={{ __html: `
          .daily-video-container div[style*="position: absolute"] {
             display: none !important;
          }
        `}} />
      </div>

      {/* Footer / Controls Hint */}
      <div className="mt-4 text-center">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
          Secure end-to-end encrypted session
        </p>
      </div>
    </div>
  );
}
