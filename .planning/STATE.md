---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 1 of 5
status: executing
stopped_at: Completed 10-02-PLAN.md
last_updated: "2026-04-13T04:39:32.419Z"
last_activity: 2026-04-10 -- Completed 10-02 progression service + routes (SKIL-01, SKIL-02, SKIL-04)
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 44
  completed_plans: 43
  percent: 98
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-07)

**Core value:** Open the fridge, take a photo, get dinner ideas -- zero mental effort from "what do we have?" to "what should we cook?"
**Current focus:** Phase 10: Skill Progression & Offline

## Current Position

Phase: 10 of 10 (Skill Progression & Offline) -- IN PROGRESS
Current Plan: 1 of 5
Status: In Progress
Last activity: 2026-04-10 -- Completed 10-02 progression service + routes (SKIL-01, SKIL-02, SKIL-04)

Progress: [██████████] 98%

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
| Phase 08-shopping-instacart P04 | 2min | 2 tasks | 2 files |
| Phase 08-shopping-instacart P02 | 4min | 2 tasks | 2 files |
| Phase 08-shopping-instacart P03 | 3min | 2 tasks | 2 files |
| Phase 08-shopping-instacart P05 | 6min | 2 tasks | 2 files |
| Phase 08-shopping-instacart P06 | 6min | 2 tasks | 2 files |
| Phase 08-shopping-instacart P07 | 3min | 3 tasks | 8 files |
| Phase 09-voice-cooking-mode P01 | 3min | 2 tasks | 5 files |
| Phase 09-voice-cooking-mode P02 | 3min | 1 tasks | 5 files |
| Phase 09-voice-cooking-mode P03 | 2min | 1 tasks | 3 files |
| Phase 09-voice-cooking-mode P04 | 4min | 3 tasks | 7 files |
| Phase 09-voice-cooking-mode P05 | 4min | 3 tasks | 11 files |
| Phase 10-skill-progression-offline P01 | 2 min | 2 tasks | 6 files |
| Phase 10-skill-progression-offline P03 | 2 min | 2 tasks | 5 files |
| Phase 10-skill-progression-offline P04 | 4min | 2 tasks | 11 files |
| Phase 10-skill-progression-offline P02 | 5min | 2 tasks | 6 files |

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
- [Phase 08-shopping-instacart]: [Phase 08-04]: getInstacartClient factory reads INSTACART_API_KEY at call-time (not module-load) so vi.stubEnv works in tests
- [Phase 08-shopping-instacart]: [Phase 08-04]: Stub slugifies via encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-')) for deterministic URL-safe stub URLs
- [Phase 08-shopping-instacart]: [Phase 08-04]: RealInstacartClient takes (apiKey, baseUrl) via constructor injection; default expires_in=30 days; landing_page_configuration only when partner_linkback_url provided
- [Phase 08-shopping-instacart]: [Phase 08-04]: Error path throws `Instacart API <status>: <text>` so upstream handlers can log both
- [Phase 08-shopping-instacart]: [Phase 08-02]: consolidateIngredients nulls unit on mismatch and takes max(qty) (no conversion)
- [Phase 08-shopping-instacart]: [Phase 08-02]: subtractPantry re-normalizes item.name defensively to decouple from producer normalization
- [Phase 08-shopping-instacart]: [Phase 08-02]: Mocked @anthropic-ai/sdk default export (recipeDiscovery pattern) rather than config/anthropic wrapper
- [Phase 08-shopping-instacart]: [Phase 08-03]: Hybrid categorizer — ~170-entry STATIC_MAP + Haiku fallback, enum-constrained tool schema (Pitfall 5 mitigation), zero-unknown path skips Claude
- [Phase 08-shopping-instacart]: [Phase 08-03]: classifyItems defaults AI-omitted unknowns to 'other' at hybrid layer; classifyBatchWithHaiku stays a pure translator
- [Phase 08-shopping-instacart]: [Phase 08-05]: Reorder path rebuilds a new shopping_list from items_snapshot rather than replaying old Instacart URL (Pitfall 4)
- [Phase 08-shopping-instacart]: [Phase 08-05]: Reorder items default category='other' (fast path, no re-classify) — user re-categorizes via /variations or manual edit
- [Phase 08-shopping-instacart]: [Phase 08-05]: Instacart client errors map to HTTP 502 INSTACART_ERROR (bad upstream) not 500
- [Phase 08-shopping-instacart]: [Phase 08-05]: /generate gracefully degrades classifyItems failure to 'other' for all items with a console warning
- [Phase 08-shopping-instacart]: [Phase 08-06]: shoppingStore mirrors mealPlanStore authedFetch pattern verbatim; snapshot rollback for all item mutations; createOrder throws without currentList
- [Phase 08-shopping-instacart]: [Phase 08-06]: fetchVariations returns [] on failure (read-only best-effort) instead of throwing
- [Phase 08-shopping-instacart]: [Phase 08-07]: Mobile ShoppingOrder type extended with optional items_snapshot via ShoppingOrderSnapshotItem; Instacart wire types stay server-internal via index signature
- [Phase 08-shopping-instacart]: [Phase 08-07]: Shopping tab groups items via useMemo + fixed CATEGORY_ORDER render (produce → protein → dairy → pantry → bakery → frozen → condiments → spices → beverages → other)
- [Phase 08-shopping-instacart]: [Phase 08-07]: Order button disabled when items.length===0 OR all checked; Reorder uses router.replace('/shopping') to avoid back-stack pollution
- [Phase 09-voice-cooking-mode]: [Phase 09-01]: Pinned @jamsch/expo-speech-recognition to exact 0.2.15 (Pitfall 7 — pre-1.0 churn)
- [Phase 09-voice-cooking-mode]: [Phase 09-01]: Timer id uses Date.now + Math.random (no crypto.randomUUID — unreliable in RN runtime)
- [Phase 09-voice-cooking-mode]: [Phase 09-02]: routeIntent checks parseTimerPhrase before nav regexes so 'continue for N minutes' can't miscategorize as next
- [Phase 09-voice-cooking-mode]: [Phase 09-02]: ask.question preserves original (non-lowercased) transcript so Claude sees user phrasing verbatim
- [Phase 09-voice-cooking-mode]: [Phase 09-02]: Timer regex allows optional 'an?\s+' so 'half an hour' resolves without a separate code path
- [Phase 09-voice-cooking-mode]: [Phase 09-03]: /cooking namespace distinct from /voice (voice is future Whisper fallback; cooking is the Claude Q&A endpoint)
- [Phase 09-voice-cooking-mode]: [Phase 09-03]: System prompt embeds short-answer rule verbatim; current_step_index clamped server-side so stale mobile indices don't 400
- [Phase 09-voice-cooking-mode]: [Phase 09-03]: INVALID_REQUEST returned for both malformed JSON and missing fields (single error shape for mobile)
- [Phase 09-voice-cooking-mode]: [Phase 09-04]: Extracted runStepSpeakerEffect as a pure helper so useStepSpeaker tests run under environment:node without a React renderer
- [Phase 09-voice-cooking-mode]: [Phase 09-04]: Global vitest.setup.ts hosts expo-speech / expo-speech-recognition / expo-keep-awake mocks — downstream screen tests inherit the stub surface
- [Phase 09-voice-cooking-mode]: [Phase 09-04]: useVoiceListener uses refs for enabled/hints/callback so updates don't tear down the native STT session
- [Phase 09-voice-cooking-mode]: [Phase 09-04]: askAssistant inlines authedFetch (mealPlanStore pattern) — no shared src/lib/api.ts exists to reuse
- [Phase 09-voice-cooking-mode]: [Phase 09-04]: askAssistant maps non-JSON error bodies to HTTP_<status> so the store layer always has a usable error code
- [Phase 09-voice-cooking-mode]: [Phase 09-04]: useVoiceListener has no unit test in 09-04 — native-coupled, coverage deferred to 09-05 cook.tsx screen test
- [Phase 09-voice-cooking-mode]: [Phase 09-05]: handleTranscript factored into its own pure module so cook screen tests run under vitest node env without RN renderer
- [Phase 09-voice-cooking-mode]: [Phase 09-05]: Cook tab repurposed as discovery hub linking to Recipes (avoids touching _layout.tsx)
- [Phase 09-voice-cooking-mode]: [Phase 09-05]: Timer countdown driven by single setInterval(1s) inside cook.tsx (parent-owned tick)
- [Phase 10-skill-progression-offline]: [Phase 10-01]: recipe_cooks is an append-only event log so cook count survives meal plan deletion (Pitfall 3)
- [Phase 10-skill-progression-offline]: [Phase 10-01]: Cook stats aggregated in service code, not a Postgres view -- keeps logic unit-testable
- [Phase 10-skill-progression-offline]: [Phase 10-01]: recipe_step_tips RLS via EXISTS through recipes.profile_id (no denormalized profile_id)
- [Phase 10-skill-progression-offline]: [Phase 10-01]: Mobile progression types are a copy of server types (independent evolution, mirrors shopping.ts)
- [Phase 10-skill-progression-offline]: [Phase 10-01]: netinfo mock lives in global vitest.setup.ts alongside expo-speech mocks
- [Phase 10-skill-progression-offline]: [Phase 10-03]: Don't cache uncertainty — empty Haiku responses bypass INSERT entirely so future model improvements can backfill
- [Phase 10-skill-progression-offline]: [Phase 10-03]: Service throws on Anthropic failure; route layer maps to 502 CLAUDE_ERROR (mirrors POST /ask)
- [Phase 10-skill-progression-offline]: [Phase 10-03]: getOrGenerateTip cache INSERT errors are swallowed (best-effort); the tip is still returned even on race
- [Phase 10-skill-progression-offline]: [Phase 10-03]: max_tokens=120, temperature=0.3, model='claude-haiku-4-20250514' for cooking tip generation
- [Phase 10-skill-progression-offline]: [Phase 10-04]: isInternetReachable=null treated as online to avoid false-offline flicker on cold launch
- [Phase 10-skill-progression-offline]: [Phase 10-04]: offlineQueue executor registry decouples queue lib from store imports — stores register their own replay handlers at module init
- [Phase 10-skill-progression-offline]: [Phase 10-04]: Global AsyncStorage mock in vitest.setup.ts so persist middleware loads cleanly across every existing store test
- [Phase 10-skill-progression-offline]: [Phase 10-02]: rankAmbition takes anthropic client as a parameter (AnthropicLike) instead of importing the singleton -- tests use plain mock objects, no module patching
- [Phase 10-skill-progression-offline]: [Phase 10-02]: logRecipeCook is best-effort; insert errors swallowed via console.warn so a logging failure can never roll back a cook
- [Phase 10-skill-progression-offline]: [Phase 10-02]: markCooked only logs to recipe_cooks when entry.recipe_id is set -- Claude-generated free-form meal entries have no recipe to track
- [Phase 10-skill-progression-offline]: [Phase 10-02]: rankAmbition fallback orders by ascending complexity when Sonnet returns 0 valid recommendations
- [Phase 10-skill-progression-offline]: [Phase 10-02]: getRecipeVariations throws BelowThresholdError mapped to HTTP 400 (not 403) so mobile UI can show 'unlock at 3 cooks' affordance

### Pending Todos

None yet.

### Blockers/Concerns

- Apply for Instacart Developer Platform API access early (approval timeline unknown, needed by Phase 8)
- Claude Vision accuracy for real fridge photos needs empirical validation in Phase 3
- expo-speech-recognition is pre-1.0 -- may need Whisper fallback for Phase 9

## Session Continuity

Last session: 2026-04-13T04:39:02.971Z
Stopped at: Completed 10-02-PLAN.md
Resume file: None
