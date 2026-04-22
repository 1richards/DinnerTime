# Phase 16 — Deferred Items

Items discovered during Phase 16 execution that were out of scope for the current plan.

## 2026-04-22 — During 16-05 execution

Four pre-existing Wave 0 red test stubs belonging to other Wave 2 plans (16-03, 16-04) are still red. These are out of scope for 16-05 per the SCOPE BOUNDARY rule (test files not directly modified by 16-05 tasks):

- `src/cooking/__tests__/useCurrentStepScroll.test.ts` — 16-04 scroll hook.
- `src/components/cooking/__tests__/ScrollableRecipe.test.tsx` — 16-04 layout primitive.
- `src/components/cooking/__tests__/StickyCookingHeader.test.tsx` — 16-04 header.
- `src/components/cooking/__tests__/TimerBar.test.tsx` (1 of 3 cases) — `bg-warning/20` chip color at `<10s` remaining not yet wired; 16-04 scope.

These four were red before 16-05 touched the tree and remain red after. They belong to 16-04 completion or a follow-up touch-up plan.

**Action:** Revisit during 16-06 cook.tsx integration or as a dedicated cleanup plan in Wave 4 (16-07/08).
