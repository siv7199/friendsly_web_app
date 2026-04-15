"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Send,
  Users,
  Video,
  Zap,
} from "lucide-react";

const queueTiles = [
  { id: "1", name: "Maya", initials: "MY", color: "bg-rose-500" },
  { id: "2", name: "Chris", initials: "CH", color: "bg-sky-500" },
  { id: "3", name: "Nina", initials: "NI", color: "bg-emerald-500" },
  { id: "4", name: "Jules", initials: "JU", color: "bg-amber-500" },
  { id: "5", name: "Tori", initials: "TO", color: "bg-fuchsia-500" },
];

const chatMessages = [
  { id: "1", user: "maya.codes", text: "This feels much closer to the reference.", accent: false },
  { id: "2", user: "Sid", text: "Queue stays tucked under the call area now.", accent: true },
  { id: "3", user: "chris.fit", text: "Chat on the right is definitely the right move.", accent: false },
];

function ChatPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#151028] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Chat</p>
          <p className="mt-1 text-sm text-slate-400">Pinned on the right</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          428 comments
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`rounded-2xl border px-4 py-3 ${message.accent ? "border-brand-live/20 bg-brand-live/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <div className="flex items-center gap-2">
              <p className={`text-xs font-bold ${message.accent ? "text-brand-live" : "text-slate-200"}`}>{message.user}</p>
              {message.accent ? <Badge variant="live">Host</Badge> : null}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{message.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
        <input
          readOnly
          value="Send message..."
          className="flex-1 bg-transparent text-sm text-slate-400 outline-none"
        />
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-live text-black">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function QueueBox({ creatorView }: { creatorView: boolean }) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-[#110e1f] px-2.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Queue</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Compact queue strip</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {queueTiles.map((entry, index) => (
          <div
            key={entry.id}
            className={`flex items-center gap-1.5 rounded-[12px] border px-2 py-1 ${index === 0 ? "border-brand-live/30 bg-brand-live/10" : "border-white/10 bg-white/[0.04]"}`}
          >
            <Avatar initials={entry.initials} color={entry.color} size="xs" />
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black ${index === 0 ? "bg-brand-live text-black" : "bg-white text-black"}`}>
              {index + 1}
            </span>
            <span className="truncate text-xs font-semibold text-white">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallCard({
  label,
  name,
  initials,
  color,
  className,
}: {
  label: string;
  name: string;
  initials: string;
  color: string;
  className: string;
}) {
  return (
    <div className={className}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.10),transparent_22%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="scale-[1.95]">
            <Avatar initials={initials} color={color} size="xl" />
          </div>
        </div>
      </div>
      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-slate-300">
        {label}
      </div>
      <div className="absolute left-4 bottom-4 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur">
        <p className="text-sm font-semibold text-white">{name}</p>
      </div>
    </div>
  );
}

export function LiveConceptPreview({ side }: { side: "Creator" | "Fan" }) {
  return (
    <div className="min-h-screen bg-[#090612] text-white xl:h-[100dvh] xl:overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_24%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.08),transparent_26%)]" />

      <div className="relative mx-auto grid h-full max-w-[1920px] grid-rows-[1fr] gap-4 px-4 py-4 md:px-5 md:py-5">
        <section className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.58fr)_340px]">
          <div className="min-h-0 rounded-[34px] border border-white/10 bg-[#120d24] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
            <div className="grid h-full min-h-0 grid-rows-[auto_minmax(360px,1fr)_auto] rounded-[30px] border border-white/10 bg-[#151028] p-4 overflow-hidden">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Badge variant="live">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                    LIVE
                  </Badge>
                  <div>
                    <p className="text-lg font-black text-white">Sid Vangara</p>
                    <p className="text-sm text-slate-400">{side === "Creator" ? "Host control room" : "Public fan view"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-slate-300 backdrop-blur md:block">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      186 watching
                    </span>
                  </div>
                  <div className="inline-flex rounded-[18px] border border-white/10 bg-[#151028] p-1">
                    <Link
                      href="/concept/live-ui"
                      className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                        side === "Creator" ? "bg-brand-live text-black" : "text-slate-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      Creator View
                    </Link>
                    <Link
                      href="/concept/live-ui/fan"
                      className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                        side === "Fan" ? "bg-brand-live text-black" : "text-slate-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      Fan View
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-3 min-h-0 overflow-hidden">
                <div className="grid h-full gap-4 md:grid-cols-2">
                  <CallCard
                    label="Creator"
                    name="Sid Vangara"
                    initials="SV"
                    color="bg-brand-primary"
                    className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,#2a1d58,#130f29_55%,#0a0813)]"
                  />
                  <CallCard
                    label="Current Fan"
                    name="Maya"
                    initials="MY"
                    color="bg-rose-500"
                    className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#1b1436,#0b0914)]"
                  />
                </div>
              </div>

              <div className="mt-2 flex items-end justify-between gap-4">
                <div className="w-full max-w-[860px] flex-1 self-start">
                  <QueueBox creatorView={side === "Creator"} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {side === "Creator" ? (
                    <>
                      <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
                        <Mic className="h-4 w-4" />
                      </button>
                      <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
                        <Video className="h-4 w-4" />
                      </button>
                      <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      <Button variant="live" className="h-11 gap-2 px-4 text-base font-semibold">
                        <ChevronRight className="h-5 w-5" />
                        Admit Next
                      </Button>
                    </>
                  ) : (
                    <Button variant="live" className="h-11 gap-2 px-4 text-base font-semibold">
                      <Zap className="h-5 w-5" />
                      Join Live
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 rounded-[34px] border border-white/10 bg-[#120d24] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
            <ChatPanel />
          </div>
        </section>
      </div>
    </div>
  );
}
