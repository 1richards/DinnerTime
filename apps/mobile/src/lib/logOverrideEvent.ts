import type { SourceLocation } from '../types/pantry';

export interface OverrideEventPayload {
  item_name: string;
  ai_location: SourceLocation;
  user_location: SourceLocation;
}

/**
 * Fire-and-forget POST to /api/v1/pantry/override-events.
 *
 * Telemetry for Phase 18 — logs every user correction of an AI-classified
 * location so Phase 21 (pantry intelligence) can derive per-user location
 * rules. Designed to never block the user-facing /confirm flow:
 *
 * - Empty events array: no-op (no fetch, no token read).
 * - Missing auth token: warn + skip (user is unauthenticated mid-session).
 * - Network error: swallow + console.warn (next scan will re-fire).
 * - Non-2xx response: warn + continue.
 *
 * The server route (Phase 18-02) silently filters invalid / no-op payloads
 * and always returns 200 for non-empty arrays, so the mobile side can stay
 * optimistic.
 */
export async function logOverrideEvents(
  events: OverrideEventPayload[],
  getAuthToken: () => Promise<string | null>,
  getApiBaseUrl: () => string,
): Promise<void> {
  if (events.length === 0) return;
  try {
    const token = await getAuthToken();
    if (!token) {
      console.warn('logOverrideEvents: no auth token, skipping');
      return;
    }
    const res = await fetch(
      `${getApiBaseUrl()}/api/v1/pantry/override-events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ events }),
      },
    );
    if (!res.ok) {
      console.warn(`logOverrideEvents: server returned ${res.status}`);
    }
  } catch (err) {
    console.warn('logOverrideEvents failed:', err);
  }
}
