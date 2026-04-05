export const NEW_CREATOR_DAYS = 14;

export function isNewCreator(createdAt?: string) {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const ageMs = Date.now() - created.getTime();
  return ageMs < NEW_CREATOR_DAYS * 24 * 60 * 60 * 1000;
}
