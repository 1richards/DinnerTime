---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_plan: 16-07 (Settings dark-mode toggle + Maestro UAT + Phase 9 cleanup) — complete [Wave 4 landed; Settings section, flow 28, StepDisplay+VoiceStatusBadge deleted]
status: verifying
stopped_at: Completed 16-07-PLAN.md (Settings Cooking section dark-mode toggle, Maestro flow 28 non-voice UAT, Phase 9 cleanup)
last_updated: "2026-04-22T04:58:10.260Z"
last_activity: 2026-04-22 -- Completed 16-07 (Settings dark-mode toggle wired to cookingStore.setDarkMode with persistence, Maestro flow 28 with 7 screenshots, StepDisplay + VoiceStatusBadge deleted, 16-08 is the final plan)
progress:
  total_phases: 25
  completed_phases: 20
  total_plans: 96
  completed_plans: 95
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-07)

**Core value:** Open the fridge, take a photo, get dinner ideas -- zero mental effort from "what do we have?" to "what should we cook?"
**Current focus:** Phase 12: Combine Home + Recipes into unified Kitchen tab

## Current Position

Phase: 16 of 25 (Cooking Mode UX Enhancements — post-v1 polish, voice latency, dark mode, Phase 19 token alignment)
Current Plan: 16-07 (Settings dark-mode toggle + Maestro UAT + Phase 9 cleanup) — complete [Wave 4 landed; Settings section, flow 28, StepDisplay+VoiceStatusBadge deleted]
Status: Wave 4 plan 16-07 green. Settings Cooking section now renders "Dark cooking mode" toggle wired to `cookingStore.setDarkMode` (persisted via `partialize: (state) => ({ darkMode: state.darkMode })`). Exact UI-SPEC copy used verbatim: title "Dark cooking mode", subtitle "Darker background while cooking. Matches Spotify's Now Playing feel.". Section placed between Pantry and Account blocks. accessibilityRole="switch" + accessibilityState={{ checked }} on the row wrapper so Maestro can drive it via the plain title text. Maestro flow 28-cooking-mode-ui.yaml authored — 49 steps, 7 screenshots (landing → ingredient check → step advance → step back → exit confirm → dark toggle → dark cooking). Voice paths intentionally NOT covered; DEVICE-TEST-16 (plan 16-08) will cover them on a physical iPhone per CLAUDE.md UAT section (simulator has no audio injection). Phase 9 cleanup: StepDisplay.tsx + VoiceStatusBadge.tsx deleted (grep confirms zero consumer imports); cook.tsx header comment and 15-*.yaml stub comment updated to reflect removal. Two task commits: bae1f1a (feat: Settings + deletions), 36b06bd (test: Maestro flow 28). Maestro flow 28 could NOT be executed end-to-end because the running Metro was started from the monorepo root instead of apps/mobile (pre-existing dev-env bug — `./index` fails to resolve, cascading to expo-haptics). Per AUTO_MODE_OVERRIDE, the human-verify checkpoint was auto-approved inline and the failing sim run logged in SUMMARY issues; DEVICE-TEST-16 remains the authoritative visual gate. 159/159 cooking+app tests green; TypeScript clean on touched files. Phase 16 Wave 4 complete. Only plan 16-08 (DEVICE-TEST-16 physical-device voice run) remains in Phase 16. Milestone v1.0 remains 100% complete.
Last activity: 2026-04-22 -- Completed 16-07 (Settings dark-mode toggle wired to cookingStore.setDarkMode with persistence, Maestro flow 28 with 7 screenshots, StepDisplay + VoiceStatusBadge deleted, 16-08 is the final plan)

Progress: [██████████] 100%

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
| Phase 10-skill-progression-offline P05 | 5min | 2 tasks | 9 files |
| Phase 11-hybrid-ai-client P01 | 4min | 3 tasks | 11 files |
| Phase 11-hybrid-ai-client P02 | 8min | 2 tasks | 4 files |
| Phase 11-hybrid-ai-client P04 | 5min | 3 tasks | 6 files |
| Phase 11-hybrid-ai-client P03 | 6min | 3 tasks | 11 files |
| Phase 11-hybrid-ai-client P05 | 3min | 3 tasks | 3 files |
| Phase 14 P01 | 4min | 2 tasks | 9 files |
| Phase 14 P02 | 22h | 3 tasks | 7 files |
| Phase 13 P01 | 6min | 2 tasks | 4 files |
| Phase 13 P02 | 14min | 3 tasks | 8 files |
| Phase 12-combine-home-recipes P01 | 2 min | 3 tasks | 4 files |
| Phase 12-combine-home-recipes P02 | 1 min | 2 tasks | 6 files |
| Phase 12-combine-home-recipes P03 | 68min | 4 tasks | 8 files |
| Phase 15 P01 | 5min | 2 tasks | 14 files |
| Phase 15 P02 | 6min | 2 tasks | 10 files |
| Phase 15 P03 | 15min | 2 tasks | 43 files |
| Phase Phase 15 PP04 | 6min | 3 tasks | 16 files |
| Phase 19 P01 | 3min | 4 tasks | 9 files |
| Phase 19 P03 | 3min | 2 tasks | 7 files |
| Phase 19 P02 | 4min | 3 tasks | 8 files |
| Phase 19 P04 | 5min | 2 tasks | 7 files |
| Phase 19 P05 | 17min | 5 tasks | 53 files |
| Phase 19 P06 | 24min | 2 tasks | 10 files |
| Phase 18 P01 | 5min | 2 tasks | 6 files |
| Phase 18 P02 | 12min | 3 tasks | 9 files |
| Phase Phase 18 PP03 | 9min | 3 tasks tasks | 18 files files |
| Phase 18 P04 | 6min | 3 tasks | 9 files |
| Phase 24 P02 | 3min | 2 tasks | 2 files |
| Phase 24 P03 | 3.5min | 2 tasks | 2 files |
| Phase 24 P01 | 13min | 3 tasks | 9 files |
| Phase 24 P04 | 6min | 2 tasks | 2 files |
| Phase 24 P05 | 10.5min | 2 tasks | 4 files |
| Phase 24 P05 | 10.5min | 2 tasks | 4 files |
| Phase 24-ai-vision-and-pantry-data-model-deep-refactor P06 | 9min | 3 tasks | 10 files |
| Phase 21 P01 | 3min | 2 tasks | 5 files |
| Phase 21-pantry-intelligence P02 | 7min | 3 tasks tasks | 6 files files |
| Phase 21 P03 | 10min | 2 tasks | 4 files |
| Phase 21 P04 | 12min | 3 tasks | 12 files |
| Phase 21 P05 | 13min | 4 tasks | 12 files |
| Phase 21 P06 | 1min | 2 tasks | 4 files |
| Phase 17 P00 | 7 min | 3 tasks | 8 files |
| Phase 17 P01 | 8min | 2 tasks | 2 files |
| Phase 17 P02 | 3min | 2 tasks | 5 files |
| Phase 17 P03 | 7 min | 3 tasks | 6 files |
| Phase 17 P04 | 11 min | 3 tasks | 2 files |
| Phase 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display P00 | 15min | 2 tasks | 24 files |
| Phase 16 P02 | 5min | 2 tasks | 5 files |
| Phase 16 P01 | 9min | 2 tasks | 4 files |
| Phase 16 P03 | 12min | 3 tasks | 7 files |
| Phase 16 P05 | 11min | 2 tasks | 10 files |
| Phase 16 P04 | 11 | 2 tasks | 4 files |
| Phase 16 P06 | 12min | 2 tasks | 3 files |
| Phase 16 P07 | 12min | 3 tasks | 6 files |

## Accumulated Context

### Roadmap Evolution

- Phase 12 added: Rationalize Home and Recipes into a single unified page
- Phase 13 added: Receipt scan and Instacart import for bulk pantry loading
- Phase 14 added: Multi-photo pantry scan with smarter item filtering (no vague/unidentifiable items)
- Phase 15 added: UI polish and navigation consistency audit (Apple HIG alignment, system icons, consistent nav)
- Phase 16 added: Cooking mode UX enhancements (voice interaction + model upgrade, UI polish, information display)
- Phase 17 added: "Something New" — AI recipe exploration with search, pantry filter, remix-save (reimagines Suggestions segment)
- Phase 18 added: AI auto-location for pantry imports (remove forced fridge/pantry/freezer choice)
- Phase 19 added: Design professionalization — icons, buttons, nav, search bars inspired by Spotify/Strava/DoorDash
- Phase 20 added: Shopping refactor — push items to Instacart draft cart; user manages payment/delivery/substitutions inside Instacart
- Phase 21 added: Pantry intelligence — fuzzy dedup, presentation improvements, AI categorization learning, user-defined scan rules + staples list
- Phase 22 added: Plan experience refactor — cross-flow Plan↔Recipes↔Suggestions↔Shopping, date pickers, day/week/month actions, skill-progression integration
- Phase 23 added: Settings, auth, and non-functional requirements — account management, auth lifecycle, error handling, observability, performance, security, App Store readiness
- Phase 24 added: AI vision & pantry data-model deep refactor — prompt eval harness, multi-pass reasoning, canonical ingredient table, identity-based dedup, quantity+unit semantics, immutable scan events
- Phase 25 added: Private beta launch — dogfooding with real kitchen data, family/friends invites, TestFlight distribution, App Store submission (TestFlight-only vs. unlisted vs. public decision deferred to phase)

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
- [Phase 10-skill-progression-offline]: [Phase 10-05]: progressionStore mirrors mealPlanStore authedFetch + persist verbatim; partializes only cookStats + ambitionSuggestions
- [Phase 10-skill-progression-offline]: [Phase 10-05]: All progression actions short-circuit on !isOnline before authedFetch — graceful degradation without throwing
- [Phase 10-skill-progression-offline]: [Phase 10-05]: Cook screen tip cache lives in useRef<Map> per-session, dropped on unmount — never persisted
- [Phase 10-skill-progression-offline]: [Phase 10-05]: OfflineBanner mounted in _layout above Stack so it overlays (auth)/onboarding/(tabs)/settings globally
- [Phase 10-skill-progression-offline]: [Phase 10-05]: Variations button label encodes unlock countdown ('cook N more') so users see affordance before tapping
- [Phase 11-hybrid-ai-client]: [Phase 11-01]: AIClient interface + AnthropicAdapter + GeminiAdapter + getClientFor factory ship the provider-agnostic scaffold; services still on direct SDKs until Waves 2+
- [Phase 11-hybrid-ai-client]: [Phase 11-01]: Model IDs centralized in GEMINI_MODELS/ANTHROPIC_MODELS const maps in taskRouting.ts with TODO for -latest alias swap when Gemini 3.x exits preview
- [Phase 11-hybrid-ai-client]: [Phase 11-01]: GeminiAdapter retries ONCE on MALFORMED_FUNCTION_CALL then throws typed MalformedFunctionCallError; empty candidates surfaces as GeminiSafetyBlockError
- [Phase 11-hybrid-ai-client]: [Phase 11-02]: parse_recipe schema simplified — dropped ['X','null'] unions and omitted nullable fields from required; toolOutputToRecipe still defaults to null at JS boundary
- [Phase 11-hybrid-ai-client]: [Phase 11-02]: Canonical AIClient test mock pattern — vi.hoisted() + vi.mock('../../ai/clientFactory.js') exposing generateText/Structured/analyzeImageStructured; 11-03/11-04 copy verbatim
- [Phase 11-hybrid-ai-client]: [Phase 11-02]: recipeParser split into callAIParseRecipeText(task, prompt) + callAIParseRecipePhoto(base64, prompt) — URL/text share Gemini path, photo stays on Anthropic
- [Phase 11-hybrid-ai-client]: [Phase 11-04]: Wave 2 consumers (cookingTips, ingredientCategories, /cooking/ask) migrated to AIClient abstraction routed to Gemini 3.1 flash-lite — cache semantics, enum-constrained classification, and short-answer contract all preserved
- [Phase 11-hybrid-ai-client]: [Phase 11-04]: Test mocks swap from @anthropic-ai/sdk to ../../ai/clientFactory.js across all three service/route test files — zero vendor SDK coupling in test layer for migrated consumers
- [Phase 11-hybrid-ai-client]: [Phase 11-05]: Smoke script iterates ALL_TASKS and dispatches by task family (image vs text-only vs structured) -- single script covers every route
- [Phase 11-hybrid-ai-client]: [Phase 11-05]: config/anthropic.ts deleted after zero-leakage grep sweep; only ai/adapters/ import provider SDKs now
- [Phase 14]: [Phase 14-01]: GeminiAdapter.analyzeImagesStructured throws not-implemented (vision routes to Anthropic only); batch maxTokens 8192; single-image prompt also updated with filtering rules
- [Phase 14]: [Phase 14-02]: CapturedPhoto buffer in useState (not Zustand) — photos only enter global state after startBatchScan submits (research Pattern 3)
- [Phase 14]: [Phase 14-02]: Pantry-aware dedup — /scan-batch fetches existing items at scan location and passes existingItemNames to AI so shelf-stable items don't clutter repeat scans
- [Phase 14]: [Phase 14-02]: Thumbnail row uses fixed-width slots (screenWidth/6) instead of FlatList so 5 photos + add button fit one row without horizontal scroll
- [Phase 14]: [Phase 14-02]: Location picker locks after first photo — one scan session = one location, enforced with visible note to user
- [Phase 14]: [Phase 14-02]: Confidence threshold (0.7) applied at store layer (startBatchScan), review screen stays dumb renderer reading item.accepted
- [Phase 13]: [Phase 13-01]: Reuse vision.pantryScan task route for receipt/Instacart — same ScanResult[] output shape, no new taskRouting slot needed
- [Phase 13]: [Phase 13-01]: Single identifyReceiptItems fn + variant enum ('receipt' | 'instacart_screenshot') instead of two services — preamble-only difference
- [Phase 13]: [Phase 13-01]: Server-side RECEIPT_NAME_DENYLIST runs AFTER AI call (case-insensitive trim+lowercase Set lookup) — prompt alone not trustworthy for financial lines
- [Phase 13]: [Phase 13-01]: /scan-receipt defaults source_location='pantry' (CONTEXT locked); /import-instacart hardcodes 'pantry' and 'instacart_screenshot' variant
- [Phase 13]: [Phase 13-01]: Thenable supabase chain mock pattern — chain.then(resolve => resolve({ data: seeded })) lets tests seed existing-items while keeping method chaining intact
- [Phase 13]: [Phase 13-02]: BulkImportSheet uses React Native Modal (transparent + animationType=slide) mirroring Phase 7 SwapSheet/CookConfirm pattern - no new dependency
- [Phase 13]: [Phase 13-02]: Receipt/Instacart screens reuse /scan/review unchanged by populating pantryStore.scanResults + navigating with sourceLocation param - no review logic fork
- [Phase 13]: [Phase 13-02]: Empty-result mitigation inspects usePantryStore.getState().scanResults.length after await; zero-length fires Alert and suppresses auto-navigate useEffect
- [Phase 13]: [Phase 13-02]: Maestro stub flow deep-links into /scan/receipt and /scan/instacart rather than tapping bottom-tab + FAB - tab-bar text selectors unreliable on Simulator
- [Phase 12-combine-home-recipes]: Custom Pressable segmented control over @react-native-segmented-control to avoid dev-client rebuild
- [Phase 12-combine-home-recipes]: display:none dual-mount (not conditional render) preserves Library scroll + search + filter state across segment toggle
- [Phase 12-combine-home-recipes]: Two independent useCollapsingHeader() instances — one per segment; active segment drives compact-header opacity
- [Phase 12-combine-home-recipes]: RegenerateFab calls fetchSuggestions (not refreshSuggestions — which CONTEXT.md cited but does not exist in store)
- [Phase 12-combine-home-recipes]: Atomic swap: rewrite _layout.tsx + delete old index/recipes files in same task so /(tabs) redirect never resolves stale
- [Phase 12-combine-home-recipes]: Save-flow redirects use /(tabs)/kitchen?segment=library so saved recipes are immediately visible (Research Pitfall 3)
- [Phase 12-combine-home-recipes]: Auth/root/onboarding redirects target /(tabs)/kitchen — no index tab after 12-01 consolidation
- [Phase 12-combine-home-recipes]: [Phase 12-03]: Regex wildcards for Maestro tab-bar selectors — bare 'Kitchen' fails against accessibilityText-only nodes; use .*Kitchen.*/.*Library.* consistently
- [Phase 12-combine-home-recipes]: [Phase 12-03]: '.*in your library.*' is the stable post-merge marker on Library segment (SearchBar collapsed by default, 'Search recipes' placeholder not always visible)
- [Phase 12-combine-home-recipes]: [Phase 12-03]: Deep-link pattern for small action-row icons (dinnertime://recipes/discover) — XCUITest taps on 38x38 targets unreliable; mirrors Phase 13-02 receipt/Instacart approach
- [Phase 15-01]: useDirtyFormGuard dispatches NavigationAction via useNavigation().dispatch(data.action) — React Navigation 7's NavigationAction is an object, not a callable
- [Phase 15-01]: vitest.config narrowed 'src/components/**' exclude to 'src/components/!(ui)/**' and added explicit include for primitive tests (minimally-invasive per plan)
- [Phase 15-01]: Global react-native vi.mock in vitest.setup.ts — sentinel function-component stubs for View/Text/Pressable/etc. sidesteps rolldown's Flow-parse failure
- [Phase 15-01]: Component-as-function vitest pattern (call component, traverse element tree by .type identity) — no renderer dependency, no @testing-library install
- [Phase 15-01]: Baseline purity counts: 37 Ionicons files, 7 decorative emoji in src/app, 1 hand-rolled back Pressable (recipes/[id]/index hero, within budget)
- [Phase 15-02]: HeaderCloseButton shared primitive calls router.dismissAll() (not router.back()) — X on modal root must exit entire stack (Research Pitfall 4)
- [Phase 15-02]: scan/_layout cascades presentation: 'modal'; scan/review overrides to presentation: 'card' to push inside the modal (Research Pitfall 2 avoided)
- [Phase 15-02]: recipes/_layout does NOT cascade modal — imports modal per-screen, destinations push — mixed group avoids override complexity
- [Phase 15-02]: Touched-flag dirty guard with editDraft/handleX wrappers — hydration from async sources uses raw setDraft (no guard trigger); only user edits flip touched
- [Phase 15-02]: Guard predicate gates on !saving/!isLoading/!isConfirming so successful save/submit flow unsubscribes guard before router.back/replace
- [Phase 15-02]: Explicit Discard buttons call setTouched(false) before router.back/replace to avoid double-alert (guard + in-component confirm)
- [Phase 15-03]: Fridge + freezer both use 'snowflake' SF Symbol (iOS 15+ safe default); 'refrigerator' is iOS 17+ only
- [Phase 15-03]: Dynamic icon prop retyped from keyof typeof Ionicons.glyphMap to string on MethodCard/OptionRow/NavButton (Pitfall 5); `as never` cast applied at SymbolIcon invocation for dynamic string names
- [Phase 15-03]: Tab bar icons wrapped in View{width:size,height:size} so SymbolView glyphs align vertically (Pitfall 1)
- [Phase 15-03]: Kid-friendly 👶 dropped across 3 surfaces; text label preserved per CONTEXT Claude's Discretion
- [Phase 15-03]: Orange #F97316 preserved on every FAB and FavoriteButton active heart; RecipeCard inline heart matches
- [Phase 15-03]: scan/index.tsx consolidated to one EmptyState on no-photos branch; has-photos branch uses inline SymbolIcon (not an empty state)
- [Phase 15-03]: recipes/import-photo uses ad-hoc layout (SymbolIcon + heading + 2 Buttons) because EmptyState supports only one action
- [Phase 15-03]: RecipeFilterSheet + RemixSheet emoji chip arrays untouched (deferred to Phase 19 chip rewrite per Open Question #2); verify-no-decorative-emoji.sh only scopes src/app so gate passes
- [Phase Phase 15-04]: HeaderEllipsis (ActionSheetIOS) overflow menu collapses 3 secondary actions (Add to Plan, Remix, Delete) on recipes/[id]/index top-right hero overlay; Edit stays as body CTA
- [Phase Phase 15-04]: Maestro flow rebase was comment-annotation-only — audit found zero 'Back' text assertions, zero emoji-specific assertions, zero Ionicons-specific visual assertions; all selectors remain stable under SF Symbol refresh
- [Phase Phase 15-04]: ROADMAP Phase 15 criterion #4 (typography/spacing/color documentation) EXPLICITLY DEFERRED to Phase 19 per plan — Phase 15 closes criteria 1, 2, 3, 5
- [Phase Phase 15-04]: 22-dirty-form-guard.yaml registered as manual-only fallback in Maestro README — iOS Alert UIWindow occasionally unreachable from XCUITest; included cleanup-save step for idempotency
- [Phase 19]: [Phase 19-01]: Brand anchor = terracotta #C65D3A; 5-step SF Pro scale (display 34/41/700, title 22/28/600, body 17/22/400, caption 13/18/400, label 11/16/600 upper); iconPropsForText(scale) pulls weight from typography token
- [Phase 19]: [Phase 19-01]: CSS variables use space-separated RGB channels (not hex) in global.css so NativeWind <alpha-value> opacity modifiers (bg-brand/15) work (Pitfall 1)
- [Phase 19]: [Phase 19-01]: tokens.test.ts text-parses tailwind.config.js (fs.readFileSync + regex) instead of require() — nativewind/preset can't resolve outside Metro and would false-RED
- [Phase 19]: [Phase 19-01]: warmWhite + warmGray legacy palette preserved for migration safety — Plan 19-05 owns the orange→terracotta atomic sweep; tokens-purity.test.ts authored as describe.skip and flipped on there
- [Phase 19-03]: StickySearchPill uses scrollY.interpolate([0,40]→[0.05,0.18]) for shadow; zIndex:20 layers above compactHeader (5/10); modal route /search?context=<ctx> via expo-router chosen over inline expansion
- [Phase 19-03]: buildSearchHref kept as pure (ctx: string) => string for testing; cast to /search?${string} Href union at call site inside StickySearchPill
- [Phase 19-03]: ItemRow inline trailing chip (not <Chip />) — Plan 19-02 not yet executed; ChipTone union co-located in ItemRow.tsx so Plan 19-05 swap is a symbol-level rename
- [Phase 19-03]: itemRowHelpers.ts exports pure resolvers (resolveTitleClasses, resolveCheckboxBoxClasses, CONTAINER_CLASSES, STEPPER_BUTTON_CLASSES); ItemRow composes them in JSX — enables Nyquist-rate variant coverage without RNTL
- [Phase 19-03]: SearchBar.test.ts inline-mocks expo-symbols + expo-router (not in global vitest.setup.ts) — follows existing SymbolIcon.test.tsx pattern
- [Phase 19]: [Phase 19-02]: Button rewritten to 5-variant 44pt system with pure variantStyles + test; 'outline' kept as deprecated alias mapping to 'secondary' for 23 legacy call sites (Plan 05 sweep removes)
- [Phase 19]: [Phase 19-02]: Chip is two-family (kind=filter|display) in a single component file; chipStyles.ts resolveChipClasses is a pure function asserted as data in vitest node env; ChipToggle reduced to deprecation shim forwarding to Chip(kind=filter)
- [Phase 19]: [Phase 19-02]: Input API preserved exactly (error?: string, not error?: boolean) — existing 5 call sites use error:string; plan explicitly permitted preserving existing shape while swapping only color/border/text classes to tokens
- [Phase 19]: [Phase 19-04]: RecipeCard gets mode:'grid'|'list' prop (default 'grid' — backward-compat); pure resolveCardClasses returns {container,imageContainer,body,title,metaRow,metaText} for vitest-guarded class contracts
- [Phase 19]: [Phase 19-04]: DayRow intentionally does NOT consume ItemRow — day-label column is text typography (w-12 label), not an affordance slot; file-top JSDoc documents the non-consumption rationale
- [Phase 19]: [Phase 19-04]: Status-chip derivation extracted to pure deriveStatusChips helper with matrix test (4 statuses × stretch × pantryReady) so silent regressions cannot hide behind Plan tab screenshots
- [Phase 19]: [Phase 19-04]: vitest.config exclude narrowed from 'src/components/!(ui)/**' to 'src/components/**/*.native.test.*' — unblocks pure helper tests under recipes/ and plan/ without exposing RN-renderer-coupled tests
- [Phase 19]: [Phase 19-04]: isStretch/pantryReady flags threaded through deriveStatusChips even though MealPlanEntry lacks them today — one-line data binding when Phase 22 plan refactor adds the fields
- [Phase 19]: [Phase 19-05]: One-pass token sweep completed; zero #F97316/orange-* in src/**; tokens-purity.test.ts GREEN
- [Phase 19]: [Phase 19-05]: PantryItemCard leading=icon deviation (stepper deferred to Phase 21 pantry intelligence — pantryStore has no updateItemQuantity)
- [Phase 19]: [Phase 19-05]: ChipToggle + components/recipes/SearchBar DELETED; 5 ChipToggle call sites migrated to Chip kind=filter|display (allergies become kind=display tone=destructive)
- [Phase 19]: [Phase 19-06]: Maestro flow 23-design-buttons-visual.yaml authored (not 21 per plan) — slots 21/22 taken by Phase 15 flows; renaming would destroy history
- [Phase 19]: [Phase 19-06]: launchApp clearState prelude pattern added to flows 18/20/23 — root-cause fix for upstream modal bleed (flow 19 Import-from-Instacart modal poisoned downstream flows)
- [Phase 19]: [Phase 19-06]: Gate A auto-approved under auto-chain mode — 9 named screenshots from live iPhone 17 Pro sim confirmed terracotta palette + sticky pill + dense DayRow + destructive Sign Out all render correctly, no orange leaks
- [Phase 18-01]: STATIC_MAP-always-wins is implemented as a short-circuit (not post-call correction) — when classifyLocationStatic returns non-null, AI is never invoked; model drift on well-known items like 'olive oil' cannot slip through
- [Phase 18-01]: classifyItems degrades to 'pantry' default + console.warn on Gemini MalformedFunctionCallError (Pitfall 5) — best-effort classification beats a broken scan
- [Phase 18-01]: item_override_events has no FK to pantry_items — item_name is Phase 21's rollup key and must survive pantry-item deletion
- [Phase 18-01]: migrations.test.ts uses two-layer design: always-on static SQL regex for contract + optional live-DB probe that auto-skips on PGRST205 so CI stays green pre- and post-migration-push
- [Phase 18-02]: Vision schema folds source_location into existing tool (Option C) — STATIC_MAP applied as POST-call correction in normalizeScanItems, AI returns are overridden when static map has a hit
- [Phase 18-02]: reconcileItems dedup query drops source_location filter — existing items matched by (profile_id, normalized_name) alone; column NOT updated on UPDATE, only item_attributes refreshes each scan
- [Phase 18-02]: Extracted SOURCE_LOCATIONS + SourceLocation to sourceLocation.ts leaf module to break vision<->itemLocation circular import; vision.ts re-exports for backward compat
- [Phase 18-02]: POST /override-events silently filters invalid + no-op (ai===user) events, returns inserted:0 with 200; only empty array returns 400 — mobile fires telemetry optimistically
- [Phase 18-02]: UPDATE merges item_attributes via {...prior, source_location} spread so Phase 24 forward-compat keys survive re-scans; test pins invariant with some_future_key fixture
- [Phase 18-03]: Extracted LOCATION_SYMBOLS/LABELS/FALLBACK to locationSymbols.ts shared module (single owner); PantryItemCard + LocationChip both import
- [Phase 18-03]: mapScanResultsToReview seeds aiLocation = source_location on every scan response; override detection is pure-pass on ReviewItem[] with zero per-flow wiring
- [Phase 18-03]: confirmScan fires logOverrideEvents via void (not awaited) so 'Pantry Updated!' Alert never waits on telemetry POST; getAuthTokenOrNull wrapper swallows mid-session sign-outs
- [Phase 18-03]: Review-only fields (id, accepted, userEdited, aiLocation, probableDupe) stripped from /confirm payload via destructure-and-spread; aiLocation stays mobile-only provenance
- [Phase 18-03]: LocationPicker intentionally stays mounted through 18-03; Plan 18-04 atomically deletes component + dead route params + rebases Maestro flows
- [Phase 18-04]: DELETED LocationPicker.tsx (not preserved for Phase 21 reuse) — dead code invites reintroduction; Phase 21 will build fresh rules UI against own schema
- [Phase 18-04]: Location-agnostic EmptyState copy on scan/index.tsx ('Take photos of your fridge, pantry, or freezer — we'll sort each item automatically.') — sets expectation that AI does the sorting
- [Phase 18-04]: Maestro flows 07/16/19 rebased comment-only (no step changes) — RESEARCH Q14 audit had confirmed none of the three flows tap or assert against LocationPicker element
- [Phase 18-04]: verify-no-location-picker-scan.sh purity gate (4 grep checks: no imports, no JSX, no hardcoded 'pantry' nav param, file deleted) — mirrors Phase 15 verify-no-ionicons.sh / verify-no-decorative-emoji.sh shape
- [Phase 24-02]: units.ts: custom system is never compatible with anything (including another custom) — forces reconcileItems multi-row fallback rather than silently aggregating unlike units
- [Phase 24-02]: units.ts: sanitize() top-level non-object returns count-piece-1 default, but object-with-missing-fields returns system='custom' to preserve any user-provided unit/value while forcing the multi-row path for unrecognized systems
- [Phase 24-02]: units.ts: zero density conversion (cup↔oz, g↔ml return null) per 24-CONTEXT lockdown — volume↔weight conversion would require per-canonical-ingredient density metadata, deliberately deferred indefinitely
- [Phase 24-02]: units.ts: RED test file written in Task 1 with no automated verify (plan W1 revision) — Task 2 GREEN run is single contract gate; avoids brittle negated-grep RED checks that mask vitest infra failures
- [Phase 24]: [Phase 24-03]: canonicalResolver uses iterative two-row DP Levenshtein with row-min early-exit — stack-safe, ~45 lines, zero npm dep, 60-80% worst-case reduction on no-match inputs
- [Phase 24]: [Phase 24-03]: 60s TTL cache with live-append invalidation — cache.rows.push(newRow) on candidate INSERT is equivalent to invalidate+refetch because cache is status-filtered at load time and the only mutations the resolver emits are candidate inserts
- [Phase 24]: [Phase 24-03]: FUZZY_MIN_LEN=4 gate — 2 edits against a 3-char canonical matches nearly anything; 4-char minimum eliminates that false-positive class while preserving real typo recovery (chikn → chicken)
- [Phase 24]: [Phase 24-03]: resolveCanonicalBatch preserves raw-input-string keys (not normalized) so callers like reconcileItems can zip back to ScanResult[] using the exact AI-produced string
- [Phase 24-01]: Seed JSON + migration DO block pattern: author JSON in packages/server/src/data/, splice via helper script, preserve JSON-as-source-of-truth for diff readability
- [Phase 24-01]: scan_events append-only via RLS construction — only SELECT + INSERT policies; UPDATE/DELETE omitted. No pass_number column (criterion #3 descoped).
- [Phase 24-01]: pantry_items.canonical_ingredient_id as nullable FK ON DELETE SET NULL; dedup index (profile_id, canonical_ingredient_id, source_location) NOT UNIQUE so incompatible-unit rescans can produce multiple rows
- [Phase 24-04]: Task 2 collapsed into Task 1 — identifyReceiptItems has always lived inside vision.ts sharing foodItemsSchema + normalizeScanItems; plan's file-path assumption was wrong; Task 1's schema change propagates to all four scan flows via the single source of truth (Rule 3 scope adjustment)
- [Phase 24-04]: Overall legacy ScanResult.confidence = Math.min(fieldConfidence.*) so Phase 14's 0.7 threshold gate continues filtering low-confidence items without a consumer rewrite; surfaces worst-case attribute
- [Phase 24-04]: Missing per-field confidence defaults to 0.5 (not 1.0) — surface uncertainty instead of hiding it; matches < 0.7 dashed-underline UI gate (24-06)
- [Phase 24-04]: Backward-compat via raw-shape sniffing ('value' in q → new nested shape; typeof q === 'number' → legacy flat); same ScanResult output either way; clean rollout without dual code path
- [Phase 24-05]: reconcileItems keys dedup on (profile_id, canonical_ingredient_id, source_location) tuple — replaces legacy (profile_id, normalized_name) string match; legacy rows with canonical_ingredient_id=NULL never merge with new canonical rows (REQ-23 forward-only, no backfill)
- [Phase 24-05]: Incompatible-unit aggregation inserts a SECOND pantry_items row with item_attributes.reconcile_hint='incompatible_units' rather than dropping/overwriting; 24-01 dedup index intentionally NOT UNIQUE to permit this; review UI (future plan) can surface 'merge these' affordance
- [Phase 24-05]: Category precedence at insert: canonical_category_override (per-user) > canonical.category > 'other'; ScanResult.category (what AI emitted) is IGNORED — canonical table is source of truth per REQ-10 + REQ-11
- [Phase 24-05]: scan_events writes happen on the SCAN routes (pre-canonical), not at /confirm — final_items stores the post-normalize, pre-canonical ScanResult[] so event log remains a faithful AI-to-mobile roundtrip snapshot; canonical_ingredient_id only lives in pantry_items via /confirm
- [Phase 24-05]: scan_events fire-and-forget — try/catch + console.warn around insert; scan succeeds even on telemetry failure; raw_ai_output==final_items for now (vision.ts does not expose pre-normalize raw; 24b eval can extend vision.ts later if needed, Rule 4 gate respected)
- [Phase 24-05]: /confirm response shape changed to {inserted, updated, incompatibleUnits} (ReconcileResult) — intentional wire-contract break for mobile 24-06 to consume per-scan counts; acceptable during Wave 2 active dev (no beta users)
- [Phase 24-05]: PantryItem.quantity kept as number at TS level despite DB JSONB column — refactoring downstream consumers (shoppingList, ingredientMatching, mealPlanner) to sanitize() at boundary is Phase 21 scope; runtime safe because only test data flows through those readers per user directive
- [Phase 24-06]: Phase 24-06: resolveFieldClass pure helper extracted to reviewItemRowHelpers.ts (mirrors Phase 19-03 itemRowHelpers split) — tests run under vitest node env without pulling expo-symbols / expo-modules-core imports
- [Phase 24-06]: Phase 24-06: PantryItem.quantity typed as Quantity|number for migration safety — pre-24a legacy rows persisted in AsyncStorage have quantity:number; migration 00015 makes new rows Quantity JSONB; formatQuantity handles both at render boundary
- [Phase 24-06]: Phase 24-06: Quantity+unit confidence merged via Math.min for the compound quantity display (single visual span covers value+unit) — conservative aggregation flags the underline if EITHER sub-field is low-confidence
- [Phase 24-06]: Phase 24-06: confirmScan reloads pantry from Supabase after 24-05 /confirm (was: merge PantryItem[] from response body) — ReconcileResult counts response shape means mobile must refetch to pick up canonical aggregations + incompatible-unit multi-row inserts; mirrors offline-queue reload pattern
- [Phase 24-06]: Phase 24-06: Strict <0.7 threshold for dashed-amber low-confidence treatment — exactly 0.7 is high-confidence (mirrors Phase 14 0.7 acceptance gate); legacy fieldConfidence=undefined renders no underline (backward compat + avoids misleading indicators on manual-adds)
- [Phase 21]: [Phase 21-01]: Counter-table pattern (canonical_scan_counts + promote_candidate_canonicals RPC) over JSONB-path matching — O(1) increment + indexed UPDATE; RPC SECURITY DEFINER + search_path=public pinned; GRANT EXECUTE to authenticated + service_role
- [Phase 21]: [Phase 21-01]: Composite unique (user_id, rule_type, payload) on suggested_rules enables aggregator upsert-on-conflict without duplication; partial index idx_suggested_rules_user_active scoped to WHERE dismissed_at IS NULL (majority query shape)
- [Phase 21]: [Phase 21-01]: user_staples RLS has only SELECT+INSERT+DELETE policies (no UPDATE) — staples are on/off markers with no in-place edits; user_location_rules + suggested_rules get full CRUD RLS for drag-reorder + dismissed_at writes
- [Phase 21]: [Phase 21-01]: Rule 2 auto-fix — added canonical_scan_counts_write_service_role policy missing from plan snippet; without it canonicalPromoter could not increment counter under RLS even with service_role client
- [Phase 21-02]: applyLocationRules preserves referential identity on pass-through — callers can '===' compare to detect no-op
- [Phase 21-02]: suggestionAggregator pre-resolves canonical_ingredient_id into payload JSONB at aggregation time (W3) so 21-03 accept path never re-resolves and never drifts on candidate canonicals
- [Phase 21-02]: Aggregator filters qualifying groups BEFORE resolveCanonicalBatch — saves one lookup per below-threshold group
- [Phase 21-02]: Un-resolvable item_names skipped in aggregator (no orphan suggestions) — belt-and-braces since canonicalResolver auto-creates candidates
- [Phase 21-02]: incrementScanCounts uses sequential read+upsert (not atomic RPC) — private-beta-acceptable; atomic-RPC follow-up documented for post-launch concurrency races
- [Phase 21-02]: Name-mapping rules NOT in ruleEvaluator — they live in ingredient_aliases(source='user_rule') applied by canonicalResolver Stage 2
- [Phase 21]: Phase 21-03: reconcileItems integrates ruleEvaluator + returns deduped canonicalIds; /confirm fires aggregator/promoter/counter as void Promise.resolve().catch() (fire-and-forget guarantees .catch tolerant)
- [Phase 21]: Phase 21-03: 5 new route groups on pantry.ts (staples, rules, suggestions, preview, category-override) registered BEFORE PATCH /:id to avoid catch-all collision; 12 endpoints total. W4 singular canonical_category_override verified (grep returns 0 hits of plural)
- [Phase 21]: Phase 21-03: suggestions/accept W3 guard — location_mapping reads canonical_ingredient_id from payload (pre-resolved by aggregator at aggregation time) and returns 400 CANONICAL_NOT_ACTIVE without dismissing when canonical is candidate (user can retry post-promotion)
- [Phase 21]: Phase 21-04: staples as Set<string> + parallel stapleRows for dual-projection (O(1) scan-accept + display list); Zustand persist v1->v2 migrates via migratePantryPersistState + onRehydrateStorage Set/Array
- [Phase 21]: Phase 21-04: GroupingMode rendered as 4-tab segmented control (not chips) per RESEARCH Pitfall 7; StickySearchPill absolute-positioned outside PantryItemList with contentContainerStyle.paddingTop:56 to prevent first-section underlap
- [Phase 21]: Phase 21-04: resolveScanAcceptance pure helper + STAPLE_THRESHOLD=0.3 / DEFAULT_THRESHOLD=0.7 unifies every scan-flow accept decision; mapScanResultsToReview threads staples Set from get().staples through start{Scan,BatchScan,ReceiptScan,InstacartImport}
- [Phase 21]: Phase 21-05: react-native-draggable-flatlist@4.0.3 is JS-only (no podspec) — depends on bundled Reanimated + Gesture Handler; no pod install needed; dev-client rebuild deferred to 21-06 UAT
- [Phase 21]: Phase 21-05: pantryStore authedFetch helper — 10 new actions (7 rules/suggestions + 3 staples*) all route through authedFetch that adds /api/v1 prefix + Bearer token; optimistic + rollback on every mutation; acceptSuggestion reloads rules on success
- [Phase 21]: Phase 21-05: Source-level contract test pattern for hook-heavy screens — component-as-function fails on useState under vitest node env; instead readFileSync(source) + substring assertions lock testIDs + store selectors + imports; mirrors Phase 21-04 PantryItemCard pattern
- [Phase 21]: Phase 21-05: testID contract for Maestro 21-06 complete — add-rule-fab, rule-delete-{name|alias}, add-staple-fab, staple-remove-{name}, pantry-item-ellipsis-{index}; DraggableFlatList height-capped at min(rules×56, 320) to avoid nested pan responder with outer ScrollView
- [Phase 21]: Auto-approved Phase 21-06 human-verify UAT checkpoint under auto-chain — testID contract tests 21/21 GREEN + typecheck clean + flows structurally sound; live sim UAT deferred to user (dev-client rebuild session)
- [Phase 21]: Maestro flows 24/25/26 authored with testID-first selectors (add-rule-fab, rule-delete-{alias}, pantry-item-ellipsis-{index}) per CLAUDE.md UAT regex-avoidance guidance
- [Phase 17]: Source-contract tests (fs.readFileSync + substring asserts) preferred over RN-renderer tests for screen files — Avoids .native.test.* suffix complexity, keeps per-file runtime <200ms, matches repo precedent in recipeStore.persist.test.ts. Trade-off: tests don't catch behavior bugs within JSX — Plan 17-04 Maestro flow fills that gap.
- [Phase 17]: STORAGE_KEY for suggestionsStore persist locked to 'dinnertime-suggestions' in Wave 0 tests — Prevents accidental collision with dinnertime-recipes (existing recipe store) or dinnertime-pantry (existing pantry store). Plan 17-02 must use this exact key.
- [Phase 17]: dedupPrepend lives in its own module (apps/mobile/src/stores/dedupPrepend.ts), not inline in suggestionsStore — Pure, store-free, cheap to unit test without instantiating Zustand. Prevents the store file from growing untestable lambdas.
- [Phase 17]: [Phase 17-01]: Used single .eq('profile_id') + in-memory status='available' filter for pantry_items query (Wave 0 test mock does not support chained .eq().eq() — deviation Rule 3)
- [Phase 17]: [Phase 17-01]: buildDiscoveryPrompt extended with optional 3rd pantryManifest arg — no-op when empty/undefined, preserving /discover byte-exact (D-07)
- [Phase 17]: [Phase 17-01]: POST /recipes/search as NEW route (not /discover extension) — shares recipeDiscovery service, independent external contract
- [Phase 17]: Persist key 'dinnertime-suggestions' v1 with 4-field partialize (searchResults, recentQueries, lastQuery, pantryOnly); autoFetch/isLoading/error excluded (Pitfall 1)
- [Phase 17]: 17-03: Inline-export PreviewSheet from recipes/discover.tsx (+ DiscoveredRecipe type) rather than extracting to components/recipes/PreviewSheet.tsx — planner preferred path, lower blast radius, deferrable refactor since current export shape is already the final API
- [Phase 17]: 17-03: Deleted RegenerateFab function entirely (not just unmounted). Grep confirmed zero other consumers. Removes dead code instead of leaving an unreachable symbol — consistent with Phase 17 D-06
- [Phase 17]: 17-03: Segment JSX text formatted as single-line JSX expression >{'Something New'}</Text> to make Wave 0 source-contract substring assertion robust against prettier's JSX text-child wrapping — pattern documented for future source-contract tests + JSX text slots
- [Phase 17]: 17-03: PantryOnlyToggle component built but not mounted on the Kitchen Something New segment in Plan 03. /search modal owns the submit via native Switch (test contract locked); segment-level pill placement deferred to UAT in Plan 17-04 without rework — toggle state rehydrates from useSuggestionsStore.pantryOnly on each modal open
- [Phase 17]: Maestro selector pattern: use .*Label.* regex for Pressable segment buttons whose accessibilityLabel masks child Text from AX tree — CLAUDE.md documented this for old Suggestions label; same gotcha applies to Something New. Plain-literal tapOn fails silently; regex matches the AX label substring.
- [Phase 17]: Maestro submit pattern for /search modal: pressKey:enter with TextInput returnKeyType=search + onSubmitEditing — /search modal title Text 'Search' shadows submit Button title in AX traversal; keyboard Enter fires onSubmitEditing directly, avoiding selector ambiguity. Precedent in flow 11.
- [Phase 16]: Persist only darkMode via partialize — ingredientChecks/lastCommandToast/currentSessionId are ephemeral per cooking session
- [Phase 16]: Session id regenerates on every enter() (not on explicit startSession()); clears on exit()
- [Phase 16]: Component tests use the Phase 19 static-inspection pattern (flatten + className assertion) rather than @testing-library/react-native
- [Phase 16]: Red-stub tests use @ts-expect-error + Cannot-find-module imports — provides clear Wave 0 signal for later plans
- [Phase 16]: Streaming /cooking/ask goes through the AIClient abstraction (generateStream as an optional AsyncIterable) rather than escaping to the raw Anthropic SDK — single Claude-calling pathway preserved; Gemini streaming is feature-detected and returns CLAUDE_ERROR if ever routed
- [Phase 16]: Anthropic messages.stream event emitter bridged to an async generator via a queue + resolveNext promise — route handlers never see vendor types, just
- [Phase 16]: Mobile streamAsk signature uses options+callbacks bags (matches Wave 0 test contract) not the plan's positional 6-arg form — caller in 16-06 injects baseUrl + accessToken + telemetry wrapping
- [Phase 16]: Pitfall 1 (RN 0.83 fetch ReadableStream uncertainty) handled via NO_STREAM_BODY error code, not a react-native-sse polyfill — caller in 16-06 falls back to askAssistant() on that signal; sse-smoke.ts on-device is the gate for whether polyfill is ever needed
- [Phase 16]: Token getter seam (wireSupabaseAuth) instead of dynamic supabase import — default sync sentinel keeps fake-timer tests clean, production wires real supabase.auth.getSession from cook-screen bootstrap
- [Phase 16]: Splice-after-await flushing in telemetry — concurrent synchronous flush starts observe the same queue snapshot; only the first resolved await drains. Fixes queue-cap contract and prevents burst thrashing in production
- [Phase 16]: Schema-light event names — wire  and DB  are plain text (no enum). Adding new telemetry event kinds in Wave 3 requires zero migration and zero server deploy
- [Phase 16]: useVoiceAmplitude falls back to a 600ms cosmetic sine loop — @jamsch/expo-speech-recognition 0.2.15 does not ship a volumechange event; hook probes anyway so future versions drive real amplitude automatically
- [Phase 16]: Promoted expo-symbols + expo-haptics mocks to vitest.setup.ts global (both pull in expo-modules-core which trips __DEV__ under Node) — removes the per-file mock footgun for all current + future cooking tests
- [Phase 16]: Timer intent dropped speak() per UI-SPEC silent-confirmation rule — toast/haptic replaces TTS echo
- [Phase 16]: StepNavButtons 72pt hand-rolled Pressable (not Phase 19 Button) — keeps 44pt Button invariant intact; 72pt deviation localized
- [Phase 16]: show_ingredients regex permits up to 3 intervening tokens; 'what ingredients are substitutes for X' accepted edge-case routed to show_ingredients instead of /ask
- [Phase 16]: 16-04: Two-layer ScrollableRecipe export (forwardRef wrapper + raw scrollableRecipeRender fn) — forwardRef return value is not directly callable, so static-inspection tests need the raw render function alongside the production export
- [Phase 16]: 16-04: useCurrentStepScroll implemented as sync function (no useEffect) — Wave 0 test invokes it from vitest node env without a React renderer; hooks would throw Invalid hook call. React's render-diffing still caps firing cadence to prop changes.
- [Phase 16]: 16-04: Ingredient-check icon tone = success (not brand) — UI-SPEC §Color accent budget reserved for rail/timer/mic/Stop/nav-pressed/toast; success semantically reads as checked/done
- [Phase 16]: Phase 16-06: Dark cooking mode applied via scoped inline style override on SafeAreaView + ScrollableRecipe wrapper (NOT app-wide NativeWind theme) per CONTEXT D-03. Scoped to cook screen only; light palette tokens remain single source of truth for className lookups.
- [Phase 16]: Phase 16-06: SSE Ask flow primary + askAssistant fallback on NO_STREAM_BODY / NO_AUTH (Pitfall 1 — RN 0.83 ReadableStream guard). Other error codes (CLAUDE_ERROR, HTTP_4xx/5xx, STREAM_ERROR) surface as askError and render ErrorState in AskSheet.
- [Phase 16]: 16-07: Settings Cooking section inline vs dedicated component — single toggle row doesn't justify a separate CookingSection.tsx; matches inline Pantry section pattern
- [Phase 16]: 16-07: Maestro flow 28 covers only non-voice paths; voice STT/TTS locked behind DEVICE-TEST-16 per CLAUDE.md UAT (simulator has no audio injection)

### Pending Todos

None yet.

### Blockers/Concerns

- Apply for Instacart Developer Platform API access early (approval timeline unknown, needed by Phase 8)
- Claude Vision accuracy for real fridge photos needs empirical validation in Phase 3
- expo-speech-recognition is pre-1.0 -- may need Whisper fallback for Phase 9

## Post-v1 Polish (out-of-band, not GSD-planned)

Landed on `main` between 2026-04-13 and 2026-04-14 as ad-hoc UAT-driven work. Logged here so GSD state reflects reality without re-planning after the fact.

**UAT + infra (2026-04-13 overnight, see `.planning/UAT-NIGHT-REPORT.md`):**

- `3031eff` unblock dev client launch on iPhone (ATS, SecureStore)
- `68b5f6d` scaffold Maestro flows + iOS Simulator UAT runbook
- `5d2b4ef` 96 server integration tests + 4 backend bugs fixed (route order, single→maybeSingle, AI null UUID, JSON-string steps)
- `72d256a` 14/14 Maestro flows green; P0 frontend fixes (shoppingStore response shape, GestureHandlerRootView)
- `8dbbc6f` food-photography visual pass (HeroImage + foodImages constants, 11 files)
- Final state: 16/16 Maestro UI flows, 329/329 server tests

**Feature + UX polish (2026-04-14):**

- `0e77e4b` recoverable navigation across non-tab screens, collapsible home hero, Keychain `AFTER_FIRST_UNLOCK`, Sign Out
- `e685985` Discover preview modal, progression gate rework, pantry scan confirm fix, cooked-entry persistence fix
- `3e11b7a` RecipeCard favorite heart made interactive
- `08445b9` Remix modes (surprise/protein/veggies/quicker) + Home suggestion preview modal + `POST /meal-plans/entries/assign`
- `070fcf8` structured variations (title+description), save-as-recipe, remix on home suggestions
- `c4b4fc4` unify Home suggestions + Discover card visuals; clarify semantics
- `5611f8e` remove Cook tab, Tier 2 Remix spread (RecipeCard/DayRow/AddToPlan), client-side recipe filters
- `b430772` collapsing header + filter bottom-sheet on Recipes tab
- `31a4ea2` hide default tab header on Recipes (double-header fix)
- `a5111a7` collapsing-header pattern applied to all five tabs (shared `useCollapsingHeader` hook)

**Deferred (pre-approved for future phase):**

- Plan tab multi-week navigation (prev/next week chevrons, cache plans by `week_start`, extend `GET /meal-plans/current` with `?week_start=`). User chose to hold off on formalizing as Phase 12.

## Session Continuity

Last session: 2026-04-22T04:58:10.256Z
Stopped at: Completed 16-07-PLAN.md (Settings Cooking section dark-mode toggle, Maestro flow 28 non-voice UAT, Phase 9 cleanup)
Resume file: None
