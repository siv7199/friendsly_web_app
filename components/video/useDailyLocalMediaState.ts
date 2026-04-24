"use client";

import { useCallback, useEffect } from "react";
import type { DailyCall } from "@daily-co/daily-js";

type MediaSyncOptions = {
  daily: DailyCall | null;
  enabled: boolean;
  micOn: boolean;
  camOn: boolean;
  setMicOn: (next: boolean) => void;
  setCamOn: (next: boolean) => void;
};

function isTrackStillOn(trackInfo: any) {
  const state = trackInfo?.state;
  const track = trackInfo?.persistentTrack ?? trackInfo?.track;

  if (track?.readyState === "ended" || track?.enabled === false) {
    return false;
  }

  if (state === "off" || state === "blocked" || state === "interrupted") {
    return false;
  }

  if (state === "playable" || state === "loading" || state === "sendable") {
    return true;
  }

  return Boolean(track && track.readyState !== "ended" && track.enabled !== false);
}

function getLocalParticipant(daily: DailyCall) {
  const participants = Object.values(daily.participants?.() ?? {}) as any[];
  return participants.find((participant) => participant?.local) ?? null;
}

export function useDailyLocalMediaState({
  daily,
  enabled,
  micOn,
  camOn,
  setMicOn,
  setCamOn,
}: MediaSyncOptions) {
  const syncLocalMediaState = useCallback(() => {
    if (!enabled || !daily || daily.meetingState?.() !== "joined-meeting") return;

    const localParticipant = getLocalParticipant(daily);
    if (!localParticipant) return;

    if (micOn && !isTrackStillOn(localParticipant.tracks?.audio)) {
      setMicOn(false);
    }

    if (camOn && !isTrackStillOn(localParticipant.tracks?.video)) {
      setCamOn(false);
    }
  }, [camOn, daily, enabled, micOn, setCamOn, setMicOn]);

  useEffect(() => {
    if (!daily || !enabled) return;

    let resumeTimer: number | null = null;
    const syncSoon = (delay = 250) => {
      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
      }
      resumeTimer = window.setTimeout(syncLocalMediaState, delay);
    };
    const syncAfterJoin = () => syncSoon(1200);
    const syncAfterResume = () => syncSoon(250);
    const syncAfterStoppedTrack = () => syncSoon(250);
    const syncOnVisible = () => {
      if (document.visibilityState === "visible") {
        syncSoon(500);
      }
    };

    daily.on("joined-meeting", syncAfterJoin);
    daily.on("track-stopped", syncAfterStoppedTrack);
    window.addEventListener("focus", syncAfterResume);
    window.addEventListener("pageshow", syncAfterResume);
    document.addEventListener("visibilitychange", syncOnVisible);

    return () => {
      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
      }
      daily.off("joined-meeting", syncAfterJoin);
      daily.off("track-stopped", syncAfterStoppedTrack);
      window.removeEventListener("focus", syncAfterResume);
      window.removeEventListener("pageshow", syncAfterResume);
      document.removeEventListener("visibilitychange", syncOnVisible);
    };
  }, [daily, enabled, syncLocalMediaState]);
}
