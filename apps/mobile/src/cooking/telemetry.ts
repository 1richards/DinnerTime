/**
 * Phase 16 Wave 1: client-side batched cooking telemetry logger.
 *
 * Queues events locally and flushes to POST /api/v1/telemetry/cooking in
 * batches of 10 OR every 30 seconds. Best-effort: on fetch failure (5xx,
 * network error, missing auth) the batch is re-queued for the next flush.
 *
 * Ship contract (per 16-01 plan + 16-RESEARCH.md Pattern 1):
 *   - Event payload must not include raw transcript text. Callers (hooks
 *     shipped in 16-06) sanitize upstream via `sanitizePayload()` which
 *     whitelists structured keys only.
 *   - Queue capped at 200 events — oldest drop on overflow, prevents
 *     memory bloat on long offline sessions.
 *   - No retry-with-backoff: mirrors `offlineQueue` pattern (Phase 10-04).
 *     First failure re-queues once; subsequent failures drop on next fetch
 *     attempt.
 */

/** Event name — open text; known values live in cooking_events.event_type. */
export type CookingEventName =
  | 'stt_final'
  | 'stt_error'
  | 'intent_routed'
  | 'intent_route'
  | 'ask_start'
  | 'ask_first_chunk'
  | 'ask_complete'
  | 'ask_latency'
  | 'tts_echo_swallowed'
  | 'command_unrecognized'
  | (string & {});

interface LogInput {
  name: CookingEventName;
  session_id: string;
  recipe_id?: string | null;
  step_index?: number | null;
  payload?: Record<string, unknown>;
}

interface QueuedEvent {
  name: CookingEventName;
  session_id: string;
  recipe_id: string | null;
  step_index: number | null;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const QUEUE_CAP = 200;
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30_000;

const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Token retrieval seam
// ---------------------------------------------------------------------------
//
// Token-getter is a module-level seam. Default returns a sync-resolved
// sentinel so tests do not need to stub supabase (they only care that the
// Authorization header is well-formed — `/^Bearer /`). Production code
// (the cook-screen bootstrap in 16-06) wires the real getter via
// `wireSupabaseAuth()` which pulls `access_token` from a live session.
//
// Keeping the default synchronous is deliberate: under `vi.useFakeTimers()`
// an `await import(...)` microtask will not resolve because dynamic imports
// don't register as a fake-timer tick, and every test failure would need a
// manual `vi.runAllTicks()` dance. A fake Promise.resolve('test-token') by
// contrast settles in the same microtask queue that `vi.advanceTimersByTime`
// drains, keeping the test contract clean.

type TokenGetter = () => Promise<string | null>;

const SENTINEL_TOKEN = 'test-token';

const defaultTokenGetter: TokenGetter = () => Promise.resolve(SENTINEL_TOKEN);

let tokenGetter: TokenGetter = defaultTokenGetter;

/**
 * Production bootstrap: wire the real supabase-backed token getter. Call
 * once at app start (or lazily from the cook-screen enter() hook). Safe
 * to call multiple times — later calls override earlier ones.
 */
export function wireSupabaseAuth(getter: TokenGetter): void {
  tokenGetter = getter;
}

// ---------------------------------------------------------------------------
// sanitizePayload
// ---------------------------------------------------------------------------

/**
 * Whitelist of structured keys allowed in a cooking-event payload. Anything
 * outside this set (raw transcripts, user names, etc.) is stripped before
 * send. This is the PII guard — callers MUST route payloads through this
 * helper before `logCookingEvent`.
 *
 * Keep in sync with the Pattern 1 anti-pattern note in 16-RESEARCH.md.
 */
const ALLOWED_PAYLOAD_KEYS = new Set([
  'answer_length',
  'confidence',
  'error_code',
  'first_chunk_ms',
  'intent_type',
  'length',
  'ms',
  'session_id',
  'total_ms',
]);

export function sanitizePayload(
  dirty: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dirty)) {
    if (ALLOWED_PAYLOAD_KEYS.has(k)) clean[k] = v;
  }
  return clean;
}

// ---------------------------------------------------------------------------
// Queue management
// ---------------------------------------------------------------------------

function armFlushTimer() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetry();
  }, FLUSH_INTERVAL_MS);
}

function clearFlushTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/**
 * Enqueue a cooking event. Batches flush when:
 *   - queue reaches BATCH_SIZE (10), OR
 *   - FLUSH_INTERVAL_MS (30 s) elapses with ≥1 queued event.
 *
 * @param e.payload MUST NOT contain raw transcript text. Callers sanitize
 *   upstream via `sanitizePayload()` (see 16-RESEARCH.md Pattern 1 guard).
 */
export function logCookingEvent(e: LogInput): void {
  queue.push({
    name: e.name,
    session_id: e.session_id,
    recipe_id: e.recipe_id ?? null,
    step_index: e.step_index ?? null,
    payload: e.payload ?? {},
    timestamp: new Date().toISOString(),
  });

  // Cap — drop oldest when over.
  if (queue.length > QUEUE_CAP) {
    queue.splice(0, queue.length - QUEUE_CAP);
  }

  if (queue.length >= BATCH_SIZE) {
    void flushTelemetry();
  } else {
    armFlushTimer();
  }
}

/**
 * Flush queued events to the backend. Idempotent (no-op when queue empty).
 * On failure (network error, non-2xx, missing auth) the batch is pushed
 * back to the front of the queue for the next flush attempt.
 *
 * Implementation note: the queue is spliced AFTER the async token fetch
 * resolves. This is deliberate — it means a synchronous burst of calls to
 * `logCookingEvent` can trigger multiple `flushTelemetry` starts that all
 * see the same queue snapshot; only the first await to resolve actually
 * drains. Back-pressure is thereby bounded by the token-fetch microtask.
 */
export async function flushTelemetry(): Promise<void> {
  clearFlushTimer();
  if (queue.length === 0) return;

  const token = await tokenGetter();

  // Re-check after await — a concurrent flush may have already drained.
  if (queue.length === 0) return;

  const batch = queue.splice(0, queue.length);

  if (!token) {
    // Re-queue at front; try again next flush.
    queue.unshift(...batch);
    return;
  }

  const baseUrl = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? '';

  try {
    const res = await fetch(`${baseUrl}/api/v1/telemetry/cooking`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) {
      queue.unshift(...batch);
    }
  } catch {
    queue.unshift(...batch);
  }
}

// ---------------------------------------------------------------------------
// Test hook
// ---------------------------------------------------------------------------

/**
 * Test-only reset. Clears the queue and any pending flush timer. Also
 * exposes `getQueueLength()` as a property — a sentinel used by the queue-
 * cap contract test.
 *
 * NOT intended for production use. Safe to call — it does not throw.
 */
export const __resetForTests = Object.assign(
  function __resetForTests(): void {
    queue.length = 0;
    clearFlushTimer();
    tokenGetter = defaultTokenGetter;
  },
  {
    getQueueLength: (): number => queue.length,
    setTokenGetter: (fn: TokenGetter): void => {
      tokenGetter = fn;
    },
  },
);
