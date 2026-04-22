---
phase: 11-hybrid-ai-client
plan: 01
subsystem: ai
tags: [ai, anthropic, google-genai, gemini, claude, adapter-pattern, task-routing]

requires:
  - phase: 03-pantry-vision
    provides: existing vision service and Anthropic singleton pattern that the new AnthropicAdapter generalizes
provides:
  - AIClient provider-agnostic interface (generateText, generateStructured, analyzeImageStructured)
  - AnthropicAdapter wrapping @anthropic-ai/sdk
  - GeminiAdapter wrapping @google/genai with MALFORMED retry + safety block handling
  - TASK_ROUTES map covering all 13 AITask variants with central GEMINI_MODELS / ANTHROPIC_MODELS config
  - getClientFor(task) factory for zero-SDK-coupling task dispatch
  - env.GOOGLE_API_KEY accessor
affects:
  - 11-02 (vision migration)
  - 11-03 (recipe import migration)
  - 11-04 (meal planner migration)
  - 11-05 (cooking/suggestions migration)

tech-stack:
  added:
    - "@google/genai ^1.49.0"
  patterns:
    - "Adapter pattern: services depend on AIClient interface, never vendor SDKs"
    - "Central model ID map in taskRouting.ts with TODO markers for *-latest aliases"
    - "MALFORMED_FUNCTION_CALL retry-once pattern for Gemini function calling"
    - "Typed error classes (MalformedFunctionCallError, GeminiSafetyBlockError) for structured failure modes"

key-files:
  created:
    - packages/server/src/ai/types.ts
    - packages/server/src/ai/taskRouting.ts
    - packages/server/src/ai/clientFactory.ts
    - packages/server/src/ai/adapters/anthropicAdapter.ts
    - packages/server/src/ai/adapters/geminiAdapter.ts
    - packages/server/src/ai/__tests__/taskRouting.test.ts
    - packages/server/src/ai/__tests__/anthropicAdapter.test.ts
    - packages/server/src/ai/__tests__/geminiAdapter.test.ts
  modified:
    - packages/server/src/config/env.ts
    - packages/server/package.json
    - packages/server/package-lock.json

key-decisions:
  - "Model IDs centralized in GEMINI_MODELS/ANTHROPIC_MODELS const maps inside taskRouting.ts with TODO for -latest alias swap"
  - "Gemini preview strings used verbatim: gemini-3.1-pro-preview, gemini-3-flash-preview, gemini-3.1-flash-lite-preview"
  - "AnthropicAdapter keeps all SDK types internal — consumers only see AIClient methods"
  - "GeminiAdapter retries ONCE on MALFORMED_FUNCTION_CALL, then throws typed MalformedFunctionCallError"
  - "BLOCK_ONLY_HIGH safety for all 4 Gemini harm categories (cooking domain mitigates false positives on knives/alcohol)"
  - "Image parts use camelCase inlineData (@google/genai v1.48+ convention), never snake_case inline_data"
  - "maxOutputTokens defaults: 1024 for generateText, 4096 for structured methods, consistent across adapters"
  - "ALL_TASKS exported array lets tests assert routing map stays exhaustive against the AITask union"

patterns-established:
  - "Adapter pattern: vendor SDKs wrapped behind AIClient; services never import @anthropic-ai/sdk or @google/genai directly"
  - "Factory pattern: getClientFor(task) is the single source of truth for task → adapter + model"
  - "Typed error hierarchy: adapters throw semantic errors (safety block, malformed call) that callers can branch on"

requirements-completed:
  - ARCH-01
  - ARCH-02

duration: 4min
completed: 2026-04-10
---

# Phase 11 Plan 01: Hybrid AI Client Scaffold Summary

**Provider-agnostic AIClient interface with Anthropic + Gemini adapters, exhaustive task→model routing map, and a factory that lets services swap providers without touching vendor SDK imports.**

## Performance

- **Duration:** ~4 min
- **Completed:** 2026-04-10
- **Tasks:** 3 (all TDD)
- **Files created:** 8
- **Files modified:** 3
- **Tests added:** 19 (all green)
- **Full server suite:** 231/231 passing

## Accomplishments

- `@google/genai ^1.49.0` installed in `packages/server` (resolved `^1.48.0` requirement to 1.49)
- AIClient interface + AITask union + JsonSchema/StructuredTool types in `ai/types.ts` — zero provider imports
- TASK_ROUTES covers all 13 AITask variants; ALL_TASKS export enables exhaustive test assertions
- Central GEMINI_MODELS / ANTHROPIC_MODELS const maps with TODO marker for future `-latest` alias promotion
- AnthropicAdapter implements all 3 AIClient methods using the existing vision.ts call shape
- GeminiAdapter implements all 3 methods with MALFORMED_FUNCTION_CALL retry, safety-block detection, and BLOCK_ONLY_HIGH safety settings
- `getClientFor(task)` factory dispatches per-task to the correct adapter + model
- 3 test files, 19 tests total — all green

## Task Commits

1. **Task 1: Install @google/genai, extend env.ts, scaffold AI module with interface + routing + factory** — `500791d` (feat)
2. **Task 2: Implement AnthropicAdapter with text/structured/image methods** — `209d01c` (feat)
3. **Task 3: Implement GeminiAdapter with MALFORMED retry and safety settings** — `209f3c7` (feat)

## Files Created/Modified

- `packages/server/src/ai/types.ts` — AIClient interface, AITask union, JsonSchema, StructuredTool, input types
- `packages/server/src/ai/taskRouting.ts` — TASK_ROUTES map + ALL_TASKS + central model config
- `packages/server/src/ai/clientFactory.ts` — getClientFor(task) dispatching to adapters
- `packages/server/src/ai/adapters/anthropicAdapter.ts` — @anthropic-ai/sdk wrapper
- `packages/server/src/ai/adapters/geminiAdapter.ts` — @google/genai wrapper + typed error classes
- `packages/server/src/ai/__tests__/taskRouting.test.ts` — factory + routing + env tests (7)
- `packages/server/src/ai/__tests__/anthropicAdapter.test.ts` — adapter unit tests (5)
- `packages/server/src/ai/__tests__/geminiAdapter.test.ts` — adapter unit tests (7, includes retry + safety block)
- `packages/server/src/config/env.ts` — added GOOGLE_API_KEY getter
- `packages/server/package.json` — added @google/genai ^1.49.0

## Decisions Made

- **Central model map with TODO aliases:** All vendor model IDs live in `GEMINI_MODELS` / `ANTHROPIC_MODELS` const maps inside `taskRouting.ts`. Preview strings (`gemini-3.1-pro-preview`, etc.) used verbatim with a TODO comment so future `-latest` alias promotion is a one-file change.
- **@google/genai resolved to 1.49.0:** Plan specified `^1.48.0`; npm picked up 1.49 which satisfies the constraint and contains the same public API used by the adapter.
- **Typed errors over generic strings:** GeminiAdapter throws `MalformedFunctionCallError` and `GeminiSafetyBlockError` so downstream service code can branch on failure mode without regex-matching message strings.
- **Exhaustive AITask routing enforced by tests:** `ALL_TASKS` array lets the routing test assert every union member has a TASK_ROUTES entry — a compile-time invariant now also guarded at runtime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `vi.fn().mockImplementation((model) => ({...}))` not a constructor**
- **Found during:** Task 1 (taskRouting.test.ts first run)
- **Issue:** The hoisted adapter mocks used arrow-function `mockImplementation`, but the factory calls `new AnthropicAdapter(...)`, which requires a constructable mock. Vitest printed a warning and TypeError.
- **Fix:** Switched `vi.fn().mockImplementation(...)` to `vi.fn(function(this, model) { this.__kind = ...; this.model = model })` so the mock is a callable constructor.
- **Files modified:** `packages/server/src/ai/__tests__/taskRouting.test.ts`
- **Verification:** `npm test -- ai/__tests__` → 19/19 green
- **Committed in:** `500791d` (part of Task 1)

**2. [Rule 1 - Bug] TS2352 conversion error on anthropicAdapter test cast**
- **Found during:** Task 2 (npx tsc --noEmit)
- **Issue:** `as { text: string }` cast on a content block whose static type is `{type:string;source?:...}` triggered TS2352 because types didn't overlap.
- **Fix:** Used `as unknown as { text: string }` double-cast pattern consistent with the rest of the codebase.
- **Files modified:** `packages/server/src/ai/__tests__/anthropicAdapter.test.ts`
- **Verification:** `npx tsc --noEmit` — no errors in `src/ai/`
- **Committed in:** `209d01c` (part of Task 2)

---

**Total deviations:** 2 auto-fixed (1 blocking mock-construction, 1 bug test typing)
**Impact on plan:** Both auto-fixes were test-only mechanics — no production code changed from plan. No scope creep.

### Deferred Items (out of scope)

- `packages/server/src/services/__tests__/suggestions.test.ts` contains pre-existing TS2345/TS2322 errors on `member_type: string` vs `'adult'|'kid'` literals. These existed before this plan, are unrelated to ai/ module, and are out of scope per deviation rules (scope boundary). Tests still run green (231/231) — TypeScript errors are test-fixture typing issues, not runtime failures.

## Issues Encountered

None — all three task verifications passed on the first or second iteration.

## Verification Results

- `cd packages/server && npm test -- ai/__tests__` — **3 files / 19 tests green**
- `cd packages/server && npm test` — **25 files / 231 tests green** (no regressions)
- `cd packages/server && npx tsc --noEmit` limited to `src/ai/` and `src/config/env.ts` — **clean** (pre-existing errors elsewhere noted above)
- `grep -rn "from '@anthropic-ai/sdk'\|from '@google/genai'" packages/server/src/services` — **zero matches** (services untouched, still use the old direct-SDK pattern as expected for this scaffold-only plan)
- `grep -n "GOOGLE_API_KEY" packages/server/src/config/env.ts` — **1 match** (one getter added)

## Authentication Gates

None — this plan only installs packages and creates scaffold; no external API calls were made. `GOOGLE_API_KEY` is already present in `.env` per plan notes, and no adapter was exercised against a live endpoint.

## User Setup Required

None — `GOOGLE_API_KEY` was already set in `.env` before this plan ran.

## Next Phase Readiness

- Wave 2 plans (11-02 through 11-05) can import `AIClient` and `getClientFor` from `packages/server/src/ai/` without any further scaffolding.
- The `TASK_ROUTES` map is the single source of truth for task → model routing. Upgrades to production Gemini aliases are a one-line change per model constant.
- All adapter failure modes (safety block, malformed function call, missing tool_use) are surfaced as typed errors; consuming services should catch and map them to HTTP status codes per phase conventions.
- The 8 existing tests in `ai/__tests__` form the regression baseline for any future adapter changes.

## Self-Check: PASSED

- All 8 created files exist on disk (verified via Write tool confirmations)
- 3 task commits present: `500791d`, `209d01c`, `209f3c7`
- Full server test suite: 231/231 green
- New module tests: 19/19 green
- No services touched (grep verification clean)

---
*Phase: 11-hybrid-ai-client*
*Completed: 2026-04-10*
