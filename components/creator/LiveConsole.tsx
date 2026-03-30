"use client";

import { useState } from "react";
import {
  Radio, Users, SkipForward, StopCircle,
  Mic, MicOff, Video, VideoOff, Settings,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { WaitingRoom } from "@/components/fan/WaitingRoom";
import { MOCK_QUEUE } from "@/lib/mock-data";
import { useAuthContext } from "@/lib/context/AuthContext";
import { cn } from "@/lib/utils";

type SessionState = "idle" | "live";

export function LiveConsole() {
  const { user } = useAuthContext();
  const isDemo = user?.id === "1";
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [currentFan, setCurrentFan] = useState(MOCK_QUEUE[0]);
  const [queue, setQueue] = useState(isDemo ? MOCK_QUEUE : []);

  const creatorName = user?.full_name ?? "You";
  const creatorInitials = user?.avatar_initials ?? "??";
  const creatorColor = user?.avatar_color ?? "bg-violet-600";

  function startSession() {
    setSessionState("live");
  }

  function admitNext() {
    const next = queue[1];
    if (!next) return;
    setCurrentFan(next);
    setQueue((q) => q.slice(1));
  }

  function endSession() {
    setSessionState("idle");
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* ── PRE-LIVE State ── */}
      {sessionState === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-brand-border bg-brand-surface p-8 text-center">
          {/* Camera preview placeholder */}
          <div className="w-full max-w-sm aspect-video rounded-2xl bg-brand-elevated border border-brand-border flex flex-col items-center justify-center mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-radial from-brand-primary/5 to-transparent" />
            <div className="w-20 h-20 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center mb-3">
              <Avatar initials={creatorInitials} color={creatorColor} size="lg" />
            </div>
            <p className="text-sm text-slate-500">Camera preview</p>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={() => setMicOn((v) => !v)}
              className={cn(
                "w-12 h-12 rounded-full border flex items-center justify-center transition-colors",
                micOn
                  ? "bg-brand-surface border-brand-border text-slate-300 hover:border-brand-primary/40"
                  : "bg-red-500/20 border-red-500/40 text-red-400"
              )}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setCamOn((v) => !v)}
              className={cn(
                "w-12 h-12 rounded-full border flex items-center justify-center transition-colors",
                camOn
                  ? "bg-brand-surface border-brand-border text-slate-300 hover:border-brand-primary/40"
                  : "bg-red-500/20 border-red-500/40 text-red-400"
              )}
            >
              {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button className="w-12 h-12 rounded-full border border-brand-border bg-brand-surface flex items-center justify-center text-slate-300 hover:border-brand-primary/40 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
            <Users className="w-4 h-4" />
            <span>{queue.length} fans waiting in queue</span>
          </div>

          <Button variant="live" size="xl" onClick={startSession} className="gap-3">
            <Radio className="w-5 h-5" />
            Start Live Session
          </Button>
        </div>
      )}

      {/* ── LIVE State ── */}
      {sessionState === "live" && (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Main video area */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* Live header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Badge variant="live">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                  LIVE
                </Badge>
                <span className="text-sm text-slate-400">Session with {currentFan.fanName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="text-brand-live font-mono font-bold">12:34</span>
                <span>elapsed</span>
              </div>
            </div>

            {/* Split screen video */}
            <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
              {/* Creator feed */}
              <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
                <div className="absolute inset-0 bg-gradient-radial from-brand-primary/10 to-transparent" />
                <Avatar initials={creatorInitials} color={creatorColor} size="xl" />
                <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-2 py-1">
                  You ({creatorName})
                </div>
              </div>

              {/* Fan feed */}
              <div className="relative rounded-2xl bg-brand-elevated border border-brand-border overflow-hidden flex items-center justify-center aspect-video">
                <div className="absolute inset-0 bg-gradient-radial from-sky-900/20 to-transparent" />
                <Avatar
                  initials={currentFan.avatarInitials}
                  color={currentFan.avatarColor}
                  size="xl"
                />
                <div className="absolute bottom-3 left-3 text-xs font-semibold text-white bg-black/50 rounded-lg px-2 py-1">
                  {currentFan.fanName}
                </div>
                <div className="absolute top-3 right-3">
                  <Badge variant="info" className="text-[10px]">Daily.co</Badge>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMicOn((v) => !v)}
                  className={cn(
                    "w-10 h-10 rounded-full border flex items-center justify-center transition-colors",
                    micOn
                      ? "border-brand-border bg-brand-surface text-slate-300"
                      : "border-red-500/40 bg-red-500/20 text-red-400"
                  )}
                >
                  {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setCamOn((v) => !v)}
                  className={cn(
                    "w-10 h-10 rounded-full border flex items-center justify-center transition-colors",
                    camOn
                      ? "border-brand-border bg-brand-surface text-slate-300"
                      : "border-red-500/40 bg-red-500/20 text-red-400"
                  )}
                >
                  {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={admitNext}
                  disabled={queue.length < 2}
                  className="gap-1.5"
                >
                  <SkipForward className="w-4 h-4" />
                  Admit Next ({Math.max(0, queue.length - 1)})
                </Button>
                <Button variant="danger" size="sm" onClick={endSession} className="gap-1.5">
                  <StopCircle className="w-4 h-4" />
                  End Session
                </Button>
              </div>
            </div>
          </div>

          {/* Queue sidebar */}
          <div className="w-full lg:w-72 shrink-0 min-h-0">
            <WaitingRoom
              queue={queue}
              currentUserPosition={1}
              creatorName={creatorName}
              creatorInitials={creatorInitials}
              creatorColor={creatorColor}
            />
          </div>
        </div>
      )}
    </div>
  );
}
