/**
 * Prepend `query` to `list`, dedupe (case-sensitive, trimmed), cap at `max`.
 * Whitespace-only queries are a no-op. Used by suggestionsStore to maintain
 * a most-recent-first list of recent search queries.
 *
 * Phase 17 D-05: recent-query chips rendered above the Something New segment.
 */
export function dedupPrepend(
  query: string,
  list: string[],
  max: number
): string[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return list;
  const deduped = [trimmed, ...list.filter((q) => q !== trimmed)];
  return deduped.slice(0, max);
}
