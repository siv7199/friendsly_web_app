"use client";

import { useEffect, useRef } from "react";
import { DailyProvider, useCallObject, useDaily } from "@daily-co/daily-react";

function CallJoiner({
  url,
  token,
  startVideo,
  startAudio,
  onJoin,
  onLeave,
}: {
  url: string;
  token?: string;
  startVideo: boolean;
  startAudio: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
}) {
  const daily = useDaily();
  // Track whether WE triggered the join so we never call it twice.
  const didJoin = useRef(false);

  useEffect(() => {
    if (!daily || !url) return;
    if (didJoin.current) return;
    didJoin.current = true;

    const handleJoinedMeeting = () => {
      onJoin?.();
    };
    const handleLeftMeeting = () => {
      onLeave?.();
    };

    daily.on("joined-meeting", handleJoinedMeeting);
    daily.on("left-meeting", handleLeftMeeting);

    async function joinMeeting() {
      if (!daily) return;
      const state = daily.meetingState();
      if (state === "joined-meeting" || state === "joining-meeting") {
        // Already in a call — leave it first before joining the new room
        try { await daily.leave(); } catch {}
      }
      await daily.join({ url, token, startVideoOff: !startVideo, startAudioOff: !startAudio });
    }

    joinMeeting().catch((e: unknown) => console.error("Failed to join Daily call", e));

    return () => {
      didJoin.current = false;
      daily.off("joined-meeting", handleJoinedMeeting);
      daily.off("left-meeting", handleLeftMeeting);
      daily.leave().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, url]);

  return null;
}

export function CallContainer({
  url,
  token,
  children,
  onJoin,
  onLeave,
  startVideo = false,
  startAudio = false,
}: {
  url: string;
  token?: string;
  children: React.ReactNode;
  onJoin?: () => void;
  onLeave?: () => void;
  startVideo?: boolean;
  startAudio?: boolean;
}) {
  const callObject = useCallObject({});

  if (!callObject) return null;

  return (
    <DailyProvider callObject={callObject}>
      <CallJoiner
        url={url}
        token={token}
        startVideo={startVideo}
        startAudio={startAudio}
        onJoin={onJoin}
        onLeave={onLeave}
      />
      {children}
    </DailyProvider>
  );
}
