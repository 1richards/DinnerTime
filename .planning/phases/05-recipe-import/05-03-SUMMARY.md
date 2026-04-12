---
phase: 05-recipe-import
plan: 03
subsystem: mobile/state
tags: [zustand, recipe, import, store, mobile]
requires:
  - apps/mobile/src/types/recipe.ts
  - apps/mobile/src/lib/supabase.ts
  - /api/v1/recipes/import/url
  - /api/v1/recipes/import/photo
  - /api/v1/recipes/import/text
  - /api/v1/recipes
provides:
  - useRecipeStore (mobile Zustand store)
  - importFromUrl / importFromPhoto / importFromText actions
  - saveRecipe / fetchRecipes / clearImport actions
  - Duplicate detection (isDuplicate, existingRecipe)
affects:
  - apps/mobile (recipe UI will consume this store in Plan 04)
tech-stack:
  added: []
  patterns:
    - "Zustand store mirroring suggestionsStore pattern (local getApiBaseUrl/getAuthToken helpers)"
    - "try/catch error state, no throwing from actions"
    - "Parsed recipe staged in importedRecipe for review before saveRecipe commits"
key-files:
  created:
    - apps/mobile/src/stores/recipeStore.ts
    - apps/mobile/src/stores/__tests__/recipeStore.test.ts
  modified: []
decisions:
  - "Import actions clear previous importedRecipe and duplicate state on start to prevent stale review UI"
  - "saveRecipe prepends the saved Recipe to recipes list (optimistic ordering by recency)"
  - "Duplicate detection exposes both isDuplicate boolean and existingRecipe for UI to offer 'view existing' action"
metrics:
  duration: 1min
  tasks: 1
  files: 2
  tests: 11
  completed: 2026-04-10
requirements: [RECP-01, RECP-02, RECP-03, RECP-04, RECP-05]
---

# Phase 05 Plan 03: Recipe Store Summary

Mobile Zustand recipe store mediating URL/photo/text imports, save, and fetch against Plan 02's server API, with duplicate detection and parsed-recipe review staging.

## What Was Built

`useRecipeStore` with seven-field state (`recipes`, `isLoading`, `isImporting`, `error`, `importedRecipe`, `isDuplicate`, `existingRecipe`) and six actions:

- `importFromUrl(url)` — POSTs to `/api/v1/recipes/import/url`, stages `ParsedRecipe` in `importedRecipe`, surfaces duplicate flag and existing recipe when server detects a match.
- `importFromPhoto(base64)` — POSTs to `/api/v1/recipes/import/photo`, stages result.
- `importFromText(text)` — POSTs to `/api/v1/recipes/import/text`, stages result.
- `saveRecipe(recipe)` — POSTs reviewed `ParsedRecipe` to `/api/v1/recipes`, prepends returned `Recipe` to `recipes`, clears staging state.
- `fetchRecipes()` — GETs `/api/v1/recipes`, populates `recipes` list.
- `clearImport()` — Resets staging and duplicate state.

All actions use the suggestionsStore pattern: local `getApiBaseUrl()` and `getAuthToken()` helpers, Bearer auth on every call, try/catch that sets `error` state instead of throwing.

## Verification

- 11/11 unit tests pass (`npx vitest run src/stores/__tests__/recipeStore.test.ts`)
- Tests cover: URL import success, duplicate detection, URL API failure, auth failure, photo import, text import, saveRecipe success, saveRecipe failure, fetchRecipes success, fetchRecipes failure, clearImport reset

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `2fbb79c` test(05-03): add failing tests for recipe store
- `177b2f4` feat(05-03): implement recipe store with import, save, fetch actions

## Self-Check: PASSED

- FOUND: apps/mobile/src/stores/recipeStore.ts (257 lines)
- FOUND: apps/mobile/src/stores/__tests__/recipeStore.test.ts (286 lines)
- FOUND: commit 2fbb79c
- FOUND: commit 177b2f4
