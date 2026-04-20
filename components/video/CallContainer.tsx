"use client";

import { useEffect, useRef } from "react";
import { DailyProvider, useDaily } from "@daily-co/daily-react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

function CallJoiner({
  url,
  token,
  startVideo,
  startAudio,
  onJoin,
  onLeave,
  onError,
}: {
  url: string;
  token?: string;
  startVideo: boolean;
  startAudio: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onError?: (error: unknown) => void;
}) {
  const daily = useDaily();
  // Track whether WE triggered the join so we never call it twice.
  const didJoin = useRef(false);
  const hasJoinedMeeting = useRef(false);
  const notifiedJoined = useRef(false);
  const suppressNextLeave = useRef(false);

  useEffect(() => {
    if (!daily || !url) return;
    if (didJoin.current) return;
    didJoin.current = true;
    let disposed = false;

    const notifyJoined = () => {
      if (disposed || notifiedJoined.current) return;
      notifiedJoined.current = true;
      hasJoinedMeeting.current = true;
      onJoin?.();
    };

    const handleJoinedMeeting = () => {
      notifyJoined();
    };
    const handleLeftMeeting = () => {
      if (suppressNextLeave.current) {
        suppressNextLeave.current = false;
        return;
      }
      if (!hasJoinedMeeting.current) return;
      hasJoinedMeeting.current = false;
      notifiedJoined.current = false;
      onLeave?.();
    };

    daily.on("joined-meeting", handleJoinedMeeting);
    daily.on("left-meeting", handleLeftMeeting);

    async function joinMeeting() {
      if (!daily) return;
      const state = daily.meetingState();
      if (state === "joined-meeting" || state === "joining-meeting") {
        // Already in a call — leave it first before joining the new room
        suppressNextLeave.current = true;
        try { await daily.leave(); } catch {}
      }
      const joinPromise = daily.join({
        url,
        token,
        startVideoOff: !startVideo,
        startAudioOff: !startAudio,
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error("Daily join timed out.")), 15000);
      });

      // Join the room before acquiring devices. Camera/mic permissions can stall
      // on some browsers, especially when testing two tabs against one webcam.
      await Promise.race([joinPromise, timeoutPromise]);
      notifyJoined();
    }

    joinMeeting().catch((e: unknown) => {
      console.error("Failed to join Daily call", e);
      onError?.(e);
    });

    return () => {
      disposed = true;
      const shouldLeave = hasJoinedMeeting.current;
      didJoin.current = false;
      hasJoinedMeeting.current = false;
      notifiedJoined.current = false;
      suppressNextLeave.current = true;
      daily.off("joined-meeting", handleJoinedMeeting);
      daily.off("left-meeting", handleLeftMeeting);
      if (shouldLeave) {
        daily.leave().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, url, token, startVideo, startAudio]);

  return null;
}

export function CallContainer({
  url,
  token,
  children,
  onJoin,
  onLeave,
  onError,
  startVideo = false,
  startAudio = false,
}: {
  url: string;
  token?: string;
  children: React.ReactNode;
  onJoin?: () => void;
  onLeave?: () => void;
  onError?: (error: unknown) => void;
  startVideo?: boolean;
  startAudio?: boolean;
}) {
  const callObjectRef = useRef<DailyCall | null>(null);

  if (!callObjectRef.current) {
    callObjectRef.current = DailyIframe.createCallObject();
  }

  useEffect(() => {
    const callObject = callObjectRef.current;
    return () => {
      if (!callObject) return;
      callObject.destroy().catch(() => {});
      callObjectRef.current = null;
    };
  }, []);

  return (
    <DailyProvider callObject={callObjectRef.current}>
      <CallJoiner
        url={url}
        token={token}
        startVideo={startVideo}
        startAudio={startAudio}
        onJoin={onJoin}
        onLeave={onLeave}
        onError={onError}
      />
      {children}
    </DailyProvider>
  );
}
