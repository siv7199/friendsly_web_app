"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Home, CheckCircle2 } from "lucide-react";
import { useAuthContext } from "@/lib/context/AuthContext";
import { WaitingRoom } from "@/components/fan/WaitingRoom";
import { FanLiveView } from "@/components/fan/FanLiveView";
import { MOCK_CREATORS } from "@/lib/mock-data";
import { getRegisteredCreators } from "@/lib/mock-auth";
import { notFound, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { QueueEntry } from "@/types";
import { Button } from "@/components/ui/button";

const MAX_LIVE_CALL_SECONDS = 3 * 60;
const QUEUE_FALLBACK_POLL_MS = 15000;

function getCreator(id: string) {
  return (
    MOCK_CREATORS.find((c) => c.id === id) ??
    getRegisteredCreators().find((c) => c.id === id)
  );
}

export default function WaitingRoomPage({ params }: { params: { id: string } }) {
  const { user } = useAuthContext();
  const router = useRouter();
  const creator = getCreator(params.id);
  const [creatorState, setCreatorState] = useState<any>(creator);
  const [loading, setLoading] = useState(!creator);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [liveSessionId, setLiveSessionId] = useState<string | undefined>(undefined);
  const [activeFanAdmittedAt, setActiveFanAdmittedAt] = useState<string | null>(null);
  const [callEndedState, setCallEndedState] = useState<{ type: "call" | "skipped" | "session"; creatorName: string } | null>(null);
  const [receipt, setReceipt] = useState<{ durationSeconds: number; amountCharged: number } | null>(null);
  const inCallRef = useRef(false);
  const creatorStateRef = useRef<any>(null);
  const liveSessionIdRef = useRef<string | undefined>(undefined);
  const userRef = useRef<any>(null);
  const missedSessionPollsRef = useRef(0);
  const selfLeavingRef = useRef(false);
  const loadQueueRef = useRef<(() => Promise<void>) | null>(null);
  const callEndedRef = useRef(false);

  useEffect(() => { inCallRef.current = inCall; }, [inCall]);
  useEffect(() => { creatorStateRef.current = creatorState; }, [creatorState]);
  useEffect(() => { liveSessionIdRef.current = liveSessionId; }, [liveSessionId]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { callEndedRef.current = Boolean(callEndedState); }, [callEndedState]);

  const applyReceipt = useCallback((nextReceipt: { durationSeconds: number; amountCharged: number } | null) => {
    setReceipt((currentReceipt) => {
      if (!nextReceipt) return currentReceipt;

      const nextHasValue = nextReceipt.durationSeconds > 0 || nextReceipt.amountCharged > 0;
      const currentHasValue = !!currentReceipt && (currentReceipt.durationSeconds > 0 || currentReceipt.amountCharged > 0);

      if (!nextHasValue && currentHasValue) {
        return currentReceipt;
      }

      return nextReceipt;
    });
  }, []);

  const hydrateLatestReceipt = useCallback(async (sessionId?: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return null;

    const supabase = createClient();
    let query = supabase
      .from("live_queue_entries")
      .select("duration_seconds, amount_charged, status, live_sessions!inner(creator_id)")
      .eq("fan_id", currentUser.id)
      .eq("live_sessions.creator_id", params.id)
      .in("status", ["completed", "skipped"])
      .order("ended_at", { ascending: false })
      .limit(1);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data: latestEndedEntry } = await query.maybeSingle();

    if (!latestEndedEntry) return null;

    const nextReceipt = {
      durationSeconds: Number(latestEndedEntry.duration_seconds ?? 0),
      amountCharged: Number(latestEndedEntry.amount_charged ?? 0),
    };
    applyReceipt(nextReceipt);
    return {
      receipt: nextReceipt,
      status: latestEndedEntry.status as "completed" | "skipped",
    };
  }, [applyReceipt, params.id]);

  const handleStatusChange = useCallback(async (status: string, _sessionId: string, url: string) => {
    if (callEndedRef.current) return;

    if (status === "active" && !inCallRef.current) {
      const roomName = url.split("/").pop();
      try {
        const res = await fetch("/api/daily/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName, isOwner: false }),
        });
        const tokenData = await res.json();

        if (tokenData.token) {
          selfLeavingRef.current = false;
          setRoomUrl(url);
          setToken(tokenData.token);
          setInCall(true);
          setCallEndedState(null);
        }
      } catch (err) {
        console.error("Failed to join call:", err);
      }
    } else if (status === "completed" || status === "skipped") {
      if (selfLeavingRef.current) return;
      const currentUser = userRef.current;
      if (currentUser) {
        const supabase = createClient();
        const { data: completedEntry } = await supabase
          .from("live_queue_entries")
          .select("duration_seconds, amount_charged")
          .eq("session_id", _sessionId)
          .eq("fan_id", currentUser.id)
          .in("status", ["completed", "skipped"])
          .order("ended_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (completedEntry) {
          applyReceipt({
            durationSeconds: Number(completedEntry.duration_seconds ?? 0),
            amountCharged: Number(completedEntry.amount_charged ?? 0),
          });
        }
      }
      setCallEndedState({
        type: status === "completed" ? "call" : "skipped",
        creatorName: creatorStateRef.current?.name || "The creator",
      });
      setInCall(false);
      setRoomUrl(null);
      setToken(null);
    }
  }, []);

  const handleFanLeave = useCallback(async () => {
    if (callEndedRef.current) return;

    selfLeavingRef.current = true;
    setInCall(false);
    setRoomUrl(null);
    setToken(null);

    const sid = liveSessionIdRef.current;
    const currentUser = userRef.current;

    let finalReceipt: { durationSeconds: number; amountCharged: number } | null = null;
    if (sid && currentUser) {
      const supabase = createClient();
      const { data: activeEntry } = await supabase
        .from("live_queue_entries")
        .select("id, admitted_at")
        .eq("session_id", sid)
        .eq("fan_id", currentUser.id)
        .eq("status", "active")
        .maybeSingle();
      try {
        const res = await fetch("/api/live/finalize-charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queueEntryId: activeEntry?.id, status: "completed" }),
        });
        const data = await res.json();
        finalReceipt = data?.receipt
          ? {
              durationSeconds: Number(data.receipt.durationSeconds ?? 0),
              amountCharged: Number(data.receipt.amountCharged ?? 0),
            }
          : null;
      } catch {
        finalReceipt = null;
      }

      if (!finalReceipt) {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const { data: completedEntry } = await supabase
            .from("live_queue_entries")
            .select("duration_seconds, amount_charged")
            .eq("session_id", sid)
            .eq("fan_id", currentUser.id)
            .in("status", ["completed", "skipped"])
            .order("ended_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (completedEntry) {
            finalReceipt = {
              durationSeconds: Number(completedEntry.duration_seconds ?? 0),
              amountCharged: Number(completedEntry.amount_charged ?? 0),
            };
            break;
          }

          await new Promise((resolve) => window.setTimeout(resolve, 350));
        }
      }
    }

    if (finalReceipt) {
      applyReceipt(finalReceipt);
      setCallEndedState({
        type: "call",
        creatorName: creatorStateRef.current?.name || "The creator",
      });
      return;
    }

    router.replace("/discover");
  }, [router]);

  const handleCreatorDisconnect = useCallback(async () => {
    if (callEndedRef.current) return;

    selfLeavingRef.current = false;
    setInCall(false);
    setRoomUrl(null);
    setToken(null);

    const sid = liveSessionIdRef.current;
    const currentUser = userRef.current;
    if (sid && currentUser) {
      const supabase = createClient();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data: completedEntry } = await supabase
          .from("live_queue_entries")
          .select("duration_seconds, amount_charged, status")
          .eq("session_id", sid)
          .eq("fan_id", currentUser.id)
          .in("status", ["completed", "skipped"])
          .order("ended_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (completedEntry) {
          applyReceipt({
            durationSeconds: Number(completedEntry.duration_seconds ?? 0),
            amountCharged: Number(completedEntry.amount_charged ?? 0),
          });
          setCallEndedState({
            type: completedEntry.status === "skipped" ? "skipped" : "call",
            creatorName: creatorStateRef.current?.name || "The creator",
          });
          return;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
    }

    setCallEndedState({
      type: "call",
      creatorName: creatorStateRef.current?.name || "The creator",
    });
  }, [applyReceipt]);

  const handleFanJoinedRoom = useCallback(async () => {
    const sid = liveSessionIdRef.current;
    if (!sid) return;

    try {
      const res = await fetch("/api/live/mark-active-joined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      });
      const data = await res.json();
      if (res.ok && data?.admittedAt) {
        setActiveFanAdmittedAt(data.admittedAt);
      }
    } catch {
      // Best effort. Realtime/polling will still reconcile the admitted_at timestamp.
    }
  }, []);

  useEffect(() => {
    return () => {
      const sid = liveSessionIdRef.current;
      const currentUser = userRef.current;
      if (!sid || !currentUser) return;

      const supabase = createClient();
      supabase
        .from("live_queue_entries")
        .update({ status: "skipped" })
        .eq("session_id", sid)
        .eq("fan_id", currentUser.id)
        .eq("status", "waiting")
        .then(() => {});
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    async function loadQueue() {
      if (callEndedRef.current) return;

      let session: { id: string; daily_room_url: string | null } | null = null;

      const { data: activeSession } = await supabase
        .from("live_sessions")
        .select("id, daily_room_url")
        .eq("creator_id", params.id)
        .eq("is_active", true)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      session = activeSession ?? null;

      if (!session) {
        const { data: creatorProfile } = await supabase
          .from("creator_profiles")
          .select("is_live, current_live_session_id")
          .eq("id", params.id)
          .maybeSingle();
        if (creatorProfile?.current_live_session_id) {
          const { data: fallbackSession } = await supabase
            .from("live_sessions")
            .select("id, daily_room_url")
            .eq("id", creatorProfile.current_live_session_id)
            .eq("is_active", true)
            .not("daily_room_url", "is", null)
            .maybeSingle();
          if (fallbackSession) session = fallbackSession;
        }
      }

      if (!session) {
        if (userRef.current) {
          const latestEndedEntry = await hydrateLatestReceipt(liveSessionIdRef.current);
          if (latestEndedEntry) {
            setCallEndedState({
              type: latestEndedEntry.status === "skipped" ? "skipped" : "call",
              creatorName: creatorStateRef.current?.name || "The creator",
            });
            setInCall(false);
            setLiveSessionId(undefined);
            setActiveFanAdmittedAt(null);
            return;
          }
        }

        missedSessionPollsRef.current += 1;
        if (liveSessionIdRef.current && missedSessionPollsRef.current >= 2) {
          if (userRef.current) {
            const { data: myQueueEntry } = await supabase
              .from("live_queue_entries")
              .select("id, status")
              .eq("session_id", liveSessionIdRef.current)
              .eq("fan_id", userRef.current.id)
              .in("status", ["waiting", "active"])
              .maybeSingle();
            if (myQueueEntry) return;
          }

          setCallEndedState({
            type: inCallRef.current ? "call" : "session",
            creatorName: creatorStateRef.current?.name || "The creator",
          });
          setInCall(false);
          setLiveSessionId(undefined);
          setActiveFanAdmittedAt(null);
        }
        return;
      }

      missedSessionPollsRef.current = 0;
      setLiveSessionId(session.id);

      const { data } = await supabase
        .from("live_queue_entries")
        .select(`
          id, position, topic, joined_at, admitted_at, fan_id, status,
          fan:profiles!fan_id(full_name, username, avatar_initials, avatar_color, avatar_url)
        `)
        .eq("session_id", session.id)
        .in("status", ["waiting", "active"])
        .order("joined_at", { ascending: true });

      if (!data) return;

      const active = data.find((entry: any) => entry.status === "active");
      const activeRemainingSeconds = active?.admitted_at
        ? Math.max(0, MAX_LIVE_CALL_SECONDS - Math.floor((Date.now() - new Date(active.admitted_at).getTime()) / 1000))
        : MAX_LIVE_CALL_SECONDS;
      setActiveFanAdmittedAt(active?.admitted_at ?? null);

      const waitingFans = data.filter((entry: any) => entry.status === "waiting");
      const mapped = data.map((entry: any) => {
        const pos = waitingFans.findIndex((f: any) => f.id === entry.id) + 1;
        return {
          id: entry.id,
          fanName: entry.fan.full_name,
          fanUsername: `@${entry.fan.username}`,
          avatarInitials: entry.fan.avatar_initials,
          avatarColor: entry.fan.avatar_color,
          avatarUrl: entry.fan.avatar_url ?? undefined,
          position: pos > 0 ? pos : 0,
          waitTime: "",
          waitSeconds: pos > 0 ? activeRemainingSeconds + ((pos - 1) * MAX_LIVE_CALL_SECONDS) : 0,
          topic: entry.topic,
          joinedAt: entry.joined_at,
          admittedAt: entry.admitted_at ?? undefined,
          creator_id: params.id,
          fan_id: entry.fan_id,
          status: entry.status,
        };
      });
      setQueue(mapped);

      const myEntry = mapped.find((e: any) => e.fan_id === userRef.current?.id);
      if (myEntry) {
        if (callEndedRef.current) {
          setCallEndedState(null);
        }
        setReceipt(null);
      }
      if (!myEntry && userRef.current) {
        const { data: latestEndedEntry } = await supabase
          .from("live_queue_entries")
          .select("duration_seconds, amount_charged, status")
          .eq("session_id", session.id)
          .eq("fan_id", userRef.current.id)
          .in("status", ["completed", "skipped"])
          .order("ended_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestEndedEntry) {
          setReceipt({
            durationSeconds: Number(latestEndedEntry.duration_seconds ?? 0),
            amountCharged: Number(latestEndedEntry.amount_charged ?? 0),
          });
          setCallEndedState({
            type: latestEndedEntry.status === "skipped" ? "skipped" : "call",
            creatorName: creatorStateRef.current?.name || "The creator",
          });
          setInCall(false);
          setRoomUrl(null);
          setToken(null);
          setActiveFanAdmittedAt(null);
          return;
        }
      }

      if (!callEndedRef.current) {
        setCallEndedState(null);
      }
      if (myEntry?.status === "active" && !inCallRef.current && session.daily_room_url) {
        handleStatusChange("active", session.id, session.daily_room_url);
      }
    }

    loadQueueRef.current = loadQueue;

    loadQueue();

    const channel = supabase
      .channel(`fan-queue:${params.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "live_queue_entries",
      }, () => loadQueue())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "live_sessions",
      }, () => loadQueue())
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "creator_profiles",
        filter: `id=eq.${params.id}`,
      }, () => loadQueue())
      .subscribe();

    return () => {
      loadQueueRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [user, params.id, liveSessionId, handleStatusChange]);

  useEffect(() => {
    if (!user) return;

    function runRefresh() {
      if (document.visibilityState !== "visible") return;
      void loadQueueRef.current?.();
    }

    const heartbeat = window.setInterval(runRefresh, QUEUE_FALLBACK_POLL_MS);
    window.addEventListener("focus", runRefresh);
    document.addEventListener("visibilitychange", runRefresh);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("focus", runRefresh);
      document.removeEventListener("visibilitychange", runRefresh);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    const supabase = createClient();

    if (!creatorStateRef.current) {
      setLoading(true);
      supabase
        .from("profiles")
        .select("*, creator_profiles(*)")
        .eq("id", params.id)
        .single()
        .then(({ data: profile }: { data: any }) => {
          if (profile) {
            setCreatorState({
              id: profile.id,
              name: profile.full_name,
              username: `@${profile.username}`,
              avatarInitials: profile.avatar_initials,
              avatarColor: profile.avatar_color,
              avatarUrl: profile.avatar_url,
            });
          }
          setLoading(false);
        });
    }

    const statusChannel = supabase
      .channel(`fan-status-${currentUser.id}-${params.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "live_queue_entries",
        filter: `fan_id=eq.${currentUser.id}`,
      }, async (payload: any) => {
        if (payload.new.fan_id !== currentUser.id) return;

        const { data: session } = await supabase
          .from("live_sessions")
          .select("daily_room_url")
          .eq("id", payload.new.session_id)
          .single();

        if (payload.new.status === "completed" || payload.new.status === "skipped") {
          handleStatusChange(payload.new.status, payload.new.session_id, session?.daily_room_url ?? "");
          return;
        }

        if (session?.daily_room_url) {
          handleStatusChange(payload.new.status, payload.new.session_id, session.daily_room_url);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
    };
  }, [params.id, user, handleStatusChange, hydrateLatestReceipt]);

  useEffect(() => {
    if (!callEndedState || !user) return;
    if (receipt && (receipt.durationSeconds > 0 || receipt.amountCharged > 0)) return;

    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const latest = await hydrateLatestReceipt(liveSessionIdRef.current);
        if (cancelled) return;
        if (latest && (latest.receipt.durationSeconds > 0 || latest.receipt.amountCharged > 0)) {
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 300));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callEndedState, receipt, user, hydrateLatestReceipt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  if (!creatorState) return notFound();

  if (callEndedState) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-2rem)] space-y-6 text-center px-6">
        <div className="w-20 h-20 rounded-full bg-brand-primary/10 flex items-center justify-center mb-2">
          <CheckCircle2 className="w-10 h-10 text-brand-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-100 mb-2">
            {callEndedState.creatorName} ended the call
          </h1>
          <p className="text-slate-400 max-w-sm mx-auto">
            Thanks for joining! We hope you had a great experience.
          </p>
          {receipt && (
            <div className="mt-4 rounded-2xl border border-brand-border bg-brand-surface px-5 py-4 text-left max-w-sm mx-auto">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Receipt</p>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                <span>Time on call</span>
                <span>{Math.floor(receipt.durationSeconds / 60)}m {receipt.durationSeconds % 60}s</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-300">
                <span>Amount charged</span>
                <span>${receipt.amountCharged.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col w-full max-w-xs gap-3">
          <Link href={`/profile/${params.id}`}>
            <Button className="w-full h-12 text-base font-bold shadow-glow-primary" variant="primary">
              Back to Profile
            </Button>
          </Link>
          <Link href="/discover">
            <Button className="w-full h-12 text-base font-bold border-brand-border hover:bg-brand-elevated" variant="outline">
              <Home className="w-4 h-4 mr-2" />
              Discover Creators
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-4 h-[calc(100vh-1rem)] flex flex-col relative">
      <div className="fixed bottom-2 right-4 bg-brand-surface border border-brand-border rounded px-2 py-0.5 text-[8px] font-mono text-slate-600 z-50">
        Sync ID: {liveSessionId || "None"}
      </div>

      <Link href={`/profile/${creatorState.id}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors shrink-0">
        <ArrowLeft className="w-4 h-4" />
        Back to {creatorState.name}&apos;s profile
      </Link>

      <div className="flex-1 min-h-0">
        {inCall && roomUrl && token ? (
          <FanLiveView
            roomUrl={roomUrl}
            token={token}
            creatorName={creatorState.name}
            creatorInitials={creatorState.avatarInitials}
            creatorColor={creatorState.avatarColor}
            creatorAvatarUrl={creatorState.avatarUrl}
            fanName={user?.full_name ?? "Fan"}
            onLeave={handleFanLeave}
            onDisconnect={handleCreatorDisconnect}
            onJoin={handleFanJoinedRoom}
          />
        ) : (
          <WaitingRoom
            queue={queue.filter((q) => q.status === "waiting")}
            currentUserPosition={
              user
                ? (queue.find((q: any) => q.fan_id === user.id && q.status === "waiting")?.position ?? 0)
                : 0
            }
            creatorName={creatorState.name}
            creatorInitials={creatorState.avatarInitials}
            creatorColor={creatorState.avatarColor}
            creatorAvatarUrl={creatorState.avatarUrl}
            creatorId={params.id}
            sessionId={liveSessionId}
            activeFanAdmittedAt={activeFanAdmittedAt}
          />
        )}
      </div>
    </div>
  );
}
