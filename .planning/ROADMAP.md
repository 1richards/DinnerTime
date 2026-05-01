# Roadmap: DinnerTime

## Milestones

- **v1.0 — Private Beta Launch Ready** — Phases 1-25 (shipped 2026-04-22). See `milestones/v1.0-ROADMAP.md`.

## Phases

<details>
<summary>v1.0 (Phases 1-25) — SHIPPED 2026-04-22</summary>

(moved to milestones/v1.0-ROADMAP.md)

</details>

### Next Milestone

Run `/gsd:new-milestone` to start v1.1.

### Phase 1: Missing-ingredient indicators on recipe ingredient lists

**Goal:** On every surface that lists a recipe's ingredients (Recipe Box detail, Discover preview, Plan day modal, Cooking mode), show which ingredients the user does not have in their pantry, and let them tap a missing ingredient to add it to the shopping list inline. Reuses the bidirectional substring + staples heuristic from `computePantryReady` and mirrors the trailing-chip pattern from `PantryItemCard.tsx`.

**Requirements**:
- Trailing `cart.badge.plus` icon on missing ingredient rows; flips to `cart.fill` (success) on add
- Coverage: PreviewSheet (Recipe Box / Discover / Plan day) + ScrollableRecipe (cooking mode)
- Match logic: case-insensitive bidirectional substring; skip `PANTRY_STAPLES`; filter pantry to `status === 'available'`
- Tap action: `useShoppingStore.addItem({ name, quantity, unit })` with optimistic UI + Alert on failure
- Tests: helper unit tests + render assertion that missing rows expose the trailing icon

**Depends on:** Phase 0
**Plans:** 1 plan

Plans:
- [ ] 01-PLAN.md — Missing-ingredient indicators (helper + PreviewSheet + ScrollableRecipe wiring + tests)
