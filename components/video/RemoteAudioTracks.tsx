"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { DailyAudioTrack } from "@daily-co/daily-react";
import { cn } from "@/lib/utils";

export function RemoteAudioTracks({
  sessionIds,
  className,
  buttonClassName,
}: {
  sessionIds: string[];
  className?: string;
  buttonClassName?: string;
}) {
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [playBlocked, setPlayBlocked] = useState(false);
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));

  useEffect(() => {
    if (uniqueSessionIds.length === 0) {
      setPlayBlocked(false);
      audioRefs.current = {};
      return;
    }

    audioRefs.current = Object.fromEntries(
      uniqueSessionIds.map((sessionId) => [sessionId, audioRefs.current[sessionId] ?? null])
    );
  }, [uniqueSessionIds.join("|")]);

  async function resumeAudio() {
    const audioElements = Object.values(audioRefs.current).filter(
      (element): element is HTMLAudioElement => Boolean(element)
    );
    let failed = false;

    for (const audioElement of audioElements) {
      try {
        await audioElement.play();
      } catch {
        failed = true;
      }
    }

    setPlayBlocked(failed);
  }

  return (
    <>
      {uniqueSessionIds.map((sessionId) => (
        <DailyAudioTrack
          key={sessionId}
          ref={(element) => {
            audioRefs.current[sessionId] = element;
          }}
          sessionId={sessionId}
          onPlayFailed={() => setPlayBlocked(true)}
        />
      ))}
      <div className={cn("text-[11px] leading-4 text-brand-ink-subtle", className)}>
        <span>* If sound or video drops, leave and rejoin the live.</span>
        {playBlocked ? (
          <button
            type="button"
            onClick={() => void resumeAudio()}
            className={cn(
              "ml-2 inline-flex min-h-8 items-center gap-1 rounded-full border border-brand-live/30 bg-brand-live/10 px-2.5 py-1 text-[11px] font-semibold text-brand-live transition-colors hover:bg-brand-live/15",
              buttonClassName
            )}
          >
            <Volume2 className="h-3 w-3" />
            Resume audio
          </button>
        ) : null}
      </div>
    </>
  );
}
