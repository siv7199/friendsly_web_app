"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageSquare, Mic, MoreHorizontal, Send, Users, Video, Zap } from "lucide-react";

const queueTiles = [
  { id: "1", name: "Maya", initials: "MY", color: "bg-rose-500" },
  { id: "2", name: "Chris", initials: "CH", color: "bg-sky-500" },
  { id: "3", name: "Nina", initials: "NI", color: "bg-emerald-500" },
  { id: "4", name: "Jules", initials: "JU", color: "bg-amber-500" },
  { id: "5", name: "Tori", initials: "TO", color: "bg-fuchsia-500" },
];

const chatMessages = [
  { id: "1", user: "maya.codes", text: "This layout feels clearer already.", accent: false },
  { id: "2", user: "Sid", text: "Bringing the next fan on stage now.", accent: true },
  { id: "3", user: "chris.fit", text: "I like that chat stays in one place.", accent: false },
  { id: "4", user: "nina.live", text: "The queue tiles at the bottom make way more sense.", accent: false },
];

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-3 text-2xl md:text-3xl font-black text-white">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm md:text-base text-slate-400">{description}</p>
    </div>
  );
}

function ChatPanel() {
  return (
    <div className="flex h-full min-h-[520px] flex-col rounded-[30px] border border-white/10 bg-[#151028] p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Live Chat</p>
          <p className="mt-1 text-sm text-slate-400">Shared on both creator and fan side</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          428 comments
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-hidden">
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
          value="Reply to chat..."
          className="flex-1 bg-transparent text-sm text-slate-400 outline-none"
        />
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-live text-black">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function QueueStrip({ creatorView }: { creatorView: boolean }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[#151028] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Queue</p>
          <p className="mt-1 text-sm text-slate-400">
            Bottom-left queue tiles with face, first name, and position only
          </p>
        </div>
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

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {queueTiles.map((entry, index) => (
          <div key={entry.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-center">
            <div className="mx-auto flex w-fit flex-col items-center">
              <div className="relative">
                <Avatar initials={entry.initials} color={entry.color} size="md" />
                <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-live text-[10px] font-black text-black">
                  {index + 1}
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-white">{entry.name}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">Spot {index + 1}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SharedStudioPreview({
  side,
  primaryAction,
  primaryActionIcon,
  accentNote,
}: {
  side: "Creator" | "Fan";
  primaryAction: string;
  primaryActionIcon: "admit" | "join";
  accentNote: string;
}) {
  const PrimaryIcon = primaryActionIcon === "admit" ? ChevronRight : Zap;

  return (
    <section className="rounded-[34px] border border-white/10 bg-[#120d24] p-5 md:p-6 shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Badge variant="live">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
              {side} Preview
            </Badge>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Shared UI Direction</p>
          </div>
          <h3 className="mt-3 text-2xl font-black text-white">{side} live layout from the new sketch</h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">{accentNote}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">No queue panel</div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">Chat always right</div>
          <div className="rounded-full border border-brand-live/20 bg-brand-live/10 px-3 py-1.5 text-brand-live">
            Same visual system
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="grid gap-5">
          <div className="rounded-[30px] border border-white/10 bg-[#151028] p-4 md:p-5">
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

              <Button variant="live" className="gap-2">
                <PrimaryIcon className="h-4 w-4" />
                {primaryAction}
              </Button>
            </div>

            <div className="mt-5 flex justify-center">
              <div className="grid w-full max-w-[860px] gap-4 md:grid-cols-2">
              <div className="relative min-h-[520px] overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(145deg,#2a1d58,#130f29_55%,#0a0813)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_36%)]" />
                <div className="absolute left-5 top-5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
                  Main stage
                </div>
                <div className="absolute right-5 top-5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    186 watching
                  </span>
                </div>
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.10),transparent_22%),linear-gradient(135deg,rgba(96,165,250,0.30),transparent_35%),linear-gradient(225deg,rgba(34,197,94,0.18),transparent_30%)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="scale-[1.65]">
                      <Avatar initials="SV" color="bg-brand-primary" size="xl" />
                    </div>
                  </div>
                </div>
                <div className="absolute left-5 bottom-5 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">On Camera</p>
                  <p className="mt-1 text-base font-bold text-white">Sid Vangara</p>
                </div>
              </div>

              <div className="relative min-h-[520px] overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,#1b1436,#0b0914)]">
                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] text-slate-300">
                  Guest Window
                </div>
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,255,255,0.10),transparent_22%),linear-gradient(135deg,rgba(244,63,94,0.28),transparent_35%),linear-gradient(225deg,rgba(251,191,36,0.16),transparent_30%)]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="scale-[1.65]">
                      <Avatar initials="MY" color="bg-rose-500" size="xl" />
                    </div>
                  </div>
                </div>
                <div className="absolute left-4 bottom-4 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 backdrop-blur">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Current Fan</p>
                  <p className="mt-1 text-sm font-bold text-white">Maya</p>
                </div>
              </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-brand-live">
                  {side === "Creator" ? "Important controls" : "Important action"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {side === "Creator"
                    ? "Admit next, keep chat visible, and monitor the active guest without showing a full queue panel."
                    : "Watch for free, keep chat visible, and use one clear join button when you want a 30-second turn."}
                </p>
              </div>
              <div className="flex items-center gap-2">
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

          <QueueStrip creatorView={side === "Creator"} />
        </div>

        <ChatPanel />
      </div>
    </section>
  );
}

export function LiveLayoutPreviewGallery() {
  return (
    <div className="min-h-screen bg-[#090612] text-white">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.10),transparent_24%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.08),transparent_26%)]" />

      <div className="relative mx-auto flex max-w-[1680px] flex-col gap-8 px-4 py-8 md:px-8 md:py-10">
        <section className="rounded-[32px] border border-white/10 bg-[#120d24] p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <SectionTitle
              eyebrow="Live Preview"
              title="Shared creator and fan live concept"
              description="Built from the new call_ui sketch only. This is still a visual sandbox, not the real live product. Both sides now use the same structure: chat on the right, smaller vertical side call windows, and queue tiles across the bottom-left instead of a queue panel."
            />
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300">
              Open this preview at <span className="font-semibold text-white">/concept/live-ui</span>
            </div>
          </div>
        </section>

        <SharedStudioPreview
          side="Creator"
          primaryAction="Admit Next"
          primaryActionIcon="admit"
          accentNote="Creator side keeps the same visual language as fan side, but the main primary action is admitting the next fan."
        />

        <SharedStudioPreview
          side="Fan"
          primaryAction="Join Live"
          primaryActionIcon="join"
          accentNote="Fan side matches the same screen composition, but the primary action becomes the paid join button and there is no full queue list shown."
        />
      </div>
    </div>
  );
}
