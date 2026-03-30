"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Users, Clock, MessageSquare, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { QueueEntry, ChatMessage } from "@/types";
import { MOCK_CHAT } from "@/lib/mock-data";
import { timeAgo, cn } from "@/lib/utils";

interface WaitingRoomProps {
  queue: QueueEntry[];
  currentUserPosition: number;
  creatorName: string;
  creatorInitials: string;
  creatorColor: string;
}

export function WaitingRoom({
  queue,
  currentUserPosition,
  creatorName,
  creatorInitials,
  creatorColor,
}: WaitingRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "queue">("chat");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    if (!newMessage.trim()) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      username: "@jordankim",
      avatarInitials: "JK",
      avatarColor: "bg-violet-500",
      message: newMessage.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
  }

  return (
    <div className="flex flex-col h-full bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            initials={creatorInitials}
            color={creatorColor}
            size="sm"
            isLive
          />
          <div>
            <p className="text-sm font-bold text-slate-100">{creatorName} is Live</p>
            <p className="text-xs text-slate-400">{queue.length} people in queue</p>
          </div>
        </div>
        <Badge variant="live">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
          LIVE
        </Badge>
      </div>

      {/* ── Your Position Banner ── */}
      <div className="mx-4 mt-4 p-4 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-primary/30 flex items-center justify-center">
            <span className="text-lg font-black text-brand-primary-light">
              {currentUserPosition}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Your Position</p>
            <p className="text-sm font-bold text-slate-100">
              {currentUserPosition === 1 ? "You're next! 🎉" : `~${(currentUserPosition - 1) * 15} min wait`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          <span>~15 min/call</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-brand-border mx-4 mt-4">
        {(["chat", "queue"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors",
              activeTab === tab
                ? "border-brand-primary text-brand-primary-light"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            {tab === "chat" ? <MessageSquare className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            {tab}
            {tab === "queue" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-surface border border-brand-border">
                {queue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Chat Tab ── */}
      {activeTab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2.5">
                <Avatar
                  initials={msg.avatarInitials}
                  color={msg.avatarColor}
                  size="xs"
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "text-xs font-bold",
                        msg.isCreator ? "text-brand-primary-light" : "text-slate-300"
                      )}
                    >
                      {msg.username}
                    </span>
                    {msg.isCreator && (
                      <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                        Creator
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-600">{timeAgo(msg.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mt-0.5">{msg.message}</p>
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat input */}
          <div className="px-4 py-3 border-t border-brand-border flex gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Say something..."
              className="flex-1 bg-brand-elevated border border-brand-border rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-primary"
            />
            <Button variant="primary" size="icon" onClick={sendMessage}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </>
      )}

      {/* ── Queue Tab ── */}
      {activeTab === "queue" && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {queue.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                entry.position === currentUserPosition
                  ? "bg-brand-primary/10 border-brand-primary/30"
                  : "bg-brand-elevated border-brand-border"
              )}
            >
              <div className="w-6 h-6 rounded-full bg-brand-surface flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-slate-400">{entry.position}</span>
              </div>
              <Avatar
                initials={entry.avatarInitials}
                color={entry.avatarColor}
                size="xs"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{entry.fanUsername}</p>
                {entry.topic && (
                  <p className="text-[11px] text-slate-500 truncate">{entry.topic}</p>
                )}
              </div>
              <span className="text-[11px] text-slate-500 shrink-0">{entry.waitTime}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
