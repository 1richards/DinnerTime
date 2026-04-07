# DinnerTime

## What This Is

DinnerTime is an AI-powered iOS meal planning app that eliminates the cognitive load of deciding what to cook and buying groceries. Users snap photos of their fridge/pantry, and the app suggests dinners based on what's available, plans the week, and generates Instacart grocery orders — with hands-free conversational voice guidance while cooking.

## Core Value

Open the fridge, take a photo, get dinner ideas — zero mental effort from "what do we have?" to "what should we cook?"

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Photo-driven pantry scanning — snap fridge/pantry/freezer photos, AI identifies contents
- [ ] Fridge-to-dinner suggestions — AI recommends meals based on current pantry inventory
- [ ] Recipe import from URLs — paste a recipe website link, get a structured recipe card
- [ ] Recipe import from photos — photograph cookbook pages, handwritten cards, screenshots
- [ ] Recipe import from family/word of mouth — manual entry with AI assistance to structure it
- [ ] Weekly meal plan generation — AI creates a balanced week considering pantry, preferences, and variety
- [ ] Kid-friendly meal awareness — respect typical kid pickiness, suggest family-pleasing meals
- [ ] Shopping list auto-generation — consolidate ingredients from meal plan, subtract pantry items
- [ ] Instacart integration — one-tap grocery ordering from shopping lists
- [ ] Easy reordering — quickly reorder past grocery runs
- [ ] Creative meal variations — AI suggests tweaks to keep repeat meals interesting
- [ ] Pantry usage tracking — mark items as used when meals are cooked, auto-deduct from inventory
- [ ] Conversational voice cooking mode — hands-free AI assistant while in the kitchen
- [ ] Gentle skill progression — nudge toward slightly more ambitious recipes as confidence builds
- [ ] Cloud storage and sync — reliable data persistence across sessions
- [ ] Recipe library — save, organize, search, and favorite recipes
- [ ] Internet recipe discovery — AI-powered search for new recipe ideas

### Out of Scope

- Android support — iOS-first for v1, cross-platform later (product ambition means we'll get there)
- Web app — mobile-only for v1
- Social features / sharing — personal/family tool first
- Nutrition tracking / calorie counting — not the core value, adds friction
- Multi-household support — single family for v1
- Meal kit delivery integration — Instacart only for v1
- Smart home device integration (Alexa, Google Home) — in-app voice only for v1

## Context

- **Target user:** Competent home cook (can follow recipes, sticks to what works) who wants to gradually build skills
- **Household:** Family with kids (typical kid pickiness — chicken nuggets, pasta, no weird textures)
- **Current pain:** Both deciding what to cook AND grocery logistics are exhausting
- **Current recipe sources:** Recipe websites, cookbooks/family recipes, word of mouth
- **Instacart status:** Want to start using it more, would if it were easier
- **First wow moment:** "What's in my fridge" → "here's what to cook tonight" (photo → dinner ideas)
- **Voice vision:** Full conversational AI — not just "next step" but ask anything about the recipe, substitutions, techniques
- **Product ambition:** Personal use validates it, then grow to other users
- **Skill coaching:** The app should gently encourage progression — "you've nailed this recipe 3 times, try this slightly more adventurous version"

## Constraints

- **Platform**: iOS-first (Expo/React Native for future cross-platform)
- **AI Provider**: Claude API for all AI features (vision, planning, voice understanding, suggestions)
- **Backend**: Node.js/TypeScript backend proxying all AI and external API calls
- **Database**: Supabase (PostgreSQL + pgvector + Auth + Storage)
- **Grocery**: Instacart Developer Platform API (link-based model)
- **Privacy**: All AI calls through backend — no API keys in mobile app

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| iOS-first with Expo | Fastest to market on primary platform, Expo enables Android later | — Pending |
| Photo-driven pantry (not manual entry) | Core differentiator — zero friction inventory tracking | — Pending |
| Claude API for all AI | Single provider for vision + text + planning — consistent quality, simpler architecture | — Pending |
| Instacart link-based integration | Their API creates hosted shopping pages — simpler than managing cart state | — Pending |
| Supabase over Firebase | SQL better for structured recipe data, pgvector for semantic search, transparent pricing | — Pending |
| Conversational voice (not just commands) | Full AI conversation while cooking is the premium experience | — Pending |
| Gentle skill progression | Differentiator — most meal apps don't coach you to grow as a cook | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-07 after initialization*
