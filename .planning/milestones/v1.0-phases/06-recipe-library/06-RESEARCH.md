# Phase 6: Recipe Library - Research

**Researched:** 2026-04-10
**Domain:** Recipe management (CRUD, search, favorites, scaling, AI discovery) in React Native + Supabase + Hono
**Confidence:** HIGH

## Summary

Phase 6 layers library-management features on top of the existing recipe infrastructure built in Phase 5. The database table (`recipes`), RLS policies, Hono route group (`/api/v1/recipes`), mobile `recipeStore` (Zustand), and a minimal recipes tab already exist. Phase 6 adds: (1) detail/edit/delete UI + server PATCH/DELETE endpoints, (2) keyword search, (3) a `is_favorite` column with toggle + filter, (4) client-side serving-size scaling with fractional-aware ingredient math, and (5) an AI-powered "discover recipes" flow that mirrors the existing meal-suggestions pattern (Claude Sonnet via backend, respecting preferences).

No new libraries are required. All work uses the established stack (Zustand, Supabase, Hono, NativeWind, expo-router, Anthropic SDK). The one meaningful design decision is search strategy: Postgres `ILIKE` on `title` is sufficient for v1 given expected library size (tens-hundreds of recipes per user); full-text search and pgvector semantic search are explicitly deferred (`ADVN-01` is v2).

**Primary recommendation:** Ship CRUD + search + favorites + scaling as 3 plans against existing tables/routes; implement AI discovery as a 4th plan that copies the `suggestionsStore` / `suggestions.ts` service pattern verbatim.

## User Constraints

No `CONTEXT.md` exists for Phase 6 — no user-locked decisions. All choices below are Claude's discretion within the constraints already set by `CLAUDE.md` / STACK / prior phase decisions.

**Inherited constraints (from CLAUDE.md + STATE.md):**
- All AI calls through backend (no API keys in mobile)
- Claude (Anthropic) is the only AI provider — use Sonnet 4 for discovery, Haiku 4 acceptable for query rewriting if needed
- Stack is locked: Expo SDK 55 / RN 0.83 / NativeWind / Zustand / Hono / Supabase
- Row-Level Security on all tables, `profile_id = auth.uid()`
- No offline support in Phase 6 (deferred to FOUN-07 / Phase 10)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RECP-06 | View, edit, delete recipes in library | Existing table + RLS policies cover delete/update. Need: detail screen, edit screen (reuse `review.tsx` patterns from Phase 5), server PATCH `/recipes/:id`, server DELETE `/recipes/:id`, store methods. |
| RECP-07 | Search recipes by keyword | Postgres `ILIKE` on `title` (optionally `description`). Client-side `useDeferredValue` for debouncing (already used in Phase 2 ingredient search). |
| RECP-08 | Favorite recipes | Add `is_favorite BOOLEAN DEFAULT FALSE` column via migration `00005_recipe_favorites.sql`. PATCH endpoint toggles. Index on `(profile_id, is_favorite)` for filter queries. |
| RECP-09 | Adjust serving size, scale ingredients | Pure client-side math. Multiplier = `newServings / recipe.servings`. Need fraction-aware quantity parsing + display (e.g., "1 1/2 cups" when scaling 3/4 cup × 2). Recommend `fraction.js` OR custom helper. |
| RECP-10 | Browse AI-suggested recipes from internet | Mirror `suggestionsStore` + `/api/v1/suggestions` pattern. New route: `POST /api/v1/recipes/discover` → Claude Sonnet with tool use, respects preferences (already loaded in `preferencesStore`). Returns `ParsedRecipe[]`; user can tap to save to library. |

## Standard Stack

### Reused (already installed — do not re-add)
| Library | Version | Purpose |
|---------|---------|---------|
| @supabase/supabase-js | ~2.101 | DB queries, realtime |
| hono | ~4.x | Server routes |
| zustand | ~5.0 | recipeStore state |
| @anthropic-ai/sdk | ~0.82 | Claude for RECP-10 discovery |
| nativewind | ~4.x | Styling |
| expo-router | bundled | `/recipes/[id]`, `/recipes/[id]/edit`, `/recipes/discover` |
| @expo/vector-icons | bundled | heart icon, search icon |

### New (minimal)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fraction.js | ~4.3 | Fraction-aware ingredient quantity scaling | Zero-dependency, 8KB, widely used. Handles `1 1/2`, `3/4`, decimals, formats back to mixed fractions. Alternative: hand-roll — NOT recommended (edge cases around repeating decimals, Unicode fractions). |

**Installation:**
```bash
pnpm --filter mobile add fraction.js
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fraction.js` | Hand-rolled parser | Simple for `1/2`, breaks on `1 1/3 × 2 = 2 2/3`. Not worth the bug surface. |
| `ILIKE` search | Postgres FTS (`tsvector`) | FTS adds migration + ranking complexity. Only worth it at >500 recipes/user. Defer. |
| `ILIKE` search | pgvector semantic search | Already covered by v2 `ADVN-01`. Out of scope for Phase 6. |
| Client-side filter for search | Server `ILIKE` | Client-side is simpler when library is small, but pagination is awkward. Server-side with a `q` query param is cleaner and matches existing route style. |

## Architecture Patterns

### Project Structure Additions
```
apps/mobile/src/
├── app/
│   ├── (tabs)/recipes.tsx           # EXISTING — add search bar + favorites filter chip
│   └── recipes/
│       ├── [id].tsx                  # NEW — detail view with scale slider, favorite toggle
│       ├── [id]/edit.tsx             # NEW — edit screen (reuse review.tsx form components)
│       └── discover.tsx              # NEW — RECP-10 AI discovery browse
├── components/recipes/
│   ├── RecipeCard.tsx                # EXISTING — add heart badge
│   ├── SearchBar.tsx                 # NEW
│   ├── ServingSizeStepper.tsx        # NEW
│   ├── ScaledIngredientList.tsx      # NEW — wraps IngredientList with multiplier
│   └── FavoriteButton.tsx            # NEW — optimistic toggle
├── stores/
│   └── recipeStore.ts                # EXISTING — add updateRecipe, deleteRecipe, toggleFavorite, searchQuery, showFavoritesOnly, discoverRecipes
├── lib/
│   └── scaleIngredient.ts            # NEW — fraction-aware scaling helper

packages/server/src/
├── routes/recipes.ts                 # EXISTING — add PATCH /:id, DELETE /:id, POST /discover
├── services/
│   ├── recipeStore.ts                # EXISTING — add updateRecipe, deleteRecipe, searchRecipes
│   └── recipeDiscovery.ts            # NEW — Claude-driven discovery (mirrors suggestions.ts)

supabase/migrations/
└── 00005_recipe_favorites.sql        # NEW — add is_favorite column + index
```

### Pattern 1: Optimistic Favorite Toggle
**What:** Flip local state immediately, call server, rollback on error.
**When:** All favorite/delete/update operations — matches Phase 2 preferences store pattern.

```typescript
toggleFavorite: async (id: string) => {
  const { recipes } = get();
  const prev = recipes;
  // Optimistic
  set({
    recipes: recipes.map((r) =>
      r.id === id ? { ...r, is_favorite: !r.is_favorite } : r
    ),
  });
  try {
    const token = await getAuthToken();
    const res = await fetch(`${getApiBaseUrl()}/api/v1/recipes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_favorite: !prev.find((r) => r.id === id)?.is_favorite }),
    });
    if (!res.ok) throw new Error('Toggle failed');
  } catch (err) {
    set({ recipes: prev, error: 'Failed to update favorite' }); // rollback
  }
}
```

### Pattern 2: Server-Side Search via Query Param
**What:** `GET /api/v1/recipes?q=pasta&favorites=true` — extend existing `recipes.get('/')`.

```typescript
// packages/server/src/services/recipeStore.ts
export async function getRecipes(
  supabase: SupabaseClient,
  userId: string,
  opts: { q?: string; favoritesOnly?: boolean } = {}
) {
  let query = supabase.from('recipes').select('*').eq('profile_id', userId);
  if (opts.q) query = query.ilike('title', `%${opts.q}%`);
  if (opts.favoritesOnly) query = query.eq('is_favorite', true);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
```

**Client debouncing:** Use `useDeferredValue(searchQuery)` (React 19 — already used in Phase 2), then trigger `fetchRecipes({ q: deferred })` in an effect. No need for lodash debounce.

### Pattern 3: Serving Scale Math
**What:** Store the raw `ParsedIngredient[]` unchanged. Compute a display-only scaled list on render using `servingMultiplier = currentServings / recipe.servings`.

```typescript
// apps/mobile/src/lib/scaleIngredient.ts
import Fraction from 'fraction.js';
import type { ParsedIngredient } from '../types/recipe';

export function scaleIngredient(
  ing: ParsedIngredient,
  multiplier: number
): ParsedIngredient {
  if (ing.quantity == null) return ing;
  const scaled = new Fraction(ing.quantity).mul(multiplier);
  return { ...ing, quantity: Number(scaled.valueOf()) };
}

export function formatQuantity(n: number): string {
  // Display mixed fraction: 1.5 → "1 1/2"
  const f = new Fraction(n);
  return f.toFraction(true); // mixed form
}
```

**Why client-side only:** Source of truth stays canonical. User can re-scale freely. No server round-trip. Slider is smooth.

### Pattern 4: AI Discovery (RECP-10) — Mirror Suggestions Pattern
**What:** Identical architecture to Phase 4 meal suggestions.

1. Mobile calls `POST /api/v1/recipes/discover` with optional `{ prompt?: string }` (user can type "quick weeknight pastas" or leave blank for pure preference-driven).
2. Backend loads user preferences (reuse helper from `services/suggestions.ts`), assembles a prompt with HARD CONSTRAINTS (allergies) and SOFT PREFERENCES (dietary/cuisine/dislikes), calls Claude Sonnet with a `suggest_recipes` tool returning structured `ParsedRecipe[]` (same shape as import output — no new types).
3. Mobile renders result as tappable cards; "Save to Library" button calls existing `saveRecipe()`.

```typescript
// packages/server/src/services/recipeDiscovery.ts — skeleton
export async function discoverRecipes(opts: {
  preferences: Preferences;
  prompt?: string;
}): Promise<ParsedRecipe[]> {
  const client = getAnthropicClient();
  const system = buildDiscoveryPrompt(opts.preferences);
  const res = await client.messages.create({
    model: 'claude-sonnet-4-latest',
    max_tokens: 4096,
    system,
    tools: [suggestRecipesTool], // returns { recipes: ParsedRecipe[] }
    tool_choice: { type: 'tool', name: 'suggest_recipes' },
    messages: [{ role: 'user', content: opts.prompt ?? 'Suggest 6 dinner recipes.' }],
  });
  return extractToolResult(res);
}
```

**Critical:** `source_type: 'url'` with `source_url` pointing to a reference is misleading for AI-generated recipes. Add a 4th source type: `'ai'`. This requires updating the CHECK constraint on `recipes.source_type`.

### Anti-Patterns to Avoid
- **Storing scaled ingredients:** Never mutate `recipes.ingredients` when user scales. Keep canonical, scale on render.
- **Client-side search over full list:** Works at 20 recipes, breaks at 200 — start server-side from day one.
- **Overloading the import flow for AI discovery:** Phase 5's `importedRecipe` / `review.tsx` is for user-initiated imports. Discovery uses its own screen; tapping "Save" can reuse the server's `POST /recipes` directly with `source_type: 'ai'`.
- **Blocking save on AI discovery:** Let user save without reviewing. The AI output is already structured.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fraction math for scaling | Custom parser | `fraction.js` | Handles `1 1/2`, repeating decimals, Unicode fractions, round-tripping |
| Search debounce | `setTimeout` debounce | `useDeferredValue` | React 19 native, no cleanup, already in codebase |
| Recipe CRUD transport | Raw Supabase from mobile | Existing Hono routes | Consistency with Phase 5, server-side auth checks, easier to add logging |
| AI tool-use plumbing | Prompt-only JSON parsing | Anthropic tool use | Phase 3/4 already established this pattern — reuse, don't invent |
| Favorite badge animation | Reanimated spring from scratch | Simple scale transform on press | Overkill for a heart toggle |

## Common Pitfalls

### Pitfall 1: RLS Policies Not Covering New Column
**What goes wrong:** Add `is_favorite` column — existing UPDATE policy `WITH CHECK (auth.uid() = profile_id)` already covers it, but if you add `favorite_collections` or similar as a separate table, you'd need fresh policies.
**How to avoid:** For Phase 6, a column on `recipes` is sufficient; existing policies apply. Verify with a test that an unauthenticated PATCH fails.

### Pitfall 2: ILIKE Injection via `q` Parameter
**What goes wrong:** `%${q}%` allows user-supplied `%` / `_` wildcards to match everything.
**How to avoid:** Escape user input: `q.replace(/[%_]/g, '\\$&')` before interpolating, OR use Supabase's `.textSearch()` once at v2.

### Pitfall 3: Serving-Size Slider Re-renders Everything
**What goes wrong:** `onValueChange` fires 60x/sec, re-computing all scaled ingredients and re-rendering.
**How to avoid:** Use `useDeferredValue(servings)` OR `useMemo` keyed on servings. For 10-20 ingredients this is fine; just don't put state on slider thumb drag.

### Pitfall 4: AI Discovery Returns Duplicates of Existing Library Recipes
**What goes wrong:** User's library has "Spaghetti Carbonara"; Claude suggests it again.
**How to avoid:** Pass recent recipe titles in the prompt as "AVOID: already in library". Cheap to implement, large UX win.

### Pitfall 5: `source_type` CHECK Constraint Blocks AI Inserts
**What goes wrong:** `source_type IN ('url', 'photo', 'manual')` rejects `'ai'`.
**How to avoid:** Migration 00005 MUST also drop+recreate the CHECK constraint to include `'ai'`, OR use `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT`.

### Pitfall 6: Deleting a Recipe Referenced by Future Meal Plans
**What goes wrong:** Phase 7 will add meal plans referencing recipe IDs. Hard-deleting a recipe orphans meal plan entries.
**How to avoid:** Not a Phase 6 concern yet (Phase 7 doesn't exist), but note it in plan summary so Phase 7 research picks it up. Consider soft delete (`deleted_at`) if easy, or let Phase 7 deal with `ON DELETE SET NULL`.

## Code Examples

### Migration: `00005_recipe_favorites.sql`
```sql
-- Add favorites support and AI-generated source type to recipes
ALTER TABLE recipes
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_recipes_profile_favorite
  ON recipes(profile_id, is_favorite)
  WHERE is_favorite = TRUE;

-- Extend source_type to include AI-discovered recipes
ALTER TABLE recipes DROP CONSTRAINT recipes_source_type_check;
ALTER TABLE recipes ADD CONSTRAINT recipes_source_type_check
  CHECK (source_type IN ('url', 'photo', 'manual', 'ai'));
```

### Server: PATCH and DELETE routes
```typescript
// packages/server/src/routes/recipes.ts additions

recipes.patch('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();

  // Whitelist updatable fields
  const allowed = [
    'title', 'description', 'ingredients', 'steps',
    'prep_time_minutes', 'cook_time_minutes', 'total_time_minutes',
    'servings', 'is_favorite', 'image_url',
  ];
  const patch = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  try {
    const data = await updateRecipe(supabase, user.id, id, patch);
    if (!data) return c.json({ error: 'Recipe not found' }, 404);
    return c.json({ data });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

recipes.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  try {
    await deleteRecipe(supabase, user.id, id);
    return c.body(null, 204);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});
```

### Mobile: Search bar with deferred value
```typescript
// apps/mobile/src/app/(tabs)/recipes.tsx additions
const [searchQuery, setSearchQuery] = useState('');
const deferredQuery = useDeferredValue(searchQuery);
const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

useEffect(() => {
  fetchRecipes({ q: deferredQuery, favoritesOnly: showFavoritesOnly });
}, [deferredQuery, showFavoritesOnly, fetchRecipes]);
```

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Manual debounce with setTimeout | `useDeferredValue` (React 19) | Already the codebase standard |
| Full-text search via tsvector | `ILIKE` for small libraries | FTS only worth it >500 rows/user |
| Server-assembled scaled recipes | Client-side scaling | Keeps DB canonical, allows re-scaling |
| Redux slices for CRUD | Zustand store methods | Codebase standard since Phase 1 |

## Open Questions

1. **Should "discover" deduplicate against library?**
   - Recommendation: Yes, pass existing titles to Claude as "avoid" list. Cheap, high UX value.

2. **Should edit use inline forms or a full screen?**
   - Recommendation: Full screen that reuses `review.tsx` form components. Matches Phase 5's UX affordance model.

3. **Soft delete vs hard delete?**
   - Recommendation: Hard delete for v1. Phase 7 (meal plans) will need to handle the referential integrity question when it arrives.

4. **Does the recipes tab need pagination?**
   - Recommendation: No. At v1 library sizes (< 200 recipes expected), `FlatList` with all rows is fine. Revisit if real usage exceeds 500.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (mobile + server workspaces) |
| Config file | `apps/mobile/vitest.config.ts`, `packages/server/vitest.config.ts` |
| Quick run command | `pnpm --filter mobile test -- --run <path>` / `pnpm --filter server test -- --run <path>` |
| Full suite command | `pnpm -r test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECP-06 | PATCH recipe updates whitelisted fields only | unit (server) | `pnpm --filter server test -- --run routes/recipes.patch` | Wave 0 |
| RECP-06 | DELETE recipe removes row, 404 on unknown | unit (server) | `pnpm --filter server test -- --run routes/recipes.delete` | Wave 0 |
| RECP-06 | recipeStore.updateRecipe / deleteRecipe optimistic + rollback | unit (mobile) | `pnpm --filter mobile test -- --run stores/recipeStore` | exists, extend |
| RECP-07 | getRecipes with `q` applies ILIKE, escapes wildcards | unit (server) | `pnpm --filter server test -- --run services/recipeStore` | exists, extend |
| RECP-07 | Search bar debounces via useDeferredValue | unit (mobile) | `pnpm --filter mobile test -- --run app/tabs/recipes` | Wave 0 |
| RECP-08 | toggleFavorite optimistic + rollback on server error | unit (mobile) | `pnpm --filter mobile test -- --run stores/recipeStore.favorite` | Wave 0 |
| RECP-08 | favoritesOnly filter query | unit (server) | same as RECP-07 server test | Wave 0 |
| RECP-09 | scaleIngredient handles fractions, nulls, integers | unit (mobile) | `pnpm --filter mobile test -- --run lib/scaleIngredient` | Wave 0 |
| RECP-09 | ServingSizeStepper updates multiplier state | unit (mobile) | `pnpm --filter mobile test -- --run components/recipes/ServingSizeStepper` | Wave 0 |
| RECP-10 | discoverRecipes builds prompt with HARD/SOFT constraints | unit (server, mocked Anthropic) | `pnpm --filter server test -- --run services/recipeDiscovery` | Wave 0 |
| RECP-10 | POST /recipes/discover returns ParsedRecipe[] | integration (server, mocked Anthropic) | `pnpm --filter server test -- --run routes/recipes.discover` | Wave 0 |
| RECP-10 | Discover screen renders cards, save calls existing saveRecipe | unit (mobile) | `pnpm --filter mobile test -- --run app/recipes/discover` | Wave 0 |

### Sampling Rate
- **Per task commit:** Run the narrow Vitest file for the task (`--run <path>`)
- **Per wave merge:** Run workspace test suite (`pnpm --filter <workspace> test -- --run`)
- **Phase gate:** `pnpm -r test -- --run` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/routes/__tests__/recipes.patch.test.ts`
- [ ] `packages/server/src/routes/__tests__/recipes.delete.test.ts`
- [ ] `packages/server/src/routes/__tests__/recipes.discover.test.ts`
- [ ] `packages/server/src/services/__tests__/recipeDiscovery.test.ts`
- [ ] `apps/mobile/src/lib/__tests__/scaleIngredient.test.ts`
- [ ] `apps/mobile/src/components/recipes/__tests__/ServingSizeStepper.test.tsx`
- [ ] `apps/mobile/src/app/recipes/__tests__/discover.test.tsx`
- [ ] Extend `apps/mobile/src/stores/__tests__/recipeStore.test.ts` with update/delete/favorite/search actions
- [ ] Extend `packages/server/src/services/__tests__/recipeStore.test.ts` with `getRecipes({ q, favoritesOnly })`

No new test framework installs needed — Vitest is established in both workspaces.

## Sources

### Primary (HIGH confidence — local codebase)
- `supabase/migrations/00004_recipes.sql` — existing schema and RLS policies
- `apps/mobile/src/stores/recipeStore.ts` — store pattern to extend
- `apps/mobile/src/types/recipe.ts` — `ParsedRecipe` / `Recipe` types
- `apps/mobile/src/components/recipes/RecipeCard.tsx` — card pattern
- `apps/mobile/src/app/(tabs)/recipes.tsx` — list screen to extend
- `packages/server/src/routes/recipes.ts` — existing Hono routes
- `packages/server/src/services/recipeStore.ts` + `recipeParser.ts` — server-side patterns
- `.planning/STATE.md` — Phase 4/5 decisions (optimistic Zustand, autoFetch pattern, useDeferredValue)
- `CLAUDE.md` — stack constraints

### Secondary (HIGH confidence — documented standards)
- Expo SDK 55 docs (expo-router dynamic routes)
- Supabase JS v2 docs (`.ilike`, `.update`, `.delete` chainables)
- Anthropic SDK tool-use patterns (same as Phase 3/4 vision + suggestions)

### Tertiary
- `fraction.js` README (npm) — mixed-fraction formatting

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all primary choices already in codebase from Phase 1-5
- Architecture: HIGH — every pattern mirrors an existing phase (optimistic store = Phase 2, AI service = Phase 4, tool use = Phase 3)
- Pitfalls: HIGH — constraint and escaping pitfalls verified against existing migration/route code

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stack is stable; re-check only if Expo SDK 56 or Supabase JS 3 ships)
