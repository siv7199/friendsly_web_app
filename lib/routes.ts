export function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeCreatorSlug(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@/, "").toLowerCase();
}

export function getCreatorProfilePath(params: { id: string; username?: string | null }) {
  return `/profile/${normalizeCreatorSlug(params.username) ?? params.id}`;
}

export function getLiveSessionPath(params: {
  creatorId: string;
  creatorUsername?: string | null;
  sessionId?: string | null;
}) {
  const creatorRef = normalizeCreatorSlug(params.creatorUsername) ?? params.creatorId;
  return params.sessionId
    ? `/waiting-room/${creatorRef}--${params.sessionId}`
    : `/waiting-room/${creatorRef}`;
}

export function parseLiveRouteParam(value: string) {
  const trimmed = value.trim();
  const separatorIndex = trimmed.lastIndexOf("--");

  if (separatorIndex === -1) {
    return {
      creatorRef: trimmed,
      sessionId: null as string | null,
    };
  }

  const creatorRef = trimmed.slice(0, separatorIndex).trim();
  const sessionId = trimmed.slice(separatorIndex + 2).trim() || null;

  return {
    creatorRef: creatorRef || trimmed,
    sessionId,
  };
}
