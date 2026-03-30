"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WaitingRoom } from "@/components/fan/WaitingRoom";
import { MOCK_CREATORS, MOCK_QUEUE } from "@/lib/mock-data";
import { getRegisteredCreators } from "@/lib/mock-auth";
import { notFound } from "next/navigation";

function getCreator(id: string) {
  return (
    MOCK_CREATORS.find((c) => c.id === id) ??
    getRegisteredCreators().find((c) => c.id === id)
  );
}

export default function WaitingRoomPage({ params }: { params: { id: string } }) {
  const creator = getCreator(params.id);
  if (!creator) return notFound();

  // Only the seeded mock creators have a pre-populated demo queue
  const isMockCreator = ["1", "2", "3", "4", "5", "6"].includes(params.id);
  const queue = isMockCreator ? MOCK_QUEUE : [];

  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto space-y-4 h-[calc(100vh-1rem)] flex flex-col">
      <Link
        href={`/profile/${creator.id}`}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100 transition-colors shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {creator.name}&apos;s profile
      </Link>
      <div className="flex-1 min-h-0">
        <WaitingRoom
          queue={queue}
          currentUserPosition={queue.length > 0 ? 1 : 0}
          creatorName={creator.name}
          creatorInitials={creator.avatarInitials}
          creatorColor={creator.avatarColor}
        />
      </div>
    </div>
  );
}
