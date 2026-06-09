---
phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions
plan: 01
subsystem: recipes-server
tags: [image-caching, performance, supabase, write-back]
requires: []
provides:
  - "POST /generate-image persists resolved hero URL to recipes.image_url scoped to the owning user"
affects:
  - packages/server/src/routes/recipes.ts
  - apps/mobile (RecipeCard skip=true once image_url is set — no code change here, downstream effect)
tech-stack:
  added: []
  patterns:
    - "supabaseAdmin (service-role) write with .eq('profile_id', user.id) as the authoritative ownership guard mirroring RLS"
    - "Chain-capturing supabaseAdmin vi.mock for asserting update().eq().eq() in route tests"
key-files:
  created:
    - packages/server/src/routes/__tests__/recipes.generate-image.test.ts
  modified:
    - packages/server/src/routes/recipes.ts
decisions:
  - "[27-01] Reused the existing supabaseAdmin import + c.get('user') binding (same as /search, /discover) — no new migration, the UPDATE RLS policy from 00004_recipes.sql already exists"
  - "[27-01] null url or absent recipeId => no DB write, keeping unsaved 'Something New' previews AsyncStorage-only and never clobbering an existing image on a model safety block"
metrics:
  duration: 2min
  completed: 2026-06-09
---

# Phase 27 Plan 01: Persist Generated Hero Image URL Summary

Generated hero images are now durable: `POST /generate-image` accepts an optional `recipeId` and writes the resolved URL back to `recipes.image_url` (scoped to the authed user), so a saved recipe never re-fires generation on a later cold start, new device, or AsyncStorage clear. This is Decision 1 (Image P0) — the dominant root cause in the image-caching debug doc.

## What Changed

### Task 1 — Extend POST /generate-image to write image_url back (commit 16cbab1)
- Added optional `recipeId?: string | null` to the handler's `body` type.
- After `generateRecipeImage(...)` resolves and before the `return c.json({ url })`, added a guarded write-back: when both `recipeId` and `url` are non-empty strings, `supabaseAdmin.from('recipes').update({ image_url: url }).eq('id', body.recipeId).eq('profile_id', user.id)`.
- `supabaseAdmin` bypasses RLS, so the `.eq('profile_id', user.id)` clause is the authoritative ownership guard (mirrors the `00004_recipes.sql` "Users can update own recipes" policy). A cross-profile recipeId matches zero rows — no error, no leak.
- Title/ingredient validation and the `generateRecipeImage(...)` call are unchanged. No migration added.

### Task 2 — Test coverage (commit 7d6398a)
- New `packages/server/src/routes/__tests__/recipes.generate-image.test.ts` with 5 cases:
  1. recipeId + resolved url → asserts `.from('recipes').update({ image_url }).eq('id', recipeId).eq('profile_id', 'user-1')` and `{ url }` returned.
  2. No recipeId → asserts NO `update()` call, `{ url }` returned.
  3. Stubbed null url with recipeId present → asserts NO `update()` call (don't clobber), `{ url: null }` returned.
  4. Ownership: cross-profile recipeId + forged body `profile_id` → asserts the guard value is the authed `user-1`, never the body's `attacker-user`.
  5. Missing/empty title → 400 unchanged, no image gen, no write.
- Mock shape follows `recipes.patch.test.ts` / `recipes.search.test.ts`: `authMiddleware` injects `c.set('user', { id: 'user-1' })`, `supabaseAdmin` is a chain-capturing `vi.mock`, `generateRecipeImage` is stubbed to a controllable url.

## Verification

- `pnpm vitest run src/routes/__tests__/recipes.generate-image.test.ts` → 5 passed.
- No regression: `recipes.search.test.ts` + `recipes.discover.test.ts` + `recipeDiscovery.test.ts` → 29 passed.
- grep confirms `update({ image_url` lives in the /generate-image handler (line 588) with `.eq('profile_id', user.id)` guard (line 590), and `recipeId` in the body type (line 547).
- No new file under `supabase/migrations/` (0 new files).

## Deviations from Plan

None — plan executed exactly as written.

## Deferred / Out-of-scope Issues

- `npx tsc --noEmit` surfaces ~60 pre-existing `c.get('user')` / `c.set(...)` Hono-context typing errors across `recipes.ts` (and other route files) because the Hono `Context` type is not augmented with the app's `user`/`supabase` variables. These predate this plan, are present on dozens of existing lines, and the dev/build path runs via `tsx` (not strict `tsc`). My new code uses the identical, already-pervasive `const user = c.get('user')` pattern, so it adds no new error category. Logged as pre-existing; not fixed here.

## Self-Check: PASSED
- FOUND: packages/server/src/routes/recipes.ts (modified, contains `update({ image_url`)
- FOUND: packages/server/src/routes/__tests__/recipes.generate-image.test.ts
- FOUND commit: 16cbab1 (feat handler)
- FOUND commit: 7d6398a (test coverage)
