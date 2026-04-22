# Roadmap: DinnerTime

## Overview

DinnerTime delivers value in a dependency-driven sequence: foundation infrastructure first, then the core "fridge photo to dinner ideas" loop (the thesis that must validate), followed by recipe management that feeds into weekly meal planning, then shopping and Instacart integration, and finally premium features (voice cooking, skill progression, offline support). Each phase delivers a complete, testable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Project Setup & Auth** - Scaffold the app, backend, database, and user authentication (completed 2026-04-11)
- [x] **Phase 2: Household Preferences** - Users configure their household, dietary needs, and cuisine preferences (completed 2026-04-11)
- [x] **Phase 3: Pantry Scanning** - AI-powered photo scanning to build and maintain a pantry inventory (completed 2026-04-12)
- [ ] **Phase 4: Fridge-to-Dinner Suggestions** - AI recommends meals based on what is in the pantry
- [ ] **Phase 5: Recipe Import** - Users bring recipes into the app from URLs, photos, and manual entry
- [ ] **Phase 6: Recipe Library** - Users organize, search, favorite, and discover recipes
- [ ] **Phase 7: Meal Planning** - AI generates balanced weekly dinner plans
- [ ] **Phase 8: Shopping & Instacart** - Auto-generated shopping lists with one-tap Instacart ordering
- [ ] **Phase 9: Voice Cooking Mode** - Hands-free conversational AI assistant while cooking
- [x] **Phase 10: Skill Progression & Offline** - Gentle skill coaching, creative variations, and offline support (completed 2026-04-13)
- [x] **Phase 11: Hybrid AI Client** - Refactor all AI services behind a provider-agnostic AIClient with per-task Anthropic/Gemini routing (completed 2026-04-13)
- [x] **Phase 12: Combine Home & Recipes** - Rationalize Home and Recipes into a single unified page (completed 2026-04-18)
- [x] **Phase 13: Receipt Scan & Instacart Import** - Bulk pantry loading from grocery receipts and Instacart purchase history (completed 2026-04-18)
- [x] **Phase 14: Multi-Photo Scan & Smarter Item Filtering** - Multiple photos per scan session, AI only returns identifiable cooking ingredients (completed 2026-04-18)
- [x] **Phase 15: UI Polish & Navigation Consistency** - Systematic audit + fixes: system icons replace emojis, consistent nav headers/back buttons, unified empty/loading states (completed 2026-04-18)
- [x] **Phase 16: Cooking Mode UX Enhancements** - Upgraded voice interaction + model, UI polish, better information display during cooking (completed 2026-04-22)
- [x] **Phase 17: "Something New" — AI Recipe Exploration** - Reimagines the Suggestions segment: keyword search over AI-generated recipes, "from the pantry" filter, persisted results, remix-and-save to Recipe Box (completed 2026-04-21)
- [x] **Phase 18: AI Auto-Location for Pantry Imports** - Remove forced fridge/pantry/freezer choice; AI infers per-item location across scan, receipt, and Instacart flows (completed 2026-04-19)
- [x] **Phase 19: Design Professionalization** - Polish icons, buttons, navigation, search bars, and shared design patterns; reference Spotify, Strava, DoorDash aesthetics (completed 2026-04-18)
- [ ] **Phase 20: Shopping Refactor — Push to Draft Cart** - Replace order placement with pushing items to an Instacart draft cart so users manage payment, delivery window, and substitutions inside Instacart itself
- [x] **Phase 21: Pantry Intelligence** - Smarter dedup (fuzzy name matching, variant rollup), better pantry-tab presentation (grouping, sections, search), AI categorization learning from history, and user-defined scan rules for commonly purchased items (completed 2026-04-19)
- [ ] **Phase 22: Plan Experience Refactor** - Better UX between Plan ↔ Recipes ↔ Suggestions ↔ Shopping; date pickers; multi-scale actions (day / week / month); skill-progression integration so planning uplevels cooking skills over time
- [ ] **Phase 23: Settings, Auth & Non-Functional** - Account management (password reset, email change, delete account), session lifecycle polish, biometric unlock, security hardening, error handling, observability, performance budgets
- [x] **Phase 24: AI Vision & Pantry Data-Model Deep Refactor** - Systematically upgrade scan quality (prompting, multi-pass reasoning, retry logic), item creation logic, category consistency, canonical-name resolution for dedup, quantity/unit extraction, and the underlying data model (canonical ingredient table, item events, quantity semantics) (completed 2026-04-19)
- [ ] **Phase 25: Private Beta Launch** - Seed DinnerTime with real kitchen data, invite family and friends as beta users via TestFlight, submit to the App Store for private/unlisted distribution

**Milestone v1.0 shipped 2026-04-14.** Post-v1 polish (UAT harness, visual pass, remix, collapsing headers, filter sheet, sign out, SecureStore fix, Cook tab removal) landed out-of-band on `main` and is logged in `STATE.md` under "Post-v1 Polish" rather than re-planned as a GSD phase. See `.planning/UAT-NIGHT-REPORT.md` for the overnight work summary. Plan tab multi-week navigation is deferred; candidate for a future Phase 12 when formalized.

## Phase Details

### Phase 1: Project Setup & Auth
**Goal**: Users can install the app, create an account, and have their data persist reliably across sessions
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-06
**Success Criteria** (what must be TRUE):
  1. User can create an account with email/password and log in
  2. User session persists across app restarts without re-login
  3. User data syncs to the cloud and survives app reinstall
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Scaffold pnpm monorepo, Expo mobile app, Hono server with route stubs, Supabase migration
- [ ] 01-02-PLAN.md — Auth flow (LargeSecureStore, Zustand store, login/register screens, onboarding, tabs)
- [ ] 01-03-PLAN.md — EAS build config and end-to-end visual verification checkpoint
**UI hint**: yes

### Phase 2: Household Preferences
**Goal**: Users can describe their household so the app personalizes all future suggestions
**Depends on**: Phase 1
**Requirements**: FOUN-03, FOUN-04, FOUN-05
**Success Criteria** (what must be TRUE):
  1. User can set dietary preferences (vegetarian, gluten-free, allergies, etc.)
  2. User can configure household size with adult and kid profiles
  3. User can specify cuisine preferences and a list of disliked ingredients
  4. Preferences persist across sessions and are available to downstream features
**Plans**: 3 plans
Plans:
- [ ] 02-01-PLAN.md — Database migration (household_members table, skill_level column), TypeScript types, data constants (ingredients, dietary options)
- [ ] 02-02-PLAN.md — Preferences Zustand store with CRUD, auto-save hooks, ingredient search hook (TDD)
- [ ] 02-03-PLAN.md — Settings UI (all sections), gear icon navigation, visual verification checkpoint

**UI hint**: yes

### Phase 3: Pantry Scanning
**Goal**: Users can photograph their fridge, pantry, and freezer and the app builds an accurate, persistent inventory
**Depends on**: Phase 1
**Requirements**: PANT-01, PANT-02, PANT-03, PANT-04, PANT-05, PANT-06, PANT-07, PANT-08
**Success Criteria** (what must be TRUE):
  1. User can snap a photo of fridge, pantry shelves, or freezer and see AI-detected food items with confidence scores
  2. User can confirm, correct, remove, or add items the AI missed after a scan
  3. Pantry inventory persists and reconciles correctly across multiple scan sessions
  4. Items not seen in 7+ days are visually marked as uncertain
  5. User can manually mark any item as used or depleted
**Plans**: 4 plans
Plans:
- [ ] 03-01-PLAN.md — Database migration (pantry_items table), TypeScript types, Anthropic SDK config, dependency install
- [ ] 03-02-PLAN.md — Backend vision service (Claude API) and pantry reconciliation service with routes (TDD)
- [ ] 03-03-PLAN.md — Pantry Zustand store with scan review workflow and confidence decay hook (TDD)
- [ ] 03-04-PLAN.md — Scan flow UI (camera, review screen) and pantry inventory tab with visual verification
**UI hint**: yes

### Phase 4: Fridge-to-Dinner Suggestions
**Goal**: Users get personalized dinner ideas based on what is actually in their kitchen right now
**Depends on**: Phase 2, Phase 3
**Requirements**: MEAL-01, MEAL-02, MEAL-03, MEAL-04
**Success Criteria** (what must be TRUE):
  1. User can request dinner suggestions and receive AI recommendations based on current pantry inventory
  2. Suggestions respect the household's dietary preferences and disliked ingredients
  3. Suggestions include kid-friendly options when the household has children
  4. User can trigger suggestions immediately after a pantry scan in a seamless flow
**Plans**: 3 plans
Plans:
- [ ] 04-01-PLAN.md — AI suggestion service with Claude tool_use, prompt assembly, dietary/kid-friendly logic, API endpoint (TDD)
- [ ] 04-02-PLAN.md — Mobile suggestion types and Zustand store with authenticated fetch
- [ ] 04-03-PLAN.md — Suggestions UI (cards, skeleton, list), home tab integration, post-scan navigation flow
**UI hint**: yes

### Phase 5: Recipe Import
**Goal**: Users can bring recipes into the app from any source they currently use
**Depends on**: Phase 1
**Requirements**: RECP-01, RECP-02, RECP-03, RECP-04, RECP-05
**Success Criteria** (what must be TRUE):
  1. User can paste a recipe URL and get a structured recipe card
  2. User can photograph a cookbook page, handwritten card, or screenshot and get a structured recipe card
  3. User can manually enter a recipe and AI helps structure it (ingredients parsed, steps numbered)
  4. All imported recipes are stored with title, ingredients (with quantities/units), steps, cook time, and servings
**Plans**: 4 plans
Plans:
- [ ] 05-01-PLAN.md — Database migration (recipes table), TypeScript type contracts, cheerio install
- [ ] 05-02-PLAN.md — Recipe parser service with JSON-LD extraction, Claude Vision, Claude text parsing, API routes (TDD)
- [ ] 05-03-PLAN.md — Mobile recipe Zustand store with import, save, and fetch actions (TDD)
- [ ] 05-04-PLAN.md — Import flow UI (method picker, URL/photo/manual screens, review/edit), recipe list tab, visual verification
**UI hint**: yes

### Phase 6: Recipe Library
**Goal**: Users can organize, browse, search, and discover recipes within their personal collection
**Depends on**: Phase 5
**Requirements**: RECP-06, RECP-07, RECP-08, RECP-09, RECP-10
**Success Criteria** (what must be TRUE):
  1. User can view, edit, and delete saved recipes
  2. User can search recipes by keyword and find relevant results
  3. User can favorite recipes and filter to see only favorites
  4. User can adjust serving size and see ingredient quantities scale proportionally
  5. User can browse AI-suggested recipes from the internet based on their preferences
**Plans**: 5 plans
Plans:
- [ ] 06-01-PLAN.md — Migration (is_favorite column, source_type 'ai'), recipe type extensions, install fraction.js
- [ ] 06-02-PLAN.md — Server CRUD completion: PATCH/DELETE routes, search + favorites query params (TDD)
- [ ] 06-03-PLAN.md — Mobile scaleIngredient helper and recipeStore update/delete/favorite/search actions (TDD)
- [ ] 06-04-PLAN.md — Backend recipe discovery service + POST /recipes/discover route with Claude tool use (TDD)
- [ ] 06-05-PLAN.md — Recipe library UI: search, detail, edit, delete, serving scaling, discover screen, visual verification
**UI hint**: yes

### Phase 7: Meal Planning
**Goal**: Users can generate a balanced weekly dinner plan that accounts for their pantry, preferences, and variety
**Depends on**: Phase 4, Phase 6
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07
**Success Criteria** (what must be TRUE):
  1. User can generate a weekly dinner plan with one tap and AI fills all 7 nights
  2. Generated plans draw from pantry inventory, preferences, and the user's recipe library
  3. Plans avoid repeating recent meals and balance complexity across the week
  4. User can swap any individual meal in the plan for a different suggestion
  5. User can view the meal plan in a weekly calendar layout
**Plans**: 5 plans
Plans:
- [ ] 07-01-PLAN.md — Migration (meal_plans + meal_plan_entries), shared MealPlan/MealPlanEntry types
- [ ] 07-02-PLAN.md — mealPlanner service: buildMealPlanPrompt + generateMealPlan + generate_meal_plan tool (TDD)
- [ ] 07-03-PLAN.md — ingredientMatching + regenerateDay + markCooked + meal-plans routes (TDD)
- [ ] 07-04-PLAN.md — Mobile mealPlanStore with optimistic swap/cook and rollback (TDD)
- [ ] 07-05-PLAN.md — Plan tab UI: DayRow, SwapSheet, CookConfirm, visual verification
**UI hint**: yes

### Phase 8: Shopping & Instacart
**Goal**: Users can go from a meal plan to a grocery order with minimal effort
**Depends on**: Phase 7
**Requirements**: SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05, SHOP-06, SHOP-07
**Success Criteria** (what must be TRUE):
  1. Shopping list auto-generates from a meal plan with ingredients consolidated and pantry items subtracted
  2. Shopping list items are grouped by grocery category (produce, dairy, protein, etc.)
  3. User can check off, add, and edit items on the shopping list
  4. User can send the shopping list to Instacart and land on a ready-to-order page
  5. User can view past orders, reorder with one tap, and see AI-suggested variations
**Plans**: 7 plans
Plans:
- [ ] 08-01-PLAN.md — Migration (shopping_lists/items/orders) + shared TS types (server + mobile)
- [ ] 08-02-PLAN.md — shoppingList service: consolidateIngredients + subtractPantry + suggestVariations (TDD)
- [ ] 08-03-PLAN.md — ingredientCategories: static map + Claude Haiku hybrid classifier (TDD)
- [ ] 08-04-PLAN.md — InstacartClient: Stub + Real + env-gated factory (TDD)
- [ ] 08-05-PLAN.md — /api/v1/shopping routes: generate, CRUD, order, reorder, variations
- [ ] 08-06-PLAN.md — Mobile shoppingStore with optimistic updates (TDD)
- [ ] 08-07-PLAN.md — Shopping tab UI, orders, order detail, visual verification
**UI hint**: yes

### Phase 9: Voice Cooking Mode
**Goal**: Users can cook any recipe hands-free with a conversational AI assistant
**Depends on**: Phase 6
**Requirements**: VOIC-01, VOIC-02, VOIC-03, VOIC-04, VOIC-05, VOIC-06, VOIC-07
**Success Criteria** (what must be TRUE):
  1. User can enter cooking mode for any recipe and see large, readable step-by-step instructions with screen staying awake
  2. User can navigate steps hands-free with voice commands (next, back, repeat)
  3. User can set timers with voice and hear recipe steps read aloud via TTS
  4. User can ask conversational questions while cooking (substitutions, technique explanations) and get useful answers
  5. Basic voice commands (next/back/repeat/timer) respond in under 1 second
**Plans**: 5 plans
Plans:
- [ ] 09-01-PLAN.md — Install voice deps, iOS permission plugin, Cooking types, cookingStore (TDD)
- [ ] 09-02-PLAN.md — intentRouter + timerParser pure modules with perf test (TDD)
- [ ] 09-03-PLAN.md — Backend POST /api/v1/cooking/ask Hono route with Claude Sonnet (TDD)
- [ ] 09-04-PLAN.md — useStepSpeaker + useVoiceListener + askAssistant hooks/client
- [ ] 09-05-PLAN.md — Cook screen UI, components, recipe-detail entry, device verification checkpoint
**UI hint**: yes

### Phase 10: Skill Progression & Offline
**Goal**: The app gently coaches users to grow as cooks based on their cooking history, and remains useful without an internet connection
**Depends on**: Phase 7, Phase 9
**Requirements**: SKIL-01, SKIL-02, SKIL-03, SKIL-04, FOUN-07
**Success Criteria** (what must be TRUE):
  1. App tracks which recipes the user has cooked and how frequently
  2. App suggests slightly more ambitious recipes based on the user's cooking history
  3. Contextual cooking tips appear on recipe steps (technique explanations, timing advice)
  4. AI suggests creative variations on frequently-cooked recipes
  5. App works offline for cached data (recipes, pantry inventory, meal plans)
**Plans**: 5 plans
Plans:
- [ ] 10-01-PLAN.md — Migration (recipe_cooks, recipe_step_tips), shared TS types, netinfo install
- [ ] 10-02-PLAN.md — Progression service (cook stats, ambition ranker, variations) + routes + markCooked hook (TDD)
- [ ] 10-03-PLAN.md — cookingTips Haiku service with cache + GET /cooking/tips route (TDD)
- [ ] 10-04-PLAN.md — Mobile offline: networkStore, offlineQueue, Zustand persist on 5 stores (TDD)
- [ ] 10-05-PLAN.md — UI wiring (progressionStore, suggestions, tips, variations, offline banner) + device verification

**UI hint**: yes

### Phase 11: Hybrid AI Client
**Goal**: All AI services route through a provider-agnostic AIClient interface with per-task Anthropic/Gemini routing, preserving behavior and test coverage
**Depends on**: Phase 10
**Requirements**: ARCH-01, ARCH-02, ARCH-03
**Success Criteria** (what must be TRUE):
  1. Every AI service and route calls getClientFor(task) instead of importing @anthropic-ai/sdk directly
  2. Task routing map sends vision + recipe-photo to Anthropic Sonnet 4.6 and everything else to Gemini 3.x per research
  3. All existing service tests pass using factory-level mocks (no SDK mocks)
  4. Env-gated smoke test script validates every AITask against live providers
**Plans**: 5 plans
Plans:
- [ ] 11-01-PLAN.md — Foundation: install @google/genai, AIClient interface, AnthropicAdapter + GeminiAdapter, task routing, unit tests
- [ ] 11-02-PLAN.md — Migrate vision.ts + recipeParser.ts (Anthropic photo paths, Gemini URL/text path)
- [ ] 11-03-PLAN.md — Migrate suggestions, mealPlanner, recipeDiscovery, progression (drop AnthropicLike DI), shoppingList
- [ ] 11-04-PLAN.md — Migrate cookingTips, ingredientCategories, routes/cooking.ts /ask endpoint
- [ ] 11-05-PLAN.md — Delete config/anthropic.ts, add env-gated smoke test script, visual verification checkpoint
**UI hint**: no

### Phase 12: Combine Home & Recipes
**Goal**: Merge the Home and Recipes tabs into a single unified "Kitchen" tab with segmented control (Suggestions | Library); tab bar drops from 5 to 4 tabs with all existing recipe and suggestion features preserved
**Depends on**: Phase 6, Phase 4
**Requirements**: UI rationalization (post-v1)
**Success Criteria** (what must be TRUE):
  1. Home and Recipes are consolidated into a single tab
  2. AI dinner suggestions and recipe library coexist on the unified page
  3. All existing recipe features (import, favorites, search, filters) remain accessible
  4. Tab bar has one fewer entry with no orphaned navigation routes
**Plans**: 3 plans
Plans:
- [ ] 12-01-PLAN.md — Create kitchen.tsx (segmented control + dual lists with display:none), update _layout.tsx (Kitchen leftmost, 4 tabs), delete old index.tsx + recipes.tsx, stub new Maestro flow
- [ ] 12-02-PLAN.md — Update 4 route call sites (scan/review, recipes/review, recipes/import-url) to target /(tabs)/kitchen with ?segment=library on save flows; full typecheck clean
- [ ] 12-03-PLAN.md — Rewrite 6 Maestro flows for Kitchen+Library navigation, fill in 20-kitchen-segment-toggle.yaml, full Maestro suite green, human UAT checkpoint
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11
Note: Phases 2, 3, and 5 can execute in parallel (all depend only on Phase 1).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Setup & Auth | 3/3 | Complete   | 2026-04-11 |
| 2. Household Preferences | 3/3 | Complete   | 2026-04-11 |
| 3. Pantry Scanning | 4/4 | Complete   | 2026-04-12 |
| 4. Fridge-to-Dinner Suggestions | 3/3 | Complete   | 2026-04-12 |
| 5. Recipe Import | 4/4 | Complete   | 2026-04-12 |
| 6. Recipe Library | 5/5 | Complete   | 2026-04-12 |
| 7. Meal Planning | 5/5 | Complete   | 2026-04-12 |
| 8. Shopping & Instacart | 7/7 | Complete   | 2026-04-13 |
| 9. Voice Cooking Mode | 5/5 | Complete   | 2026-04-13 |
| 10. Skill Progression & Offline | 5/5 | Complete    | 2026-04-13 |
| 11. Hybrid AI Client | 4/5 | Complete    | 2026-04-13 |
| 12. Combine Home & Recipes | 3/3 | Complete    | 2026-04-18 |

| 13. Receipt Scan & Instacart Import | 2/2 | Complete    | 2026-04-18 |
| 14. Multi-Photo Scan & Smarter Filtering | 2/2 | Complete   | 2026-04-18 |
| 17. Something New (AI recipe exploration) | 5/5 | Complete    | 2026-04-21 |

### Phase 13: Receipt Scan & Instacart Import
**Goal**: Users can bulk-load pantry items by scanning a grocery receipt or importing an Instacart order screenshot, instead of photographing every item individually
**Depends on**: Phase 3, Phase 8
**Requirements**: Pantry scalability (post-v1)
**Success Criteria** (what must be TRUE):
  1. User can photograph a grocery store receipt and get items extracted and added to pantry
  2. User can upload an Instacart order screenshot and get items extracted (descoped from API import — Instacart Developer Platform does not expose order history; see 13-RESEARCH.md)
  3. Imported items are reconciled with existing pantry inventory (no duplicates)
  4. Both flows are accessible from the Pantry tab alongside the existing camera scan
**Plans**: 2 plans
Plans:
- [x] 13-01-PLAN.md — Backend: identifyReceiptItems service (receipt + Instacart variants, denylist), POST /scan-receipt + /import-instacart routes, TDD
- [x] 13-02-PLAN.md — Mobile: pantryStore actions, BulkImportSheet launcher, /scan/receipt + /scan/instacart screens, Maestro smoke, iOS Simulator UAT checkpoint
**UI hint**: yes

### Phase 14: Multi-Photo Scan & Smarter Item Filtering
**Goal**: Users can take multiple photos before submitting a scan, and the AI only returns identifiable food items useful for cooking — no vague placeholders
**Depends on**: Phase 3
**Requirements**: Pantry UX improvement (post-v1)
**Success Criteria** (what must be TRUE):
  1. User can take multiple photos (different angles/shelves) before submitting a single scan
  2. Photo thumbnails are visible and removable before submission
  3. AI deduplicates items seen across multiple photos
  4. AI never returns vague items like "leftover container", "unidentified dairy item", "condiment packet", or "sauce packet" — only identifiable ingredients useful for recipes
  5. Low-confidence items that can't be specifically named are silently excluded
**Plans**: 2 plans
Plans:
- [x] 14-01-PLAN.md — Server: AIClient multi-image extension, vision batch service with filtering prompt, POST /scan-batch route
- [x] 14-02-PLAN.md — Mobile: multi-photo capture UI with thumbnail strip, pantryStore batch scan, review screen fixes
**UI hint**: yes

### Phase 15: UI Polish & Navigation Consistency
**Goal**: Every screen feels native, polished, and consistent with Apple HIG — system iconography replaces emojis, back-button/nav patterns are consistent, visual hierarchy is coherent across the app
**Depends on**: Phase 14
**Requirements**: UI quality (post-v1)
**Success Criteria** (what must be TRUE):
  1. Every pushed/modal screen has a consistent navigation header with back button
  2. Decorative emojis (📸, 🎉, ⚠️, etc.) replaced with Ionicons/SF Symbol equivalents
  3. Empty states, loading states, and error states use a consistent component pattern
  4. Typography scale, spacing, and color usage documented and applied consistently (DEFERRED to Phase 19 — Phase 15 leaves a breadcrumb only)
  5. /gsd:ui-review audit passes with no BLOCK-level issues
**Plans**: 4 plans
Plans:
- [x] 15-01-PLAN.md — Shared primitives (SymbolIcon, EmptyState/LoadingState/ErrorState, useDirtyFormGuard) + Vitest coverage + purity grep scripts
- [x] 15-02-PLAN.md — Native stack headers, modal presentation for scan/recipes import, dirty-form guard wiring, HeaderCloseButton
- [x] 15-03-PLAN.md — Icon + emoji sweep: Ionicons → SymbolIcon across 34 files, decorative emojis → EmptyState/SymbolIcon per mapping
- [ ] 15-04-PLAN.md — Overflow ellipsis (ActionSheetIOS), new Maestro flows (21-modal-dismiss, 22-dirty-form-guard), re-baseline existing flows, /gsd:ui-review gate
**UI hint**: yes


### Phase 16: Cooking Mode UX Enhancements
**Goal**: Hands-free cooking becomes genuinely delightful — voice recognition is fast and accurate with a better model, the UI during cooking is polished and iOS-native, and essential information (current step, ingredients, timers) is displayed clearly without clutter
**Depends on**: Phase 9, Phase 15
**Requirements**: Cooking UX improvement (post-v1)
**Success Criteria** (what must be TRUE):
  1. Voice interaction feels responsive — latency between user utterance and Claude response is noticeably improved vs. current Phase 9 implementation
  2. Voice model upgrade evaluated — on-device speech recognition (expo-speech-recognition) verified against current quality, or upgraded path chosen (better model, server-side Whisper fallback, etc.)
  3. Cooking mode UI is polished and consistent with Apple HIG — typography, spacing, state transitions, and icons meet Phase 15's design standards
  4. During cooking, users see at a glance: current step, upcoming steps, active timers, remaining ingredients/quantities without scrolling
  5. Voice commands to navigate (next/previous step, repeat, pause timer, set timer, show ingredients) work reliably with clear visual confirmation
**Plans**: 9 plans
Plans:
- [x] 16-00-PLAN.md — Wave 0 test scaffolding + cookingStore extensions + expo-haptics install + DEVICE-TEST-16 skeleton
- [x] 16-01-PLAN.md — Telemetry pipeline: cooking_events migration + POST /telemetry/cooking + mobile batched logger
- [x] 16-02-PLAN.md — SSE streaming /cooking/ask-stream server route + mobile streamAsk client (completed 2026-04-22)
- [x] 16-03-PLAN.md — Header primitives: StickyCookingHeader, VoiceWaveform, StopTTSButton, TimerBar retoken + haptics helpers + useVoiceAmplitude
- [x] 16-04-PLAN.md — Body primitives: StepCard, IngredientRow, ScrollableRecipe + useCurrentStepScroll hook
- [x] 16-05-PLAN.md — CommandToast + StepNavButtons @ 72pt + AskSheet retoken + handleTranscript toast/haptic deps
- [x] 16-06-PLAN.md — Integration: rewrite cook.tsx composing every primitive + SSE fallback + dark-mode scoped palette + T-10s haptic + exit confirm + telemetry hooks
- [x] 16-07-PLAN.md — Settings Cooking section + dark-mode toggle + Maestro flow 28 + delete StepDisplay/VoiceStatusBadge + human checkpoint
- [ ] 16-08-PLAN.md — DEVICE-TEST-16 execution on physical iPhone (latency/voice/haptics/dark-mode/real-kitchen telemetry)
**UI hint**: yes

### Phase 17: "Something New" — AI Recipe Exploration
**Goal**: Reimagine the Suggestions segment from a reactive "tap to regenerate" loop into a proactive recipe search. Users type keywords, get AI-generated recipes, optionally filter to only ones possible with current pantry, and remix-and-save the ones they like
**Depends on**: Phase 12, Phase 4
**Requirements**: Suggestions UX reimagining (post-v1)
**Success Criteria** (what must be TRUE):
  1. Suggestions segment renamed to "Something New"
  2. Landing on the segment shows persisted previous results (no empty state with a blocking FAB)
  3. User can type keywords in a search bar to explore AI-generated recipe ideas
  4. "From the pantry" filter toggle restricts results to recipes feasible with current pantry
  5. Tap-to-remix on any result opens the existing remix/edit flow, with save-to-Recipe Box
  6. Sparkles regenerate FAB is either replaced or repositioned so it doesn't feel like the only entry point
**Plans**: 5 plans
Plans:
- [x] 17-00-PLAN.md — Wave 0 Nyquist test scaffolding: 6 new test files + 2 existing extensions stubbed red before production code
- [x] 17-01-PLAN.md — Server: POST /recipes/search route + buildDiscoveryPrompt pantry-manifest extension
- [x] 17-02-PLAN.md — Mobile store: suggestionsStore persist + searchRecipes + clearHistory + dedupPrepend helper
- [x] 17-03-PLAN.md — Mobile UI: segment rename + /search modal branch + PreviewSheet Remix + FAB→HeaderEllipsis + recent-query chips + pantry toggle
- [x] 17-04-PLAN.md — UAT: new Maestro flow 27-something-new-search + flow 20 label rebase + human iOS Simulator checkpoint
**UI hint**: yes

### Phase 18: AI Auto-Location for Pantry Imports
**Goal**: Remove the forced choice between fridge/pantry/freezer on pantry import flows. The AI infers per-item location from context (ingredient type, temperature requirements, packaging) so users don't have to think about it
**Depends on**: Phase 3, Phase 13, Phase 14
**Requirements**: Pantry UX improvement (post-v1)
**Success Criteria** (what must be TRUE):
  1. AI returns a suggested source_location per item across camera scan, receipt scan, and Instacart import
  2. Review screen shows location per item as an editable chip (override possible if AI is wrong)
  3. LocationPicker is removed as a gating step before scanning (or reduced to an optional hint)
  4. Default locations are sensible: dairy/meat/produce → fridge; frozen → freezer; shelf-stable → pantry
  5. Receipt/Instacart imports correctly distribute items across all three locations in one session
**Plans**: 4 plans
Plans:
- [x] 18-01-PLAN.md — Foundation: migrations (item_attributes JSONB + item_override_events table) + hybrid STATIC_MAP/AI classifier service + SourceLocation type
- [x] 18-02-PLAN.md — Backend wiring: extend vision tool schemas with source_location, reconcileItems dual-write, strip sourceLocation from scan routes, new /override-events route
- [x] 18-03-PLAN.md — Mobile primitives: LocationChip + LocationChoiceSheet + ReviewItemRow integration + pantryStore signature changes + override-event logging
- [ ] 18-04-PLAN.md — LocationPicker removal across all scan entries + Maestro flow rebase + iOS Simulator UAT checkpoint
**UI hint**: yes

### Phase 19: Design Professionalization
**Goal**: App feels polished enough to ship commercially — icons, buttons, navigation, search bars, typography, and shared design patterns are consistent and premium-feeling. Reference points: Spotify (dark premium feel, typography, tab bar), Strava (information density, chip design, activity cards), DoorDash (search bar pattern, filter chips, cart CTAs)
**Depends on**: Phase 15
**Requirements**: Design quality (post-v1)
**Success Criteria** (what must be TRUE):
  1. Icon set is coherent — one icon family (SF Symbols or Ionicons) used consistently, sized and weighted to a documented scale
  2. Button system has documented variants (primary, secondary, ghost, destructive, icon-only) with consistent heights, padding, and states
  3. Search bars follow one pattern across Recipe Box, Something New, and any other searchable surfaces
  4. Navigation headers use a consistent pattern — large title collapses to compact, back buttons styled identically, right-side action slots ordered predictably
  5. Filter chips, category chips, and toggle chips share one design language
  6. Color palette documented — semantic roles (primary/accent/warning/destructive/surface/subtle) with usage rules
  7. Typography scale documented (display/title/body/caption/label) with consistent line heights
**Plans**: 6 plans
Plans:
- [x] 19-01-PLAN.md — Design token foundation: CSS variables in global.css, tailwind.config.js extension, tokens.ts/icons.ts/typography.ts typed re-exports, Wave 0 parity + purity + icon unit tests
- [x] 19-02-PLAN.md — Primitive rewrites: Button (5 variants @ 44pt), Chip (filter|display kinds), Input retheme; pure-className tests; ChipToggle deprecation shim
- [x] 19-03-PLAN.md — StickySearchPill + /search modal route + shared ItemRow primitive (checkbox|stepper|icon leading variants)
- [x] 19-04-PLAN.md — Mode-aware RecipeCard (grid + list) + denser DayRow with Chip status indicators
- [x] 19-05-PLAN.md — One-pass sweep: orange->terracotta across ~25 files, tab-bar/FAB/collapsingHeader retint, Shopping+Pantry adopt ItemRow, ChipToggle+legacy SearchBar deleted, tokens-purity test enabled
- [ ] 19-06-PLAN.md — Maestro flow updates (sticky pill, tab tint, FAB visual), new 21-design-buttons-visual flow, Metro cache clear, human UAT Gate A
**UI hint**: yes

### Phase 20: Shopping Refactor — Push to Draft Cart
**Goal**: Replace the current "create an order via recipe/shopping-list URL" flow with a draft-cart handoff. DinnerTime pushes selected items to the user's Instacart cart as drafts; the user lands in Instacart with everything pre-populated but manages payment method, delivery window, substitutions, and final checkout inside Instacart itself. DinnerTime is the curator, not the checkout system.
**Depends on**: Phase 8
**Requirements**: Shopping UX improvement (post-v1)
**Success Criteria** (what must be TRUE):
  1. "Order on Instacart" flows (shopping list and recipe) no longer create a checkout-ready order; they push items into the user's Instacart cart as drafts
  2. User lands inside the Instacart app (or web) with items pre-populated but can still add/remove, choose payment, pick a delivery window, and confirm substitutions before checkout
  3. Items pushed include quantities, units, and UPC matches where possible (reuse existing Instacart API item-matching)
  4. DinnerTime UI clearly communicates the handoff: "Sending to Instacart cart…" → success state → deep link / URL to continue in Instacart
  5. No card-on-file, no delivery-window picker, no payment UI inside DinnerTime — those responsibilities move entirely to Instacart
  6. Existing Phase 8 shopping-list features (auto-generation from meal plan, consolidation, manual edits) remain functional before the cart handoff
**Plans**: 5 plans
Plans:
- [x] 20-00-PLAN.md — Wave 0 scaffolding: 5 red mobile test stubs, server telemetry + migrations test extensions, 00024_shopping_events migration, settingsStore (shoppingHandoffMode flag), DEVICE-TEST-20 skeleton
- [ ] 20-01-PLAN.md — Shopping telemetry pipeline (mobile logger cloned from cooking/telemetry + POST /api/v1/telemetry/shopping route) + openInstacartCart deep-link helper + classifyHandoffError discriminator
- [ ] 20-02-PLAN.md — Settings hidden rollback toggle (5-tap reveal gesture on "Shopping" section header, flips shoppingHandoffMode between draft_cart and legacy)
- [ ] 20-03-PLAN.md — HandoffSheet primitive (Apple-Pay-style bottom-sheet, 3 visible states: sending / success / error with variant-specific copy)
- [ ] 20-04-PLAN.md — Integration: rewire shopping.tsx handleOrder (HandoffSheet + feature flag + telemetry wiring) + rename orders.tsx → handoffs.tsx (UI-only, DB unchanged) + Maestro flow 12 copy rebase
- [ ] 20-05-PLAN.md — Maestro flow 29 (happy path + dismiss), full regression sweep, DEVICE-TEST-20 simulator rows, human UAT checkpoint
**UI hint**: yes

### Phase 21: Pantry Intelligence
**Goal**: Pantry feels smart — identity-based dedup (shipped in Phase 24a), user-defined rules + staples for recurring items, silent category learning, improved pantry-tab presentation (4-way grouping, sticky search, stale treatment, compact rows). Criterion #1 (fuzzy dedup) is EXPLICITLY DROPPED — superseded by Phase 24a canonical-identity dedup.
**Depends on**: Phase 3, Phase 14, Phase 18, Phase 24a (canonical substrate)
**Requirements**: Pantry UX improvement (post-v1)
**Success Criteria** (what must be TRUE):
  1. ~~Smarter deduplication — fuzzy name matching~~ (DROPPED — Phase 24a identity dedup supersedes)
  2. Improved pantry-tab presentation — 4-way grouping toggle (Location/Category/Staples/Recent), sticky search pill, stale treatment (dashed border + opacity when confidence < 0.5), compact ItemRow variant
  3. AI categorization learns — silent first-correction category override per user (writes to Phase 24a canonical_category_override); aggregator surfaces 2-occurrence-in-30-days repeats as Suggestions in Settings
  4. User-defined scan rules — two rule types (name-mapping + location-mapping), drag-to-reorder precedence, Settings-only entry, 30-day preview panel
  5. Commonly purchased items list — staples keyed by canonical_ingredient_id, auto-accept threshold 0.3 (vs default 0.7), mark via row ellipsis + Pantry filter chip + Settings management
  6. Rules are manageable — Settings → Pantry Rules with edit/delete/drag-reorder + 30-day preview of affected items
**Plans**: 6 plans
Plans:
- [x] 21-01-PLAN.md — Migrations 00016-00019 (user_staples + user_location_rules + suggested_rules + canonical_scan_counts + promote RPC) + migrations.test.ts contract
- [x] 21-02-PLAN.md — TDD services: ruleEvaluator + suggestionAggregator + canonicalPromoter
- [x] 21-03-PLAN.md — reconcileItems rule-evaluator integration + 5 new route groups (staples/rules/suggestions/preview/category-override) + fire-and-forget aggregator+promoter on /confirm
- [x] 21-04-PLAN.md — Mobile Pantry tab: ItemRow compact variant + PantryItemCard stale treatment + 4-way grouping hook + StickySearchPill + Staples filter chip + pantryStore staples auto-accept + persist migration
- [x] 21-05-PLAN.md — Mobile Settings/Rules UI: draggable-flatlist install + pantryStore rules/suggestions actions + settings/pantry-rules.tsx + settings/staples.tsx + PantryItemCard ellipsis Mark-as-staple
- [x] 21-06-PLAN.md — Maestro flows 24/25/26 + full suite regression + human UAT checkpoint
**UI hint**: yes

### Phase 22: Plan Experience Refactor
**Goal**: Meal planning becomes the backbone of the weekly cooking workflow — seamlessly pulling from Recipe Box and AI suggestions, flowing naturally into shopping, and exposing useful actions at day / week / month scales. Planning itself is a vehicle for progression: the plan nudges users toward new skills and tracks growth over time
**Depends on**: Phase 7, Phase 4, Phase 6, Phase 8, Phase 10, Phase 12, Phase 17, Phase 20
**Requirements**: Planning UX improvement (post-v1)
**Success Criteria** (what must be TRUE):

### Cross-flow navigation
  1. Plan → Recipe: any planned meal is one tap from full recipe view; back from recipe returns to the same day in the plan
  2. Recipe → Plan: from any recipe (Recipe Box or Something New search result), user can add to a specific day with a date picker, not just "generate a week"
  3. Plan → Shopping: selecting days or whole plan generates a shopping list with one tap; shopping list knows which items came from which planned meals
  4. Suggestions → Plan: any AI suggestion can be pinned to a specific day immediately

### Date pickers and scale
  5. Native iOS date picker for adding individual meals to any future date
  6. Week view (current default) and a month overview — month view shows planned days at a glance, empty days, and cooked-vs-planned ratio
  7. Day drill-down: tap a day → see planned meal, ingredients checklist, timer shortcuts, "cook now" entry point to Voice Cooking Mode
  8. Week-level actions: regenerate week, shift week forward/back, duplicate last week, shopping list for week
  9. Month-level actions: see patterns (repeat meals, protein balance, cuisine distribution), plan around known events (travel days skipped, dinner parties marked)

### Skill progression integration
 10. Plan suggestions nudge toward skill level above current (one "stretch" meal per week)
 11. Completed plans feed progression metrics — which techniques, cuisines, complexity levels the user has executed
 12. "Weekly skill focus" concept: plan intentionally exposes user to a specific technique (knife skills, pan sauces, fermentation) across the week's meals
 13. Plan generation respects progression gate — doesn't suggest advanced recipes until prerequisite basics are cooked

### Information density on Plan tab
 14. Each day card shows: meal name, cook time, one stretch/new indicator, cook status, pantry-readiness indicator
 15. Visual distinction between cooked / scheduled / skipped / unplanned
 16. Quick edit inline (swap day, mark cooked, skip) without leaving Plan tab

**Plans**: 0 plans
Plans: (not yet planned)
**UI hint**: yes

### Phase 23: Settings, Auth & Non-Functional Requirements
**Goal**: Bring Settings, auth, and the app's non-functional posture up to production-grade. Users can fully manage their account (password, email, data export, delete). Auth lifecycle is smooth (biometric unlock, graceful session recovery, clear sign-out). Non-functional posture (error handling, observability, performance, security) meets App Store and commercial-app expectations
**Depends on**: Phase 1, Phase 2, Phase 19
**Requirements**: Platform readiness (post-v1)
**Success Criteria** (what must be TRUE):

### Settings — account management
  1. Change password (current password verification, new password rules, success feedback)
  2. Change email (verification email sent, old email kept until confirmed)
  3. Export data — user can download JSON dump of their profile, pantry, recipes, meal plans, cook history
  4. Delete account — destructive action with confirmation, clearly communicated data-retention policy, Supabase auth + data deletion
  5. Connected services — show/revoke Instacart connection (if any), future integrations
  6. About section — app version, build number, privacy policy link, terms link, support contact

### Auth lifecycle
  7. Face ID / Touch ID unlock option — opt-in, wraps existing session retrieval, graceful fallback to password
  8. Session refresh / graceful re-auth — if access token expires mid-use, refresh silently; if refresh fails, re-auth modal instead of kicking to login
  9. Forgot password flow — email-based reset, in-app deep link handles reset URL
 10. Sign out confirmation — current "Sign out?" alert polished, clear what gets cleared locally vs. cloud
 11. First-time login vs. returning — returning users skip onboarding if already onboarded; onboarding resumable if interrupted

### Non-functional: error handling
 12. Global error boundary — any uncaught error shows a friendly fallback screen, not a white-screen crash; "Report issue" action
 13. Network errors — consistent pattern (inline banner, retry affordance) across all screens; offline mode visible and dismissible
 14. Rate-limit / quota errors from Claude or Supabase — surfaced to the user with actionable language ("We're a bit busy — try again in a minute") not raw error codes

### Non-functional: observability
 15. Client-side error reporting — Sentry or equivalent wired up (errors, breadcrumbs, user-correlated session IDs)
 16. Server-side request logging — structured logs with request IDs, user IDs, endpoint, latency, status
 17. AI call telemetry — tokens in/out, model used, task route, latency per task (informs cost and performance work)

### Non-functional: performance
 18. Startup budget — cold-start to interactive < 2 seconds on a recent iPhone
 19. Screen transition budget — tab switches feel instant (< 16ms frame budget), no dropped frames during collapsing-header animations
 20. Scan + AI response budget — user sees feedback within 500ms, full result within target per task (receipt ≤ 8s, pantry scan ≤ 6s)
 21. Image handling — base64 images processed off-main-thread where possible; file sizes kept under Anthropic's 5MB via existing quality settings

### Non-functional: security
 22. Keychain storage verified for all sensitive tokens (Supabase access, refresh, Instacart)
 23. HTTPS-only API calls enforced (no fallback to HTTP in prod)
 24. Deep link allowlist — only known `/recipes/*`, `/scan/*`, password-reset paths accepted
 25. No PII or secrets in client-side logs or server logs

### Non-functional: App Store readiness
 26. Privacy nutrition label matches actual data collection
 27. App Store screenshots, description, keywords drafted
 28. Required legal pages (Privacy Policy, Terms of Service) linked from Settings and reachable without login
 29. Support contact email or in-app report form

**Plans**: 0 plans
Plans: (not yet planned)
**UI hint**: yes

### Phase 24: AI Vision & Pantry Data-Model Deep Refactor
**Goal**: Upgrade the engineering substrate under every pantry flow. The vision pipeline becomes more accurate and self-correcting, items are resolved to canonical ingredients instead of raw strings, categorization is consistent across sources, deduplication works on identity (not just name), quantity is properly modeled (not crammed into a number+unit), and the data model supports all the smart behaviors the upstream UX phases want to express
**Depends on**: Phase 3, Phase 11, Phase 14, Phase 18, Phase 21
**Requirements**: Platform quality (post-v1)
**Success Criteria** (what must be TRUE):

### Scan quality — vision pipeline
  1. Prompt engineering is formalized — prompts live in versioned files with an evaluation harness (golden fixture images with expected outputs)
  2. Regression harness catches prompt drift — if a prompt change drops accuracy on any fixture, the PR fails
  3. Multi-pass reasoning for tough scans — first pass identifies regions/shelves, second pass extracts items per region; improves accuracy for dense scenes
  4. Retry + fallback — structured-tool failures fall back to text parsing; text-parsing failures surface a clear user error (not silent empty results)
  5. Model routing per variant — receipt / fridge-photo / Instacart-screenshot may use different prompts or even different models, all routed through the Phase 11 AIClient abstraction

### Item creation logic
  6. Raw AI output → canonical ingredient resolution — "CHKN BRST", "chicken breast", "organic boneless skinless chicken breast" all resolve to the same canonical ingredient
  7. Canonical ingredient table — seed with a curated list (produce, proteins, dairy, grains, condiments, beverages); extensible via admin and via usage
  8. Aliases table — maps observed names to canonical IDs, learns from user corrections
  9. Item creation is idempotent — re-scanning an existing item updates `last_seen_at` and `quantity` without creating a new row

### Categorization consistency
 10. Category is a property of the canonical ingredient, not the scanned instance — "milk" is always dairy regardless of which scan produced it
 11. Category override is a user preference on the canonical ingredient, not the item — changing "olive oil" from condiment to pantry applies everywhere
 12. Mixed categorizations (AI returns different categories for the same ingredient across scans) are resolved via canonical ingredient table

### Deduplication on identity, not name
 13. Duplicates detected by canonical ingredient ID + source_location (not fuzzy string match) — reliably catches "organic bananas" + "bananas" + "banana" as one
 14. Identity-based dedup replaces the fuzzy helper added in Phase 21 (it becomes a fallback when no canonical match exists)
 15. Batch scan dedup (Phase 14) also uses canonical IDs — merging across photos is deterministic

### Quantity and unit semantics
 16. Quantity is modeled as a value + unit + unit-system — not a free-form number+string. Examples: {value: 2, unit: "piece", system: "count"}, {value: 1, unit: "lb", system: "imperial-weight"}, {value: 500, unit: "ml", system: "metric-volume"}
 17. Unit conversion library — known equivalences for cooking units (cups, tbsp, tsp, ml, l, oz, lb, g, kg, pieces)
 18. Pantry quantity aggregation — when the same canonical item is scanned multiple times, quantities accumulate in compatible units; incompatible units are stored as multiple entries with a UX hint
 19. Confidence per field — name, quantity, unit, category each have their own confidence; review UI surfaces low-confidence fields inline

### Data storage logic
 20. Database migration: new `canonical_ingredients` and `ingredient_aliases` tables; `pantry_items` gains `canonical_ingredient_id` FK
 21. Migration is reversible and non-destructive — existing pantry items get alias entries auto-created on first match
 22. Immutable event log — each scan produces `scan_events` rows for auditability and future ML feedback
 23. Existing reconcileItems rewritten to use canonical IDs; all four scan flows (camera, batch, receipt, Instacart) adopt the new path

### Quality gates
 24. Fixture-based accuracy metric — we can say "receipt scan is 94% accurate on the test set"; each release must not regress
 25. Performance doesn't regress — multi-pass reasoning stays within Phase 23's latency budgets
 26. User-facing behavior preserved — existing review screen still works, category chips still editable, dupe flag still fires

**Plans**: 6 plans (Phase 24a — data-model + dedup, criteria 6-23)
Plans:
- [x] 24-01-PLAN.md — Migrations 00011-00015 + canonical (~300) + alias (~2000-3000) seed JSONs + migrations.test.ts extension
- [x] 24-02-PLAN.md — units.ts unit conversion library (TDD) — REQ-16/17
- [x] 24-03-PLAN.md — canonicalResolver.ts: exact canonical → alias → fuzzy → candidate auto-create (TDD) — REQ-07/09/14
- [x] 24-04-PLAN.md — vision.ts + identifyReceiptItems.ts tool schema extensions (nested Quantity + nested FieldConfidence) — REQ-16/19 at AI boundary
- [x] 24-05-PLAN.md — Rewritten reconcileItems (canonical-identity dedup + quantity aggregation) + scan_events write-path on 4 scan flows — REQ-13/15/18/19/23
- [x] 24-06-PLAN.md — Mobile ScanResult mirror + inline low-confidence UI on ReviewItemRow + Maestro smoke UAT checkpoint

**Scope note:** Phase 24a covers ROADMAP criteria 6-23. Criteria 1-2, 4-5, 24-26 (versioned prompts, eval harness, accuracy metric, retry/fallback, model routing per variant) are Phase 24b — scheduled for a future `/gsd:plan-phase` invocation. Criterion 3 (multi-pass reasoning) is DESCOPED entirely.

**UI hint**: no (primarily backend + data model; minimum inline confidence UI on review screen is the only mobile-visible change)

### Phase 25: Private Beta Launch
**Goal**: Ship DinnerTime to a small circle of real users — Patrick's household + family + friends. Seed the app with real kitchen data, distribute via TestFlight (with App Store review path), gather structured feedback, and establish a release rhythm. This is the first real validation of the app outside the builder's phone
**Depends on**: Phase 19, Phase 23
**Requirements**: Launch readiness (post-v1)
**Success Criteria** (what must be TRUE):

### Real kitchen data (dogfooding)
  1. Patrick's actual pantry is captured — fridge, pantry, freezer scanned and confirmed; weekly re-scans are habitual
  2. At least 30 recipes imported from real sources (bookmarked URLs, cookbook photos, family recipes)
  3. One real week of meal plans generated, cooked, shopped — end-to-end flow validated on live data
  4. AI suggestions evaluated against real pantry state — noted which suggestions felt right and which didn't, feedback logged for future tuning

### User invites
  5. Invite list confirmed — household + target family/friends (target: 5–15 beta users)
  6. Onboarding flow tested with a non-builder — someone outside the household signs up, onboards, and completes their first scan unassisted
  7. Each invited user has a path to give feedback (in-app feedback form, email, or TestFlight feedback)

### TestFlight distribution
  8. TestFlight build uploaded via EAS Submit
  9. Internal testing group configured (Patrick's Apple ID + invited testers)
 10. External testing group configured if > 25 users (requires App Review for external beta)
 11. TestFlight crash reports and feedback wired to Patrick's review workflow
 12. Build numbering / versioning strategy documented (semver + build number auto-increment via EAS)

### App Store submission
 13. App Store Connect listing drafted — name, subtitle, description, keywords, category (Food & Drink)
 14. Screenshots captured — required device sizes (iPhone 6.9", 6.5", 5.5" per current Apple requirements), showing Kitchen / Plan / Pantry / Shopping / voice cooking
 15. App Preview video optional but drafted — 30s showing the core loop (snap → suggest → plan → cook)
 16. Privacy nutrition label filled out accurately — matches actual data collection (Supabase, Anthropic, Instacart)
 17. Privacy Policy and Terms of Service published and linked from Settings
 18. Age rating set; content warnings (if any) declared
 19. Export compliance answered (no encryption beyond HTTPS/Keychain required)
 20. App submitted to App Review for TestFlight external beta OR full public release — decision based on maturity

### Release rhythm
 21. Release checklist documented (see `.planning/RELEASE.md` or equivalent) — version bump, changelog, EAS build, submit, announce
 22. Backend deployment path confirmed — server running on Fly.io or Railway (NOT localhost+cloudflared tunnel) with HTTPS and uptime
 23. Backend secrets rotated from dev keys to prod keys
 24. Feedback loop established — at least one structured check-in with each beta user after a week

### Decision: private/unlisted vs. public
 25. Distribution posture decided — TestFlight-only (max ~10k testers, 90-day expiry) vs. App Store unlisted vs. App Store public
 26. If App Store: understand family-and-friends is the initial audience but the app is publicly installable

**Plans**: 0 plans
Plans: (not yet planned)
**UI hint**: yes (screenshots, App Store assets, onboarding polish may reveal UI issues)
