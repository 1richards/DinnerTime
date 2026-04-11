# Roadmap: DinnerTime

## Overview

DinnerTime delivers value in a dependency-driven sequence: foundation infrastructure first, then the core "fridge photo to dinner ideas" loop (the thesis that must validate), followed by recipe management that feeds into weekly meal planning, then shopping and Instacart integration, and finally premium features (voice cooking, skill progression, offline support). Each phase delivers a complete, testable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Project Setup & Auth** - Scaffold the app, backend, database, and user authentication
- [ ] **Phase 2: Household Preferences** - Users configure their household, dietary needs, and cuisine preferences
- [ ] **Phase 3: Pantry Scanning** - AI-powered photo scanning to build and maintain a pantry inventory
- [ ] **Phase 4: Fridge-to-Dinner Suggestions** - AI recommends meals based on what is in the pantry
- [ ] **Phase 5: Recipe Import** - Users bring recipes into the app from URLs, photos, and manual entry
- [ ] **Phase 6: Recipe Library** - Users organize, search, favorite, and discover recipes
- [ ] **Phase 7: Meal Planning** - AI generates balanced weekly dinner plans
- [ ] **Phase 8: Shopping & Instacart** - Auto-generated shopping lists with one-tap Instacart ordering
- [ ] **Phase 9: Voice Cooking Mode** - Hands-free conversational AI assistant while cooking
- [ ] **Phase 10: Skill Progression & Offline** - Gentle skill coaching, creative variations, and offline support

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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
Note: Phases 2, 3, and 5 can execute in parallel (all depend only on Phase 1).

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Project Setup & Auth | 0/3 | Planning complete | - |
| 2. Household Preferences | 0/TBD | Not started | - |
| 3. Pantry Scanning | 0/TBD | Not started | - |
| 4. Fridge-to-Dinner Suggestions | 0/TBD | Not started | - |
| 5. Recipe Import | 0/TBD | Not started | - |
| 6. Recipe Library | 0/TBD | Not started | - |
| 7. Meal Planning | 0/TBD | Not started | - |
| 8. Shopping & Instacart | 0/TBD | Not started | - |
| 9. Voice Cooking Mode | 0/TBD | Not started | - |
| 10. Skill Progression & Offline | 0/TBD | Not started | - |
