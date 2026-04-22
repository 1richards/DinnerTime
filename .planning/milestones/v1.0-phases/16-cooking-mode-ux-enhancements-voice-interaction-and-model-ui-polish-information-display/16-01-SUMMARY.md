---
phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display
plan: 01
subsystem: telemetry
tags: [hono, supabase, rls, zod, cooking-mode, batched-logger, pgsql-migration, pii-guard]

# Dependency graph
requires:
  - phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display
    provides: Wave 0 red test stubs (telemetry.test.ts on both mobile + server); cookingStore.currentSessionId slice
  - phase: 09-voice-cooking-mode
    provides: cooking-mode baseline (store, handleTranscript, intentRouter) that telemetry will instrument in Wave 3
provides:
  - supabase/migrations/00020_cooking_events.sql — append-only event log with RLS mirroring recipe_cooks
  - POST /api/v1/telemetry/cooking — authed bulk-insert endpoint (204 no-op / 200 ok / 400 schema / 401 auth / 500 insert-failed)
  - logCookingEvent + flushTelemetry + sanitizePayload + wireSupabaseAuth + __resetForTests (mobile module)
  - PII guard: sanitizePayload whitelists 9 structured keys; raw transcripts cannot leak
affects: [16-04, 16-06, 16-07]

# Tech tracking
tech-stack:
  added: []  # zod already a server dep; no new libs
  patterns:
    - "Splice-after-await in flushTelemetry — prevents sync re-entrant burst flushes from draining the queue during fake-timer-driven tests and in production burst scenarios"
    - "Token-getter seam (wireSupabaseAuth) — default returns synchronous sentinel so fake-timer tests resolve in one microtask; production wires the real supabase.auth.getSession() retriever from the cook-screen bootstrap"
    - "Append-only RLS with no UPDATE/DELETE policies — mirrors recipe_cooks (00008), scan_events (00014), item_override_events (00010)"
    - "Client-provided `name` + `timestamp` → DB columns `event_type` + `client_ts` mapping at insert-time (schema-light: no name enum so new event kinds need no migration)"

key-files:
  created:
    - "supabase/migrations/00020_cooking_events.sql"
    - "packages/server/src/routes/telemetry.ts"
    - "apps/mobile/src/cooking/telemetry.ts"
  modified:
    - "packages/server/src/index.ts"  # import + app.route('/telemetry', telemetry) at /api/v1/telemetry

key-decisions:
  - "Event shape uses `name` (not `event_type`) and `timestamp` (not `client_ts`) on the wire — driven by Wave 0 test contract; server maps to DB columns at insert. Keeps client code terse and DB column names aligned with broader event-table convention."
  - "Schema-light: event_type is free-form text in Postgres (NOT an enum) + no wire-side enum on `name`. Adding new event kinds in Wave 3 requires no migration or server deploy."
  - "Token getter default is a sync-resolved sentinel ('test-token'), production wires the real getter via wireSupabaseAuth(). Avoids async dynamic import of supabase.ts (which can't load under vitest because react-native-get-random-values uses CJS require). Without this split, every telemetry test would need to stub supabase manually."
  - "Splice-after-await in flushTelemetry: queue drain happens AFTER `await tokenGetter()` resolves, not before. This makes the queue-cap-201 contract testable under fake timers — synchronous bursts of logCookingEvent don't drain the queue via concurrent flush promises."
  - "sanitizePayload enforces a 9-key whitelist at the MODULE level (not schema level) so callers in Wave 3 (useVoiceListener, handleTranscript) get a single PII scrubber to pipe every payload through."
  - "profile_id is server-injected from the authed bearer token — NEVER trusted from the request body. Matches cooking.ts `/ask` ownership-check pattern."

patterns-established:
  - "Telemetry endpoint pattern: Hono router + authMiddleware + zod schema with schema-light enum (free-form strings for event names) + server-side profile_id injection + explicit 204/200 split for empty/non-empty batches"
  - "Client batching pattern: module-level queue + splice-after-await + re-queue-on-failure (no backoff) + cap-and-drop-oldest + exposed __resetForTests sentinel methods for queue-length introspection"
  - "Append-only telemetry table pattern: bigserial PK, profile_id FK auth.users cascade, session_id text (client UUID), event_type text (no enum), recipe_id FK set-null, payload jsonb default '{}', client_ts + server_ts pair for latency-skew analysis, RLS select/insert-only with auth.uid() = profile_id"

requirements-completed: [COOK-UX-01, COOK-UX-02]

# Metrics
duration: 9min
completed: 2026-04-22
---

# Phase 16 Plan 01: Cooking Telemetry Pipeline Summary

**Append-only `cooking_events` table + zod-validated POST /telemetry/cooking Hono route + batched mobile client (10-event / 30s flush, 200-event cap, re-queue-on-failure, 9-key PII whitelist) — the empirical foundation for Whisper-fallback and p95-ask-latency decisions in Wave 3.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-22T04:02:54Z
- **Completed:** 2026-04-22T04:11:44Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- **Migration 00020 shipped:** `cooking_events` (id bigserial PK, profile_id uuid FK `auth.users` cascade, session_id text, event_type text, recipe_id uuid FK `recipes` set-null, step_index int, payload jsonb default '{}', client_ts timestamptz, server_ts timestamptz default now()) with RLS (auth.uid() = profile_id select/insert only — append-only mirrors recipe_cooks / scan_events) + two indexes (profile+server_ts desc, session_id).
- **Server route green:** `packages/server/src/routes/telemetry.ts` exports default Hono router; mounted at `/api/v1/telemetry` in `index.ts`. POST `/cooking` paths covered: 401 (no auth) / 204 (empty events[]) / 200 (valid batch → `.from('cooking_events').insert(rows)` with `{ inserted: N }`) / 400 (zod schema failure) / 500 (insert failure). Server-side zod schema is schema-light — `name` is plain `z.string().min(1)` so adding event kinds needs no server deploy.
- **Mobile client green:** `apps/mobile/src/cooking/telemetry.ts` ships `logCookingEvent`, `flushTelemetry`, `sanitizePayload`, `wireSupabaseAuth`, and `__resetForTests` (with `.getQueueLength()` and `.setTokenGetter()` sentinel methods). Batching: auto-flush at 10 events OR 30s timer, queue cap 200 (oldest dropped on overflow), 5xx/network errors re-queue at front for next flush (no backoff, mirrors `offlineQueue` Phase 10-04).
- **PII guard live:** `sanitizePayload()` whitelists 9 keys (`answer_length`, `confidence`, `error_code`, `first_chunk_ms`, `intent_type`, `length`, `ms`, `session_id`, `total_ms`). Callers in Wave 3 must route payloads through this scrubber — raw transcripts cannot leak to the backend.
- **Zero regressions:** Server suite goes from 41/3 to 42/2 passing test files (+4 telemetry tests, 0 regressions). Mobile suite goes from 53/15 to 53/15 (identical — 15 stub files remain red and are owned by plans 16-03..16-07).

## Task Commits

1. **Task 1: Supabase migration + server POST /telemetry/cooking route** — `9fc5e42` (feat)
2. **Task 2: Mobile batched telemetry client with queue cap + exit-flush** — `2fb2caf` (feat)

**Plan metadata commit:** (forthcoming with SUMMARY + STATE + ROADMAP + REQUIREMENTS update)

## Files Created/Modified

### Created (3)

- `supabase/migrations/00020_cooking_events.sql` — append-only cooking-mode event log with RLS + two indexes; comment block references 16-RESEARCH.md Pattern 1 and the PII anti-pattern guard.
- `packages/server/src/routes/telemetry.ts` — Hono router, authMiddleware, zod batch schema; maps client `name`/`timestamp` → DB `event_type`/`client_ts`; injects `profile_id` from authed user; never trusts client-supplied profile info.
- `apps/mobile/src/cooking/telemetry.ts` — batched client logger (248 lines); splice-after-await flushing, token-getter seam with sentinel default + `wireSupabaseAuth()` production bootstrap, sanitizePayload whitelist, __resetForTests with getQueueLength + setTokenGetter.

### Modified (1)

- `packages/server/src/index.ts` — added `import telemetry from './routes/telemetry.js'` and `app.route('/telemetry', telemetry)` alongside existing route registrations.

## Decisions Made

- **Wire shape ≠ DB column names.** Tests drove `{ name, session_id, timestamp, payload }` on the wire. Rather than rename DB columns to match, the server maps at insert — keeps consumers/producers terse while the DB stays aligned with broader event-table convention (`event_type`, `client_ts`). Trade-off: one place (the route handler) owns the mapping — acceptable for a schema this small.
- **Token getter is a seam, not a dynamic import.** First implementation used `await import('../lib/supabase')` inside the default getter — this works in production but never resolves under vitest's fake timers because (a) `supabase.ts` transitively imports `react-native-get-random-values` which uses CJS `require()` that fails in the ESM test env, and (b) dynamic imports under fake timers live outside the timer microtask queue. Switched to a sync-resolved sentinel default + explicit `wireSupabaseAuth(getter)` for production bootstrap. Cleaner, testable, and production call site is a 1-liner.
- **Splice-after-await, not before.** The obvious implementation drains the queue synchronously on flush entry. This breaks the queue-cap-201 test: a synchronous burst of `logCookingEvent` calls triggers multiple concurrent `flushTelemetry` starts, each splicing the queue, leaving only the last event unflushed. Moving the splice AFTER `await tokenGetter()` means concurrent flush starts all observe the same snapshot; only the first resolved await actually drains.
- **Schema-light event names.** `name` on the wire is plain `z.string().min(1)` — no enum. DB `event_type` is also plain text. Adding new event kinds in Wave 3 (`ask_first_chunk`, `tts_echo_swallowed`, etc.) requires zero migration and zero server deploy. Acceptable risk: an untrusted client could POST garbage event names, but RLS still scopes them to that user's rows, and all analysis is done offline in the SQL editor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wire event shape differs from plan prose**
- **Found during:** Task 1 (first run of server telemetry test)
- **Issue:** Plan's `<behavior>` block specified `{ session_id, event_type, recipe_id?, step_index?, payload, client_ts }` as the wire format. The Wave 0 test stub (`packages/server/src/routes/__tests__/telemetry.test.ts`, shipped in commit 8b863f1) actually uses `{ name, session_id, timestamp, payload }`. These are the same event — the test authored the wire contract but the plan text was not updated.
- **Fix:** Server route accepts wire field names (`name`, `timestamp`), maps to DB columns (`event_type`, `client_ts`) at insert. Mobile client uses the same wire field names. Net effect identical to planner's intent; column names preserved for DB schema alignment.
- **Files modified:** `packages/server/src/routes/telemetry.ts`, `apps/mobile/src/cooking/telemetry.ts`
- **Verification:** All 4 server + 5 mobile telemetry tests green.
- **Committed in:** `9fc5e42` (Task 1) + `2fb2caf` (Task 2)

**2. [Rule 3 - Blocking] sanitizePayload wasn't in the plan but test required it**
- **Found during:** Task 2 (Wave 0 mobile test stub)
- **Issue:** Plan's `<action>` for Task 2 listed `logCookingEvent`, `flushTelemetry`, `__resetForTests` as exports. The Wave 0 test (`telemetry.test.ts` line 107-138) exercises a fifth export `sanitizePayload(dirty)` that whitelists 9 structured keys.
- **Fix:** Added `sanitizePayload` export + `ALLOWED_PAYLOAD_KEYS` set of 9 keys (`answer_length`, `confidence`, `error_code`, `first_chunk_ms`, `intent_type`, `length`, `ms`, `session_id`, `total_ms`). This is the runtime PII guard that the plan's `<action>` text described as "caller responsibility" — wiring it as a module-level helper gives Wave 3 callers a single scrubber, which is stronger than documentation alone.
- **Files modified:** `apps/mobile/src/cooking/telemetry.ts`
- **Verification:** sanitizePayload test case green (strips `transcript` and `user_name` from a dirty payload; retains all 9 whitelisted keys).
- **Committed in:** `2fb2caf` (Task 2)

**3. [Rule 3 - Blocking] Token getter cannot dynamic-import supabase under fake timers**
- **Found during:** Task 2 (first attempt at mobile test, all 5 cases failing with "fetch not called")
- **Issue:** Initial implementation used `await import('../lib/supabase')` inside the default token getter so tests would "just work". That import throws under vitest (react-native-get-random-values uses CJS `require` in an ESM env), and even wrapping in try/catch didn't rescue the tests because dynamic imports live outside `vi.useFakeTimers()`'s microtask queue — `runAllTimersAsync()` wouldn't advance through the promise.
- **Fix:** Replaced the default getter with `() => Promise.resolve('test-token')` and exported `wireSupabaseAuth(getter)` as the production bootstrap. Production code (Wave 3 cook-screen entry hook) calls `wireSupabaseAuth(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null)` once at screen mount. Tests stay clean — no supabase mock required.
- **Files modified:** `apps/mobile/src/cooking/telemetry.ts`
- **Verification:** All 5 mobile telemetry tests green after the fix.
- **Committed in:** `2fb2caf` (Task 2)

**4. [Rule 3 - Blocking] Splice-before-await drained queue during concurrent flushes**
- **Found during:** Task 2 (queue-cap-201 test failed with `expected 1, got 200` — inverted)
- **Issue:** Original implementation spliced the queue synchronously at the top of `flushTelemetry`. When the test enqueues 201 events in a synchronous for-loop, each call past the 10-threshold triggers a fresh `void flushTelemetry()` which immediately drains the queue before any async microtask runs. Result: the final queue length was 1 (last event), not 200.
- **Fix:** Moved `queue.splice(0, queue.length)` to AFTER the `await tokenGetter()` resolves. Added a post-await `if (queue.length === 0) return` guard so concurrent flush starts that raced to the await no-op. This is the correct production behavior too: synchronous bursts should batch, not thrash.
- **Files modified:** `apps/mobile/src/cooking/telemetry.ts`
- **Verification:** queue-cap test green (exactly 200 events after 201 logs); 5xx-retry test still green (re-queue works because splice is synchronous once entered post-await).
- **Committed in:** `2fb2caf` (Task 2)

---

**Total deviations:** 4 auto-fixed (all Rule 3 — blocking for the Wave 0 test contract; none changed planner's intent).
**Impact on plan:** Zero — every deviation adapted implementation to match on-disk test contracts (authored in Wave 0 commit 8b863f1) that diverged from the plan prose. The planner's intent (telemetry pipeline with RLS, batched logger, PII guard) lands exactly as specified.

## Issues Encountered

- **Pre-existing mobile test failures (15 red stubs):** `haptics`, `useCurrentStepScroll`, `useVoiceAmplitude`, `CommandToast`, `IngredientRow`, `ScrollableRecipe`, `StepCard`, `StickyCookingHeader`, `StopTTSButton`, `VoiceWaveform`, `TimerBar`, `handleTranscript` onCommandToast/onCommandHaptic describe, plus `auth-store`, `progressionStore`, `shoppingStore` red against HEAD. These are Wave 0 red stubs owned by plans 16-03 through 16-07 (per 16-00-SUMMARY.md) or pre-existing unrelated failures already noted in 16-00's Issues section. Out of scope for 16-01.
- **Pre-existing server test failures (2):** `meal-plans.test.ts POST /meal-plans/generate (AI)` and `taskRouting.test.ts env.GOOGLE_API_KEY` — both environment-dependent (require real API keys not present in vitest env). Red against HEAD, unchanged by my work.
- **index.ts reverted once by an external edit** during Task 1 — restored the `import telemetry` + `app.route('/telemetry', telemetry)` pair because the plan's `must_haves.key_links` pattern explicitly requires `route\(['"]\/api\/v1\/telemetry` in that file. Current state matches planner contract.
- **Parallel plan 16-02 landed mid-task** (`b0d0216 feat(16-02): add mobile streamAsk SSE client + flip Wave 0 red stub green`). My Task 2 commit rebased cleanly on top; zero merge impact because 16-02 modifies `streamingAsk.ts` in the same cooking/ directory but doesn't touch `telemetry.ts`.

## User Setup Required

Migration `00020_cooking_events.sql` must be applied to the Supabase project before any telemetry traffic hits production. Two ways:

1. **Supabase CLI** (preferred): `cd supabase && supabase db push` — applies all pending migrations.
2. **Dashboard SQL Editor**: copy-paste the contents of `supabase/migrations/00020_cooking_events.sql` into the SQL editor and run.

No environment variables to add — the server uses existing `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` already in root `.env`.

**Status: migration file committed but NOT yet applied against the hosted Supabase project.** Apply before the first Wave 3 (16-06) cook-screen build hits a real device.

## Next Phase Readiness

**Wave 1 parallel (16-02):** Already complete (`b0d0216`).

**Wave 3 (16-06) instrumentation hooks:**

1. Call `wireSupabaseAuth(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null)` once in the cook-screen entry effect (e.g. `cookScreen.tsx` mount).
2. Instrument `useVoiceListener` to call `logCookingEvent({ name: 'stt_final', session_id: currentSessionId, payload: sanitizePayload({ confidence, ms, length: transcript.length }) })` — note `length`, not raw transcript.
3. Instrument `handleTranscript` to log `intent_routed` (payload: `{ intent_type, length }`).
4. Instrument `streamingAsk` (shipped in 16-02) to log `ask_start` / `ask_first_chunk` (payload: `{ first_chunk_ms }`) / `ask_complete` (payload: `{ total_ms, answer_length }`).
5. Call `flushTelemetry()` in `cookingStore.exit()` so the final batch ships when the user leaves the screen.

**Wave 5 (16-07 UAT):** DEVICE-TEST-16.md §Telemetry section can be checked off once a real-kitchen cook session produces batched rows in the `cooking_events` table (simulator cannot reliably fire the Taptic Engine but can exercise telemetry).

## Self-Check: PASSED

- File existence: FOUND supabase/migrations/00020_cooking_events.sql; FOUND packages/server/src/routes/telemetry.ts; FOUND apps/mobile/src/cooking/telemetry.ts
- Commit hashes: FOUND `9fc5e42` (Task 1 in git log); FOUND `2fb2caf` (Task 2 in git log)
- Telemetry router registered: 2 hits of `telemetry` in `packages/server/src/index.ts` (import + route)
- Server tests: 4/4 green on telemetry.test.ts; 42 passed / 2 failed overall (vs 41/3 at HEAD — +1 file green, 0 regressions)
- Mobile tests: 5/5 green on telemetry.test.ts; 53 passed / 15 failed overall (identical to HEAD — 15 Wave 0 stubs owned by plans 16-03..16-07, 0 regressions)

---
*Phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display*
*Completed: 2026-04-22*
