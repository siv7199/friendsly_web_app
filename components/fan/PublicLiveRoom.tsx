"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CallContainer } from "@/components/video/CallContainer";
import { cn } from "@/lib/utils";
import { LIVE_STAGE_SECONDS } from "@/lib/live";
import { DailyVideo, useDaily, useLocalSessionId } from "@daily-co/daily-react";

function getBestRemoteParticipantSessionId(params: {
  participants: any[];
  preferredUserName?: string | null;
}) {
  const remoteParticipants = params.participants.filter((participant) => !participant?.local);
  if (remoteParticipants.length === 0) return null;

  const exactMatch = params.preferredUserName
    ? remoteParticipants.find((participant) => participant?.user_name === params.preferredUserName)
    : null;
  if (exactMatch?.session_id) return exactMatch.session_id;

  const playableVideo = remoteParticipants.find((participant) => {
    const videoState = participant?.tracks?.video?.state;
    return videoState === "playable" || videoState === "loading";
  });
  if (playableVideo?.session_id) return playableVideo.session_id;

  return remoteParticipants[0]?.session_id ?? null;
}

function LiveStage({
  creatorId,
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  isAdmitted,
  secondsRemaining,
  onJoinQueue,
  joinDisabled,
  queueCount,
  onStageSessionReady,
}: {
  creatorId: string;
  creatorName: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  isAdmitted: boolean;
  secondsRemaining: number;
  onJoinQueue: () => void;
  joinDisabled: boolean;
  queueCount: number;
  onStageSessionReady?: (dailySessionId: string) => void;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const [creatorSessionId, setCreatorSessionId] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(isAdmitted);
  const [camOn, setCamOn] = useState(isAdmitted);

  async function enableStageMedia(next: { video?: boolean; audio?: boolean }) {
    if (!daily) return;

    try {
      if (next.video || next.audio) {
        await daily.startCamera({
          startVideoOff: next.video === false,
          startAudioOff: next.audio === false,
        });
      }
    } catch {}

    try {
      if (typeof next.audio === "boolean") {
        daily.setLocalAudio(next.audio);
      }
      if (typeof next.video === "boolean") {
        daily.setLocalVideo(next.video);
      }
    } catch {}
  }

  useEffect(() => {
    setMicOn(isAdmitted);
    setCamOn(isAdmitted);
  }, [isAdmitted]);

  useEffect(() => {
    if (!isAdmitted || !localSessionId || !onStageSessionReady) return;
    onStageSessionReady(localSessionId);
  }, [isAdmitted, localSessionId, onStageSessionReady]);

  useEffect(() => {
    if (!daily) return;

    const syncParticipants = () => {
      const participants = Object.values(daily.participants() ?? {});
      setCreatorSessionId(getBestRemoteParticipantSessionId({
        participants,
        preferredUserName: creatorId,
      }));
    };

    syncParticipants();
    daily.on("participant-joined", syncParticipants);
    daily.on("participant-updated", syncParticipants);
    daily.on("participant-left", syncParticipants);
    return () => {
      daily.off("participant-joined", syncParticipants);
      daily.off("participant-updated", syncParticipants);
      daily.off("participant-left", syncParticipants);
    };
  }, [creatorId, daily]);

  useEffect(() => {
    if (!daily) return;
    void enableStageMedia({
      audio: isAdmitted && micOn,
      video: isAdmitted && camOn,
    });
  }, [camOn, daily, isAdmitted, micOn]);

  const stageLabel = useMemo(() => {
    if (isAdmitted) return `You're on stage for ${Math.max(0, secondsRemaining)}s`;
    if (queueCount > 0) return `${queueCount} ${queueCount === 1 ? "fan" : "fans"} waiting to join`;
    return "Public live chat is open";
  }, [isAdmitted, queueCount, secondsRemaining]);

  return (
    <div className="rounded-[28px] border border-brand-border bg-brand-surface p-4 md:p-5 h-full flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="live">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
              LIVE
            </Badge>
            <span className="text-sm font-semibold text-slate-100">{creatorName}</span>
          </div>
          <p className="mt-1 text-sm text-slate-400">{stageLabel}</p>
        </div>

        {!isAdmitted ? (
          <Button variant="live" className="gap-2 shrink-0" onClick={onJoinQueue} disabled={joinDisabled}>
            <Zap className="w-4 h-4" />
            Join Live
          </Button>
        ) : (
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.2em] text-brand-live">On Stage</p>
            <p className="text-2xl font-black text-brand-live">{Math.max(0, secondsRemaining)}s</p>
          </div>
        )}
      </div>

      <div className="grid flex-1 min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative min-h-[300px] rounded-[24px] overflow-hidden border border-brand-border bg-brand-elevated">
          {creatorSessionId ? (
            <DailyVideo sessionId={creatorSessionId} type="video" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_55%)]">
              <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="xl" />
              <p className="text-sm text-slate-400">Connecting to {creatorName}'s live video...</p>
            </div>
          )}
          <div className="absolute left-4 bottom-4 rounded-xl bg-black/45 px-3 py-1.5 text-sm font-semibold text-white">
            {creatorName}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[24px] border border-brand-border bg-brand-elevated p-4 min-h-[180px] flex flex-col items-center justify-center text-center">
            {isAdmitted && localSessionId ? (
              <div className="w-full h-full flex flex-col gap-3">
                <div className="relative flex-1 rounded-2xl overflow-hidden bg-black/30">
                  <DailyVideo sessionId={localSessionId} type="video" mirror className="h-full w-full object-cover" />
                  <div className="absolute left-3 bottom-3 rounded-lg bg-black/45 px-2 py-1 text-xs font-semibold text-white">
                    You
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-brand-live/15 border border-brand-live/25 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-brand-live" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-100">Want to go on screen?</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Pay the creator's live join fee, enter the queue, and wait for them to admit you for {LIVE_STAGE_SECONDS} seconds.
                </p>
              </>
            )}
          </div>

          <div className="rounded-[24px] border border-brand-border bg-brand-elevated p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Stage Controls</p>
            {isAdmitted ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={async () => {
                    const next = !micOn;
                    setMicOn(next);
                    await enableStageMedia({
                      audio: next,
                      video: camOn,
                    });
                  }}
                  className={cn(
                    "w-11 h-11 rounded-full border flex items-center justify-center transition-colors",
                    micOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light" : "border-red-500/40 bg-red-500/20 text-red-400"
                  )}
                >
                  {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={async () => {
                    const next = !camOn;
                    setCamOn(next);
                    await enableStageMedia({
                      audio: micOn,
                      video: next,
                    });
                  }}
                  className={cn(
                    "w-11 h-11 rounded-full border flex items-center justify-center transition-colors",
                    camOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light" : "border-red-500/40 bg-red-500/20 text-red-400"
                  )}
                >
                  {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                You'll stay in viewer mode until the creator admits you from the queue.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicLiveRoom({
  roomUrl,
  token,
  creatorId,
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  isAdmitted,
  secondsRemaining,
  onJoinQueue,
  joinDisabled,
  queueCount,
  onStageSessionReady,
}: {
  roomUrl: string;
  token: string;
  creatorId: string;
  creatorName: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  isAdmitted: boolean;
  secondsRemaining: number;
  onJoinQueue: () => void;
  joinDisabled: boolean;
  queueCount: number;
  onStageSessionReady?: (dailySessionId: string) => void;
}) {
  return (
    <CallContainer url={roomUrl} token={token} startVideo={false} startAudio={false}>
      <LiveStage
        creatorId={creatorId}
        creatorName={creatorName}
        creatorInitials={creatorInitials}
        creatorColor={creatorColor}
        creatorAvatarUrl={creatorAvatarUrl}
        isAdmitted={isAdmitted}
        secondsRemaining={secondsRemaining}
        onJoinQueue={onJoinQueue}
        joinDisabled={joinDisabled}
        queueCount={queueCount}
        onStageSessionReady={onStageSessionReady}
      />
    </CallContainer>
  );
}
