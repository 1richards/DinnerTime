# Research Summary — DinnerTime

**Domain:** AI-powered meal planning app (family-focused, iOS)
**Researched:** 2026-04-07

---

## Key Findings

### Stack

**Expo SDK 55** (React Native 0.83, React 19.2) with New Architecture (mandatory — Legacy Architecture dropped). **Hono** over Express for the backend API proxy (4x faster, built-in TypeScript). **Supabase** for database, auth, storage, and realtime sync — includes pgvector for semantic recipe search. **Claude API** via `@anthropic-ai/sdk` for all AI features (vision, planning, voice understanding). **NativeWind** for styling.

**Critical insight:** Claude has NO real-time voice API. Voice requires a pipeline: on-device STT → Claude API text streaming → on-device TTS. This is the architecture, not a workaround.

**Backend choice changed:** Research recommends **Hono** over originally planned Fastify/Express — faster, smaller, better TypeScript support.

### Features

**Table stakes** (must have): Recipe library with search, URL import, weekly meal plan generation, shopping list auto-generation, grocery delivery integration, dietary preferences, serving size adjustment, cloud sync, cooking mode (step-by-step).

**Differentiators** (DinnerTime's moat):
1. **Photo-driven pantry scanning** — no competitor has nailed "snap fridge → get dinner ideas"
2. **Conversational voice cooking** — existing apps only do basic "next step" commands
3. **Gentle skill progression** — no competitor coaches users to grow as cooks
4. **Recipe import from photos** — cookbook pages, handwritten cards, screenshots
5. **Creative meal variations** — keeps repeat meals interesting
6. **Kid-friendly meal awareness** — explicit handling of typical kid pickiness

**Anti-features** (deliberately NOT building): Calorie/macro tracking, social features, user-generated recipe database, barcode scanning, smart home integration, meal kit delivery, complex dietary coaching.

### Architecture

**Three-tier with AI gateway pattern:**
- Mobile app → Backend API → Claude/Instacart/Supabase
- Exception: Supabase Auth direct from mobile (standard pattern)
- All AI calls proxied through backend (API key security)

**Instacart integration is simpler than expected:** Link-based model — POST ingredients, get back a hosted shopping page URL. No cart state management needed.

**Five-layer build order** (dependency-driven):
1. Foundation (auth, database, backend skeleton)
2. Core AI Loop (photo pantry scanning → dinner suggestions — the "wow moment")
3. Recipe System (import, library, search)
4. Planning & Shopping (meal plans, lists, Instacart)
5. Premium Features (voice cooking, skill progression)

### Pitfalls

**P0 — Must address immediately:**
- AI food recognition is imperfect — confirmation UX is mandatory, never silently add items
- Recipe import breaks on ~40% of sites — need JSON-LD → HTML parsing → Claude vision fallback chain

**P1 — Design for early:**
- Pantry goes stale fast — auto-deduct when meals cooked, confidence decay over time
- AI meal plans get monotonous — weekday/weekend awareness, variety constraints, kid preferences
- Voice latency in kitchens — local matching for common commands, pre-fetch next steps, streaming responses

**P2 — Plan ahead:**
- Apply for Instacart API access immediately (approval timeline unknown)
- Onboarding must deliver value in <60 seconds — "fridge photo → dinner ideas" IS the onboarding
- Skill progression must feel encouraging, not patronizing — infer from behavior, don't gamify

---

## Recommendations for Roadmap

1. **Phase 1 should validate the core thesis:** Photo → pantry items → dinner suggestions. If this doesn't work well enough, everything else is moot.
2. **Recipe import is table stakes and should come early** — it populates the library that meal planning depends on.
3. **Shopping list works standalone** — build it independently of Instacart, add Instacart as an enhancement.
4. **Voice cooking is highest complexity, lowest urgency** — defer to late phases after core loop is proven.
5. **Skill progression collects data passively** from day one (cooking history) but surfaces features later.
6. **Apply for Instacart Developer Platform access immediately** — don't let API approval block the grocery phase.

---

## Open Questions

- Claude Vision accuracy for real fridge photos needs empirical validation in Phase 1
- `@jamsch/expo-speech-recognition` is pre-1.0 — may need Whisper fallback for voice
- Instacart API approval timeline is unknown — apply early
- Embedding model choice for semantic recipe search (Claude embeddings vs dedicated model)
