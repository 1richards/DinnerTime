---
phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display
plan: 02
subsystem: api
tags: [sse, streaming, hono, anthropic-sdk, async-generator, react-native-fetch, cooking-mode, claude-sonnet-4]

# Dependency graph
requires:
  - phase: 16-00
    provides: streamingAsk.test.ts red stub + sse-response fixtures + cooking.test.ts SSE describe block
  - phase: 11-hybrid-ai-client
    provides: AIClient interface + AnthropicAdapter + getClientFor factory
  - phase: 09-voice-cooking-mode
    provides: askAssistant.ts (preserved as fallback) + cooking.voiceAsk task route
provides:
  - Server POST /api/v1/cooking/ask-stream endpoint emitting SSE delta/done/error frames
  - AIClient.generateStream optional AsyncIterable<string> contract
  - AnthropicAdapter.generateStream bridging messages.stream().on('text') to an async generator via a drain queue
  - apps/mobile/src/cooking/streamingAsk.ts — RN fetch ReadableStream + TextDecoder SSE parser with documented error codes (NO_AUTH, HTTP_<status>, NO_STREAM_BODY, STREAM_ERROR, CLAUDE_ERROR)
  - Pitfall 1 fallback signal (NO_STREAM_BODY) so the Wave 3 caller can degrade to askAssistant()
  - Pitfall 2 guard (no tools on streaming path) documented in route + adapter comments
affects: [16-06, 16-07]

# Tech tracking
tech-stack:
  added: []  # hono/streaming already present; Anthropic SDK already supports messages.stream
  patterns:
    - "Async-generator bridge over event-emitter SDK: Anthropic .on('text') + .on('error') + .on('end') drained into a queue behind an async generator so consumers see a plain AsyncIterable"
    - "Optional AIClient capabilities via `generateStream?(...)` — route handlers feature-detect with `typeof ai.generateStream === 'function'` and emit CLAUDE_ERROR when unavailable (Gemini adapter falls through)"
    - "SSE wire format pinned in fixtures + route: `event: <name>\\ndata: <payload>\\n\\n` — parsed by a shared \\n\\n chunk buffer on mobile (Pattern 6 from 16-RESEARCH.md)"
    - "Documented error-code taxonomy for streaming client: NO_AUTH / HTTP_<status> / NO_STREAM_BODY / STREAM_ERROR / <server-code> — caller dispatches fallback on the first three, surfaces the last as a user error"

key-files:
  created:
    - "apps/mobile/src/cooking/streamingAsk.ts"
  modified:
    - "packages/server/src/ai/types.ts"
    - "packages/server/src/ai/adapters/anthropicAdapter.ts"
    - "packages/server/src/routes/cooking.ts"
    - "apps/mobile/src/cooking/__tests__/streamingAsk.test.ts"

key-decisions:
  - "Kept streaming inside the AIClient abstraction rather than escaping to the raw Anthropic SDK — the test already mocked `generateStream` on the AIClient so adding it as an optional interface method was the lowest-friction path and avoids a documented Phase 11 tech-debt divergence. The plan's escape-hatch option (getAnthropicClient direct) was explicitly rejected because it would create two Claude-calling paths in the codebase."
  - "Async-generator bridge over Anthropic's event emitter: rather than expose vendor types, we drain `.on('text')` events into a FIFO queue and yield them from an async generator. Gives the route handler a plain `for await (const chunk of iter)` loop and keeps zero Anthropic imports in cooking.ts."
  - "Mobile signature uses an options bag + callbacks bag — `streamAsk({ baseUrl, accessToken, recipeId, currentStepIndex, question }, { onChunk, onDone, onError })` — matching the Wave 0 test contract rather than the plan's positional form. Caller (16-06 cook.tsx) will inject baseUrl and accessToken so the module stays pure / testable."
  - "Removed `@ts-expect-error` red-stub comment from streamingAsk.test.ts once the module landed — leaving it would have triggered `TS2578: Unused @ts-expect-error directive` and obscured real regressions."
  - "Pitfall 1 handling: `res.body === null` fires `onError('NO_STREAM_BODY')` as a fallback signal rather than attempting a react-native-sse polyfill in this plan. The caller (cook.tsx in Wave 3) detects that code and falls through to askAssistant(). sse-smoke.ts on a physical iPhone is the Wave 0 gate for confirming RN 0.83 actually exposes res.body before 16-06 wires the happy path."

patterns-established:
  - "Optional AIClient capability interface: methods may be declared `method?(...)` on AIClient and feature-detected at call sites. Sets precedent for future streaming/batched/realtime capabilities without forcing every adapter to no-op."
  - "SSE route pattern for Hono+AIClient: `streamSSE(c, async (stream) => { try { for await const chunk of ai.generateStream(...) await stream.writeSSE(delta) } catch await stream.writeSSE(error) })` — reusable for any future streaming endpoint."
  - "Mobile SSE client pattern: fetch POST → feature-detect `res.body` → `getReader()` + `TextDecoder` + `\\n\\n` buffer loop → dispatch on `event:` field. Reusable if we later stream suggestions, meal-plan generation, etc."

requirements-completed: [COOK-UX-01]

# Metrics
duration: 5min
completed: 2026-04-22
---

# Phase 16 Plan 02: Streaming /cooking/ask via SSE Summary

**Server `/api/v1/cooking/ask-stream` SSE endpoint + mobile `streamAsk` client wired end-to-end — unlocks <1.5s p95 TTS-first-word latency for Wave 3, preserves Claude Sonnet 4 brevity (max_tokens: 300), and keeps the non-streaming `/cooking/ask` path intact as the Pitfall-1 fallback.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T04:03:22Z
- **Completed:** 2026-04-22T04:08:20Z
- **Tasks:** 2 (both TDD)
- **Files created/modified:** 5 (1 new, 4 modified)

## Accomplishments

- **Server `/cooking/ask-stream` SSE endpoint** shipped in `packages/server/src/routes/cooking.ts`. Handles auth (401), body validation (400), recipe ownership check (404), and streams `event: delta` frames for each text chunk followed by `event: done` with the (300-char-truncated) full answer, or `event: error` with `CLAUDE_ERROR` on any adapter failure. The non-streaming `/ask` and `/tips` routes are untouched.
- **AIClient.generateStream** added as an optional AsyncIterable method on the provider-agnostic interface. The Anthropic adapter implements it via an event-emitter-to-async-generator bridge; Gemini adapter intentionally does not — the route feature-detects and emits `CLAUDE_ERROR` when the current task route points at a non-streaming provider.
- **Mobile `streamAsk`** shipped in `apps/mobile/src/cooking/streamingAsk.ts`. Accepts an options bag (baseUrl, accessToken, recipeId, currentStepIndex, question) + callbacks bag (onChunk, onDone, onError) matching the Wave 0 test contract. Parses SSE via `res.body.getReader()` + `TextDecoder` + `\n\n` message buffering. Surfaces a documented error-code taxonomy (`NO_AUTH`, `HTTP_<status>`, `NO_STREAM_BODY`, `STREAM_ERROR`, plus server-emitted codes like `CLAUDE_ERROR`).
- **Wave 0 red stubs flipped green:** `streamingAsk.test.ts` (3/3) and `cooking.test.ts` "POST /cooking/ask-stream (Phase 16 SSE)" (3/3) both pass. Total server cooking route suite: 18/18. Total mobile cooking unit suites affected by this plan: streamingAsk 3/3, cookingStore 26/26, intentRouter 22/22 (no regressions).
- **Pitfall 1 fallback path preserved:** `askAssistant.ts` remains untouched. `streamAsk` emits `NO_STREAM_BODY` when `res.body === null` (RN 0.83 failure mode) so `cook.tsx` in 16-06 can degrade gracefully to the non-streaming endpoint without a second rebuild. `sse-smoke.ts` (Wave 0) still needs to be run on a physical iPhone as the 16-06 prerequisite.
- **Pitfall 2 guard** documented in both the route comment and the adapter method JSDoc — "no tools on streaming path; switch to raw contentBlock events if ever needed."

## Task Commits

1. **Task 1: Server `/cooking/ask-stream` SSE endpoint + AIClient.generateStream** — `71bf6c8` (feat)
2. **Task 2: Mobile streamAsk SSE client + flip Wave 0 red stub green** — `b0d0216` (feat)

## Files Created/Modified

### Created (1)
- `apps/mobile/src/cooking/streamingAsk.ts` — SSE client with options/callbacks bag signature, TextDecoder + `\n\n` buffer parser, documented error-code taxonomy, Pitfall 1 NO_STREAM_BODY fallback signal

### Modified (4)
- `packages/server/src/ai/types.ts` — added optional `generateStream?(input: GenerateTextInput): AsyncIterable<string>` to AIClient interface with JSDoc on Pitfall 2 and adapter-support feature detection
- `packages/server/src/ai/adapters/anthropicAdapter.ts` — implemented `generateStream` via Anthropic SDK `messages.stream(...)` event emitter bridged to an async generator through a queue + `resolveNext` promise (decouples consumer backpressure from Anthropic timing)
- `packages/server/src/routes/cooking.ts` — added `import { streamSSE } from 'hono/streaming'` and the `POST /ask-stream` handler (auth, validation, recipe load, SSE streaming, 300-char truncation, CLAUDE_ERROR path); no changes to existing `/ask` or `/tips`
- `apps/mobile/src/cooking/__tests__/streamingAsk.test.ts` — removed obsolete `@ts-expect-error` red-stub directive and comment (the directive became "Unused" once the module shipped and was blocking the TS check)

## Decisions Made

- **Stay inside the AIClient abstraction** rather than escape to the raw Anthropic SDK for streaming. The Wave 0 test already mocked `generateStream` on the AIClient, making the interface-first approach the path of least friction. The plan's escape-hatch alternative would have fragmented Claude calls across two paths and created Phase 11 tech debt. Gemini streaming can be added when/if the task route changes.
- **Async-generator bridge pattern for Anthropic streaming.** The Anthropic SDK exposes `.messages.stream()` as an event emitter (`.on('text', ...)`). Rather than leak that shape, we drain events into a FIFO queue and expose a plain `AsyncIterable<string>` — route handlers see only standard JS iteration.
- **Mobile call-site signature uses options bag + callbacks bag.** The Wave 0 test shipped a specific contract (`streamAsk({...opts}, {...callbacks})`) and the plan's positional form was wrong. Using the test's contract is correct per TDD.
- **Pitfall 1 (RN 0.83 ReadableStream uncertainty) handled via error code, not polyfill.** `NO_STREAM_BODY` is the fallback signal; the caller in 16-06 degrades to `askAssistant()`. Adding `react-native-sse` was considered and deferred — sse-smoke.ts on-device is the gate for whether we ever need it.
- **`generateStream` is optional on AIClient.** Forcing every adapter to implement streaming would add no-op bloat to Gemini. Feature detection (`typeof ai.generateStream === 'function'`) is cleaner and documents the capability gap.

## Deviations from Plan

### Plan-contract adjustments (not auto-fixes — these align with Wave 0 tests that supersede the plan prose)

**1. Mobile streamAsk signature uses options+callbacks bags, not the plan's 6-arg positional form.**
- **Rationale:** The Wave 0 red stub `streamingAsk.test.ts` was written with the options-bag contract (`streamAsk({ baseUrl, accessToken, recipeId, currentStepIndex, question }, { onChunk, onDone, onError })`). Plan 16-02 text proposed `streamAsk(recipeId, currentStepIndex, question, onChunk, onDone, onError)`. Tests supersede plan prose per TDD.
- **Effect:** Cleaner call site (dependency injection of baseUrl/accessToken) and easier to mock. Caller in 16-06 will wire from `supabase.auth.getSession()` and `process.env.EXPO_PUBLIC_API_URL`.
- **Telemetry integration:** The plan's sessionId + telemetry hooks (`logCookingEvent`) are deferred to plan 16-06 where the full cook-screen integration lives. The streamAsk module itself stays pure — no store/telemetry imports — which makes it trivially testable and lets 16-06 wrap it with telemetry there rather than inline.

**2. Kept AIClient abstraction for streaming instead of escaping to raw Anthropic SDK.**
- **Rationale:** Plan text allowed "escape to getAnthropicClient() if AIClient doesn't expose .stream()". But the Wave 0 cooking.test.ts explicitly mocks `generateStream` on the AIClient factory return value, so adding it as an optional AIClient method was the correct path. No escape hatch needed.
- **Effect:** Single Claude-calling pathway in the codebase. Gemini streaming remains unimplemented but feature-detected.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript "Unused @ts-expect-error" on streamingAsk.test.ts**
- **Found during:** Task 2 post-implementation `npx tsc --noEmit`
- **Issue:** The Wave 0 stub used `@ts-expect-error` above `import { streamAsk } from '../streamingAsk'` because the module didn't exist. Once Task 2 shipped the module, the directive became "unused" (TS2578) which breaks the clean TypeScript check and obscures real regressions.
- **Fix:** Removed the directive and updated the test-file header comment from "Red test stub" to "Contract tests for the SSE streaming client" (keeps the Wave 0 provenance clear without lying about its current state).
- **Files modified:** `apps/mobile/src/cooking/__tests__/streamingAsk.test.ts`
- **Verification:** `pnpm test --run src/cooking/__tests__/streamingAsk.test.ts` → 3/3 green; `npx tsc --noEmit` no longer reports TS2578 on this file.
- **Committed in:** `b0d0216` (Task 2)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking) + 2 plan-vs-test-contract adjustments (TDD precedence).
**Impact on plan:** Zero scope change. The 2 contract adjustments tighten the deliverable to match the test suite (correctness), and the 1 Rule 3 auto-fix is a mechanical cleanup.

## Issues Encountered

- **Pre-existing test failures out of scope:** `packages/server/src/ai/__tests__/taskRouting.test.ts` (1 failure on `env.GOOGLE_API_KEY throws when unset`) and `packages/server/__tests__/meal-plans.test.ts` (1 failure on 7-day meal plan generation) are red at HEAD independent of this plan. Verified by stashing my changes and rerunning — both failures persist. Logged mentally for a future phase; not fixed here per Rule-1 scope boundary.
- **Pre-existing TypeScript errors in unrelated files:** `suggestions.test.ts` (member_type literal vs string) and `recipeParser.ts` (recipe source 'ai' vs literal union) are pre-existing and unrelated. Not touched.
- **Other Phase 16 Wave 0 red stubs still red on the mobile side:** `haptics.test.ts`, `telemetry.test.ts`, `useCurrentStepScroll.test.ts`, `useVoiceAmplitude.test.ts`, and 4 cases in `handleTranscript.test.ts` all remain red. These belong to plans 16-03, 16-04, and 16-06 running in Waves 2–3 — they are intentionally red at this point per the Nyquist scaffolding in 16-00 and out of scope for 16-02.

## SSE Smoke Script Status

`apps/mobile/src/cooking/sse-smoke.ts` (shipped in 16-00) remains the on-device Wave 0 gate and **has not yet been run against a live dev server in this plan**. It is a prerequisite for 16-06 — once Wave 1 plans 16-01 and 16-02 are both complete (this plan finishes 16-02), Wave 3 should:
1. Start the server with `cd packages/server && pnpm dev`.
2. On a physical iPhone or simulator running the dev client, invoke `sse-smoke.ts` and verify it receives delta/done frames without hitting the NO_STREAM_BODY fallback.
3. If NO_STREAM_BODY fires on-device, wire a `react-native-sse` polyfill in 16-06 before enabling the happy path.

This is tracked in DEVICE-TEST-16.md §Latency (COOK-UX-01).

## User Setup Required

None — no external services added. The existing `ANTHROPIC_API_KEY` in the server `.env` is the only credential the streaming path needs, and it is already configured from Phase 09.

## Next Phase Readiness

**Wave 1 is complete once 16-01 (telemetry) also lands.** That plan is executing in parallel and its files (`packages/server/src/routes/telemetry.ts`, `supabase/migrations/00020_cooking_events.sql`, `packages/server/src/index.ts` route registration) are already untracked/modified in the tree but belong to that plan's commits, not this one.

**Wave 2 (16-03 TimerBar retoken) can start** — it has no dependency on this plan.

**Wave 3 (16-04, 16-05, 16-06, 16-07) can start after Wave 2 closes:**
- 16-06 (cook.tsx scrollable rewrite + Ask wiring) will consume both `streamAsk` (this plan) and the telemetry batcher (16-01). The cook screen will:
  1. Resolve `baseUrl` (via `getApiBaseUrl()`) and `accessToken` (via `supabase.auth.getSession()`).
  2. Call `streamAsk({...}, { onChunk, onDone, onError })` with a sentence-chunker that fires `Speech.speak(sentence)` on each sentence boundary (periods, question marks, exclamation marks).
  3. On `onError('NO_STREAM_BODY')` or `onError('NO_AUTH')`, fall back to `askAssistant()` transparently.
  4. On `onError('CLAUDE_ERROR')` or any other server-emitted code, surface a user-visible error toast.
  5. Wrap the above with `logCookingEvent({ event_type: 'ask_start' | 'ask_first_chunk' | 'ask_complete', ... })` from the 16-01 telemetry module.

## Self-Check: PASSED

- **File existence:**
  - `apps/mobile/src/cooking/streamingAsk.ts` — FOUND (185 lines)
  - `packages/server/src/routes/cooking.ts` contains `ask-stream` and `streamSSE` — FOUND
  - `packages/server/src/ai/types.ts` contains `generateStream?` — FOUND
  - `packages/server/src/ai/adapters/anthropicAdapter.ts` contains `generateStream` — FOUND
- **Commit hashes in git log:**
  - `71bf6c8` (Task 1) — FOUND via `git log --oneline -5`
  - `b0d0216` (Task 2) — FOUND via `git log --oneline -5`
- **Plan verification command results:**
  - `pnpm test --run src/routes/__tests__/cooking.test.ts` (server) — 18/18 PASSED
  - `pnpm test --run src/cooking/__tests__/streamingAsk.test.ts` (mobile) — 3/3 PASSED
  - `pnpm test --run src/cooking/__tests__/telemetry.test.ts` (mobile) — still red (belongs to 16-01, out of scope)
  - cookingStore 26/26, intentRouter 22/22 — no regressions
- **TypeScript:** `npx tsc --noEmit` on mobile no longer reports the `TS2578 Unused @ts-expect-error` for streamingAsk.test.ts. Pre-existing errors in unrelated files (suggestions, recipeParser) remain and are out of scope.

---
*Phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display*
*Plan: 02 — Streaming /cooking/ask via SSE*
*Completed: 2026-04-22*
