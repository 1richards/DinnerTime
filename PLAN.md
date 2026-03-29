# DinnerTime - Implementation Plan

> AI-powered meal planning app that liberates you from the effort of planning and buying meals.

## Vision

DinnerTime is a multimedia-rich mobile app that uses AI to handle the entire meal lifecycle: discover recipes (from URLs, photos, or AI suggestions), plan weekly meals, track pantry inventory via photos, generate Instacart grocery orders, and guide you through cooking with hands-free voice interaction.

**North Star:** Eliminate the cognitive load of "what's for dinner?" entirely.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Mobile App** | Expo (React Native) SDK 55, TypeScript | Cross-platform, rich multimedia support, file-based routing |
| **Navigation** | expo-router | File-based routing, deep linking, type-safe |
| **State** | Zustand (local) + TanStack Query (server) | Minimal boilerplate, excellent caching |
| **Camera** | react-native-vision-camera + expo-image-picker | Full camera control for food photography |
| **Backend** | Fastify + TypeScript | Fast, type-safe, great plugin ecosystem |
| **Database** | Supabase (PostgreSQL + pgvector + Auth + Storage + Realtime) | SQL for structured recipe data, vectors for semantic search, built-in auth |
| **AI** | Claude API (Anthropic SDK) - multimodal | Vision + text for recipe parsing, pantry scanning, meal planning, voice understanding |
| **Voice STT** | expo-speech-recognition (on-device) | Low-latency speech-to-text |
| **Voice TTS** | expo-speech (on-device) | Step-by-step cooking narration |
| **Grocery** | Instacart Developer Platform API | Link-based model - create shopping pages, user completes on Instacart |
| **Recipe Scraping** | cheerio + Claude API fallback | Structured data extraction from recipe URLs |

---

## Project Structure

```
DinnerTime/
├── package.json                          # Root workspace config
├── .gitignore
├── .env.example
├── PLAN.md
│
├── apps/
│   └── mobile/                           # Expo app
│       ├── package.json
│       ├── app.json
│       ├── tsconfig.json
│       ├── eas.json
│       ├── src/
│       │   ├── app/                      # expo-router file-based routing
│       │   │   ├── _layout.tsx           # Root layout (providers, auth gate)
│       │   │   ├── index.tsx             # Redirect to tabs or onboarding
│       │   │   ├── onboarding.tsx
│       │   │   ├── (auth)/
│       │   │   │   ├── login.tsx
│       │   │   │   └── register.tsx
│       │   │   ├── (tabs)/
│       │   │   │   ├── _layout.tsx       # Tab navigator
│       │   │   │   ├── index.tsx         # Home / This Week's Meals
│       │   │   │   ├── recipes.tsx       # Recipe library
│       │   │   │   ├── pantry.tsx        # Pantry inventory
│       │   │   │   ├── shopping.tsx      # Shopping list / Instacart
│       │   │   │   └── cook.tsx          # Cooking mode (voice)
│       │   │   ├── recipe/
│       │   │   │   ├── [id].tsx          # Recipe detail
│       │   │   │   ├── import.tsx        # Import (URL/photo)
│       │   │   │   └── suggestions.tsx   # AI suggestions
│       │   │   ├── meal-plan/
│       │   │   │   ├── index.tsx         # Weekly plan editor
│       │   │   │   ├── generate.tsx      # AI generation
│       │   │   │   └── history.tsx       # Past plans
│       │   │   ├── pantry/
│       │   │   │   ├── scan.tsx          # Camera scan
│       │   │   │   └── items.tsx         # Item list/edit
│       │   │   ├── shopping/
│       │   │   │   ├── list.tsx          # Current list
│       │   │   │   ├── instacart.tsx     # Instacart checkout
│       │   │   │   └── history.tsx       # Past orders / reorder
│       │   │   └── settings.tsx
│       │   │
│       │   ├── components/
│       │   │   ├── ui/                   # Button, Card, Input, Modal, etc.
│       │   │   ├── recipe/              # RecipeCard, IngredientList, StepList
│       │   │   ├── meal-plan/           # WeekView, DayColumn, MealSlot
│       │   │   ├── pantry/             # PantryGrid, ScanOverlay
│       │   │   ├── shopping/           # ShoppingListItem, InstacartButton
│       │   │   └── voice/              # VoiceButton, VoiceOverlay, CookingModeUI
│       │   │
│       │   ├── hooks/                    # useAuth, useCamera, useVoice, useRecipes, etc.
│       │   ├── stores/                   # Zustand stores (auth, recipe, mealPlan, pantry, shopping, voice)
│       │   ├── services/                 # API clients (supabase, recipe, mealPlan, pantry, shopping, instacart)
│       │   ├── lib/                      # ai.ts, camera.ts, voice.ts, offline.ts, constants.ts
│       │   ├── types/                    # TypeScript type definitions
│       │   └── assets/
│       │
│       └── __tests__/
│
├── packages/
│   └── server/                           # Fastify backend
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       ├── src/
│       │   ├── index.ts                  # Server entry
│       │   ├── config/                   # env.ts, supabase.ts, anthropic.ts
│       │   ├── routes/                   # auth, recipes, mealPlans, pantry, shopping, instacart, ai, voice
│       │   ├── services/
│       │   │   ├── claude.ts             # Anthropic SDK wrapper (ALL AI goes through here)
│       │   │   ├── recipeParser.ts       # URL scraping + Claude parsing
│       │   │   ├── imageAnalyzer.ts      # Photo → structured data
│       │   │   ├── mealPlanner.ts        # AI meal plan generation
│       │   │   ├── instacart.ts          # Instacart API client
│       │   │   └── voiceProcessor.ts     # Voice intent processing
│       │   ├── middleware/               # auth, rateLimit, errorHandler
│       │   ├── db/migrations/            # SQL migrations
│       │   └── types/
│       └── __tests__/
│
└── supabase/                             # Supabase project config
    ├── config.toml
    ├── migrations/
    └── seed.sql
```

---

## Data Model

### Core Tables

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- User profiles (extends Supabase Auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    household_size INTEGER DEFAULT 2,
    dietary_preferences JSONB DEFAULT '[]',    -- ["vegetarian", "gluten-free"]
    cuisine_preferences JSONB DEFAULT '[]',    -- ["italian", "mexican"]
    disliked_ingredients JSONB DEFAULT '[]',
    instacart_connected BOOLEAN DEFAULT FALSE,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipes
CREATE TABLE recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    source_type TEXT CHECK (source_type IN ('url', 'photo', 'manual', 'ai_generated', 'internet_search')),
    source_url TEXT,
    source_image_path TEXT,
    image_url TEXT,
    servings INTEGER DEFAULT 4,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    total_time_minutes INTEGER,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    cuisine TEXT,
    tags JSONB DEFAULT '[]',
    nutrition_estimate JSONB,
    embedding VECTOR(1536),                    -- Semantic search
    is_favorite BOOLEAN DEFAULT FALSE,
    times_cooked INTEGER DEFAULT 0,
    last_cooked_at TIMESTAMPTZ,
    raw_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity NUMERIC,
    unit TEXT,
    preparation TEXT,
    category TEXT,
    optional BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    raw_text TEXT
);

CREATE TABLE recipe_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    instruction TEXT NOT NULL,
    duration_minutes INTEGER,
    image_url TEXT,
    tip TEXT
);

-- Pantry (AI-driven inventory)
CREATE TABLE pantry_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    quantity_estimate TEXT,                     -- "about half", "full", "almost empty"
    unit TEXT,
    expiry_estimate TIMESTAMPTZ,
    confidence NUMERIC DEFAULT 0.8,
    source_image_path TEXT,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'low', 'expired', 'used')),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pantry_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    scan_type TEXT CHECK (scan_type IN ('fridge', 'pantry', 'freezer', 'counter')),
    ai_response JSONB,
    items_detected INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Meal Plans
CREATE TABLE meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
    ai_generation_prompt TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meal_plan_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    servings INTEGER DEFAULT 4,
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Shopping Lists
CREATE TABLE shopping_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'Shopping List',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ordered', 'completed')),
    instacart_link TEXT,
    instacart_link_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shopping_list_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    quantity NUMERIC,
    unit TEXT,
    category TEXT,
    checked BOOLEAN DEFAULT FALSE,
    in_pantry BOOLEAN DEFAULT FALSE,
    recipe_ids JSONB DEFAULT '[]',
    sort_order INTEGER DEFAULT 0
);

-- Order History (for reordering)
CREATE TABLE order_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL,
    meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
    instacart_link TEXT,
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    items_snapshot JSONB,
    recipes_snapshot JSONB,
    total_items INTEGER,
    notes TEXT
);
```

---

## API Endpoints

All routes prefixed with `/api/v1`. All require auth (Supabase JWT) except auth routes.

### AI Processing (Core Differentiator)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/parse-url` | Scrape URL → Claude parses into structured recipe |
| POST | `/ai/parse-image` | Upload photo → Claude extracts recipe |
| POST | `/ai/scan-pantry` | Upload fridge/pantry photo → return detected items |
| POST | `/ai/generate-meal-plan` | Generate weekly meal plan from preferences + pantry + history |
| POST | `/ai/suggest-variations` | Creative tweaks on a recipe to keep things interesting |
| POST | `/ai/voice-command` | Process voice transcript → return intent + response |
| POST | `/ai/find-recipes` | Search internet for recipes matching criteria |

### Recipes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/recipes` | List user recipes (paginated, filterable) |
| GET | `/recipes/:id` | Recipe detail with ingredients + steps |
| POST | `/recipes` | Create recipe |
| PATCH | `/recipes/:id` | Update recipe |
| DELETE | `/recipes/:id` | Delete recipe |
| GET | `/recipes/search?q=` | Semantic search via pgvector |

### Meal Plans
| Method | Path | Description |
|--------|------|-------------|
| GET | `/meal-plans` | List plans |
| GET | `/meal-plans/:id` | Plan with entries |
| POST | `/meal-plans` | Create plan |
| PATCH | `/meal-plans/:id` | Update plan |
| POST | `/meal-plans/:id/entries` | Add/update entry |

### Pantry
| Method | Path | Description |
|--------|------|-------------|
| GET | `/pantry` | List pantry items |
| PATCH | `/pantry/:id` | Update item |
| POST | `/pantry/scan` | Upload photo → AI processes → saves items |

### Shopping / Instacart
| Method | Path | Description |
|--------|------|-------------|
| GET | `/shopping-lists` | List shopping lists |
| POST | `/shopping-lists/from-meal-plan/:planId` | Auto-generate from plan (minus pantry) |
| PATCH | `/shopping-lists/:id/items/:itemId` | Toggle checked, edit |
| POST | `/shopping-lists/:id/instacart` | Generate Instacart link |
| GET | `/orders` | Past orders |
| POST | `/orders/:id/reorder` | Reorder with optional AI variations |

---

## AI Integration Points

All Claude API calls go through the backend (`packages/server/src/services/claude.ts`). The mobile app never calls Claude directly.

### 1. Recipe Parsing from URL
Backend fetches URL with cheerio. If JSON-LD/schema.org Recipe data found, extract directly. Otherwise, pass cleaned HTML to Claude to extract: title, ingredients (quantity/unit/preparation), steps, times, servings, cuisine, tags.

### 2. Recipe Parsing from Photo
Upload image to Supabase Storage. Send to Claude vision with recipe extraction prompt. Handles cookbook pages, handwritten recipe cards, screenshots of recipe websites.

### 3. Pantry Scanning (Low-Overhead Inventory)
User snaps photo of fridge/pantry/freezer. Claude vision identifies all visible food items with: name, category, approximate quantity, estimated days until expiry. Results reconciled against existing pantry (update seen items, add new, flag missing as potentially used).

### 4. Meal Plan Generation
Gathers: user preferences, current pantry, recipe library favorites, past 2-3 weeks of plans. Claude generates a balanced weekly plan optimizing for variety, nutrition, using expiring pantry items first, and reasonable prep complexity.

### 5. Creative Variation Suggestions
Given a previously-cooked recipe, Claude suggests 2-3 variations: ingredient swaps, cuisine twists, dietary adaptations. Keeps repeat meals interesting.

### 6. Voice Command Processing
Voice transcript + context (current recipe, step, screen) → Claude determines intent (next_step, set_timer, ask_substitution, etc.) and generates a natural language response.

### 7. Internet Recipe Search
Claude generates search queries from user request + pantry contents. Backend searches recipe sources, Claude ranks and summarizes best matches.

---

## Key User Flows

### Recipe Import
```
Recipes tab → "+" → Choose: URL / Camera / Browse
  → URL: paste → loading → AI-parsed recipe preview → Save
  → Camera: photo → loading → AI-parsed recipe → Save
  → Browse: describe what you want → AI finds recipes → select → Save
```

### Pantry Scan
```
Pantry tab → "Scan" → Camera → Take photo(s)
  → AI analyzes → Shows items with confidence scores
  → User confirms/adjusts → Saved
```

### Meal Planning
```
Home → "Plan This Week" → AI generates plan considering:
  preferences + pantry + favorites + recent history
  → Review/swap meals → Confirm
  → Auto-generates shopping list (minus pantry items)
```

### Instacart Ordering
```
Shopping tab → View consolidated list → "Order on Instacart"
  → Backend creates Instacart shopping list page → Opens URL
  → User completes order on Instacart
  → Saved to history for easy reordering
```

### Cooking Mode (Voice)
```
Cook tab → Select recipe → Full-screen step-by-step
  → Tap mic: "Next step" / "Set timer for 10 min" / "What can I substitute?"
  → TTS reads responses aloud
  → Hands-free throughout
```

### Reorder with Tweaks
```
Shopping → History → Past order → "Reorder"
  → AI: "Last time you made X, Y, Z. Try swapping X for A?"
  → Accept/modify → New list → Instacart
```

---

## Instacart Integration

The Instacart Developer Platform uses a **link-based model**: the API creates a recipe page or shopping list page on Instacart's marketplace and returns a URL. The user clicks the URL to complete the order.

```
Mobile App → Backend → Instacart Developer Platform API
                          ↓
                    Returns URL
                          ↓
Mobile App opens URL (in-app browser or Instacart deep link)
```

### Meal Plan → Instacart Flow
1. User finalizes meal plan
2. Backend consolidates ingredients across all recipes
3. Deduplicates and combines quantities
4. Subtracts pantry items
5. Groups by category
6. User reviews and adjusts
7. Backend calls Instacart API to create shopping list page
8. User opens link, completes order
9. Snapshot saved for future reordering

---

## Voice Interaction Architecture

```
┌────────────────────────┐
│     Mobile App         │
│  ┌──────────────────┐  │    STT transcript
│  │  CookingModeUI   │──────────────────►  Backend
│  │  + VoiceButton   │  │                  POST /ai/voice-command
│  │                   │◄──────────────────  { intent, response_text, action_data }
│  │  expo-speech      │  │   response
│  │  (TTS output)     │  │
│  └──────────────────┘  │
│                        │
│  expo-speech-          │
│  recognition (STT)     │
└────────────────────────┘
```

**Pipeline:** User speaks → on-device STT → backend → Claude (with recipe context) → response → on-device TTS → UI update

**Supported commands:** next/previous/repeat step, set timer, ask substitution, ask technique, add to shopping list, estimate remaining time.

---

## Phased Implementation

### Phase 1: MVP (Weeks 1-6)
- **Week 1:** Project scaffolding (Expo, Fastify, Supabase, monorepo)
- **Week 2:** Auth + core UI shell (tabs, navigation, profile/preferences)
- **Week 3:** Recipe import (URL scraping + photo → Claude → structured recipe)
- **Week 4:** Pantry scanning (camera → Claude vision → inventory)
- **Week 5:** Meal planning + shopping list generation
- **Week 6:** Instacart integration + offline caching + polish

### Phase 2: Voice + Intelligence (Weeks 7-10)
- Cooking mode with step-by-step UI
- Voice STT/TTS integration
- Voice command processing via Claude
- Timers in cooking mode
- Creative variation suggestions
- Semantic recipe search (pgvector)

### Phase 3: Polish + Delight (Weeks 11-14)
- Onboarding wizard
- Push notifications (meal reminders, expiring pantry items)
- Family/household multi-user
- Offline mode hardening
- App Store / Play Store submission

---

## Testing Strategy

- **Unit:** Backend services (mock Claude/Instacart), Zustand stores, utility functions
- **Integration:** API routes with Supertest, Supabase RLS policies
- **E2E:** Detox or Maestro for critical flows (recipe import, pantry scan, meal plan, Instacart)
- **AI-specific:** Golden sets of 20-30 recipe URLs, 10-15 pantry photos, 50+ voice transcripts for regression testing
