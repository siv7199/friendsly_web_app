"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronLeft,
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mt-3 rounded-[18px] border border-white/10 bg-[#110e1f] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Queue</p>
          <p className="mt-1 text-xs text-slate-400">
            {collapsed ? "Compact queue view" : "Up next first, then everyone else"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-brand-live/30 hover:text-brand-live"
          >
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {creatorView ? (
            <Button variant="live" className="gap-2">
              <ChevronRight className="h-4 w-4" />
              Admit Next
            </Button>
          ) : (
            <Button variant="live" className="gap-2">
              <Zap className="h-4 w-4" />
              Join Live
            </Button>
          )}
        </div>
      </div>

      {collapsed ? (
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {queueTiles.map((entry, index) => (
            <div key={entry.id} className={`rounded-[18px] border p-2 ${index === 0 ? "border-brand-live/30 bg-brand-live/10" : "border-white/10 bg-white/[0.04]"}`}>
              <div className="relative">
                <Avatar initials={entry.initials} color={entry.color} size="sm" />
                <div className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${index === 0 ? "bg-brand-live text-black" : "bg-white text-black"}`}>
                  {index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-[190px_minmax(0,1fr)]">
          <div className="rounded-[16px] border border-brand-live/25 bg-brand-live/10 p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-brand-live">Up Next</p>
            <div className="mt-2 flex items-center gap-2.5">
              <Avatar initials={queueTiles[0].initials} color={queueTiles[0].color} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{queueTiles[0].name}</p>
                <p className="mt-1 text-[11px] text-slate-300">
                  {creatorView ? "Next fan to admit on stage" : "First in line for the next spot"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {queueTiles.slice(1).map((entry, index) => (
              <div key={entry.id} className="min-w-0 rounded-[14px] border border-white/10 bg-white/[0.04] px-2.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black text-black">
                    {index + 2}
                  </div>
                  <Avatar initials={entry.initials} color={entry.color} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-none text-white">{entry.name}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">Waiting</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SharedStudioPreview({
  side,
}: {
  side: "Creator" | "Fan";
}) {
  return (
    <section className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1.58fr)_340px]">
      <div className="min-h-0 rounded-[34px] border border-white/10 bg-[#120d24] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
        <div className="flex h-full min-h-0 flex-col rounded-[30px] border border-white/10 bg-[#151028] p-4 overflow-hidden">
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
            <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                186 watching
              </span>
            </div>
          </div>

          <div className="mt-4 flex min-h-0 justify-center">
            <div className="grid w-full max-w-[1180px] min-h-0 gap-4 md:grid-cols-2">
            <div className="relative h-[clamp(360px,56vh,640px)] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,#2a1d58,#130f29_55%,#0a0813)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_36%)]" />
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.10),transparent_22%),linear-gradient(135deg,rgba(96,165,250,0.30),transparent_35%),linear-gradient(225deg,rgba(34,197,94,0.18),transparent_30%)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="scale-[1.95]">
                    <Avatar initials="SV" color="bg-brand-primary" size="xl" />
                  </div>
                </div>
              </div>
              <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-slate-300">
                Creator
              </div>
              <div className="absolute left-4 bottom-4 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur">
                <p className="text-sm font-semibold text-white">Sid Vangara</p>
              </div>
            </div>

            <div className="relative h-[clamp(360px,56vh,640px)] overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#1b1436,#0b0914)]">
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.10),transparent_22%),linear-gradient(135deg,rgba(244,63,94,0.28),transparent_35%),linear-gradient(225deg,rgba(251,191,36,0.16),transparent_30%)]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="scale-[1.95]">
                    <Avatar initials="MY" color="bg-rose-500" size="xl" />
                  </div>
                </div>
              </div>
              <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-slate-300">
                Current Fan
              </div>
              <div className="absolute left-4 bottom-4 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur">
                <p className="text-sm font-semibold text-white">Maya</p>
              </div>
            </div>
            </div>
          </div>

          <QueueBox creatorView={side === "Creator"} />
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
              <Mic className="h-4 w-4" />
            </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
                <Video className="h-4 w-4" />
              </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
                <MessageSquare className="h-4 w-4" />
              </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200">
                <MoreHorizontal className="h-4 w-4" />
              </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 rounded-[34px] border border-white/10 bg-[#120d24] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
        <ChatPanel />
      </div>
    </section>
  );
}

export function LiveLayoutPreviewGallery() {
  const [activeView, setActiveView] = useState<"Creator" | "Fan">("Creator");

  return (
    <div className="min-h-screen bg-[#090612] text-white xl:h-[100dvh] xl:overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_24%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.08),transparent_26%)]" />

      <div className="relative mx-auto grid h-full max-w-[1920px] grid-rows-[auto_1fr] gap-4 px-4 py-4 md:px-5 md:py-5">
        <div className="flex items-center justify-end">
          <div className="inline-flex rounded-[18px] border border-white/10 bg-[#151028] p-1">
            {(["Creator", "Fan"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`rounded-[14px] px-4 py-2 text-sm font-semibold transition ${
                  activeView === view
                    ? "bg-brand-live text-black"
                    : "text-slate-300 hover:bg-white/[0.04]"
                }`}
              >
                {view} View
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 xl:overflow-hidden">
          <SharedStudioPreview
            side={activeView}
          />
        </div>
      </div>
    </div>
  );
}
