# Pitfalls Research — AI Meal Planning App

## Overview

Critical mistakes and common pitfalls when building an AI-powered meal planning app with photo-based pantry scanning, conversational voice cooking, and Instacart grocery integration.

---

## Pitfall 1: Over-Trusting AI Food Recognition Accuracy

**Risk Level:** CRITICAL
**Phase Impact:** Core AI Loop (pantry scanning)

### The Problem

Claude Vision is impressive but not infallible with food recognition. Partially obscured items in a crowded fridge, similar-looking items (zucchini vs cucumber), items in opaque containers, and poor lighting all degrade accuracy. Building the entire UX around "AI gets it right" leads to user frustration and abandoned pantry inventories.

### Warning Signs

- Users repeatedly correcting the same items
- Pantry inventory drifts significantly from reality within days
- Users stop scanning because corrections take longer than manual entry

### Prevention Strategy

- **Always show confidence scores** — let users know when the AI is guessing
- **Confirmation UI is mandatory** — never silently add items without user review
- **Make corrections fast** — swipe to remove, tap to edit, not a modal form
- **Learn from corrections** — store user corrections to improve prompts over time
- **Fuzzy matching** — "chicken breast" and "chicken breasts" are the same item
- **Category fallbacks** — if AI can't identify specifically, at least categorize ("some kind of produce")

### Phase Mapping

Phase 1 (Core AI Loop) must include the confirmation/correction UX. Don't ship scan-only without correction flow.

---

## Pitfall 2: Recipe Import Fragility

**Risk Level:** HIGH
**Phase Impact:** Recipe system

### The Problem

Recipe websites are notoriously hostile to scraping — paywalls, anti-bot measures, infinite scroll, pop-ups, and wildly inconsistent HTML structure. JSON-LD structured data (schema.org/Recipe) exists on ~60% of recipe sites, but the other 40% require HTML parsing or AI extraction. Recipe import that fails 30% of the time kills user trust immediately.

### Warning Signs

- Import success rate drops below 80%
- Users report "it couldn't read this recipe" frequently
- Popular recipe sites (NYT Cooking, AllRecipes) start blocking requests

### Prevention Strategy

- **Try JSON-LD first** — fastest, most reliable, no AI cost
- **Cheerio HTML parsing as fallback** — target common recipe card patterns
- **Claude vision as last resort** — screenshot the page if scraping fails
- **Cache scraped recipes** — don't re-scrape the same URL
- **User-agent rotation and rate limiting** — respect robots.txt
- **Manual entry fallback** — always let users type/paste a recipe if import fails
- **Test against top 20 recipe sites** — maintain a golden test set

### Phase Mapping

Recipe import phase should include a test suite against popular recipe sites, with fallback chains built in from day one.

---

## Pitfall 3: Pantry Inventory Staleness

**Risk Level:** HIGH
**Phase Impact:** Pantry tracking, meal planning

### The Problem

Pantry inventory goes stale fast. Users cook, snack, throw things away, and items expire — none of which the app automatically knows about. If the app suggests meals based on items that were used up 3 days ago, trust erodes quickly. The "low overhead" promise means you can't rely on users manually updating inventory.

### Warning Signs

- Meal suggestions include ingredients users don't have
- Shopping lists don't include items users actually need
- Users stop trusting and start ignoring pantry-based suggestions

### Prevention Strategy

- **Auto-deduct when meals are cooked** — if user marks a meal as "cooked," subtract its ingredients from pantry
- **Expiry estimation** — AI estimates shelf life, proactively mark items as likely expired
- **"Quick scan" encouragement** — gentle nudges to re-scan every few days, not demanding
- **Confidence decay** — items seen 7+ days ago get lower confidence; items seen 14+ days ago marked as "uncertain"
- **Smart assumptions** — staples (salt, oil, flour) don't expire quickly, don't nag about them
- **Grocery order integration** — when Instacart order is placed, auto-add those items to pantry

### Phase Mapping

Pantry tracking phase must include auto-deduction logic and confidence decay, not just photo scanning.

---

## Pitfall 4: AI Meal Plan Monotony and Irrelevance

**Risk Level:** MEDIUM-HIGH
**Phase Impact:** Meal planning

### The Problem

AI-generated meal plans that don't account for family dynamics, kid preferences, weeknight time constraints, and ingredient fatigue become a nuisance rather than a help. Generic plans with no memory of what the family actually eats get ignored after week 2.

### Warning Signs

- Users override 50%+ of AI suggestions
- Plans suggest meals that require 2 hours on a Tuesday
- Kids reject suggested meals regularly
- Same cuisine type suggested 4 days in a row

### Prevention Strategy

- **Weekday vs weekend awareness** — simpler meals Mon-Thu, ambitious meals Fri-Sat
- **Kid-friendly tagging** — explicitly flag meals as kid-approved based on feedback
- **Variety constraints** — no same protein two days in a row, rotate cuisines
- **Feedback loop** — let users rate meals, thumbs up/down, AI learns preferences
- **Cook history** — track what was actually cooked (not just planned) to avoid repetition
- **Prep time awareness** — tag recipes with realistic prep times, match to day complexity

### Phase Mapping

Meal planning phase should include variety constraints and weekday awareness from the start, not just "Claude picks 7 dinners."

---

## Pitfall 5: Voice Interaction Latency in Kitchen

**Risk Level:** HIGH
**Phase Impact:** Voice cooking mode

### The Problem

Kitchen environments are noisy (running water, sizzling pans, kids, timers). Combined with the round-trip latency of STT → Claude API → TTS, voice commands can feel painfully slow. Users with messy hands waiting 3-5 seconds for "next step" will abandon voice mode.

### Warning Signs

- Voice command response time exceeds 2 seconds
- STT misrecognition rate spikes in kitchen noise
- Users tap the screen instead of using voice (defeating the purpose)

### Prevention Strategy

- **Local intent matching for common commands** — "next step," "repeat," "go back" should be instant (regex on STT output, no API call)
- **Pre-fetch next step** — always have the next 2-3 steps ready for TTS
- **Streaming Claude responses** — start TTS as soon as first sentence arrives, don't wait for full response
- **Noise-aware STT** — use keyword detection for simple commands, full STT for conversational queries
- **Visual fallback** — always show the current step on screen even in voice mode
- **Keep-awake screen** — prevent screen dimming during cooking mode

### Phase Mapping

Voice phase should implement local command matching before cloud-based conversational AI. Get basic navigation instant, then add conversational depth.

---

## Pitfall 6: Instacart API Access and Limitations

**Risk Level:** MEDIUM
**Phase Impact:** Shopping/grocery integration

### The Problem

Instacart's Developer Platform requires application and approval. The link-based model means you don't control the shopping experience after the user clicks through. Items may be unavailable, substituted, or priced differently than expected. There's no webhook for order completion.

### Warning Signs

- API approval takes weeks/months, blocking the grocery phase
- Generated links expire, breaking saved order history
- Item matching is poor (user wanted "chicken thighs," Instacart shows "chicken wings")

### Prevention Strategy

- **Apply for API access immediately** — don't wait until the grocery phase
- **Build shopping list UX independently of Instacart** — the list is valuable even without one-click ordering
- **Handle link expiry gracefully** — re-generate links on demand, show "link expired, tap to refresh"
- **Ingredient name normalization** — map recipe ingredients to grocery-friendly names ("2 lbs chicken breast, boneless skinless" not "chicken")
- **Alternative delivery options** — design the shopping list to be copy-pasteable to any grocery service
- **Test with real grocery items** — validate that Instacart's product matching works for common ingredients

### Phase Mapping

Apply for Instacart API access in Phase 1. Build shopping list as standalone feature, add Instacart as enhancement.

---

## Pitfall 7: Onboarding Friction Kills Retention

**Risk Level:** MEDIUM
**Phase Impact:** First-run experience

### The Problem

Meal planning apps have notoriously poor retention. If the first experience requires setting up dietary preferences, scanning the entire kitchen, importing recipes, AND planning a week — users abandon before seeing value. The "first wow moment" must happen in under 60 seconds.

### Warning Signs

- Users drop off during onboarding (analytics)
- Time-to-first-value exceeds 2 minutes
- Users skip preferences, getting poor recommendations later

### Prevention Strategy

- **One-action onboarding** — first screen after signup: "Take a photo of your fridge" → instant dinner suggestions
- **Defer everything else** — dietary preferences, recipe imports, meal planning can come later
- **Progressive profiling** — learn preferences from behavior (what they cook, what they skip) rather than questionnaires
- **Pre-populated recipes** — seed the library with 50 popular family-friendly recipes so suggestions work even without imports
- **Quick wins** — show value before asking for investment

### Phase Mapping

Onboarding should be designed alongside the core AI loop, not as a separate phase. The "fridge photo → dinner ideas" flow IS the onboarding.

---

## Pitfall 8: Skill Progression Feeling Patronizing

**Risk Level:** LOW-MEDIUM
**Phase Impact:** Skill progression feature

### The Problem

"Gentle skill progression" can easily feel condescending. If the app keeps suggesting "try adding garlic" to a competent cook, or pushes complex French techniques too early, it annoys rather than inspires.

### Warning Signs

- Users disable or ignore progression suggestions
- Suggestions don't match actual skill level
- Progression feels like gamification rather than genuine coaching

### Prevention Strategy

- **Infer skill from behavior** — what recipes they cook, how complex, what techniques they use
- **Suggest, never push** — "You've made great stir-fries. Want to try a wok hei technique?" not "Level up!"
- **Contextual tips** — attach tips to specific recipe steps, not standalone notifications
- **Respect the user's pace** — some weeks are survival mode, don't push progression during busy periods
- **Quality over quantity** — one great suggestion per week beats daily nudges

### Phase Mapping

This is a late-phase feature. Get the core loop right first. Skill data collection can happen passively from Phase 1.

---

## Summary: Priority Pitfalls by Phase

| Priority | Pitfall | When to Address |
|----------|---------|-----------------|
| P0 | AI food recognition accuracy + confirmation UX | Phase 1 (Core AI) |
| P0 | Recipe import reliability + fallback chain | Phase 2 (Recipes) |
| P1 | Pantry staleness + auto-deduction | Phase 2-3 (Pantry tracking) |
| P1 | Meal plan variety + family awareness | Phase 3-4 (Meal planning) |
| P1 | Voice latency + local command matching | Phase 5+ (Voice) |
| P2 | Instacart API access timing | Apply immediately, integrate Phase 4-5 |
| P2 | Onboarding friction | Design with Phase 1, build Phase 6+ |
| P3 | Skill progression tone | Phase 7+ (Late feature) |
