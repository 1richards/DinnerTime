# Phase 7: Meal Planning - Research

**Researched:** 2026-04-10
**Domain:** AI-generated weekly meal plans with pantry/preference constraints, variety balancing, calendar UI, swap flows, and pantry deduction on cook
**Confidence:** HIGH (stack locked by CLAUDE.md; patterns established in Phases 3-6)

## Summary

Phase 7 builds weekly dinner planning on top of already-shipped primitives: pantry inventory (Phase 3), AI suggestion prompt assembly (Phase 4), and the recipe library (Phase 6). The work is overwhelmingly integration plus one new domain model (`meal_plans`) — not greenfield research. The core technical question is how to structure a 7-day plan as persistent data, how to extend the existing Claude tool-use pattern from "suggest 3-5 dinners" to "fill 7 nights with variety/complexity constraints," and how to wire pantry deduction when a planned meal is marked cooked.

No new third-party libraries are needed. All work lands in existing locations: `packages/server/src/services/mealPlanner.ts` (new), `packages/server/src/routes/meal-plans.ts` (currently a 501 stub), a new Supabase migration `00006_meal_plans.sql`, and a new mobile store + tab route. The calendar UI is a simple 7-row vertical list (no third-party calendar lib — the scale does not justify it).

**Primary recommendation:** Reuse `suggestions.ts` patterns verbatim. One new Claude tool `generate_meal_plan` returning 7 slots, each slot referencing either an existing recipe_id from the user's library or a new AI-generated recipe. Persist as `meal_plans` (1 row per week) + `meal_plan_entries` (7 rows per plan). Swap = regenerate a single slot with exclusion list. Cook-deduct = join plan entry to recipe ingredients and decrement matching pantry items.

## User Constraints

No CONTEXT.md exists for this phase — planning proceeds without pre-locked user decisions. Planner should surface key choices during plan-check (calendar vs list UI, persist history depth for "recent meals", single active plan vs multiple).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | Generate weekly dinner plan with AI | New `mealPlanner.ts` service mirroring `suggestions.ts`; new `generate_meal_plan` Claude tool returning 7 slots |
| PLAN-02 | Consider pantry, preferences, recipe library | Reuse pantry fetch + prompt assembly from `suggestions.ts`; additionally pass user's recipe library titles/ids so Claude can reference existing recipes |
| PLAN-03 | Avoid repeating recent meals | Query last N completed meal_plan_entries (last 2-3 weeks); pass titles as "AVOID REPEATING" block in prompt |
| PLAN-04 | Balance complexity across week | Prompt guideline: easy (15-30 min) on Mon-Thu, more ambitious allowed Fri-Sun; enforce via tool schema `complexity_target` per slot |
| PLAN-05 | Swap individual meals | New endpoint `POST /meal-plans/:id/entries/:day/regenerate` — same prompt with single-slot scope + exclusion of current title |
| PLAN-06 | Weekly calendar view | New `app/(tabs)/plan.tsx` (replace or extend existing tab structure); 7-row vertical layout with day labels — no calendar library |
| PLAN-07 | Auto-deduct on cook | New endpoint `POST /meal-plans/:id/entries/:day/cook` — reads recipe ingredients, matches against pantry by `normalized_name`, decrements quantities or marks status='used' |

## Standard Stack

### Core (already installed, reuse)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ~0.82 | Claude API with tool-use | Already powers `suggestions.ts`, `vision.ts`, `recipeParser.ts`, `recipeDiscovery.ts` — same pattern |
| Hono | ~4.x | API routes | Existing `meal-plans.ts` stub ready to replace |
| @supabase/supabase-js | ~2.101 | DB + RLS | Pattern: each service takes `SupabaseClient` injected from route via `c.get('supabase')` |
| Zustand | ~5.0 | Mobile plan store | Follow `suggestionsStore.ts` / `recipeStore.ts` pattern exactly (optimistic + snapshot rollback) |
| expo-router | bundled | `/plan` route | File-based under `src/app/(tabs)/plan.tsx` |
| NativeWind | ~4.x | Styling | Consistent with Phase 6 UI |
| date-fns | check | Week start/day labels | Likely already transitively present; if not, use native `Date` — no extra install |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vertical 7-row list | react-native-calendars | Overkill — we don't need month navigation, event overlays, or date picking. Just 7 slots. |
| Single `meal_plans` JSONB column | Normalized `meal_plan_entries` table | JSONB simpler but makes "recent meals" query + swap-single-day harder. Normalized wins for PLAN-03 and PLAN-05. |
| Store plans server-generated every time | Persist plans | Persistence is mandatory — users view plan across sessions (PLAN-06) and cook from it (PLAN-07) |

**No new packages to install.** All dependencies already present from Phases 1-6.

## Architecture Patterns

### Recommended Structure

```
packages/server/src/
├── routes/meal-plans.ts                    # replace 501 stub
├── services/mealPlanner.ts                 # NEW — mirrors suggestions.ts
├── services/__tests__/mealPlanner.test.ts  # NEW — mirrors suggestions.test.ts
supabase/migrations/
└── 00006_meal_plans.sql                    # NEW — meal_plans + meal_plan_entries
apps/mobile/src/
├── app/(tabs)/plan.tsx                     # NEW — weekly calendar tab
├── app/(tabs)/_layout.tsx                  # add Plan tab
├── stores/mealPlanStore.ts                 # NEW — Zustand store
├── stores/__tests__/mealPlanStore.test.ts  # NEW
├── components/plan/                        # NEW — DayRow, SwapSheet, CookConfirm
└── hooks/useMealPlan.ts                    # NEW — if needed
```

### Pattern 1: Service Mirrors `suggestions.ts`

**What:** New `mealPlanner.ts` exports `buildMealPlanPrompt()` (pure, testable) and `generateMealPlan(supabase, profileId)` (fetches + calls Claude).
**When:** Always — this matches the Phase 4 pattern exactly and reuses established test scaffolding.
**Example** (adapted from existing `suggestions.ts`):
```typescript
// packages/server/src/services/mealPlanner.ts
const generateMealPlanTool = {
  name: 'generate_meal_plan' as const,
  description: 'Fill 7 dinner slots for the week, balancing variety, pantry use, and complexity',
  input_schema: {
    type: 'object' as const,
    properties: {
      days: {
        type: 'array',
        minItems: 7,
        maxItems: 7,
        items: {
          type: 'object',
          properties: {
            day_of_week: { type: 'string', enum: ['mon','tue','wed','thu','fri','sat','sun'] },
            title: { type: 'string' },
            description: { type: 'string' },
            recipe_id: { type: ['string','null'], description: 'UUID of existing library recipe if reused' },
            ingredients_used: { type: 'array', items: { type: 'string' } },
            ingredients_needed: { type: 'array', items: { type: 'string' } },
            estimated_time_minutes: { type: 'number' },
            difficulty: { type: 'string', enum: ['easy','medium','hard'] },
            complexity_target: { type: 'string', enum: ['weeknight','weekend'] },
            kid_friendly: { type: 'boolean' },
            why_suggested: { type: 'string' },
          },
          required: ['day_of_week','title','description','estimated_time_minutes','difficulty','complexity_target','kid_friendly','why_suggested'],
        },
      },
    },
    required: ['days'],
  },
};
```

### Pattern 2: Prompt Extends `buildSuggestionPrompt`

Reuse the allergy/dislike/preference blocks verbatim. Add three new sections:
- **RECIPE LIBRARY** — list of `{id, title}` pairs so Claude can set `recipe_id` when reusing
- **RECENT MEALS (avoid repeating)** — titles from last 14-21 days of cooked entries
- **WEEK STRUCTURE** — Mon-Thu simpler, Fri-Sun ambitious allowed

### Pattern 3: Normalized Persistence

```sql
-- meal_plans: one row per week per user
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,              -- Monday of the week
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, week_start)
);

-- meal_plan_entries: 7 rows per plan
CREATE TABLE meal_plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',     -- mirror of recipe for ad-hoc AI meals
  estimated_time_minutes INTEGER,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  kid_friendly BOOLEAN DEFAULT FALSE,
  why_suggested TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','cooked','skipped')),
  cooked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meal_plan_id, day_of_week)
);

CREATE INDEX idx_meal_plans_profile_week ON meal_plans(profile_id, week_start DESC);
CREATE INDEX idx_meal_plan_entries_plan ON meal_plan_entries(meal_plan_id);
CREATE INDEX idx_meal_plan_entries_cooked ON meal_plan_entries(meal_plan_id, status, cooked_at DESC);

-- RLS: mirror recipes policies
-- Standard updated_at trigger on meal_plans using existing public.update_updated_at()
```

### Pattern 4: Swap = Scoped Regeneration

`POST /meal-plans/:id/entries/:day/regenerate` body: `{ exclude: [currentTitle] }`.
Service fetches same pantry+preferences context, prompt asks for ONE alternative for day X excluding listed titles, tool schema narrows to single item. Update row in place.

### Pattern 5: Cook-Deduct Reconciliation

`POST /meal-plans/:id/entries/:day/cook`:
1. Load entry with its `ingredients` JSONB (either from linked `recipe_id` or inline)
2. For each ingredient: fuzzy match against `pantry_items` by `normalized_name` (same normalization used in Phase 3)
3. For matches: decrement `quantity` by recipe-indicated amount; if <= 0 set `status='used'`
4. Update entry `status='cooked'`, `cooked_at=NOW()`
5. Return updated pantry delta so mobile can reflect changes

### Anti-Patterns to Avoid

- **JSONB for the whole plan.** Blocks efficient recent-meal queries and per-day swap updates. Use normalized rows.
- **Multiple active plans.** For v1, one active plan per `week_start`. Unique constraint enforces.
- **Pre-building recipe shells for AI-generated meals.** Keep AI meals inline in `meal_plan_entries.ingredients` — only promote to `recipes` table if user explicitly saves.
- **Using `react-native-calendars`.** 7 rows don't need it. Adds weight + gestures we don't use.
- **Recomputing recent-meals inside the Claude prompt each request without a limit.** Cap at last 21 days / 21 entries to keep prompt bounded.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured AI output | Regex over freeform text | Claude tool-use (already standard here) | Existing pattern — `suggest_dinners` tool in `suggestions.ts` proves reliability |
| Fuzzy ingredient match for deduction | Custom tokenizer | Reuse `normalized_name` column + simple substring/exact match | Phase 3 already normalized pantry item names |
| Week start date math | Custom Monday-finder | `Date.getDay()` with simple offset or existing date helpers | Trivial — don't install moment/dayjs |
| Calendar grid | react-native-calendars | Vertical FlatList of 7 `DayRow` components | Scale is 7 rows, not a month grid |
| Confidence decay in plan context | New logic | Import `getEffectiveConfidence` from `suggestions.ts` (or lift to shared util) | Already battle-tested |

**Key insight:** Every "hard" part of Phase 7 has a precedent in an earlier phase. Research is mostly about mapping, not discovery.

## Common Pitfalls

### Pitfall 1: Claude returning fewer than 7 days
**What goes wrong:** Tool schema permits arrays but model occasionally returns 5-6.
**Why it happens:** Token limits or ambiguous prompt.
**How to avoid:** `minItems: 7, maxItems: 7` in tool schema + explicit "Return EXACTLY 7 days, one per day_of_week value" in prompt. Validate length server-side and throw 502 on mismatch.
**Warning signs:** `days.length !== 7` in parsed tool block.

### Pitfall 2: Stale pantry during swap
**What goes wrong:** User swaps on Day 3 but sees pantry state from when plan was generated yesterday.
**Why:** Swap is stateless — each call re-fetches pantry.
**How to avoid:** Ensure swap endpoint re-queries pantry fresh, not stored snapshot. Document in service.

### Pitfall 3: Double-deduction on cook
**What goes wrong:** User taps "Cooked" twice → ingredients decremented twice.
**How to avoid:** Idempotency check — if `status === 'cooked'` already, return 409 or no-op.

### Pitfall 4: Unique constraint on `(profile_id, week_start)` conflicts when regenerating
**What goes wrong:** User taps "Generate" twice → constraint violation.
**How to avoid:** Use `UPSERT` (ON CONFLICT DO UPDATE) or delete existing plan + entries in a transaction before inserting. Prefer delete-then-insert for clarity.

### Pitfall 5: Recent-meals query pulls too much
**What goes wrong:** User cooks for 6 months — prompt bloats with 180 titles.
**How to avoid:** Hard limit `LIMIT 21` ordered by `cooked_at DESC` when fetching recent meals for prompt.

### Pitfall 6: Recipe ingredient shape mismatch
**What goes wrong:** Recipes store `ingredients JSONB` with `{name, quantity, unit}` objects; pantry deduction needs consistent parsing.
**How to avoid:** Reuse any Phase 6 recipe-ingredient parsing utility. If none exists, define one in `packages/server/src/services/ingredientMatching.ts` and cover with tests.

### Pitfall 7: Kid-friendly not enforced week-wide
**What goes wrong:** Plan has zero kid-friendly nights despite kids in household.
**How to avoid:** Prompt guideline: "If household has kids, at least 3 of 7 nights must be kid_friendly=true." Optionally validate server-side and regenerate once on failure.

## Code Examples

### Route Shape (replace existing 501 stub)
```typescript
// packages/server/src/routes/meal-plans.ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { generateMealPlan, regenerateDay, markCooked } from '../services/mealPlanner.js';

const mealPlans = new Hono();
mealPlans.use('*', authMiddleware);

mealPlans.get('/current', async (c) => {
  const supabase = c.get('supabase');
  const profileId = c.get('profileId');
  // fetch active plan for current week_start
});

mealPlans.post('/generate', async (c) => {
  const supabase = c.get('supabase');
  const profileId = c.get('profileId');
  const { week_start } = await c.req.json();
  const plan = await generateMealPlan(supabase, profileId, week_start);
  return c.json(plan);
});

mealPlans.post('/:id/entries/:day/regenerate', async (c) => { /* swap */ });
mealPlans.post('/:id/entries/:day/cook', async (c) => { /* deduct */ });

export default mealPlans;
```

### Mobile Store Skeleton (follows `suggestionsStore.ts`)
```typescript
// apps/mobile/src/stores/mealPlanStore.ts
import { create } from 'zustand';

interface MealPlanState {
  currentPlan: MealPlan | null;
  loading: boolean;
  error: string | null;
  generate: (weekStart: string) => Promise<void>;
  swapDay: (day: number) => Promise<void>;
  markCooked: (day: number) => Promise<void>;
}

// Same getApiBaseUrl + getAuthToken helpers as pantryStore/suggestionsStore
// Optimistic update + snapshot rollback (Phase 6 pattern)
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Freeform Claude JSON + parse | Tool-use with `input_schema` | Phase 3+ | Already adopted — strict schemas eliminate parse errors |
| Legacy Architecture RN | New Architecture (Fabric) | Expo SDK 55 | Non-issue — already running on New Arch |
| expo-av | expo-audio/expo-video | SDK 52+ | N/A for this phase |

## Open Questions

1. **How deep should "recent meals" history go?**
   - What we know: Too shallow → repetition; too deep → prompt bloat
   - What's unclear: Sweet spot between 14 and 28 days
   - Recommendation: Start with 21 days / 21 entries cap, make configurable via service param, revisit after dogfooding

2. **Should the Plan tab replace an existing tab or be added?**
   - What we know: Current tabs are Home, Recipes, Pantry, Shopping, Cook
   - What's unclear: Whether Plan replaces Home (which currently handles suggestions) or is a 6th tab
   - Recommendation: Add as 6th tab OR fold into Home. Defer to plan-check with UX owner.

3. **Does Phase 7 populate `shopping` (Phase 8 feature) as a side effect?**
   - What we know: PLAN-02 says plans consider pantry; Phase 8 (SHOP-01) says shopping list auto-generates from meal plan
   - What's unclear: Whether Phase 7 emits the "ingredients_needed" list anywhere persistent
   - Recommendation: Store `ingredients_needed` on each entry but do NOT build shopping UI in Phase 7. Phase 8 reads from `meal_plan_entries`.

4. **Servings scaling?**
   - Unclear if plans should scale recipe servings to household size automatically
   - Recommendation: For v1, just pass `household_size` to prompt as context; defer automatic scaling.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (server + mobile, config already present per `vitest.config.ts`) |
| Config file | `packages/server/vitest.config.ts`, `apps/mobile/vitest.config.ts` |
| Quick run command | `pnpm --filter @dinnertime/server test -- mealPlanner` |
| Full suite command | `pnpm -r test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-01 | `generateMealPlan` returns 7 days given mocked pantry/preferences/Claude | unit | `pnpm --filter @dinnertime/server test mealPlanner` | Wave 0 |
| PLAN-02 | `buildMealPlanPrompt` includes pantry items, allergies, recipe library | unit (pure fn) | same | Wave 0 |
| PLAN-03 | Prompt includes "AVOID REPEATING" section with recent titles; recent-meal fetch limited to 21 | unit | same | Wave 0 |
| PLAN-04 | Prompt contains complexity guidance Mon-Thu vs Fri-Sun; tool schema enforces `complexity_target` | unit | same | Wave 0 |
| PLAN-05 | `regenerateDay` excludes current title, updates single entry row | unit + integration | same | Wave 0 |
| PLAN-06 | Mobile `mealPlanStore` fetch populates `currentPlan`; DayRow component renders 7 rows (RNTL) | unit | `pnpm --filter @dinnertime/mobile test mealPlan` | Wave 0 |
| PLAN-07 | `markCooked` decrements matching pantry items and sets entry status to cooked; idempotent | unit + integration | `pnpm --filter @dinnertime/server test mealPlanner` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @dinnertime/server test mealPlanner` (server) or `pnpm --filter @dinnertime/mobile test mealPlan` (mobile)
- **Per wave merge:** `pnpm -r test` (all packages)
- **Phase gate:** `pnpm -r test` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/services/__tests__/mealPlanner.test.ts` — covers PLAN-01..05, 07 server-side
- [ ] `packages/server/src/routes/__tests__/meal-plans.test.ts` — covers route wiring (may not yet exist)
- [ ] `apps/mobile/src/stores/__tests__/mealPlanStore.test.ts` — covers store flows
- [ ] `apps/mobile/src/components/plan/__tests__/DayRow.test.tsx` — renders entry row
- [ ] Supabase migration `00006_meal_plans.sql` must exist before integration tests can run against local Supabase
- [ ] Test fixtures: sample pantry + household + recipe library + 3-5 "recent cooked" entries for prompt assembly tests

No framework install needed — Vitest already configured in both workspaces.

## Sources

### Primary (HIGH confidence)
- `./CLAUDE.md` — locked stack (Expo 55, Hono, Claude Sonnet 4, Supabase, Zustand, NativeWind)
- `.planning/REQUIREMENTS.md` — PLAN-01..07 definitions and Phase 8 dependency (SHOP-01 reads from meal plan)
- `.planning/STATE.md` — Phase 4/6 decisions (tool-use pattern, optimistic+rollback store pattern, confidence decay replicated server-side)
- `packages/server/src/services/suggestions.ts` — canonical template for `mealPlanner.ts`
- `packages/server/src/services/__tests__/suggestions.test.ts` — canonical template for `mealPlanner.test.ts`
- `packages/server/src/routes/meal-plans.ts` — existing 501 stub, ready to replace
- `supabase/migrations/00004_recipes.sql` — canonical RLS + trigger template for `00006_meal_plans.sql`
- `apps/mobile/src/app/(tabs)/_layout.tsx` — tab registration pattern

### Secondary (MEDIUM confidence)
- `apps/mobile/src/stores/suggestionsStore.ts` (inferred from STATE.md Phase 04 decisions) — store pattern source

### Tertiary (LOW confidence)
- None — this phase is integration work over shipped primitives; no external/unverified claims.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all libraries locked in CLAUDE.md
- Architecture: HIGH — direct mirrors of `suggestions.ts` (service) and `00004_recipes.sql` (schema)
- Pitfalls: HIGH — drawn from Phase 3-6 accumulated decisions in STATE.md
- Claude tool schema shape: MEDIUM — `minItems/maxItems` array constraints should be verified against current `@anthropic-ai/sdk` tool-use behavior at plan time (fallback: server-side length check)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days — stack is stable, no fast-moving dependencies in scope)
