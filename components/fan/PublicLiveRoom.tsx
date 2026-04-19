"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Zap, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CallContainer } from "@/components/video/CallContainer";
import { cn } from "@/lib/utils";
import { LIVE_STAGE_MAX_MINUTES } from "@/lib/live";

function formatStageElapsed(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
import { DailyVideo, useDaily, useLocalSessionId } from "@daily-co/daily-react";

type QueuePreviewEntry = {
  id: string;
  fanName: string;
  avatarInitials?: string;
  avatarColor?: string;
  avatarUrl?: string;
};

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

function isParticipantVideoActive(participant: any) {
  const videoState = participant?.tracks?.video?.state;
  return videoState === "playable" || videoState === "loading";
}

function resolveRemoteParticipant(params: {
  participants: any[];
  preferredUserName?: string | null;
  preferredSessionId?: string | null;
}) {
  const remoteParticipants = params.participants.filter((participant) => !participant?.local);

  const explicitParticipant = params.preferredSessionId
    ? remoteParticipants.find((participant) => participant?.session_id === params.preferredSessionId)
    : null;
  if (explicitParticipant?.session_id) {
    return explicitParticipant;
  }

  const fallbackSessionId = getBestRemoteParticipantSessionId({
    participants: remoteParticipants,
    preferredUserName: params.preferredUserName,
  });

  return remoteParticipants.find((participant) => participant?.session_id === fallbackSessionId) ?? null;
}

function LiveStage({
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
  onJoinQueue,
  joinDisabled,
  queueCount,
  queuePreview,
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
  activeFan?: {
    fanId: string;
    fanName: string;
    avatarInitials: string;
    avatarColor: string;
    avatarUrl?: string;
    admittedDailySessionId?: string;
  } | null;
  isAdmitted: boolean;
  stageElapsedSeconds: number;
  onJoinQueue: () => void;
  joinDisabled: boolean;
  queueCount: number;
  queuePreview?: QueuePreviewEntry[];
  onStageSessionReady?: (dailySessionId: string) => void;
}) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const [creatorSessionId, setCreatorSessionId] = useState<string | null>(null);
  const [creatorVideoActive, setCreatorVideoActive] = useState(false);
  const [activeFanSessionId, setActiveFanSessionId] = useState<string | null>(null);
  const [activeFanVideoActive, setActiveFanVideoActive] = useState(false);
  const [localVideoActive, setLocalVideoActive] = useState(false);
  const [audienceCount, setAudienceCount] = useState(0);
  const [micOn, setMicOn] = useState(isAdmitted);
  const [camOn, setCamOn] = useState(isAdmitted);

  const dailyVideoFillStyles = {
    __html: `
      .daily-stage-video,
      .daily-stage-video > div,
      .daily-stage-video > div > div,
      .daily-stage-video video {
        width: 100% !important;
        height: 100% !important;
      }
      .daily-stage-video {
        position: relative;
      }
      .daily-stage-video video {
        display: block !important;
        object-fit: cover !important;
        transform: none !important;
      }
      .daily-stage-video div[style*='position: absolute'] {
        display: none !important;
      }
    `,
  };

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
      if (typeof next.audio === "boolean") daily.setLocalAudio(next.audio);
      if (typeof next.video === "boolean") daily.setLocalVideo(next.video);
    } catch {}
  }

  useEffect(() => {
    setMicOn(isAdmitted);
    setCamOn(isAdmitted);

    if (isAdmitted) {
      void enableStageMedia({ audio: true, video: true });
    } else if (daily) {
      try {
        daily.setLocalAudio(false);
        daily.setLocalVideo(false);
      } catch {}
    }
  }, [daily, isAdmitted]);

  useEffect(() => {
    if (!isAdmitted || !localSessionId || !onStageSessionReady) return;
    onStageSessionReady(localSessionId);
  }, [isAdmitted, localSessionId, onStageSessionReady]);

  useEffect(() => {
    if (!daily) return;

    const syncParticipants = () => {
      const participants = Object.values(daily.participants() ?? {});
      const localParticipant = participants.find(
        (participant: any) => participant?.local || participant?.session_id === localSessionId
      );
      setLocalVideoActive(isParticipantVideoActive(localParticipant));

      const resolvedCreatorParticipant = resolveRemoteParticipant({
        participants,
        preferredUserName: creatorId,
      });
      const nextCreatorSessionId = resolvedCreatorParticipant?.session_id ?? null;
      setCreatorSessionId(nextCreatorSessionId);
      setCreatorVideoActive(isParticipantVideoActive(resolvedCreatorParticipant));
      setAudienceCount(participants.length);

      if (!activeFan || isAdmitted) {
        setActiveFanSessionId(null);
        setActiveFanVideoActive(false);
        return;
      }

      const resolvedActiveFanParticipant = resolveRemoteParticipant({
        participants: participants.filter((participant: any) => participant?.session_id !== nextCreatorSessionId),
        preferredUserName: activeFan.fanId,
        preferredSessionId: activeFan.admittedDailySessionId,
      });
      setActiveFanSessionId(resolvedActiveFanParticipant?.session_id ?? null);
      setActiveFanVideoActive(isParticipantVideoActive(resolvedActiveFanParticipant));
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
  }, [activeFan?.admittedDailySessionId, activeFan?.fanId, creatorId, daily, isAdmitted, localSessionId]);

  useEffect(() => {
    if (!daily || !isAdmitted) return;

    const syncStageMedia = () => {
      void enableStageMedia({
        audio: micOn,
        video: camOn,
      });
    };

    syncStageMedia();
    daily.on("joined-meeting", syncStageMedia);
    return () => {
      daily.off("joined-meeting", syncStageMedia);
    };
  }, [camOn, daily, isAdmitted, micOn]);

  const stageLabel = useMemo(() => {
    if (isAdmitted) return `You're on stage for ${formatStageElapsed(stageElapsedSeconds)} of ${LIVE_STAGE_MAX_MINUTES}:00`;
    if (activeFan?.fanName && activeFanVideoActive) return `${activeFan.fanName} is live with ${creatorName}`;
    if (queueCount > 0) return `${queueCount} ${queueCount === 1 ? "fan" : "fans"} waiting to join`;
    return "Live chat is open";
  }, [activeFan?.fanName, activeFanVideoActive, creatorName, isAdmitted, queueCount, stageElapsedSeconds]);

  const showRemoteGuestStage = Boolean(!isAdmitted && activeFan);

  return (
    <div className="rounded-[28px] border border-brand-border bg-brand-surface p-4 md:p-5 h-full min-h-0 flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="live">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
              LIVE
            </Badge>
            <span className="text-sm font-semibold text-brand-ink">{creatorName}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-elevated px-2.5 py-1 text-xs text-brand-ink-subtle">
              <Users className="w-3.5 h-3.5" />
              {audienceCount} in live
            </span>
          </div>
          <p className="mt-1 text-sm text-brand-ink-subtle">{stageLabel}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isAdmitted ? (
            <>
              <button
                onClick={async () => {
                  const next = !micOn;
                  setMicOn(next);
                  await enableStageMedia({ audio: next, video: camOn });
                }}
                className={cn(
                  "w-10 h-10 rounded-full border flex items-center justify-center transition-colors",
                  micOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light" : "border-red-500/40 bg-red-500/20 text-red-400"
                )}
              >
                {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={async () => {
                  const next = !camOn;
                  setCamOn(next);
                  await enableStageMedia({ audio: micOn, video: next });
                }}
                className={cn(
                  "w-10 h-10 rounded-full border flex items-center justify-center transition-colors",
                  camOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light" : "border-red-500/40 bg-red-500/20 text-red-400"
                )}
              >
                {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
              <div className="text-right pl-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-brand-live">On Stage</p>
                <p className="text-xl font-black text-brand-live tabular-nums">{formatStageElapsed(stageElapsedSeconds)}</p>
                <p className="text-[10px] text-brand-live/75">of {LIVE_STAGE_MAX_MINUTES}:00 max</p>
              </div>
            </>
          ) : (
            <Button variant="live" className="gap-2 shrink-0" onClick={onJoinQueue} disabled={joinDisabled}>
              <Zap className="w-4 h-4" />
              Join Live
            </Button>
          )}
        </div>
      </div>

      <div className={cn(
        "grid flex-1 min-h-0 auto-rows-fr items-stretch gap-4 overflow-hidden",
        isAdmitted || showRemoteGuestStage ? "md:grid-cols-2" : "grid-cols-1"
      )}>
        <div className="relative h-full min-h-[240px] md:min-h-0 rounded-[24px] overflow-hidden border border-brand-border bg-brand-elevated">
          {creatorSessionId && creatorVideoActive ? (
            <div className="daily-stage-video h-full w-full overflow-hidden">
              <DailyVideo sessionId={creatorSessionId} type="video" className="h-full w-full object-cover" />
              <style dangerouslySetInnerHTML={dailyVideoFillStyles} />
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_55%)]">
              <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="xl" />
              <p className="text-sm text-brand-ink-subtle">
                {creatorSessionId ? `${creatorName}'s camera is off` : `Connecting to ${creatorName}'s live video...`}
              </p>
            </div>
          )}
          <div className="absolute left-4 bottom-4 rounded-xl bg-black/45 px-3 py-1.5 text-sm font-semibold text-white">
            {creatorName}
          </div>
        </div>

        {isAdmitted ? (
          <div className="relative h-full rounded-[24px] border border-brand-border bg-brand-elevated min-h-[240px] md:min-h-0 overflow-hidden">
            {localSessionId && camOn && localVideoActive ? (
              <div className="relative h-full w-full overflow-hidden bg-black/30">
                <div className="daily-stage-video h-full w-full overflow-hidden">
                  <DailyVideo sessionId={localSessionId} type="video" mirror className="h-full w-full object-cover" />
                  <style dangerouslySetInnerHTML={dailyVideoFillStyles} />
                </div>
                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-white/80">
                  You
                </div>
                <div className="absolute left-4 bottom-4 rounded-xl bg-black/45 px-3 py-1.5 text-sm font-semibold text-white">
                  On Stage
                </div>
              </div>
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_55%)] flex flex-col items-center justify-center gap-4 text-center">
                <Avatar initials={viewerInitials} color={viewerColor} imageUrl={viewerAvatarUrl} size="xl" />
                <p className="text-sm text-brand-ink-subtle">
                  {camOn ? "Camera unavailable or already in use" : "Your camera is off"}
                </p>
              </div>
            )}
          </div>
        ) : showRemoteGuestStage ? (
          <div className="h-full rounded-[24px] border border-brand-border bg-brand-elevated min-h-[240px] md:min-h-0 overflow-hidden">
            <div className="relative h-full w-full overflow-hidden">
              {activeFanSessionId && activeFanVideoActive ? (
                <div className="daily-stage-video h-full w-full overflow-hidden">
                  <DailyVideo sessionId={activeFanSessionId} type="video" className="h-full w-full object-cover" />
                  <style dangerouslySetInnerHTML={dailyVideoFillStyles} />
                </div>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#1d4ed833,transparent_55%)] text-center">
                  <Avatar
                    initials={activeFan?.avatarInitials ?? "F"}
                    color={activeFan?.avatarColor ?? "bg-brand-primary"}
                    imageUrl={activeFan?.avatarUrl}
                    size="xl"
                  />
                  <p className="text-sm text-brand-ink-subtle">
                    {activeFanSessionId
                      ? `${activeFan?.fanName ?? "Fan"} is on stage, but their camera is off or unavailable.`
                      : `Connecting ${activeFan?.fanName ?? "fan"} to the stage...`}
                  </p>
                </div>
              )}
              <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-white/80">
                Current Fan
              </div>
              <div className="absolute left-3 bottom-3 rounded-lg bg-black/45 px-2 py-1 text-xs font-semibold text-white">
                {activeFan?.fanName ?? "Fan"}
              </div>
            </div>
          </div>
        ) : null}
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
  viewerInitials,
  viewerColor,
  viewerAvatarUrl,
  activeFan,
  isAdmitted,
  stageElapsedSeconds,
  onJoinQueue,
  joinDisabled,
  queueCount,
  queuePreview,
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
  activeFan?: {
    fanId: string;
    fanName: string;
    avatarInitials: string;
    avatarColor: string;
    avatarUrl?: string;
    admittedDailySessionId?: string;
  } | null;
  isAdmitted: boolean;
  stageElapsedSeconds: number;
  onJoinQueue: () => void;
  joinDisabled: boolean;
  queueCount: number;
  queuePreview?: QueuePreviewEntry[];
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
        viewerInitials={viewerInitials}
        viewerColor={viewerColor}
        viewerAvatarUrl={viewerAvatarUrl}
        activeFan={activeFan}
        isAdmitted={isAdmitted}
        stageElapsedSeconds={stageElapsedSeconds}
        onJoinQueue={onJoinQueue}
        joinDisabled={joinDisabled}
        queueCount={queueCount}
        queuePreview={queuePreview}
        onStageSessionReady={onStageSessionReady}
      />
    </CallContainer>
  );
}
