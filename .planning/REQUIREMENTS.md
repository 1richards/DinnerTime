# Requirements: DinnerTime

**Defined:** 2026-04-07
**Core Value:** Open the fridge, take a photo, get dinner ideas — zero mental effort from "what do we have?" to "what should we cook?"

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: User can create account with email and password
- [x] **FOUN-02**: User session persists across app restarts
- [x] **FOUN-03**: User can set dietary preferences for the household
- [x] **FOUN-04**: User can set household size and family member profiles (adults vs kids)
- [x] **FOUN-05**: User can set cuisine preferences and disliked ingredients
- [x] **FOUN-06**: All user data syncs to cloud storage reliably
- [ ] **FOUN-07**: App works offline for cached data (recipes, pantry, meal plans)

### Pantry Scanning

- [x] **PANT-01**: User can take a photo of their fridge and AI identifies visible food items
- [x] **PANT-02**: User can take a photo of their pantry shelves and AI identifies items
- [x] **PANT-03**: User can take a photo of their freezer and AI identifies items
- [x] **PANT-04**: AI shows detected items with confidence scores for user confirmation
- [x] **PANT-05**: User can correct, remove, or add items the AI missed in a scan
- [x] **PANT-06**: Pantry inventory persists and updates across multiple scans (reconciliation)
- [x] **PANT-07**: Items get confidence decay — items not seen in 7+ days marked as uncertain
- [x] **PANT-08**: User can manually mark items as used or depleted

### Meal Suggestions

- [x] **MEAL-01**: User can get AI dinner suggestions based on current pantry inventory
- [x] **MEAL-02**: Suggestions respect dietary preferences and disliked ingredients
- [x] **MEAL-03**: Suggestions account for kid-friendly meals (familiar flavors, no challenging textures)
- [x] **MEAL-04**: User can get suggestions immediately after a pantry scan ("fridge → dinner ideas" flow)

### Recipe System

- [x] **RECP-01**: User can import a recipe by pasting a URL
- [x] **RECP-02**: User can import a recipe by photographing a cookbook page or handwritten card
- [x] **RECP-03**: User can import a recipe by photographing a screenshot
- [x] **RECP-04**: User can manually enter a recipe with AI assistance to structure it
- [x] **RECP-05**: Imported recipes are parsed into structured format (title, ingredients with quantities/units, steps, times, servings)
- [x] **RECP-06**: User can view, edit, and delete recipes in their library
- [x] **RECP-07**: User can search recipes by keyword
- [x] **RECP-08**: User can favorite recipes
- [x] **RECP-09**: User can adjust serving sizes and ingredient quantities scale accordingly
- [x] **RECP-10**: User can browse AI-suggested recipes from the internet based on preferences

### Meal Planning

- [x] **PLAN-01**: User can generate a weekly dinner plan with AI
- [x] **PLAN-02**: AI meal plans consider pantry inventory, preferences, and recipe library
- [x] **PLAN-03**: AI meal plans avoid repeating recent meals (variety constraints)
- [x] **PLAN-04**: AI meal plans balance complexity across the week (simpler meals on weeknights)
- [x] **PLAN-05**: User can swap individual meals in a generated plan
- [x] **PLAN-06**: User can view meal plan in a weekly calendar view
- [x] **PLAN-07**: Cooking a planned meal auto-deducts ingredients from pantry inventory

### Shopping

- [ ] **SHOP-01**: Shopping list auto-generates from a meal plan by consolidating all ingredients
- [ ] **SHOP-02**: Shopping list subtracts items already in pantry inventory
- [ ] **SHOP-03**: Shopping list items are grouped by category (produce, dairy, protein, etc.)
- [ ] **SHOP-04**: User can check off items, add items, and edit the shopping list
- [ ] **SHOP-05**: User can send shopping list to Instacart for one-tap ordering
- [ ] **SHOP-06**: User can view past orders and reorder with one tap
- [ ] **SHOP-07**: AI suggests creative variations when reordering ("try harissa this time")

### Voice Cooking

- [ ] **VOIC-01**: User can enter cooking mode for any recipe with step-by-step display
- [ ] **VOIC-02**: User can navigate steps hands-free with voice ("next step," "go back," "repeat")
- [ ] **VOIC-03**: User can set timers with voice ("set a timer for 10 minutes")
- [ ] **VOIC-04**: User can ask conversational questions while cooking ("can I substitute X for Y?", "what does braise mean?")
- [ ] **VOIC-05**: App reads recipe steps aloud via text-to-speech
- [ ] **VOIC-06**: Screen stays awake during cooking mode with large readable text
- [ ] **VOIC-07**: Basic voice commands (next/back/repeat/timer) respond in under 1 second

### Skill Progression

- [ ] **SKIL-01**: App tracks which recipes user has cooked and how often
- [ ] **SKIL-02**: App gently suggests slightly more ambitious recipes based on cooking history
- [ ] **SKIL-03**: Contextual cooking tips appear on recipe steps (technique explanations, timing advice)
- [ ] **SKIL-04**: AI suggests creative variations on frequently-cooked recipes to build skills

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Platform Expansion

- **PLAT-01**: Android support
- **PLAT-02**: Web app for desktop recipe browsing and meal planning
- **PLAT-03**: iPad-optimized layout

### Multi-User

- **MULT-01**: Multiple household members can access the same account
- **MULT-02**: Family members can collaborate on meal plans
- **MULT-03**: Individual preference profiles per family member

### Notifications

- **NOTF-01**: Push notification reminders for meal plan ("Tonight's dinner: Chicken Tikka Masala")
- **NOTF-02**: Expiring pantry item alerts
- **NOTF-03**: Weekly meal plan prompt ("Plan this week's meals?")

### Advanced Features

- **ADVN-01**: Semantic recipe search ("something warm and comforting with chicken")
- **ADVN-02**: Recipe sharing via link
- **ADVN-03**: Onboarding wizard for new users
- **ADVN-04**: Multiple grocery delivery services (Amazon Fresh, Walmart)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Calorie counting / macro tracking | Changes app tone from "joyful cooking" to "diet tracking"; adds friction, not core value |
| Social features / recipe community | Splits focus; requires moderation infrastructure; the user is a family, not a social network |
| User-generated recipe database | Moderation nightmare; quality control impossible; existing sites do this already |
| Barcode scanning for pantry | Slower than photo scanning (scan each item vs one photo); requires product database license |
| Smart home / IoT integration | Massive surface area; minimal user value for v1; in-app voice is sufficient |
| Meal kit delivery (Blue Apron, etc.) | Business model conflicts; limited APIs; Instacart covers grocery needs |
| Complex dietary/medical coaching | Liability concerns; regulatory risk; simple preference filters are sufficient |
| Multi-household support | Complex data model; not needed for family use case |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Complete |
| FOUN-03 | Phase 2 | Complete |
| FOUN-04 | Phase 2 | Complete |
| FOUN-05 | Phase 2 | Complete |
| FOUN-06 | Phase 1 | Complete |
| FOUN-07 | Phase 10 | Pending |
| PANT-01 | Phase 3 | Complete |
| PANT-02 | Phase 3 | Complete |
| PANT-03 | Phase 3 | Complete |
| PANT-04 | Phase 3 | Complete |
| PANT-05 | Phase 3 | Complete |
| PANT-06 | Phase 3 | Complete |
| PANT-07 | Phase 3 | Complete |
| PANT-08 | Phase 3 | Complete |
| MEAL-01 | Phase 4 | Complete |
| MEAL-02 | Phase 4 | Complete |
| MEAL-03 | Phase 4 | Complete |
| MEAL-04 | Phase 4 | Complete |
| RECP-01 | Phase 5 | Complete |
| RECP-02 | Phase 5 | Complete |
| RECP-03 | Phase 5 | Complete |
| RECP-04 | Phase 5 | Complete |
| RECP-05 | Phase 5 | Complete |
| RECP-06 | Phase 6 | Complete |
| RECP-07 | Phase 6 | Complete |
| RECP-08 | Phase 6 | Complete |
| RECP-09 | Phase 6 | Complete |
| RECP-10 | Phase 6 | Complete |
| PLAN-01 | Phase 7 | Complete |
| PLAN-02 | Phase 7 | Complete |
| PLAN-03 | Phase 7 | Complete |
| PLAN-04 | Phase 7 | Complete |
| PLAN-05 | Phase 7 | Complete |
| PLAN-06 | Phase 7 | Complete |
| PLAN-07 | Phase 7 | Complete |
| SHOP-01 | Phase 8 | Pending |
| SHOP-02 | Phase 8 | Pending |
| SHOP-03 | Phase 8 | Pending |
| SHOP-04 | Phase 8 | Pending |
| SHOP-05 | Phase 8 | Pending |
| SHOP-06 | Phase 8 | Pending |
| SHOP-07 | Phase 8 | Pending |
| VOIC-01 | Phase 9 | Pending |
| VOIC-02 | Phase 9 | Pending |
| VOIC-03 | Phase 9 | Pending |
| VOIC-04 | Phase 9 | Pending |
| VOIC-05 | Phase 9 | Pending |
| VOIC-06 | Phase 9 | Pending |
| VOIC-07 | Phase 9 | Pending |
| SKIL-01 | Phase 10 | Pending |
| SKIL-02 | Phase 10 | Pending |
| SKIL-03 | Phase 10 | Pending |
| SKIL-04 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0

---
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-07 after roadmap creation*
