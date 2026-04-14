"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mic, MoreHorizontal, Send, Sparkles, Users, Video } from "lucide-react";

const QUEUE = [
  { id: "1", name: "Maya", initials: "MY", color: "bg-rose-500", note: "Album drop?" },
  { id: "2", name: "Chris", initials: "CH", color: "bg-sky-500", note: "Quick hello" },
  { id: "3", name: "Nina", initials: "NI", color: "bg-emerald-500", note: "Fan challenge" },
  { id: "4", name: "Jules", initials: "JU", color: "bg-amber-500", note: "Birthday shoutout" },
];

const CHAT = [
  { id: "1", user: "maya.codes", text: "This layout feels way more like a real live.", creator: false },
  { id: "2", user: "Sid", text: "Bringing Maya up next.", creator: true },
  { id: "3", user: "ninafit", text: "Queue looks super clear here.", creator: false },
  { id: "4", user: "Sid", text: "Want this to feel packed and active, not empty.", creator: true },
];

export function CreatorLiveStudioConcept() {
  return (
    <div className="min-h-screen bg-[#090612] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(40,140,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_28%)] pointer-events-none" />

      <div className="relative px-5 md:px-8 py-6 max-w-[1600px] mx-auto h-screen flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Badge variant="live">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                CONCEPT
              </Badge>
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Standalone Preview</p>
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl font-black">Creator Live Studio Exploration</h1>
            <p className="mt-2 text-slate-400 max-w-3xl">
              Built from the sketch only. Not wired into the production live flow.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" className="gap-2">
              <Users className="w-4 h-4" />
              128 Watching
            </Button>
            <Button variant="danger">End Live</Button>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_390px]">
          <div className="min-h-0 flex flex-col gap-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_260px]">
              <div className="rounded-[30px] border border-white/10 bg-[#120d24] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)]">
                <div className="relative min-h-[270px] rounded-[24px] overflow-hidden border border-white/10 bg-[linear-gradient(135deg,#2b1e5b,#17112f_45%,#0f0c1a)]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />
                  <div className="absolute left-5 top-5 flex items-center gap-2">
                    <Badge variant="live">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
                      LIVE
                    </Badge>
                    <div className="rounded-full bg-black/30 px-3 py-1 text-xs text-slate-300">Creator Cam</div>
                  </div>
                  <div className="absolute right-5 top-5 rounded-2xl border border-brand-live/25 bg-brand-live/10 px-4 py-3 text-right">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-brand-live">Up Next</p>
                    <p className="mt-1 text-lg font-black">Maya</p>
                    <p className="text-xs text-slate-300">Birthday shoutout</p>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-4">
                    <div className="rounded-2xl bg-black/35 px-4 py-3 backdrop-blur">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">Host</p>
                      <p className="mt-1 text-lg font-bold">Sid Vangara</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-12 h-12 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-slate-200">
                        <Mic className="w-4 h-4" />
                      </button>
                      <button className="w-12 h-12 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-slate-200">
                        <Video className="w-4 h-4" />
                      </button>
                      <button className="w-12 h-12 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-slate-200">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-[#120d24] p-4 flex flex-col gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Guest Window</p>
                  <p className="mt-1 text-sm text-slate-400">The admitted fan appears right under the queue flow.</p>
                </div>
                <div className="relative flex-1 min-h-[270px] rounded-[24px] overflow-hidden border border-white/10 bg-[linear-gradient(180deg,#1d1638,#0e0a19)] flex items-center justify-center">
                  <Avatar initials="MY" color="bg-rose-500" size="xl" />
                  <div className="absolute left-4 bottom-4 rounded-2xl bg-black/35 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-slate-300">Admitted Fan</p>
                    <p className="mt-1 text-base font-bold">Maya</p>
                  </div>
                  <div className="absolute right-4 top-4 rounded-xl border border-brand-live/25 bg-brand-live/10 px-3 py-2 text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-brand-live">Timer</p>
                    <p className="text-xl font-black text-brand-live">0:23</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/10 bg-[#120d24] p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Queue Path</p>
                  <p className="mt-1 text-sm text-slate-400">A central visual lane that makes the admission order obvious at a glance.</p>
                </div>
                <Button variant="live" className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Admit Next
                </Button>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,#18122d,#0d0a17)] px-6 py-6">
                <div className="relative">
                  <div className="absolute left-[10%] right-[10%] top-10 h-[2px] bg-gradient-to-r from-transparent via-brand-live/40 to-transparent" />
                  <div className="relative grid grid-cols-4 gap-5">
                    {QUEUE.map((entry, index) => (
                      <div key={entry.id} className="flex flex-col items-center text-center">
                        <div className={`relative rounded-full p-2 border ${index === 0 ? "border-brand-live/60 bg-brand-live/10 shadow-[0_0_35px_rgba(34,197,94,0.18)]" : "border-white/10 bg-white/5"}`}>
                          <Avatar initials={entry.initials} color={entry.color} size="md" />
                          <div className={`absolute -right-1 -top-1 w-6 h-6 rounded-full border-2 border-[#18122d] flex items-center justify-center text-[10px] font-black ${index === 0 ? "bg-brand-live text-black" : "bg-slate-700 text-white"}`}>
                            {index + 1}
                          </div>
                        </div>
                        <p className={`mt-3 text-sm font-bold ${index === 0 ? "text-brand-live" : "text-white"}`}>{entry.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{index === 0 ? "Going live next" : entry.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  {QUEUE.map((entry, index) => (
                    <div key={`${entry.id}-card`} className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${index === 0 ? "border-brand-live/30 bg-brand-live/10" : "border-white/10 bg-white/[0.03]"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${index === 0 ? "bg-brand-live text-black" : "bg-white/10 text-white"}`}>
                        {index + 1}
                      </div>
                      <Avatar initials={entry.initials} color={entry.color} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{entry.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{entry.note}</p>
                      </div>
                      {index === 0 ? <Badge variant="live">Next</Badge> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 rounded-[30px] border border-white/10 bg-[#120d24] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Chat</p>
                <p className="mt-1 text-sm text-slate-400">Pinned to the right like a social live stream control room.</p>
              </div>
              <div className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs text-slate-300 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" />
                428 comments
              </div>
            </div>

            <div className="flex-1 min-h-0 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#151028,#0d0a18)] p-4 flex flex-col">
              <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                {CHAT.map((message) => (
                  <div key={message.id} className={`rounded-2xl px-4 py-3 ${message.creator ? "bg-brand-live/10 border border-brand-live/20" : "bg-white/[0.04] border border-white/10"}`}>
                    <div className="flex items-center gap-2">
                      <p className={`text-xs font-bold ${message.creator ? "text-brand-live" : "text-slate-200"}`}>
                        {message.user}
                      </p>
                      {message.creator ? <Badge variant="live">Host</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-300 leading-relaxed">{message.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <input
                  readOnly
                  value="Reply to chat..."
                  className="flex-1 bg-transparent text-sm text-slate-400 outline-none"
                />
                <button className="w-10 h-10 rounded-full bg-brand-live text-black flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
