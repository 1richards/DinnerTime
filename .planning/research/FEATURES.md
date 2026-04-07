# Feature Landscape

**Domain:** AI-powered meal planning app (family-focused, iOS)
**Researched:** 2026-04-07
**Confidence:** MEDIUM-HIGH (based on competitor analysis, app store data, industry reviews)

## Table Stakes

Features users expect from any modern meal planning app. Missing any of these and users will leave for competitors that have them.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Recipe library with search | Every competitor has this. Users need to save, organize, favorite, and search their recipes. Without it there's no sticky content. | Medium | Core data model. Must support tags, categories, full-text search. Paprika, Plan to Eat, Mealime all center on this. |
| Recipe import from URL | Ollie, FoodiePrep, Paprika, SideChef all do this. Users paste a link and get a clean recipe card. Standard expectation. | Medium | Use recipe-scrapers patterns (JSON-LD/schema.org). 630+ sites use structured markup. Handle graceful fallback for unstructured pages via AI extraction. |
| Weekly meal plan generation | Kitchendary does this in 60 seconds. Ollie, FoodiePrep, Mealime all generate weekly plans. This is the core product loop. | High | Must consider preferences, dietary needs, variety, pantry contents. AI-heavy. Calendar view is expected. |
| Shopping list auto-generation | Every serious competitor generates grocery lists from meal plans. Users cite manual list management as a top frustration. | Medium | Consolidate ingredients across recipes, subtract pantry items, organize by aisle/category. Must update dynamically when plan changes (common complaint: lists don't sync with plan edits). |
| Grocery delivery integration | Ollie integrates with Instacart and Amazon Fresh. SideChef with Walmart. One-tap ordering is expected in 2026. | Medium | Instacart Developer Platform API provides product matching and hosted shopping pages. Link-based model simplifies implementation. |
| Dietary preference support | All competitors handle dietary restrictions (gluten-free, vegetarian, allergies). Families expect this. | Low | Preference profiles stored per user/family member. Filter recipes at generation time. |
| Serving size adjustment | Paprika, SideChef, Mealime all scale recipes. Basic expectation for any recipe app. | Low | Ingredient quantity math. Handle "pinch of salt" type non-scalable items gracefully. |
| Cloud sync and backup | Users expect data to persist and sync. Loss of recipe library is catastrophic for retention. | Medium | Supabase handles this. Must be reliable -- data loss is an app-killer. |
| Cooking mode (step-by-step) | SideChef pioneered step-by-step with photos. Screen-on, large text, timer integration is standard. | Medium | Keep screen awake, large readable text, built-in timers, swipe/tap navigation between steps. |

## Differentiators

Features that set DinnerTime apart. Not universally expected, but high-value when present. These are DinnerTime's competitive moat.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Photo-driven pantry scanning | Ollie has basic fridge photo support, but most apps use manual entry or barcode scanning. A truly seamless "snap your fridge, get dinner ideas" flow is rare and is DinnerTime's core differentiator. Zero-friction inventory beats manual data entry every time. | High | Claude Vision API for food identification. Challenges: overlapping items, poor lighting, packaging vs raw food recognition. Must handle partial/imperfect scans gracefully. Portions Master and Pantry Rescue are attempting this but neither has nailed it. |
| Recipe import from photos (cookbook/handwritten) | Most apps only import from URLs. Photographing a cookbook page or grandma's handwritten recipe card and getting a structured recipe is genuinely novel. Preserves family recipes that exist nowhere online. | High | OCR + AI understanding of recipe structure. Handwritten text is harder than printed. Must handle varied layouts, stains, faded ink. Claude Vision should handle this well. |
| Conversational voice cooking mode | Existing voice cooking apps (Voicipe, SideChef) offer basic "next step" / "read ingredients" commands. A full conversational AI that can answer "can I substitute butter for oil?", "what does 'fold' mean?", or "I don't have thyme, what else works?" while you cook -- that's a premium experience no competitor offers well. | Very High | Real-time speech-to-text, Claude API for conversational understanding, text-to-speech response. Latency is critical -- >2s response time kills the experience. Background noise in kitchens is a real challenge. Must work hands-free. |
| Gentle skill progression | No major competitor does this. Most apps are static -- they serve recipes but don't coach you to grow. "You've made this 3 times, try this slightly more ambitious version" is a unique value proposition that builds long-term engagement. | Medium | Track cooking history, recipe difficulty scoring, suggest incrementally harder recipes. The AI nudge must feel encouraging, not pushy. Research shows users prefer goals and progress bars over social/competitive gamification. |
| Kid-friendly meal awareness | Ollie has family preferences, but explicit kid-pickiness handling (no weird textures, familiar flavors, "hidden veggie" strategies) is underserved. Little Lunches and Picky Plates focus on this but aren't AI meal planners. | Medium | Separate preference profiles for kids vs adults. "Family-pleasing" recipe scoring. Suggest meals where adults eat well and kids will actually eat. Huge pain point for families. |
| Creative meal variations | "You've made tacos 4 times this month -- try Korean-style bulgogi tacos for variety" is something no competitor does well. Keeps repeat meals interesting without forcing completely new recipes. | Medium | AI analyzes cooking history, suggests ingredient/technique swaps on familiar base recipes. Connects to skill progression -- variations can be the vehicle for growth. |
| Recipe import from word-of-mouth | AI-assisted manual entry where you describe "my mom's chicken thing with the lemon and the crispy skin" and the AI helps structure it into a proper recipe. No competitor does this. | Medium | Conversational AI that asks clarifying questions, suggests measurements, fills in standard technique steps. Preserves oral tradition recipes. |
| Internet recipe discovery | AI-powered "find me something new" that understands your taste profile, pantry, and skill level. More than just search -- proactive suggestion of recipes you'd love but haven't tried. | High | Semantic search over recipe databases, filtered by user profile. Different from browsing a fixed catalog. |

## Anti-Features

Features to explicitly NOT build. These are tempting but wrong for DinnerTime.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Calorie counting / macro tracking | Adds friction, changes the app's emotional tone from "joyful cooking" to "diet tracking." MyFitnessPal owns this space and has 1.5-star Trustpilot ratings partly because paywall frustration. The PROJECT.md explicitly excludes this. | Show basic nutritional info on recipe cards if desired, but never make it a workflow. Don't gamify nutrition. |
| Social features / recipe sharing | Splits focus. Community features require moderation, content policies, abuse handling. The core user is a family, not a social network participant. | Allow export/share of individual recipes via standard share sheet. No feeds, no followers, no comments. |
| User-generated recipe database | Moderation nightmare. Quality control impossible. Existing recipe websites already have this (AllRecipes). | Import from existing sources. The user's personal library is their content. |
| Barcode scanning for pantry | Tempting but wrong -- it's slower than photo scanning (scan every item individually vs. one photo of a shelf), requires a product database license, and doesn't handle produce/bulk items. Portions Master does this and it's tedious. | Photo-based scanning is the differentiator. Barcode scanning adds implementation cost for an inferior UX. |
| Smart home / IoT integration | Alexa, Google Home, smart oven integration is a massive surface area with minimal user value for v1. PROJECT.md excludes this. | In-app voice is sufficient. Smart home can be a v2+ feature. |
| Multi-household support | Complex data model, permission systems, billing complications. Not needed for personal/family use case. | Single household with multiple family member profiles (adults + kids). |
| Meal kit delivery integration | Blue Apron, HelloFresh APIs are limited and the business model conflicts (they want you buying their kits, not your own groceries). | Instacart only for v1. Instacart's 85,000+ retailer network covers the grocery need. |
| Complex dietary coaching | Registered dietitian features, medical diet plans, therapeutic nutrition. Liability concerns, regulatory risk. | Simple preference filters. "I'm vegetarian" or "no nuts" is fine. "Design my diabetic meal plan" is not. |

## Feature Dependencies

```
Recipe Library -----> Recipe Import (URL)
       |-----------> Recipe Import (Photo)
       |-----------> Recipe Import (Word-of-mouth)
       |-----------> Internet Recipe Discovery
       |
       v
Weekly Meal Plan Generation
       |
       |----> requires: Dietary Preference Support
       |----> requires: Recipe Library (needs recipes to plan from)
       |----> enhanced by: Photo Pantry Scanning (plan around what you have)
       |----> enhanced by: Kid-Friendly Awareness (family-appropriate plans)
       |
       v
Shopping List Auto-generation
       |
       |----> subtracts: Pantry Inventory (don't buy what you have)
       |
       v
Grocery Delivery Integration (Instacart)
       |
       v
Easy Reordering (past grocery runs)

Photo Pantry Scanning -----> Pantry Inventory Tracking
       |                            |
       v                            v
Fridge-to-Dinner Suggestions    Pantry Usage Deduction (mark items used)

Cooking Mode (step-by-step) -----> Voice Cooking Mode (conversational)
                                          |
                                          |----> requires: Cooking Mode as base
                                          |----> enhanced by: Skill Progression

Cooking History Tracking -----> Skill Progression (nudges based on history)
       |
       v
Creative Meal Variations (suggest tweaks to repeated meals)
```

## MVP Recommendation

**Phase 1 -- Core Loop (must ship to validate the product hypothesis):**
1. Recipe library with search and favorites
2. Recipe import from URL (most common source of recipes)
3. Photo-driven pantry scanning (core differentiator -- validate this early)
4. Fridge-to-dinner suggestions (the "first wow moment" per PROJECT.md)
5. Basic cooking mode (step-by-step, screen-on)

**Phase 2 -- Planning and Shopping (complete the end-to-end workflow):**
6. Weekly meal plan generation with dietary preferences
7. Shopping list auto-generation
8. Instacart integration
9. Kid-friendly meal awareness
10. Pantry usage tracking / deduction

**Phase 3 -- Premium Experience (deepen engagement and retention):**
11. Conversational voice cooking mode
12. Recipe import from photos (cookbook/handwritten)
13. Recipe import from word-of-mouth (AI-assisted manual entry)
14. Creative meal variations

**Phase 4 -- Growth and Engagement:**
15. Gentle skill progression
16. Internet recipe discovery
17. Easy reordering of past grocery runs

**Rationale for ordering:**
- Phase 1 validates the unique value prop (photo -> dinner ideas) before investing in the full workflow
- Phase 2 completes the daily/weekly usage loop that drives retention
- Phase 3 adds the premium differentiators that justify a subscription
- Phase 4 adds long-term engagement features that reduce churn

**Defer indefinitely:** Calorie tracking, social features, barcode scanning, smart home integration, multi-household support

## Competitive Landscape Summary

| Competitor | Strengths | Weaknesses (DinnerTime opportunities) |
|-----------|-----------|--------------------------------------|
| Ollie | Best family AI meal planner, learns preferences, Instacart integration, fridge photo | No voice cooking, no skill progression, no cookbook photo import |
| Kitchendary | Fastest plan generation (60 sec), dietary support | No pantry scanning, no voice, no family-specific features |
| FoodiePrep | Multi-platform recipe import (TikTok, YouTube), Chef Foodie in-kitchen support | Chef Foodie is text-based not voice, pantry tracking is basic |
| Paprika | Best URL recipe import, one-time purchase, pantry with expiration dates | No AI planning, no photo scanning, no voice, feels dated |
| SideChef | Step-by-step cooking with photos/video, grocery integration | No AI meal planning, no pantry photo scanning |
| Mealime | Good free tier, fast recipe generation | Limited customization, no pantry tracking, no AI conversation |
| Plan to Eat | Good pantry feature, reusable meal plans | Manual-heavy, no AI, no photo features |

**DinnerTime's unique position:** The only app combining photo-based pantry scanning + AI meal planning + conversational voice cooking + gentle skill progression. No competitor offers all four.

## Sources

- [Ollie AI Family Meal Planner](https://ollie.ai/) - Competitor analysis
- [FoodiePrep AI Meal Planner](https://www.foodieprep.ai/) - Competitor analysis
- [Paprika Recipe Manager](https://www.paprikaapp.com/) - Competitor analysis
- [SideChef](https://www.sidechef.com/) - Competitor analysis
- [Instacart Developer Platform](https://www.instacart.com/company/business/developers) - API capabilities
- [recipe-scrapers (Python)](https://github.com/hhursev/recipe-scrapers) - Recipe import patterns
- [Pantry Rescue](https://pantryrescue.com/) - Photo pantry scanning competitor
- [Picky Plates](https://pickyplates.com/) - Kid-friendly meal planning
- [Little Lunches](https://www.littlelunches.com/) - Family meal planning
- [Washington Post: AI Meal Planning Apps](https://www.washingtonpost.com/technology/2025/08/21/ai-meal-planning-home-apps/) - Industry trends
- [Trophy: Gamification for Recipe Apps](https://trophy.so/blog/building-cooking-habits-gamification-ideas-for-recipe-apps) - Skill progression patterns
