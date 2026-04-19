"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Users, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry, ChatMessage } from "@/types";
import { timeAgo, cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/context/AuthContext";
import { LIVE_STAGE_SECONDS } from "@/lib/live";

interface WaitingRoomProps {
  queue: QueueEntry[];
  currentUserPosition: number;
  creatorName: string;
  creatorInitials: string;
  creatorColor: string;
  creatorAvatarUrl?: string;
  creatorId: string;
  sessionId?: string;
  showQueueTab?: boolean;
  activeFanAdmittedAt?: string | null;
  queuePreview?: { id: string; fanName: string; avatarInitials?: string; avatarColor?: string; avatarUrl?: string }[];
  totalQueueCount?: number;
}

function formatWaitTime(waitSeconds: number) {
  if (waitSeconds <= 0) return "0 min";
  const minutes = Math.ceil(waitSeconds / 60);
  return `~${minutes}m`;
}

export function WaitingRoom({
  queue,
  currentUserPosition,
  creatorName,
  creatorInitials,
  creatorColor,
  creatorAvatarUrl,
  creatorId,
  sessionId,
  showQueueTab = false,
  activeFanAdmittedAt = null,
  queuePreview,
  totalQueueCount,
}: WaitingRoomProps) {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "queue">("chat");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [resolvedSessionId, setResolvedSessionId] = useState<string | null>(sessionId ?? null);

  useEffect(() => {
    if (sessionId) { setResolvedSessionId(sessionId); return; }
    const supabase = createClient();
    supabase.from("live_sessions").select("id").eq("creator_id", creatorId).eq("is_active", true)
      .order("started_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: any) => { if (data) setResolvedSessionId(data.id); });
  }, [creatorId, sessionId]);

  useEffect(() => {
    if (!creatorId || !resolvedSessionId) return;
    const supabase = createClient();

    supabase.from("live_chat_messages")
      .select("*, profiles!user_id(username, avatar_initials, avatar_color, avatar_url, role)")
      .eq("session_id", resolvedSessionId).order("created_at", { ascending: true }).limit(50)
      .then(({ data }: { data: any[] | null }) => {
        if (data) {
          setMessages(data.map((m: any) => ({
            id: m.id,
            username: `@${m.profiles.username}`,
            avatarInitials: m.profiles.avatar_initials,
            avatarColor: m.profiles.avatar_color,
            avatarUrl: m.profiles.avatar_url ?? undefined,
            message: m.message,
            timestamp: m.created_at,
            isCreator: m.profiles.role === "creator",
          })));
        }
      });

    const channel = supabase.channel(`chat:${resolvedSessionId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "live_chat_messages",
        filter: `session_id=eq.${resolvedSessionId}`,
      }, async (payload: any) => {
        const { data: profile } = await supabase.from("profiles")
          .select("username, avatar_initials, avatar_color, avatar_url, role")
          .eq("id", payload.new.user_id).single();
        if (profile) {
          setMessages((prev) => {
            const filtered = prev.filter((m) => !m.id.startsWith("optimistic-"));
            return [...filtered, {
              id: payload.new.id, username: `@${profile.username}`,
              avatarInitials: profile.avatar_initials, avatarColor: profile.avatar_color,
              avatarUrl: profile.avatar_url ?? undefined, message: payload.new.message,
              timestamp: payload.new.created_at, isCreator: profile.role === "creator",
            }];
          });
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [creatorId, resolvedSessionId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activeFanRemainingSeconds = activeFanAdmittedAt
    ? Math.max(0, LIVE_STAGE_SECONDS - Math.floor((currentTime - new Date(activeFanAdmittedAt).getTime()) / 1000))
    : 0;

  const queueWithCountdown = queue.map((entry) => {
    const fallbackSeconds = Math.max(0, (entry.position - 1) * LIVE_STAGE_SECONDS);
    const waitSeconds = entry.waitSeconds ?? fallbackSeconds;
    return { ...entry, waitSeconds, waitTime: formatWaitTime(waitSeconds) };
  });

  async function sendMessage() {
    if (!newMessage.trim() || !user || !creatorId || !resolvedSessionId) return;
    const messageText = newMessage.trim();
    setNewMessage("");

    const optimisticMsg: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      username: `@${user.username ?? "you"}`,
      avatarInitials: user.avatar_initials ?? "??",
      avatarColor: user.avatar_color ?? "bg-violet-600",
      avatarUrl: user.avatar_url ?? undefined,
      message: messageText,
      timestamp: new Date().toISOString(),
      isCreator: user.role === "creator",
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const supabase = createClient();
    const { error } = await supabase.from("live_chat_messages").insert({
      creator_id: creatorId, session_id: resolvedSessionId, user_id: user.id, message: messageText,
    });
    if (error) console.error("[WaitingRoom] chat insert failed:", error.message);
  }

  const currentUserWaitSeconds = currentUserPosition > 0
    ? Math.max(0, activeFanRemainingSeconds + Math.max(0, currentUserPosition - 1) * LIVE_STAGE_SECONDS)
    : 0;

  return (
    <div className="flex flex-col h-full bg-brand-dark-surface rounded-2xl border border-brand-dark-border/60 overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3.5 border-b border-brand-dark-border/50 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar initials={creatorInitials} color={creatorColor} imageUrl={creatorAvatarUrl} size="sm" isLive />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate leading-tight">{creatorName} is Live</p>
            <p className="text-[11px] text-white/45 truncate">Live chat · paid 30s queue</p>
          </div>
        </div>
        <Badge variant="live" className="shrink-0 text-[11px] border-orange-500/30 bg-orange-500/15 text-orange-400">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-live animate-pulse" />
          LIVE
        </Badge>
      </div>

      {/* Queue position indicator */}
      {currentUserPosition > 0 && (
        <div className="mx-4 mt-3.5 p-3.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-brand-primary/20 flex items-center justify-center shrink-0">
            <span className="text-base font-black text-brand-primary-light">{currentUserPosition}</span>
          </div>
          <div>
            <p className="text-[10px] text-white/45 uppercase tracking-wider font-semibold">Your Position</p>
            <p className="text-sm font-bold text-white">
              #{currentUserPosition} · {formatWaitTime(currentUserWaitSeconds)}
            </p>
          </div>
        </div>
      )}

      {/* Compact queue preview */}
      {queuePreview && queuePreview.length > 0 && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-brand-dark-elevated border border-brand-dark-border/50 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-semibold mb-2">
            Queue · {totalQueueCount ?? queuePreview.length}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {queuePreview.slice(0, 5).map((entry, index) => (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-[12px] border px-2 py-1",
                  index === 0 ? "border-brand-live/30 bg-brand-live/10" : "border-brand-dark-border/50 bg-brand-dark"
                )}
              >
                {entry.avatarInitials ? (
                  <Avatar initials={entry.avatarInitials} color={entry.avatarColor ?? "bg-brand-primary"} imageUrl={entry.avatarUrl} size="xs" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-brand-dark-elevated flex items-center justify-center text-[9px] font-bold text-white/60">{index + 1}</div>
                )}
                <span className="text-[11px] font-semibold text-white/80 truncate max-w-[80px]">{entry.fanName}</span>
              </div>
            ))}
            {(totalQueueCount ?? queuePreview.length) > 5 && (
              <div className="rounded-[12px] border border-brand-dark-border/50 bg-brand-dark px-2 py-1 text-[11px] font-semibold text-white/50">
                +{(totalQueueCount ?? queuePreview.length) - 5} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-brand-dark-border/50 mx-4 mt-3.5 shrink-0">
        {(["chat", ...(showQueueTab ? ["queue"] : [])] as ("chat" | "queue")[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold capitalize border-b-2 transition-all duration-150",
              activeTab === tab
                ? "border-brand-primary text-brand-primary-light"
                : "border-transparent text-white/45 hover:text-white/75"
            )}
          >
            {tab === "chat" ? <MessageSquare className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
            {tab}
            {tab === "queue" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-dark-elevated border border-brand-dark-border text-white/60">
                {queue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Chat */}
      {activeTab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 min-h-0">
            {messages.length === 0 && (
              <p className="text-center text-[12px] text-white/35 py-6">No messages yet. Say something!</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="flex items-start gap-2.5">
                <Avatar initials={msg.avatarInitials} color={msg.avatarColor} imageUrl={msg.avatarUrl} size="xs" className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={cn("text-xs font-bold leading-tight", msg.isCreator ? "text-brand-primary-light" : "text-white/90")}>
                      {msg.username}
                    </span>
                    {msg.isCreator && (
                      <Badge variant="primary" className="text-[9px] px-1.5 py-0 border-brand-primary/30 bg-brand-primary/15 text-brand-primary-light">Creator</Badge>
                    )}
                    <span className="text-[10px] text-white/35">{timeAgo(msg.timestamp)}</span>
                  </div>
                  <p className="text-[13px] text-white/75 leading-relaxed mt-0.5">{msg.message}</p>
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>

          <div className="px-4 py-3 border-t border-brand-dark-border/50 flex gap-2 shrink-0">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Say something…"
              className="flex-1 bg-brand-dark-elevated border border-brand-dark-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-brand-primary/50 transition-colors"
            />
            <Button variant="primary" size="icon" onClick={sendMessage}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </>
      )}

      {/* Queue list */}
      {activeTab === "queue" && (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {queueWithCountdown.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                entry.position === currentUserPosition
                  ? "bg-brand-primary/10 border-brand-primary/25"
                  : "bg-brand-dark-elevated border-brand-dark-border/50"
              )}
            >
              <div className="w-5 h-5 rounded-full bg-brand-dark flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-white/60">{entry.position}</span>
              </div>
              <Avatar initials={entry.avatarInitials} color={entry.avatarColor} imageUrl={entry.avatarUrl} size="xs" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/90 truncate">{entry.fanUsername}</p>
                {entry.topic && <p className="text-[11px] text-white/45 truncate">{entry.topic}</p>}
              </div>
              <span className="text-[11px] text-white/45 shrink-0">{entry.waitTime}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
