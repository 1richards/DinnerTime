/**
 * Phase 20 Wave 1: client-side batched shopping telemetry logger.
 *
 * Queues events locally and flushes to POST /api/v1/telemetry/shopping in
 * batches of 10 OR every 30 seconds. Best-effort: on fetch failure (5xx,
 * network error, missing auth) the batch is re-queued for the next flush.
 *
 * Ship contract (per 20-01 plan + 20-RESEARCH.md Pattern 2 — cloned verbatim
 * from Phase 16 cooking telemetry, only diffs: event name type, 14-key
 * whitelist, shopping_list_id/shopping_order_id fields, and the POST URL):
 *   - Event payload must not include raw item names, user names, or other
 *     PII. Callers sanitize upstream via `sanitizePayload()` which whitelists
 *     the 14 structured keys (9 Phase-16 + 5 shopping-specific).
 *   - Queue capped at 200 events — oldest drop on overflow, prevents memory
 *     bloat on long offline sessions.
 *   - No retry-with-backoff: mirrors `offlineQueue` pattern (Phase 10-04)
 *     and Phase 16 cooking telemetry. First failure re-queues once;
 *     subsequent failures drop on next fetch attempt.
 */

/** Event name — open text; known values live in shopping_events.event_type. */
export type ShoppingEventName =
  | 'shopping.draft_cart_started'
  | 'shopping.draft_cart_succeeded'
  | 'shopping.draft_cart_failed'
  | 'shopping.handoff_opened_app'
  | 'shopping.handoff_opened_web'
  | 'shopping.handoff_dismissed'
  | (string & {});

interface LogInput {
  name: ShoppingEventName;
  session_id: string;
  shopping_list_id?: string | null;
  shopping_order_id?: string | null;
  payload?: Record<string, unknown>;
}

interface QueuedEvent {
  name: ShoppingEventName;
  session_id: string;
  shopping_list_id: string | null;
  shopping_order_id: string | null;
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
// (the shopping-screen bootstrap in 20-03/04) wires the real getter via
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
 * once at app start (or lazily from the shopping-screen enter() hook). Safe
 * to call multiple times — later calls override earlier ones.
 */
export function wireSupabaseAuth(getter: TokenGetter): void {
  tokenGetter = getter;
}

// ---------------------------------------------------------------------------
// sanitizePayload
// ---------------------------------------------------------------------------

/**
 * Whitelist of structured keys allowed in a shopping-event payload. Anything
 * outside this set (raw item names, user names, etc.) is stripped before
 * send. This is the PII guard — callers MUST route payloads through this
 * helper before `logShoppingEvent`.
 *
 * 14 keys total: 9 Phase-16 cooking keys (kept for parity + error_code/ms
 * reuse across channels) + 5 shopping-specific (item_count, list_id,
 * order_id, app_installed, variant). Addresses SHOP-DC-04 per
 * 20-RESEARCH.md Pitfall 6 (list_id/order_id needed for offline SQL joins
 * against shopping_lists/shopping_orders).
 */
const ALLOWED_PAYLOAD_KEYS = new Set([
  // Phase 16 — 9 keys (kept verbatim for channel parity)
  'answer_length',
  'confidence',
  'error_code',
  'first_chunk_ms',
  'intent_type',
  'length',
  'ms',
  'session_id',
  'total_ms',
  // Phase 20 — 5 shopping-specific keys
  'item_count',
  'list_id',
  'order_id',
  'app_installed',
  'variant',
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
    void flushShoppingTelemetry();
  }, FLUSH_INTERVAL_MS);
}

function clearFlushTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/**
 * Enqueue a shopping event. Batches flush when:
 *   - queue reaches BATCH_SIZE (10), OR
 *   - FLUSH_INTERVAL_MS (30 s) elapses with ≥1 queued event.
 *
 * @param e.payload MUST NOT contain raw item names or user-identifiable
 *   strings. Callers sanitize upstream via `sanitizePayload()` (see
 *   20-RESEARCH.md Pitfall 6).
 */
export function logShoppingEvent(e: LogInput): void {
  queue.push({
    name: e.name,
    session_id: e.session_id,
    shopping_list_id: e.shopping_list_id ?? null,
    shopping_order_id: e.shopping_order_id ?? null,
    payload: e.payload ?? {},
    timestamp: new Date().toISOString(),
  });

  // Cap — drop oldest when over.
  if (queue.length > QUEUE_CAP) {
    queue.splice(0, queue.length - QUEUE_CAP);
  }

  if (queue.length >= BATCH_SIZE) {
    void flushShoppingTelemetry();
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
 * `logShoppingEvent` can trigger multiple `flushShoppingTelemetry` starts
 * that all see the same queue snapshot; only the first await to resolve
 * actually drains. Back-pressure is thereby bounded by the token-fetch
 * microtask.
 */
export async function flushShoppingTelemetry(): Promise<void> {
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
    const res = await fetch(`${baseUrl}/api/v1/telemetry/shopping`, {
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
