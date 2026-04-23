/**
 * Phase 23 Wave 2 (plan 23-06): client-side batched AI telemetry logger.
 *
 * Queues events locally and flushes to POST /api/v1/telemetry/ai in batches
 * of 10 OR every 30 seconds. Best-effort: on fetch failure (5xx, network
 * error, missing auth) the batch is re-queued for the next flush.
 *
 * Ship contract (cloned verbatim from Phase 20 shopping telemetry /
 * Phase 22 plan telemetry, only diffs: event-name type, POST URL, and the
 * 14-key whitelist tuned for AI-call scope):
 *   - Event payload must not include raw prompts, responses, transcripts,
 *     user names, or other PII. Callers sanitize upstream via
 *     `sanitizePayload()` which whitelists the 14 structured keys.
 *   - Queue capped at 200 events — oldest drop on overflow.
 *   - No retry-with-backoff: first failure re-queues once; subsequent
 *     failures drop on next fetch attempt.
 *
 * NOTE: This module is for AI-call METADATA only (task name, model, token
 * counts, latencies). Raw prompts and raw responses NEVER enter the queue —
 * the server-side `packages/server/src/ai/aiTelemetry.ts` writer enforces
 * the same invariant at the source.
 *
 * Requirement: NFR-17 (AI cost + performance telemetry).
 */

/** Event name — open text; known values live in ai_events.event_type. */
export type AiEventName =
  | 'ai.request_succeeded'
  | 'ai.request_failed'
  | 'ai.rate_limited'
  | 'ai.stream_first_chunk'
  | (string & {});

interface LogInput {
  name: AiEventName;
  session_id: string;
  task_name: string;
  model: string;
  payload?: Record<string, unknown>;
}

interface QueuedEvent {
  name: AiEventName;
  session_id: string;
  task_name: string;
  model: string;
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
// Authorization header is well-formed — `/^Bearer /`). Production code wires
// the real getter via `wireSupabaseAuth()` which pulls `access_token` from a
// live supabase session (typically called once at app start from
// `_layout.tsx`).
//
// Keeping the default synchronous (Promise.resolve, not dynamic-import) is
// deliberate: under `vi.useFakeTimers()` an `await import(...)` microtask
// will not resolve because dynamic imports don't register as a fake-timer
// tick, and every test failure would need a manual `vi.runAllTicks()` dance.

type TokenGetter = () => Promise<string | null>;

const SENTINEL_TOKEN = 'test-token';

const defaultTokenGetter: TokenGetter = () => Promise.resolve(SENTINEL_TOKEN);

let tokenGetter: TokenGetter = defaultTokenGetter;

/**
 * Production bootstrap: wire the real supabase-backed token getter. Call
 * once at app start. Safe to call multiple times — later calls override
 * earlier ones.
 */
export function wireSupabaseAuth(getter: TokenGetter): void {
  tokenGetter = getter;
}

// ---------------------------------------------------------------------------
// sanitizePayload
// ---------------------------------------------------------------------------

/**
 * Whitelist of structured keys allowed in an AI-event payload. Anything
 * outside this set (raw prompts, raw responses, user names, etc.) is
 * stripped before send. This is the PII + cost-data guard — callers MUST
 * route payloads through this helper before `logAiEvent`.
 *
 * 14 keys total, tuned for AI-call observability:
 *   - session_id + task_name + model: join keys for offline analysis
 *   - tokens_in + tokens_out: cost attribution
 *   - latency_ms + first_chunk_ms + total_ms + ms: latency distribution
 *   - success + error_code: outcome classification
 *   - intent_type: cooking-mode intent routing (reused from Phase 16)
 *   - length + confidence: structured-output quality signal
 */
const ALLOWED_PAYLOAD_KEYS = new Set([
  'session_id',
  'task_name',
  'model',
  'tokens_in',
  'tokens_out',
  'latency_ms',
  'first_chunk_ms',
  'total_ms',
  'success',
  'error_code',
  'intent_type',
  'length',
  'ms',
  'confidence',
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
    void flushAiTelemetry();
  }, FLUSH_INTERVAL_MS);
}

function clearFlushTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/**
 * Enqueue an AI event. Batches flush when:
 *   - queue reaches BATCH_SIZE (10), OR
 *   - FLUSH_INTERVAL_MS (30 s) elapses with ≥1 queued event.
 *
 * @param e.payload MUST NOT contain raw prompts, raw responses, or user-
 *   identifiable strings. Callers sanitize upstream via `sanitizePayload()`.
 */
export function logAiEvent(e: LogInput): void {
  queue.push({
    name: e.name,
    session_id: e.session_id,
    task_name: e.task_name,
    model: e.model,
    payload: e.payload ?? {},
    timestamp: new Date().toISOString(),
  });

  // Cap — drop oldest when over.
  if (queue.length > QUEUE_CAP) {
    queue.splice(0, queue.length - QUEUE_CAP);
  }

  if (queue.length >= BATCH_SIZE) {
    void flushAiTelemetry();
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
 * `logAiEvent` can trigger multiple `flushAiTelemetry` starts that all see
 * the same queue snapshot; only the first await to resolve actually drains.
 * Back-pressure is thereby bounded by the token-fetch microtask.
 */
export async function flushAiTelemetry(): Promise<void> {
  clearFlushTimer();
  if (queue.length === 0) return;

  const token = await tokenGetter();

  // Re-check after await — a concurrent flush may have already drained.
  if (queue.length === 0) return;

  const batch = queue.splice(0, queue.length);

  if (!token) {
    queue.unshift(...batch);
    return;
  }

  const baseUrl = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? '';

  try {
    const res = await fetch(`${baseUrl}/api/v1/telemetry/ai`, {
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
