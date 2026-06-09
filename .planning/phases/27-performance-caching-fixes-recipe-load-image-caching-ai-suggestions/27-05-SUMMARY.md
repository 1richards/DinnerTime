---
phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions
plan: 05
subsystem: performance
tags: [ai, anthropic, gemini, caching, prompt-cache, latency, hono]

# Dependency graph
requires:
  - phase: 11-hybrid-ai-client
    provides: AnthropicAdapter.generateStructured + GeminiAdapter.callStructured (AIClient abstraction)
  - phase: 27-04
    provides: GeminiAdapter MALFORMED_FUNCTION_CALL retry warn (must be preserved)
provides:
  - Anthropic prompt caching (cache_control ephemeral) on the static discovery system prefix + tool schema
  - Documented Gemini context-cache threshold guard explaining cachedContent omission (traceable for future revisit)
affects: [performance, ai-suggestions, recipe-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anthropic prompt caching: system passed as a text content-block array with cache_control: ephemeral; tool schema marked as a second cache breakpoint; variable user prompt left uncached"
    - "Documented no-op guard comment for an optimization deliberately omitted (Gemini context-cache), with debug-doc reference so a future patch can revisit"

key-files:
  created: []
  modified:
    - packages/server/src/ai/adapters/anthropicAdapter.ts
    - packages/server/src/ai/adapters/geminiAdapter.ts

key-decisions:
  - "Anthropic system string converted to a [{ type:'text', text, cache_control:ephemeral }] block; SDK 0.88.0 accepts cache_control natively (no `as any` needed)"
  - "Optional i.system coalesced to '' for the text-block string requirement (an absent system was already an empty prefix)"
  - "Gemini path took the documented-guard option (b), not cachedContent (a): @google/genai exposes ai.caches.create, but the discovery prefix may not clear Gemini's context-cache min-token floor, and the named-cache TTL lifecycle adds operational surface for a marginal, unverified win — flagged for live-token-count revisit"

patterns-established:
  - "Prompt-cache breakpoints at system + tool schema for any large static AIClient structured call"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-06-08
---

# Phase 27 Plan 05: Prompt Caching (Anthropic cache_control + Gemini threshold guard) Summary

**Anthropic `cache_control: ephemeral` now marks the static discovery system prompt + tool schema so the near-static prefix is cached server-side per call, while the Gemini path carries a documented threshold guard explaining why `cachedContent` is deliberately omitted (the prefix may not clear Gemini's context-cache min-token floor) — the 27-04 MALFORMED_FUNCTION_CALL retry warn is intact.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-09T04:43:09Z
- **Completed:** 2026-06-09T04:45:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `anthropicAdapter.ts generateStructured` (Decision 6 / Fix 3): `system` is now a `[{ type:'text', text:i.system ?? '', cache_control:{ type:'ephemeral' } }]` content block, and the tools array's single tool is marked with `cache_control: ephemeral` as a cache breakpoint. Anthropic caches the longest matching prefix ending at a breakpoint, so both the static system text and the tool schema are cached; the variable user prompt (`i.user`) stays uncached. SDK 0.88.0 accepts `cache_control` on these positions natively — no `as any` cast needed.
- `geminiAdapter.ts callStructured` (Decision 6 / Fix 3, Gemini): added a traceable guard comment explaining that explicit context-cache (`caches.create → cachedContent`) is NOT applied. The `@google/genai` client does expose `ai.caches.create`, but the static discovery prefix may not clear Gemini's context-cache minimum-token floor and the TTL'd named-cache lifecycle adds operational surface for a marginal, unverified win on the "Something New" hot path. Anthropic prompt caching (Task 1) covers the Claude path; the comment references `perf-ai-suggestions-latency.md` Fix 3 for a live-token-count revisit. The 27-04 retry warn was preserved verbatim.

## Task Commits

Each task was committed atomically to `main` (normal `git commit`, no `--no-verify`):

1. **Task 1: Apply Anthropic cache_control: ephemeral to static system prompt + tool schema** - `2bfd3f3` (feat)
2. **Task 2: Document Gemini context-cache threshold guard (cachedContent omitted)** - `77fbb10` (feat)

## Files Created/Modified
- `packages/server/src/ai/adapters/anthropicAdapter.ts` - `generateStructured`: system → cache_control text-block; tool schema marked as cache breakpoint; optional system coalesced to `''`. Other methods (generateText, generateStream, analyzeImage(s)Structured) unchanged.
- `packages/server/src/ai/adapters/geminiAdapter.ts` - documented threshold-guard comment in `callStructured` config block; systemInstruction + tools still sent inline; 27-04 MALFORMED_FUNCTION_CALL retry warn untouched.

## Decisions Made
- **Anthropic cast not needed:** the installed SDK (0.88.0, >= the ~0.82 floor in CLAUDE.md) accepts `cache_control` on system text-blocks and tools directly. The only type friction was `i.system` being `string | undefined` vs the text-block `text: string` requirement, resolved by `?? ''` (an absent system was already an empty prefix).
- **Gemini path (b) over (a):** the plan offered cachedContent (a) or a documented guard (b). Chose (b) because the prefix-clears-the-floor precondition is unverified in this phase (no live run) and the named-cache TTL lifecycle is real operational surface for a marginal win on a path where the bigger lever (server response cache + coalescing) lands in 27-03. The guard keeps the decision traceable so a future patch can flip to (a) once live token counts confirm payoff.

## Deviations from Plan

None - plan executed exactly as written. (The plan pre-authorized the `?? ''` / minimal handling for the SDK's optional-system typing and the choice between Gemini paths (a)/(b); both followed the plan's guidance.)

## Issues Encountered
- Full `pnpm vitest run` continues to show the pre-existing `connect ECONNREFUSED 127.0.0.1:3000` integration/route failures (no live server on :3000 this session) and the untyped-Hono-context tsc errors in route files. Both are the documented environment baseline, NOT regressions from this plan. The suites this plan touches are green: `src/ai` adapter suites (29 passed) and `recipeDiscovery.test.ts` (16 passed). `npx tsc --noEmit` reports no new errors in either adapter.

## User Setup Required
None - no external service configuration required. Prompt caching is provider-side and automatic; payoff requires the static prefix to clear Anthropic's ~1024-token cache minimum (verify against live token counts — flagged, no live run this phase).

## Next Phase Readiness
- 27-05 is the last incomplete plan in Phase 27. All five plans (27-01..27-05) now have summaries.
- Future revisit hook: if live token counts show the Gemini discovery prefix clears the context-cache floor, swap the geminiAdapter guard for `caches.create` + `cachedContent` (path a), guarded by try/catch falling back to the current inline path.

## Self-Check: PASSED

---
*Phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions*
*Completed: 2026-06-08*
