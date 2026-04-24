"use client";

import { useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CallContainer } from "@/components/video/CallContainer";
import { RemoteAudioTracks } from "@/components/video/RemoteAudioTracks";
import { useLocalSessionId, useParticipantIds, DailyVideo, useDaily } from "@daily-co/daily-react";

function FanVideoStage({
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  fanName,
  onLeaveClick,
}: any) {
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });
  const creatorId = remoteParticipantIds[0]; // Assuming creator is the only other person in room

  const daily = useDaily();
  // Start false — CallContainer joins with startVideo/startAudio both off
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    if (daily && typeof daily.setLocalAudio === 'function') {
      try { daily.setLocalAudio(next); } catch {}
    }
  };

  const toggleCam = () => {
    const next = !camOn;
    setCamOn(next);
    if (daily && typeof daily.setLocalVideo === 'function') {
      try { daily.setLocalVideo(next); } catch {}
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-[500px]">
      {creatorId ? <RemoteAudioTracks sessionIds={[creatorId]} /> : null}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="live">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
            LIVE
          </Badge>
          <span className="text-sm text-brand-ink-subtle">
            Session with {creatorName}
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        {/* Fan feed (Local) */}
        <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
          <div className="absolute inset-0 bg-gradient-radial from-brand-primary/10 to-transparent" />
          
          {localSessionId ? (
            <DailyVideo sessionId={localSessionId} type="video" mirror className="w-full h-full object-cover z-10" />
          ) : (
            <Avatar initials={"You"} size="xl" />
          )}

          <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-2 py-1 z-20">
            You ({fanName})
          </div>
        </div>

        {/* Creator feed (Remote) */}
        <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
          {creatorId ? (
            <>
              <DailyVideo sessionId={creatorId} type="video" className="w-full h-full object-cover z-10" />
              <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-2 py-1 z-20">
                {creatorName}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-brand-ink-muted p-6 text-center z-10">
              <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="xl" className="opacity-50 mb-3" />
              <p className="text-sm font-medium text-brand-ink-subtle">Waiting for {creatorName}...</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-1 mt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            className={cn(
              "w-12 h-12 rounded-full border flex items-center justify-center transition-colors",
              micOn
                ? "border-brand-border bg-brand-surface text-brand-ink-subtle"
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
                ? "border-brand-border bg-brand-surface text-brand-ink-subtle"
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

export function FanLiveView({
  roomUrl,
  token,
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  fanName,
  onLeave,
  onDisconnect,
  onJoin,
}: {
  roomUrl: string;
  token: string;
  creatorName: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  fanName: string;
  onLeave: () => void;
  onDisconnect?: () => void;
  onJoin?: () => void;
}) {
  return (
    <CallContainer url={roomUrl} token={token} onJoin={onJoin} onLeave={onDisconnect}>
      <div className="w-full max-w-4xl mx-auto">
        <FanVideoStage 
          creatorName={creatorName}
          creatorInitials={creatorInitials}
          creatorColor={creatorColor}
          creatorAvatarUrl={creatorAvatarUrl}
          fanName={fanName}
          onLeaveClick={onLeave}
        />
      </div>
    </CallContainer>
  );
}
