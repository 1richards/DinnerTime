# Architecture Patterns

**Domain:** AI-powered meal planning mobile app
**Researched:** 2026-04-07

## Recommended Architecture

DinnerTime follows a **three-tier mobile architecture** with the backend acting as an AI gateway. The mobile app never talks to Claude or Instacart directly -- all external API calls route through the Node.js backend, which owns API keys, orchestrates multi-step AI workflows, and enforces rate limits.

```
+------------------+       +-------------------+       +------------------+
|                  |       |                   |       |                  |
|   Expo/React     | <---> |   Node.js/TS      | <---> |   Supabase       |
|   Native App     |  HTTP |   Backend API     |  SQL  |   (PostgreSQL)   |
|                  |  WS   |                   |       |                  |
+------------------+       +-------------------+       +------------------+
                                   |    |
                           +-------+    +--------+
                           |                     |
                    +------+------+     +--------+-------+
                    |  Claude API |     | Instacart API  |
                    |  (Vision +  |     | (Link-based    |
                    |   Text +    |     |  shopping)     |
                    |   Planning) |     +----------------+
                    +-------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Expo Mobile App** | UI, camera capture, audio recording, local state, offline cache | Backend API (REST + WebSocket) |
| **Node.js Backend** | Auth proxy, AI orchestration, API key management, business logic, rate limiting | Supabase, Claude API, Instacart API |
| **Supabase PostgreSQL** | User data, recipes, pantry inventory, meal plans, embeddings (pgvector) | Backend (via Supabase client/SQL) |
| **Supabase Auth** | User authentication, JWT tokens, session management | Mobile app (direct), Backend (verification) |
| **Supabase Storage** | User-uploaded images (fridge photos, recipe photos) | Mobile app (direct upload with signed URLs) |
| **Claude API** | Vision (food recognition), meal planning, recipe suggestions, conversational cooking | Backend only |
| **Instacart API** | Shopping list/recipe page creation, returns hosted shopping URLs | Backend only |

### Why This Separation

- **Security:** API keys for Claude and Instacart never leave the backend. Supabase Auth tokens authenticate mobile-to-backend calls. Row Level Security on Supabase tables provides defense in depth.
- **AI orchestration complexity:** A single "suggest dinners from fridge photo" request involves: image analysis, pantry cross-referencing, preference lookup, recipe matching, and response formatting. This multi-step chain belongs on the server.
- **Cost control:** Backend can enforce per-user rate limits on expensive Claude API calls.

## Data Flow: Core User Journeys

### 1. Fridge Photo to Dinner Suggestions

```
User takes photo
    |
    v
[Expo Camera] --> capture image (JPEG, compressed)
    |
    v
[Mobile App] --> upload to Supabase Storage (signed URL)
    |                --> POST /api/pantry/scan { imageUrl }
    v
[Backend] --> fetch image from Supabase Storage
    |       --> Claude Vision API: "identify food items in this image"
    |       --> parse structured response (JSON list of items + quantities)
    |       --> upsert pantry inventory in Supabase DB
    |       --> Claude Text API: "suggest 3-5 dinners using these ingredients,
    |           considering user preferences and past meals"
    |       --> return suggestions to mobile
    v
[Mobile App] --> display dinner cards with ingredients, time, difficulty
```

**Key decision:** Upload images to Supabase Storage first, then pass the URL to the backend. This avoids base64 bloat in API requests and keeps images accessible for future reference (pantry history).

### 2. Weekly Meal Plan Generation

```
User requests meal plan
    |
    v
[Mobile App] --> POST /api/meal-plans/generate { week, preferences }
    |
    v
[Backend] --> fetch current pantry from DB
    |       --> fetch user preferences, dietary restrictions
    |       --> fetch recent meal history (avoid repetition)
    |       --> fetch saved/favorited recipes
    |       --> Claude API: structured prompt with all context
    |           "Generate a 7-day dinner plan. Use pantry items first.
    |            Balance variety. Kid-friendly options 3+ nights."
    |       --> parse structured response
    |       --> save meal plan to DB
    |       --> calculate missing ingredients (plan - pantry = shopping list)
    |       --> return plan + shopping list
    v
[Mobile App] --> display weekly calendar view + shopping list
```

### 3. Shopping List to Instacart Order

```
User taps "Order on Instacart"
    |
    v
[Mobile App] --> POST /api/shopping/instacart { shoppingListId }
    |
    v
[Backend] --> fetch shopping list items from DB
    |       --> POST to Instacart API: Create Shopping List Page
    |           { line_items: [{ name: "chicken breast", quantity: 2 }, ...] }
    |       --> receive hosted shopping page URL
    |       --> save URL + order reference to DB
    |       --> return URL to mobile
    v
[Mobile App] --> open Instacart URL in in-app browser or deep link
    |
    v
[Instacart] --> user selects store, reviews product matches, checks out
```

**Key insight:** Instacart's Developer Platform uses a **link-based model**. You send ingredient names and quantities, they return a hosted page URL where the user selects a store and completes checkout. You do NOT manage cart state -- Instacart handles product matching, pricing, and fulfillment. This dramatically simplifies the integration.

### 4. Conversational Voice Cooking Mode

```
User enters cooking mode for a recipe
    |
    v
[Mobile App] --> load recipe, display step 1
    |           --> open WebSocket to /ws/cooking-assistant
    |           --> start audio recording (expo-audio-stream)
    |
    v
[Audio Loop]:
    User speaks --> audio chunks streamed via WebSocket
        |
        v
    [Backend] --> buffer audio chunks
        |       --> Speech-to-Text (whisper or platform STT)
        |       --> Claude API with conversation context:
        |           system: "You are a cooking assistant. Current recipe: {recipe}.
        |                    Current step: {step}. User's skill level: {level}."
        |           user: "{transcribed speech}"
        |       --> Text-to-Speech on response
        |       --> stream audio response back via WebSocket
        v
    [Mobile App] --> play audio response
                 --> update UI if step changed
```

**Architecture choice: WebSocket for voice, not REST.** Voice requires low-latency bidirectional streaming. The backend maintains conversation state for the cooking session (current step, past Q&A, recipe context).

**STT/TTS options (needs phase-specific research):**
- **Option A:** Whisper (OpenAI) for STT + ElevenLabs/similar for TTS -- highest quality, more infrastructure
- **Option B:** expo-speech-recognition (on-device STT) + Claude text + on-device TTS -- lower latency, less server cost, but less capable
- **Option C:** A real-time voice AI platform (LiveKit, Agora) -- turnkey but adds dependency
- **Recommendation:** Start with Option B for MVP (on-device STT/TTS, Claude for the "brain"), upgrade to Option A later for quality. Voice is a premium feature that can ship after core flows work.

### 5. Recipe Import (URL, Photo, Manual)

```
[URL Import]:
User pastes recipe URL
    --> Backend fetches + parses webpage (recipe structured data / scraping)
    --> Claude API: "Extract structured recipe from this content"
    --> Save to recipes table

[Photo Import]:
User photographs cookbook page
    --> Upload to Supabase Storage
    --> Backend sends to Claude Vision: "Extract recipe from this image"
    --> Save structured recipe to DB

[Manual Import]:
User types rough description
    --> Claude API: "Structure this into a proper recipe with ingredients,
        steps, times"
    --> User reviews/edits
    --> Save to DB
```

## Database Schema Architecture

### Core Tables

```
users
  |- id, email, preferences (JSON), skill_level, created_at

pantry_items
  |- id, user_id, name, category, quantity, unit, confidence,
  |  source_image_id, last_seen_at, expires_at
  |
  |- INDEX: user_id + category (pantry browsing)
  |- INDEX: user_id + name (deduplication)

recipes
  |- id, user_id, title, description, ingredients (JSONB),
  |  steps (JSONB), prep_time, cook_time, servings,
  |  difficulty, tags[], source_type, source_url,
  |  embedding (vector(1536)), created_at
  |
  |- INDEX: embedding using ivfflat (semantic search)
  |- INDEX: user_id + tags (filtered browsing)

meal_plans
  |- id, user_id, week_start, status, created_at

meal_plan_entries
  |- id, meal_plan_id, day_of_week, meal_type, recipe_id

shopping_lists
  |- id, user_id, meal_plan_id, status, instacart_url, created_at

shopping_list_items
  |- id, shopping_list_id, ingredient_name, quantity, unit,
  |  from_pantry (bool), checked (bool)

cooking_sessions
  |- id, user_id, recipe_id, started_at, completed_at,
  |  current_step, notes
```

### Supabase-Specific Patterns

- **Row Level Security (RLS):** Every table filtered by `auth.uid() = user_id`. Users can only see their own data.
- **Supabase Auth:** Direct from mobile app for sign-up/login. Backend verifies JWT on every request.
- **Supabase Storage:** Buckets for `fridge-photos`, `recipe-photos`. Signed upload URLs generated by backend, direct upload from mobile.
- **pgvector:** Recipe embeddings enable "find recipes similar to X" and semantic search ("something Italian with chicken"). Embeddings generated by Claude or a dedicated embedding model when recipes are saved.
- **Realtime (optional, later):** Supabase Realtime could push pantry updates if multi-device support is added.

## Patterns to Follow

### Pattern 1: AI Gateway / Proxy Pattern
**What:** All AI API calls go through a single backend service layer that handles prompt construction, response parsing, error handling, and cost tracking.
**Why:** Centralized prompt management, consistent error handling, cost visibility, easy A/B testing of prompts.
```typescript
// Backend: services/ai.ts
class AIGateway {
  async identifyFoodItems(imageUrl: string): Promise<PantryItem[]> {
    const response = await this.claude.messages.create({
      model: "claude-sonnet-4-20250514",
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: PROMPTS.IDENTIFY_FOOD }
        ]
      }]
    });
    return this.parseFoodItems(response);
  }
}
```

### Pattern 2: Structured Output from Claude
**What:** Always request JSON output with a defined schema from Claude. Parse and validate before storing.
**Why:** Prevents UI breakage from unexpected AI responses. Makes downstream processing reliable.
```typescript
const PROMPTS = {
  IDENTIFY_FOOD: `Identify all food items visible in this image.
    Return JSON array: [{ "name": string, "category": string,
    "quantity": string, "unit": string, "confidence": number }]
    Only return the JSON, no other text.`
};
```

### Pattern 3: Optimistic UI with Server Reconciliation
**What:** Mobile app updates UI immediately on user action, then syncs with backend.
**Why:** Pantry edits, recipe saves, and list checks should feel instant.

### Pattern 4: Image-First, Then Process
**What:** Upload images to storage immediately, then trigger processing asynchronously.
**Why:** Separates the fast operation (upload) from the slow operation (AI analysis). User sees their photo immediately; AI results appear moments later.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side AI Orchestration
**What:** Having the mobile app make multiple sequential API calls to coordinate AI workflows.
**Why bad:** Fragile on mobile networks, exposes orchestration logic, hard to add steps later.
**Instead:** Single backend endpoint per user action. Backend handles multi-step AI chains internally.

### Anti-Pattern 2: Storing Raw AI Responses
**What:** Saving Claude's raw text responses directly to the database.
**Why bad:** Inconsistent format, hard to query, breaks UI when AI output varies.
**Instead:** Always parse AI responses into structured data before storing. Validate against a schema.

### Anti-Pattern 3: Synchronous Image Processing
**What:** Making the user wait while fridge photos are analyzed.
**Why bad:** Claude Vision calls can take 3-8 seconds. User stares at spinner.
**Instead:** Upload image, show confirmation immediately, process in background, push results via polling or WebSocket notification.

### Anti-Pattern 4: Monolithic Prompt Construction
**What:** Building one massive prompt with all user context for every AI call.
**Why bad:** Wastes tokens, increases latency, makes debugging impossible.
**Instead:** Compose prompts from focused context modules. Only include what's needed for each specific AI task.

### Anti-Pattern 5: Direct Supabase Queries for Complex Operations
**What:** Having the mobile app use Supabase's auto-generated REST API for operations that involve business logic.
**Why bad:** Business logic leaks into the client, hard to maintain, impossible to add AI processing steps.
**Instead:** Mobile app uses Supabase directly ONLY for simple CRUD (recipe library browsing, pantry item editing). Anything involving AI, Instacart, or multi-table operations goes through the backend.

## Scalability Considerations

| Concern | At 1 user (you) | At 1K users | At 100K users |
|---------|-----------------|-------------|---------------|
| **Claude API costs** | Negligible (~$5/mo) | $500-2K/mo, need caching | Cache aggressively, batch where possible, consider tiered models |
| **Image storage** | Supabase free tier | Supabase Pro ($25/mo) | CDN + lifecycle policies to archive old photos |
| **Database** | Supabase free tier | Supabase Pro, pgvector works fine | Connection pooling, read replicas, embedding index tuning |
| **Voice/WebSocket** | Single server handles it | Sticky sessions needed | Dedicated WebSocket service, consider managed platform |
| **Backend** | Single process | Basic horizontal scaling | Separate AI-heavy endpoints onto dedicated workers |

**For v1 (personal use + validation):** A single Node.js server, Supabase free/Pro tier, and direct Claude API calls are more than sufficient. Do not over-architect for scale you don't have.

## Suggested Build Order

Based on component dependencies, the system should be built in this order:

### Layer 1: Foundation (must exist first)
1. **Supabase project setup** -- database schema, auth, storage buckets, RLS policies
2. **Node.js backend skeleton** -- Express/Fastify, auth middleware, Supabase client, health check
3. **Expo app skeleton** -- navigation, auth flow, Supabase Auth integration

*Rationale:* Everything depends on auth and data persistence. Get the plumbing working before adding features.

### Layer 2: Core AI Loop (the "wow moment")
4. **Camera capture + image upload** -- Expo camera to Supabase Storage
5. **Claude Vision integration** -- backend endpoint that processes fridge photos
6. **Pantry management** -- CRUD for pantry items, display scan results
7. **Dinner suggestions** -- Claude text API using pantry as context

*Rationale:* This is the core value proposition: photo to dinner ideas. Ship this first to validate the concept.

### Layer 3: Recipe System
8. **Recipe data model + library UI** -- browse, search, favorite recipes
9. **Recipe import (URL)** -- paste URL, backend scrapes + structures
10. **Recipe import (photo)** -- Claude Vision on cookbook pages
11. **Semantic recipe search** -- pgvector embeddings for "find me something like..."

*Rationale:* Recipes are the content backbone. Import flows feed the library that meal planning draws from.

### Layer 4: Planning + Shopping
12. **Meal plan generation** -- Claude creates weekly plan from recipes + pantry + preferences
13. **Shopping list derivation** -- plan minus pantry equals list
14. **Instacart integration** -- send list to Instacart API, get shopping page URL

*Rationale:* Planning depends on having recipes and pantry data. Instacart is the final link in the chain.

### Layer 5: Premium Experience
15. **Voice cooking mode** -- WebSocket audio streaming, STT, Claude conversation, TTS
16. **Skill progression** -- track cooking history, suggest level-ups
17. **Creative variations** -- AI suggests tweaks to familiar recipes

*Rationale:* These are differentiators but not table stakes. Ship after core loop is validated.

## Technology-Specific Architecture Notes

### Expo/React Native
- Use **Expo Router** for file-based navigation (standard in 2025+)
- Use **React Query (TanStack Query)** for server state management -- handles caching, background refetching, optimistic updates
- Use **expo-camera** for photo capture, **expo-image-manipulator** for compression before upload
- Use **expo-audio-stream** (community package) for real-time audio streaming in voice mode -- Expo's built-in audio APIs don't support chunk-level streaming

### Node.js Backend
- **Fastify** over Express -- better TypeScript support, schema validation built-in, faster
- Organize by **feature modules** not technical layers: `/modules/pantry/`, `/modules/recipes/`, `/modules/meal-plans/`, `/modules/cooking-assistant/`
- Each module owns its routes, services, and prompts
- Centralized **prompt registry** -- all Claude prompts in one place for easy iteration

### Supabase
- **Auth:** Use Supabase Auth from mobile app directly. Backend verifies the JWT from the `Authorization` header using Supabase's `getUser()`.
- **Storage:** Generate signed upload URLs from the backend, mobile uploads directly to Storage. This avoids routing large files through the backend.
- **Edge Functions:** Avoid for v1. Keep all logic in the Node.js backend for debuggability. Edge Functions are useful later for webhooks or lightweight operations.

## Sources

- [Supabase + Expo quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Supabase pgvector docs](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Supabase semantic search guide](https://supabase.com/docs/guides/ai/semantic-search)
- [Claude Vision API docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- [Instacart Developer Platform](https://docs.instacart.com/developer_platform_api/)
- [Instacart Shopping List API](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/)
- [Instacart Recipe Page API](https://docs.instacart.com/developer_platform_api/api/products/create_recipe_page/)
- [expo-audio-stream](https://github.com/mykin-ai/expo-audio-stream) -- real-time audio streaming for Expo
- [expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition) -- on-device STT for Expo
- [Expo Camera docs](https://docs.expo.dev/versions/latest/sdk/camera/)
- [Expo local-first architecture guide](https://docs.expo.dev/guides/local-first/)
- [Voice AI stack for building agents (2026)](https://www.assemblyai.com/blog/the-voice-ai-stack-for-building-agents)
- [Real-time audio processing with Expo](https://expo.dev/blog/real-time-audio-processing-with-expo-and-native-code)
