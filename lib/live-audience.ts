import { readJsonResponse } from "@/lib/http";

type LiveAudiencePayload = {
  counts?: Record<string, number>;
};

export async function fetchLiveAudienceCounts(sessionIds: string[]): Promise<Record<string, number>> {
  const ids = Array.from(new Set(sessionIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) return {};

  const response = await fetch(`/api/live/audience?sessionIds=${encodeURIComponent(ids.join(","))}`, {
    cache: "no-store",
  });
  const data = await readJsonResponse<LiveAudiencePayload>(response);
  return data?.counts ?? {};
}
