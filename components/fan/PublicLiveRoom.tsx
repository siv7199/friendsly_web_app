"use client";

import { useEffect, useMemo, useState } from "react";
import { Flag, Loader2, Mic, MicOff, Video, VideoOff, Zap, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { CallContainer } from "@/components/video/CallContainer";
import { cn } from "@/lib/utils";
import { LIVE_STAGE_MAX_MINUTES } from "@/lib/live";
import { DailyAudioTrack, DailyVideo, useDaily, useLocalSessionId } from "@daily-co/daily-react";
import { useAuthContext } from "@/lib/context/AuthContext";

function formatStageElapsed(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

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

function getLiveAudienceCount(daily: ReturnType<typeof useDaily>, participants: any[]) {
  const visibleParticipants = participants.filter((participant) => !participant?.hidden).length;
  const hasLocalParticipant = participants.some((participant) => participant?.local);
  const joinedLocalCount = daily?.meetingState?.() === "joined-meeting" && !hasLocalParticipant ? 1 : 0;
  return Math.max(daily?.participantCounts?.().present ?? 0, visibleParticipants + joinedLocalCount);
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
  onLeaveStage,
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
  onLeaveStage?: () => void;
  joinDisabled: boolean;
  queueCount: number;
  queuePreview?: QueuePreviewEntry[];
  onStageSessionReady?: (dailySessionId: string) => void;
}) {
  const { user } = useAuthContext();
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
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [reportDeliveryState, setReportDeliveryState] = useState<"sent" | "stored_only" | "delivery_failed" | null>(null);
  const audibleSessionIds = Array.from(new Set(
    [creatorSessionId, !isAdmitted ? activeFanSessionId : null].filter((value): value is string => Boolean(value))
  ));

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
      setShowReportForm(false);
      setReportDescription("");
      setReportError(null);
      setReportSent(false);
      setReportDeliveryState(null);
    }

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
      setAudienceCount(getLiveAudienceCount(daily, participants));

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

  async function handleSubmitReport() {
    if (!user?.full_name || !user.email || !reportDescription.trim()) return;

    setReportSubmitting(true);
    setReportError(null);
    setReportDeliveryState(null);

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: user.full_name,
          email: user.email,
          subject: `Live call report - ${creatorName}`,
          description: reportDescription.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not send report.");
      }

      setReportSent(true);
      setReportDeliveryState(
        data.emailNotificationConfigured === false
          ? "stored_only"
          : data.emailNotificationSent === false
          ? "delivery_failed"
          : "sent"
      );
      setReportDescription("");
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Could not send report.");
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-[28px] border border-brand-border bg-brand-surface p-3 md:p-4 xl:gap-2.5 xl:p-3.5">
      {audibleSessionIds.map((sessionId) => (
        <DailyAudioTrack key={sessionId} sessionId={sessionId} />
      ))}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between xl:gap-3">
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
          <p className="mt-1 text-xs md:text-sm text-brand-ink-subtle">{stageLabel}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start md:self-auto">
          {isAdmitted ? null : (
            <Button variant="live" className="gap-2 shrink-0" onClick={onJoinQueue} disabled={joinDisabled}>
              <Zap className="w-4 h-4" />
              Join Live
            </Button>
          )}
        </div>
      </div>

      <div className={cn(
        "grid flex-1 min-h-0 gap-4 overflow-hidden xl:gap-3",
        isAdmitted || showRemoteGuestStage
          ? "grid-rows-[minmax(220px,33vh)_minmax(220px,33vh)] md:grid-rows-1 md:auto-rows-fr md:grid-cols-2"
          : "grid-cols-1 auto-rows-fr"
      )}>
        <div className={cn(
          "relative h-full rounded-[24px] overflow-hidden border border-brand-border bg-brand-elevated",
          isAdmitted || showRemoteGuestStage ? "min-h-[220px] md:min-h-0 xl:min-h-[200px]" : "min-h-[280px] md:min-h-0 xl:min-h-[250px]"
        )}>
          {!isAdmitted ? (
            <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
              <Button
                type="button"
                variant="surface"
                size="sm"
                className="gap-2 border-white/15 bg-black/35 text-white backdrop-blur-sm hover:bg-black/55 hover:text-white"
                  onClick={() => {
                    setShowReportForm((current) => !current);
                    setReportError(null);
                    setReportSent(false);
                    setReportDeliveryState(null);
                  }}
              >
                <Flag className="h-4 w-4" />
                Report
              </Button>

              {showReportForm ? (
                <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/75 p-4 text-left text-white shadow-xl backdrop-blur">
                  <p className="text-sm font-semibold">Report this live call</p>
                  <p className="mt-1 text-xs leading-5 text-white/70">
                    This sends a support request with the subject Live call report - {creatorName}.
                  </p>
                  <textarea
                    value={reportDescription}
                    onChange={(event) => setReportDescription(event.target.value)}
                    rows={4}
                    placeholder="Tell us what happened so our team can review it."
                    className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-white/30"
                  />
                  {reportError ? <p className="mt-2 text-xs text-red-300">{reportError}</p> : null}
                  {reportSent && reportDeliveryState === "sent" ? (
                    <p className="mt-2 text-xs text-emerald-300">Report sent and forwarded to support.</p>
                  ) : null}
                  {reportSent && reportDeliveryState === "stored_only" ? (
                    <p className="mt-2 text-xs text-amber-200">Report saved, but support email forwarding is not configured yet.</p>
                  ) : null}
                  {reportSent && reportDeliveryState === "delivery_failed" ? (
                    <p className="mt-2 text-xs text-amber-200">Report saved, but the support email did not send successfully.</p>
                  ) : null}
                  {!user?.full_name || !user.email ? (
                    <p className="mt-2 text-xs text-amber-200">You need a signed-in account email to send a report.</p>
                  ) : null}
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/10 hover:text-white"
                      onClick={() => {
                        setShowReportForm(false);
                        setReportError(null);
                        setReportSent(false);
                        setReportDeliveryState(null);
                      }}
                    >
                      Close
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={reportSubmitting || !reportDescription.trim() || !user?.full_name || !user.email}
                      onClick={() => void handleSubmitReport()}
                    >
                      {reportSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : "Send report"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
          <div className="absolute left-4 bottom-4 rounded-xl bg-black/45 px-3 py-2 text-white max-w-[calc(100%-2rem)]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Host</p>
            <p className="text-sm font-semibold">{creatorName}</p>
          </div>
        </div>

        {isAdmitted ? (
          <div className="relative h-full min-h-[220px] overflow-hidden rounded-[24px] border border-brand-border bg-brand-elevated md:min-h-0 xl:min-h-[200px]">
            {localSessionId && camOn && localVideoActive ? (
              <div className="relative h-full w-full overflow-hidden bg-black/30">
                <div className="daily-stage-video h-full w-full overflow-hidden">
                  <DailyVideo sessionId={localSessionId} type="video" mirror className="h-full w-full object-cover" />
                  <style dangerouslySetInnerHTML={dailyVideoFillStyles} />
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
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
            <div className="absolute left-4 top-4 rounded-xl border border-brand-live/30 bg-black/25 px-3 py-2 text-white">
              <p className="text-[10px] uppercase tracking-[0.2em] text-brand-live">On Stage</p>
              <p className="text-lg font-black tabular-nums text-brand-live">{formatStageElapsed(stageElapsedSeconds)}</p>
              <p className="text-[10px] text-white/75">of {LIVE_STAGE_MAX_MINUTES}:00 max</p>
            </div>
            <div className="absolute left-4 bottom-4 rounded-xl bg-black/45 px-3 py-2 text-white">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-300">You</p>
              <p className="text-sm font-semibold">On Stage</p>
            </div>
            <div className="absolute right-4 bottom-4 flex items-center gap-2">
              <button
                onClick={async () => {
                  const next = !micOn;
                  setMicOn(next);
                  await enableStageMedia({ audio: next, video: camOn });
                }}
                className={cn(
                  "w-11 h-11 rounded-full border flex items-center justify-center transition-colors backdrop-blur-sm",
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
                  "w-11 h-11 rounded-full border flex items-center justify-center transition-colors backdrop-blur-sm",
                  camOn ? "border-brand-primary bg-brand-primary/10 text-brand-primary-light" : "border-red-500/40 bg-red-500/20 text-red-400"
                )}
              >
                {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
              {onLeaveStage && (
                <button
                  onClick={onLeaveStage}
                  title="Return to spectator"
                  className="w-11 h-11 rounded-full border border-white/20 bg-black/30 flex items-center justify-center transition-colors backdrop-blur-sm text-white hover:bg-black/50"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : showRemoteGuestStage ? (
          <div className="h-full min-h-[220px] overflow-hidden rounded-[24px] border border-brand-border bg-brand-elevated md:min-h-0 xl:min-h-[200px]">
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
              <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />
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
  onLeaveStage,
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
  onLeaveStage?: () => void;
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
        onLeaveStage={onLeaveStage}
        joinDisabled={joinDisabled}
        queueCount={queueCount}
        queuePreview={queuePreview}
        onStageSessionReady={onStageSessionReady}
      />
    </CallContainer>
  );
}
