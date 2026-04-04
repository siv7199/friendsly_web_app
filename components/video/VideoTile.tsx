"use client";

import { useEffect, useRef } from "react";
import { useVideoTrack, useAudioTrack } from "@daily-co/daily-react";

export function VideoTile({ sessionId, isLocal }: { sessionId: string; isLocal?: boolean }) {
  const videoElement = useRef<HTMLVideoElement>(null);
  const audioElement = useRef<HTMLAudioElement>(null);

  const videoState = useVideoTrack(sessionId);
  const audioState = useAudioTrack(sessionId);

  useEffect(() => {
    if (videoElement.current && videoState?.track) {
      videoElement.current.srcObject = new MediaStream([videoState.track]);
    }
  }, [videoState?.track]);

  useEffect(() => {
    if (audioElement.current && audioState?.track && !isLocal) {
      audioElement.current.srcObject = new MediaStream([audioState.track]);
    }
  }, [audioState?.track, isLocal]);

  if (!videoState?.track) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-brand-elevated">
        <span className="text-slate-500 text-sm">No video</span>
      </div>
    );
  }

  return (
    <>
      <video
        autoPlay
        muted={isLocal}
        playsInline
        ref={videoElement}
        className="w-full h-full object-cover"
      />
      {!isLocal && <audio autoPlay playsInline ref={audioElement} />}
    </>
  );
}
