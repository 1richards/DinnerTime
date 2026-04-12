---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 1 of 7 (complete)
status: executing
stopped_at: Completed 08-01-PLAN.md
last_updated: "2026-04-12T21:22:27.112Z"
last_activity: 2026-04-12 -- Completed 08-01 shopping schema & types
progress:
  total_phases: 10
  completed_phases: 7
  total_plans: 34
  completed_plans: 28
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-07)

**Core value:** Open the fridge, take a photo, get dinner ideas -- zero mental effort from "what do we have?" to "what should we cook?"
**Current focus:** Phase 8: Shopping & Instacart

## Current Position

Phase: 8 of 10 (Shopping & Instacart) -- IN PROGRESS
Current Plan: 1 of 7 (complete)
Status: In Progress
Last activity: 2026-04-12 -- Completed 08-01 shopping schema & types

Progress: [████████░░] 82%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: --
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: --
- Trend: --

*Updated after each plan completion*
| Phase 01 P01 | 5min | 2 tasks | 38 files |
| Phase 01 P02 | 5min | 2 tasks | 18 files |
| Phase 01 P03 | 5min | 2 tasks | 2 files |
| Phase 02 P01 | 2min | 2 tasks | 5 files |
| Phase 02 P02 | 3min | 2 tasks | 6 files |
| Phase 02 P03 | 5min | 3 tasks | 13 files |
| Phase 03 P01 | 1min | 2 tasks | 7 files |
| Phase 03 P02 | 2min | 2 tasks | 5 files |
| Phase 03 P03 | 3min | 2 tasks | 4 files |
| Phase 03 P04 | 3min | 3 tasks | 10 files |
| Phase 04 P01 | 3min | 2 tasks | 3 files |
| Phase 04 P02 | 3min | 2 tasks | 4 files |
| Phase 04 P03 | 3min | 3 tasks | 6 files |
| Phase 05 P01 | 2min | 2 tasks | 4 files |
| Phase 05 P02 | 4min | 3 tasks | 4 files |
| Phase 05 P03 | 1min | 1 tasks | 2 files |
| Phase 05-recipe-import P04 | 4min | 3 tasks | 9 files |
| Phase 06-recipe-library P01 | 4min | 2 tasks | 3 files |
| Phase 06-recipe-library P03 | 3min | 2 tasks | 5 files |
| Phase 06-recipe-library P02 | 3min | 2 tasks | 6 files |
| Phase 06-recipe-library P04 | 3min | 2 tasks | 5 files |
| Phase 06-recipe-library P05 | 4min | 3 tasks | 10 files |
| Phase 07-meal-planning P01 | 4min | 2 tasks | 3 files |
| Phase 07-meal-planning P02 | 5min | 2 tasks | 2 files |
| Phase 07-meal-planning P04 | 2min | 2 tasks | 2 files |
| Phase 07-meal-planning P03 | 5min | 3 tasks | 6 files |
| Phase 07-meal-planning P05 | 3 min | 3 tasks | 6 files |
| Phase 08-shopping-instacart P01 | 1min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 10 phases at fine granularity, core thesis (photo -> suggestions) validated in phases 3-4
- Roadmap: Voice cooking uses STT -> Claude API -> TTS pipeline (no real-time voice API)
- Roadmap: Hono over Express/Fastify for backend (research recommendation)
- Roadmap: FOUN-07 (offline) deferred to Phase 10 -- offline caching layers on after core features exist
- [Phase 01]: Used hoisted node-linker for React Native/Metro bundler compatibility
- [Phase 01]: Server conditionally starts (skips in NODE_ENV=test) for clean Hono test client usage
- [Phase 01]: Profiles trigger extracts display_name from user metadata on signup
- [Phase 01]: Used vi.hoisted() for Vitest mock variables to work with vi.mock hoisting
- [Phase 01]: 3-step onboarding wizard: name, household (with kids toggle), cuisine and dietary preferences
- [Phase 01]: EAS development profile uses simulator distribution for local iOS testing
- [Phase 01]: Bundle identifier set to com.dinnertime.app
- [Phase 02]: dietary_restrictions (soft) vs dietary_allergies (hard) as separate JSONB columns per member
- [Phase 02]: 261 curated ingredients across 10 categories for dislike search with local filtering
- [Phase 02]: Optimistic Zustand updates with Supabase rollback for all preference mutations
- [Phase 02]: useDeferredValue (React 19) for ingredient search instead of manual debounce
- [Phase 02]: Dietary summary section is read-only aggregation; per-member editing in MemberFormModal
- [Phase 02]: Allergies use red chip color to visually distinguish from soft dietary preferences
- [Phase 03]: Anthropic client as lazy singleton using env getter pattern for testability
- [Phase 03]: PantryItem quantity as number (not integer) to support fractional amounts like 0.5 lb
- [Phase 03]: ScanResult type defined locally in vision.ts (server does not share types with mobile)
- [Phase 03]: Reconciliation uses select-then-insert/update pattern for clarity over Supabase upsert
- [Phase 03]: Backend API calls use fetch with Supabase auth token for scan/confirm endpoints
- [Phase 03]: Confidence decay: 7-day grace period, linear 0.05/day reduction, floor at 0.1
- [Phase 03]: Expand-to-act pattern for item Used/Gone actions instead of swipe gestures
- [Phase 04]: Replicated confidence decay logic server-side for prompt assembly (keeps server self-contained)
- [Phase 04]: Prompt separates HARD CONSTRAINTS (allergies, NEVER) from SOFT PREFERENCES (dietary restrictions)
- [Phase 04]: Empty pantry guard at <3 items returns 400 without calling Claude API
- [Phase 04]: Suggestions store follows pantryStore pattern exactly with local getApiBaseUrl and getAuthToken helpers
- [Phase 04]: autoFetch Zustand flag pattern for cross-screen post-scan navigation triggers
- [Phase 04]: Pantry item threshold of 3 before allowing suggestion fetch (matches server-side guard)
- [Phase 05]: Recipe ingredients and steps stored as JSONB arrays for schema flexibility
- [Phase 05]: parse_recipe tool requires only title, ingredients, steps -- other fields optional
- [Phase 05]: JSON-LD ingredients sent through Claude parse_recipe tool for structured parsing
- [Phase 05]: Mobile recipe store stages parsed imports in importedRecipe for user review before saveRecipe commits to server
- [Phase 05-recipe-import]: Review screen uses local draft state separate from importedRecipe store to isolate edits until save
- [Phase 05-recipe-import]: Recipe sub-routes live under app/recipes/ top-level route group, mirroring scan/ pattern
- [Phase 06-recipe-library]: [Phase 06]: Partial index on is_favorite=TRUE for favorites filtering; existing UPDATE RLS covers new column
- [Phase 06-recipe-library]: [Phase 06-03]: Optimistic update + snapshot rollback pattern for all recipe mutations (update/delete/toggleFavorite)
- [Phase 06-recipe-library]: [Phase 06-03]: formatQuantity short-circuits integer and zero before Fraction to avoid mixed-form quirks
- [Phase 06-recipe-library]: [Phase 06]: ILIKE wildcards escaped server-side via /[%_\\]/g before %-wrapping to neutralize user search injection
- [Phase 06-recipe-library]: [Phase 06]: PATCH /recipes/:id uses 10-field whitelist; unknown body keys silently dropped
- [Phase 06-recipe-library]: [Phase 06-04]: Flat DiscoveryPreferences DTO decouples recipeDiscovery service from Supabase schema (unit-testable without mocks)
- [Phase 06-recipe-library]: [Phase 06-04]: Extended ParsedRecipe.source_type union with 'ai' variant (minimum-scope for RECP-10)
- [Phase 06-recipe-library]: [Phase 06-04]: POST /discover assembles preferences inline (mirrors suggestions.ts) -- no shared loadPreferences helper
- [Phase 06-recipe-library]: [Phase 06-05]: Nested dynamic routes use [id]/index.tsx + [id]/edit.tsx folder (flat [id].tsx collides with sub-routes)
- [Phase 06-recipe-library]: [Phase 06-05]: Edit screen uses local Draft slice, commits via updateRecipe on Save
- [Phase 06-recipe-library]: [Phase 06-05]: Discover screen keeps suggestions in local component state; source_type='ai' forced at save time
- [Phase 07-meal-planning]: [Phase 07-01]: meal_plan_entries RLS uses EXISTS subquery through parent meal_plans.profile_id
- [Phase 07-meal-planning]: [Phase 07-01]: Status enum lives on meal_plan_entries only, not on parent meal_plans
- [Phase 07-meal-planning]: [Phase 07-01]: day_of_week uses 0=Monday (SMALLINT 0-6) for ISO week alignment
- [Phase 07-meal-planning]: [Phase 07-02]: Claude tool schema enforces minItems:7/maxItems:7 on days array (Pitfall 1 mitigation)
- [Phase 07-meal-planning]: [Phase 07-02]: day_of_week is string enum mon..sun at API boundary, SMALLINT 0..6 at DB via dayStringToIndex
- [Phase 07-meal-planning]: [Phase 07-02]: Regenerate flow uses delete-then-insert on meal_plans (cascades entries) not upsert
- [Phase 07-meal-planning]: [Phase 07-02]: buildMealPlanPrompt pure over MealPlanContext DTO (not DB rows) for zero-mock unit tests
- [Phase 07-meal-planning]: [Phase 07-02]: Recipe library capped at 100 and recent meals capped at 21 for prompt context budget
- [Phase 07-meal-planning]: [Phase 07-04]: EMPTY_PANTRY server error mapped to 'Add at least 3 pantry items first' at store boundary
- [Phase 07-meal-planning]: [Phase 07-04]: 409 ALREADY_COOKED retains optimistic cooked state and signals via error='already_cooked' (no rollback)
- [Phase 07-meal-planning]: [Phase 07-04]: authedFetch helper centralizes /api/v1 prefix + auth header for mealPlanStore actions
- [Phase 07-meal-planning]: [Phase 07-03]: normalizeIngredientName strips trailing 'es' then 's' so 'Tomatoes' collapses to match pantry 'tomato'
- [Phase 07-meal-planning]: [Phase 07-03]: regenerateDay re-fetches pantry/members/profile/recipes on every call (Pitfall 2) -- never trusts snapshot
- [Phase 07-meal-planning]: [Phase 07-03]: markCooked idempotency via status guard throwing Error with code=ALREADY_COOKED/status=409
- [Phase 07-meal-planning]: [Phase 07-03]: Route layer maps service error.code to HTTP (EMPTY_PANTRY->400, INVALID_PLAN_LENGTH->502, ALREADY_COOKED->409)
- [Phase 07-meal-planning]: [Phase 07-03]: mondayOf uses UTC exclusively so server timezone drift cannot shift the active week
- [Phase 07-meal-planning]: Plan tab positioned between Recipes and Pantry (browse→plan→stock flow)
- [Phase 07-meal-planning]: Native Modal over bottom-sheet library for SwapSheet/CookConfirm
- [Phase 07-meal-planning]: Client currentMondayIso uses UTC to mirror server mondayOf (zero timezone drift)
- [Phase 07-meal-planning]: Cook flow snapshots entry.ingredients_needed pre-call for pantry delta display
- [Phase 08-shopping-instacart]: [Phase 08-01]: GroceryCategory stored as TEXT with application-level enum (not Postgres ENUM) for easier evolution
- [Phase 08-shopping-instacart]: [Phase 08-01]: shopping_orders.shopping_list_id ON DELETE SET NULL preserves order history across list deletion
- [Phase 08-shopping-instacart]: [Phase 08-01]: shopping_list_items.category defaults to 'other' (not NULL) so downstream grouping never hits NULL
- [Phase 08-shopping-instacart]: [Phase 08-01]: Mobile type file omits ConsolidatedItem and InstacartLineItem (server-internal only)

### Pending Todos

None yet.

### Blockers/Concerns

- Apply for Instacart Developer Platform API access early (approval timeline unknown, needed by Phase 8)
- Claude Vision accuracy for real fridge photos needs empirical validation in Phase 3
- expo-speech-recognition is pre-1.0 -- may need Whisper fallback for Phase 9

## Session Continuity

Last session: 2026-04-12T21:22:03.937Z
Stopped at: Completed 08-01-PLAN.md
Resume file: None
