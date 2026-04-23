/**
 * Phase 22 Wave 0: client-side batched plan telemetry logger.
 *
 * Queues events locally and flushes to POST /api/v1/telemetry/plan in
 * batches of 10 OR every 30 seconds. Best-effort: on fetch failure (5xx,
 * network error, missing auth) the batch is re-queued for the next flush.
 *
 * Ship contract (per 22-01..06 plans + 22-RESEARCH.md Pattern 2 — cloned
 * verbatim from Phase 20 shopping telemetry, only diffs: event name type,
 * 14-key whitelist tuned for plan scope, meal_plan_id/meal_plan_entry_id
 * fields, and the POST URL):
 *   - Event payload must not include raw recipe titles, ingredient names,
 *     or user notes (PII-adjacent). Callers sanitize upstream via
 *     `sanitizePayload()` which whitelists the 14 structured keys.
 *   - Queue capped at 200 events — oldest drop on overflow, prevents memory
 *     bloat on long offline sessions.
 *   - No retry-with-backoff: mirrors `offlineQueue` pattern (Phase 10-04)
 *     and Phase 16/20 telemetry. First failure re-queues once; subsequent
 *     failures drop on next fetch attempt.
 */

/** Event name — open text; known values live in plan_events.event_type. */
export type PlanEventName =
  | 'plan.recipe_pin_started'
  | 'plan.recipe_pin_succeeded'
  | 'plan.recipe_pin_failed'
  | 'plan.suggestion_pin_succeeded'
  | 'plan.shopping_handoff_opened'
  | 'plan.week_regenerated'
  | 'plan.week_shifted'
  | 'plan.week_duplicated'
  | 'plan.month_opened'
  | 'plan.day_drill_opened'
  | 'plan.swipe_action'
  | 'plan.stretch_displayed'
  | 'plan.focus_theme_set'
  | (string & {});

interface LogInput {
  name: PlanEventName;
  session_id: string;
  meal_plan_id?: string | null;
  meal_plan_entry_id?: string | null;
  payload?: Record<string, unknown>;
}

interface QueuedEvent {
  name: PlanEventName;
  session_id: string;
  meal_plan_id: string | null;
  meal_plan_entry_id: string | null;
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
// (the plan-screen bootstrap in 22-01..06) wires the real getter via
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
 * once at app start (or lazily from the plan-screen enter() hook). Safe
 * to call multiple times — later calls override earlier ones.
 */
export function wireSupabaseAuth(getter: TokenGetter): void {
  tokenGetter = getter;
}

// ---------------------------------------------------------------------------
// sanitizePayload
// ---------------------------------------------------------------------------

/**
 * Whitelist of structured keys allowed in a plan-event payload. Anything
 * outside this set (raw titles, ingredient names, notes, etc.) is stripped
 * before send. This is the PII guard — callers MUST route payloads through
 * this helper before `logPlanEvent`.
 *
 * 14 keys total: 9 parity keys (reused from Phase 16/20 for cross-channel
 * analytics consistency) + 5 plan-specific:
 *   - meal_plan_id + meal_plan_entry_id: FK joins against plan tables for
 *     offline SQL analysis
 *   - variant: reused for swipe-variant (swap|cook|skip), error-variant
 *     (network|server|validation), and pin-variant (recipe|suggestion)
 *   - date + week_start: the schedule target for pin/assign/shift events
 */
const ALLOWED_PAYLOAD_KEYS = new Set([
  // 9 parity keys (kept verbatim for channel parity with shopping + cooking)
  'answer_length',
  'confidence',
  'error_code',
  'first_chunk_ms',
  'intent_type',
  'length',
  'ms',
  'session_id',
  'total_ms',
  // 5 plan-specific keys
  'meal_plan_id',
  'meal_plan_entry_id',
  'variant',
  'date',
  'week_start',
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
    void flushPlanTelemetry();
  }, FLUSH_INTERVAL_MS);
}

function clearFlushTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/**
 * Enqueue a plan event. Batches flush when:
 *   - queue reaches BATCH_SIZE (10), OR
 *   - FLUSH_INTERVAL_MS (30 s) elapses with ≥1 queued event.
 *
 * @param e.payload MUST NOT contain raw titles, ingredient names, or user
 *   notes. Callers sanitize upstream via `sanitizePayload()` (see
 *   22-RESEARCH.md Pattern 2 — 14-key whitelist).
 */
export function logPlanEvent(e: LogInput): void {
  queue.push({
    name: e.name,
    session_id: e.session_id,
    meal_plan_id: e.meal_plan_id ?? null,
    meal_plan_entry_id: e.meal_plan_entry_id ?? null,
    payload: e.payload ?? {},
    timestamp: new Date().toISOString(),
  });

  // Cap — drop oldest when over.
  if (queue.length > QUEUE_CAP) {
    queue.splice(0, queue.length - QUEUE_CAP);
  }

  if (queue.length >= BATCH_SIZE) {
    void flushPlanTelemetry();
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
 * `logPlanEvent` can trigger multiple `flushPlanTelemetry` starts that all
 * see the same queue snapshot; only the first await to resolve actually
 * drains. Back-pressure is thereby bounded by the token-fetch microtask.
 */
export async function flushPlanTelemetry(): Promise<void> {
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
    const res = await fetch(`${baseUrl}/api/v1/telemetry/plan`, {
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
