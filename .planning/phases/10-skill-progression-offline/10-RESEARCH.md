# Phase 10: Skill Progression & Offline - Research

**Researched:** 2026-04-10
**Domain:** Offline-first data persistence, cooking history analytics, AI skill progression
**Confidence:** HIGH

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SKIL-01 | App tracks which recipes user has cooked and how often | Aggregate over existing `meal_plan_entries` (status='cooked') — no new cook event needed. New `recipe_cook_stats` materialized view OR new `recipe_cooks` table updated from `markCooked` service. |
| SKIL-02 | Gently suggests slightly more ambitious recipes based on cooking history | New `/api/v1/progression/suggestions` endpoint; Claude Sonnet 4 tool-call with history summary + recipe library + difficulty heuristic |
| SKIL-03 | Contextual cooking tips appear on recipe steps | New `cooking_tips` JSONB column on recipes OR lazy fetch from `/api/v1/cooking/tips` by `(recipe_id, step_index)`; Claude Haiku 4 for cost |
| SKIL-04 | AI suggests creative variations on frequently-cooked recipes | Reuse `/api/v1/shopping/variations` pattern (phase 8-06) — apply to any recipe with `cook_count >= 3` |
| FOUN-07 | App works offline for cached data (recipes, pantry, meal plans) | `@tanstack/react-query-persist-client` + `@tanstack/query-async-storage-persister` wrapping existing `QueryClient`; `onlineManager` wired to `@react-native-community/netinfo`; Zustand stores already use in-memory state — add `persist` middleware where needed |

## Summary

This phase has two distinct workstreams. The **skill progression** workstream is data/AI heavy but architecturally simple: cooking history already exists in `meal_plan_entries` (`status='cooked'`, `cooked_at` column, index `idx_meal_plan_entries_cooked`), so SKIL-01 is primarily an aggregation query plus a new `recipe_cook_stats` surface. SKIL-02 and SKIL-04 are Claude prompts that consume the aggregation; SKIL-03 is per-step tip generation (cached) using Haiku for cost control.

The **offline** workstream (FOUN-07) layers persistence on the existing stack. The project currently uses plain Zustand stores (no persist middleware) with direct `authedFetch` calls — NOT TanStack Query (verified: no `@tanstack/react-query` imports found in stores). Two viable paths exist: **(A) add `persist` middleware to each Zustand store** (minimal migration, mirrors current architecture), or **(B) introduce TanStack Query + `persistQueryClient` selectively** for read-heavy domains (recipes, pantry, meal plans). Path A is the lower-risk choice and aligns with existing conventions; CLAUDE.md lists React Query in the stack but no code currently imports it.

**Primary recommendation:** Use Zustand `persist` middleware with `createJSONStorage(() => AsyncStorage)` for `recipeStore`, `pantryStore`, `mealPlanStore`, `preferencesStore`, and `shoppingStore`. Add `@react-native-community/netinfo` driven `isOnline` flag in a new `networkStore`; gate mutations behind it with a write-queue fallback for critical paths (cooking mark, pantry edits). For SKIL-01..04, extend the existing server `services/progression.ts` (new) and a Hono route group `/api/v1/progression/*`. Keep cooking-tips generation lazy and cached in a new `recipe_step_tips` table keyed on `(recipe_id, step_index)` so Haiku is called at most once per step per recipe.

## User Constraints (from CONTEXT.md)

No CONTEXT.md file found in `.planning/phases/10-skill-progression-offline/`. No locked user decisions. All design choices are Claude's discretion, subject to the phase goal and existing project conventions.

## Standard Stack

### Core (already installed — reuse)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ~5.0 | State + persistence | Already every store; `persist` middleware is first-party |
| @react-native-async-storage/async-storage | latest (bundled via Supabase client) | Key-value storage for persist | Already installed (used by `supabase.ts` auth storage) |
| @anthropic-ai/sdk | ~0.82 | Claude calls for SKIL-02/03/04 | Already pattern-matched in `suggestions.ts`, `recipeDiscovery.ts` |

### Supporting (new)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-native-community/netinfo | ~11.x | Online/offline detection | Drives `networkStore.isOnline`, gates mutations, triggers write-queue flush |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand persist + AsyncStorage | `react-native-mmkv` + `zustand-mmkv-storage` | MMKV is ~30x faster but adds a native dep + dev client rebuild; AsyncStorage is already in the project and fast enough for recipe JSON (<1MB per store). Stick with AsyncStorage. |
| Zustand persist for offline reads | `@tanstack/react-query-persist-client` | React Query is not currently imported anywhere; adoption would require rewriting all 8 stores. Defer to future refactor. |
| New `recipe_cooks` table | Aggregate over `meal_plan_entries` via view | Existing table already has `status='cooked'` + `cooked_at` + index. A VIEW or RPC `get_recipe_cook_stats(profile_id)` is lighter than a duplicate table. Use a VIEW. |
| Haiku for cooking tips | Sonnet 4 | Tips are short (<100 tokens out), Haiku is 10x cheaper, and accuracy on "explain braise" is more than adequate. Haiku wins. |
| Per-step tip lazy fetch | Pre-generate all tips at import time | Pre-generation wastes tokens on steps the user never views. Lazy + cache hits the sweet spot. |

**Installation:**
```bash
pnpm --filter mobile add @react-native-community/netinfo
cd apps/mobile && npx expo prebuild  # netinfo is autolinked; dev client rebuild required
```

## Architecture Patterns

### Recommended File Layout
```
packages/server/src/
├── routes/
│   └── progression.ts          # /api/v1/progression/* (new)
├── services/
│   ├── progression.ts          # cook stats aggregation + ambition-ranking helpers
│   ├── cookingTips.ts          # Haiku-backed tip generation w/ cache read/write
│   └── recipeVariations.ts     # Sonnet, reuses shoppingList/generateVariations pattern
apps/mobile/src/
├── stores/
│   ├── networkStore.ts         # isOnline flag driven by NetInfo (new)
│   └── progressionStore.ts     # cookedRecipeStats, ambitionSuggestions (new)
├── lib/
│   └── offlineQueue.ts         # write queue for pantry/cook mutations while offline
├── hooks/
│   └── useNetworkBanner.tsx    # "You're offline — changes will sync" UI
└── app/(tabs)/
    └── recipes.tsx             # extend existing screen with "Suggested for you" section
supabase/migrations/
└── 00008_skill_progression.sql # recipe_step_tips table + recipe_cook_stats VIEW
```

### Pattern 1: Zustand `persist` middleware
```typescript
// Source: https://zustand.docs.pmnd.rs/integrations/persisting-store-data
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      // ... existing actions
    }),
    {
      name: 'dinnertime-recipes',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist cacheable read state — NEVER persist in-flight loading flags
      partialize: (state) => ({ recipes: state.recipes, lastFetchedAt: state.lastFetchedAt }),
      version: 1,
    }
  )
);
```

### Pattern 2: NetInfo-driven online flag
```typescript
// Source: https://tanstack.com/query/latest/docs/framework/react/react-native (onlineManager example)
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

interface NetworkState { isOnline: boolean; }

export const useNetworkStore = create<NetworkState>(() => ({ isOnline: true }));

// Wire once at app startup (app/_layout.tsx)
NetInfo.addEventListener((state) => {
  useNetworkStore.setState({
    isOnline: !!state.isConnected && state.isInternetReachable !== false,
  });
});
```

### Pattern 3: Lazy cooking-tip fetch with server-side cache
```typescript
// packages/server/src/services/cookingTips.ts
export async function getOrGenerateTip(
  supabase: SupabaseClient,
  recipeId: string,
  stepIndex: number,
  stepText: string
): Promise<string> {
  const { data: cached } = await supabase
    .from('recipe_step_tips')
    .select('tip')
    .eq('recipe_id', recipeId)
    .eq('step_index', stepIndex)
    .maybeSingle();
  if (cached?.tip) return cached.tip;

  const tip = await callHaikuForTip(stepText);
  await supabase.from('recipe_step_tips').insert({ recipe_id: recipeId, step_index: stepIndex, tip });
  return tip;
}
```

### Pattern 4: Ambition ranking heuristic
```typescript
// Score = f(cook_count, recipe_complexity_proxy)
// Complexity proxy = steps.length + ingredients.length + (total_time_minutes / 15)
// "Ambition window" = recipes with complexity between user_median and user_median * 1.4
// Prompt Claude with: {"history": [{title, complexity, cook_count}], "candidates": [...]}
// Claude returns top 3 with one-sentence rationale.
```

### Anti-Patterns to Avoid
- **Persisting loading/error flags:** Rehydrating an `isLoading=true` flag on cold start creates phantom spinners. Always `partialize`.
- **Blocking render on rehydration:** Zustand persist is async — use `onRehydrateStorage` or check `useStore.persist.hasHydrated()` to show a splash.
- **Treating "isConnected" as online:** On iOS, `isConnected` can be true on captive portals. Always check `isInternetReachable !== false`.
- **Re-aggregating cook stats on every render:** Memoize via a server-side VIEW or RPC, cache client-side in `progressionStore`.
- **Generating tips for every step at import time:** Wastes Haiku tokens on steps never viewed. Lazy-fetch + cache.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Store persistence | Custom `useEffect` + `AsyncStorage.setItem` | Zustand `persist` middleware | Handles rehydration timing, versioning, migration, partialize, throttling |
| Network detection | `fetch('https://...').catch()` polling | `@react-native-community/netinfo` | Native-event driven, zero polling, handles airplane mode / VPN / captive portal |
| JSON storage on device | SQLite schema for recipe cache | AsyncStorage via `createJSONStorage` | AsyncStorage handles the JSON size we need (<5MB); SQLite is overkill and needs migrations |
| Cook-count aggregation | Client-side reduce over meal plan entries | Postgres VIEW `recipe_cook_stats` | One query, always fresh, zero client CPU, RLS works via underlying table |
| Offline write queue | Custom retry loop | Thin wrapper over Zustand persist + NetInfo listener (~50 LOC) | For this phase only two write paths need queueing (markCooked, pantry edits); full CRDTs are overkill |

**Key insight:** The hardest offline problem (conflict resolution on multi-device edits) doesn't exist here — MULT-01 is v2. A single-device write queue that flushes on reconnect is sufficient.

## Common Pitfalls

### Pitfall 1: Stale persisted schema after app update
**What goes wrong:** User updates the app; new `Recipe` type adds a required field; old persisted JSON missing field → TypeError on access.
**Why it happens:** Zustand persist rehydrates whatever was on disk regardless of TS type shape.
**How to avoid:** Set `version: N` on every persist config; bump on schema change; provide `migrate` function that fills defaults or wipes cache.
**Warning signs:** Test by installing app → cook some recipes → force new persisted-state shape → reload. Catch TypeErrors in dev.

### Pitfall 2: NetInfo false positives on iOS simulator
**What goes wrong:** Simulator reports `isConnected=true` when host Mac has no internet; tests pass, real devices fail.
**Why it happens:** Simulator shares host network stack.
**How to avoid:** Validate on physical device in Wave 0 checklist; use `isInternetReachable !== false` (not `=== true`, which is too strict on first check).
**Warning signs:** Offline banner never appears in simulator airplane mode.

### Pitfall 3: Double-counting cooks across plan regenerations
**What goes wrong:** User marks plan entry cooked → regenerates plan → old entry deleted (cascade) → cook count drops.
**Why it happens:** `regenerateDay`/regenerate uses `delete-then-insert` on `meal_plans` (decision from Phase 07-02).
**How to avoid:** SKIL-01 must NOT depend on `meal_plan_entries` alone. Either (a) write a separate `recipe_cooks` log table append-only from `markCooked` service, or (b) add `ON DELETE SET NULL` on regenerate path. **Recommendation: new `recipe_cooks` append-only table** (simple, avoids coupling to meal-plan lifecycle).
**Warning signs:** Cook count decreases after user clicks "regenerate week".

### Pitfall 4: Rehydration race with Supabase auth bootstrap
**What goes wrong:** App opens offline, Zustand rehydrates recipes, but Supabase auth hasn't loaded yet → RLS queries with null user would fail on next online mount.
**Why it happens:** Persist rehydrates synchronously-ish; auth session is async.
**How to avoid:** Gate UI on `authStore.session !== undefined` (already done). Persisted data is safe to show because it's already the user's own data from last session.

### Pitfall 5: Haiku hallucination on obscure techniques
**What goes wrong:** Tip for "ferment for 72h in koji" returns confident but wrong advice.
**Why it happens:** Haiku is smaller; low-frequency culinary terms are riskier.
**How to avoid:** System prompt: "If uncertain about the technique, return empty string instead of guessing." Server treats empty as "no tip available" and UI hides the tip row.
**Warning signs:** Tips contain "traditionally", "some say", "might" — flag for review.

### Pitfall 6: Cost blow-up on tip generation
**What goes wrong:** User opens a 20-step recipe, 20 parallel Haiku calls fire at render time.
**Why it happens:** Eager fetch in `useEffect` per step.
**How to avoid:** Only fetch tip for the currently-active step in cooking mode; one tip at a time; cache in `recipe_step_tips`.

## Code Examples

### TanStack-style onlineManager wiring (adapted for Zustand-only project)
```typescript
// apps/mobile/src/app/_layout.tsx (augment existing)
// Source: https://tanstack.com/query/latest/docs/framework/react/react-native
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStore } from '@/stores/networkStore';

useEffect(() => {
  const unsub = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    useNetworkStore.setState({ isOnline: online });
    if (online) void flushOfflineQueue(); // trigger write replay
  });
  return unsub;
}, []);
```

### Recipe cook stats VIEW (or fallback table)
```sql
-- supabase/migrations/00008_skill_progression.sql
-- Option A (recommended): append-only cook log decoupled from meal plan lifecycle
CREATE TABLE recipe_cooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  cooked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_recipe_cooks_profile_recipe ON recipe_cooks(profile_id, recipe_id);
CREATE INDEX idx_recipe_cooks_profile_time ON recipe_cooks(profile_id, cooked_at DESC);
ALTER TABLE recipe_cooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cooks select" ON recipe_cooks FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "own cooks insert" ON recipe_cooks FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Per-step tip cache
CREATE TABLE recipe_step_tips (
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_index SMALLINT NOT NULL,
  tip TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (recipe_id, step_index)
);
ALTER TABLE recipe_step_tips ENABLE ROW LEVEL SECURITY;
-- Tip cache is per-recipe (which is profile-scoped), policy via subquery
CREATE POLICY "own recipe tips select" ON recipe_step_tips FOR SELECT
  USING (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.profile_id = auth.uid()));
CREATE POLICY "own recipe tips insert" ON recipe_step_tips FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.profile_id = auth.uid()));
```

### Ambition ranker prompt (Claude Sonnet 4)
```typescript
const SYSTEM = `You are a gentle cooking coach. Given a user's cooking history and their recipe library, recommend 3 recipes that are ONE NOTCH more ambitious than what they usually cook. Avoid anything drastically harder. Return a one-sentence "why this next" rationale for each. Never recommend a recipe they've cooked 2+ times already.`;
// tool schema: { recommendations: [{ recipe_id, rationale }] }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux Persist | Zustand `persist` middleware | Zustand 4+ (2023) | Standard in project already |
| AsyncStorage direct calls | `createJSONStorage` wrapper | Zustand 4.1+ | Canonical pattern |
| SQLite for offline cache | AsyncStorage for JSON blobs | Modern mobile apps | Simpler for document-style cache |
| Polling connectivity | `NetInfo.addEventListener` | NetInfo 5+ | Event-driven, battery friendly |

**Deprecated/outdated:**
- `NetInfo.isConnected` (use `isConnected` + `isInternetReachable`)
- Legacy `AsyncStorage` from `react-native` core (use `@react-native-async-storage/async-storage`)
- Pre-generating all recipe data at import (wasteful vs lazy)

## Open Questions

1. **Scope of "offline" in FOUN-07**
   - What we know: Requirements list recipes, pantry, meal plans as offline-readable.
   - What's unclear: Do pantry scan uploads and shopping order creation queue while offline, or simply show "go online"?
   - Recommendation: Queue only `markCooked` and manual pantry edits (small writes). Surface a clear "you need to be online to scan" banner for camera/AI-heavy features.

2. **Skill graduation signal**
   - What we know: SKIL-02 says "gently suggests more ambitious" — no explicit threshold.
   - What's unclear: What constitutes "ambitious"? (Steps? Ingredients? Cook time? Technique diversity?)
   - Recommendation: Use heuristic proxy `complexity = steps + ingredients + (total_time/15)`, ask Claude to validate with reasoning. Tune in-phase.

3. **Who owns cook-count increment?**
   - What we know: `markCooked` already sets `meal_plan_entries.status='cooked'` (phase 07-03).
   - What's unclear: Should SKIL-01 hook that service, or add a parallel endpoint?
   - Recommendation: Extend `markCooked` to also `INSERT INTO recipe_cooks` in the same transaction. One source of truth, minimal duplication.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-wide), same as phases 01–09 |
| Config file | `apps/mobile/vitest.config.ts`, `packages/server/vitest.config.ts` (assumed — follows monorepo pattern) |
| Quick run command | `pnpm --filter mobile test -- --run` / `pnpm --filter server test -- --run` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-01 | `markCooked` inserts into `recipe_cooks` | unit | `pnpm --filter server test -- markCooked` | ❌ Wave 0 |
| SKIL-01 | Cook stats RPC/query aggregates correctly | unit | `pnpm --filter server test -- progression.service` | ❌ Wave 0 |
| SKIL-02 | Ambition ranker prompt assembly returns top-3 with rationales | unit (mocked Anthropic) | `pnpm --filter server test -- progression.service` | ❌ Wave 0 |
| SKIL-03 | `getOrGenerateTip` cache hit returns stored tip without Haiku call | unit | `pnpm --filter server test -- cookingTips` | ❌ Wave 0 |
| SKIL-03 | `getOrGenerateTip` cache miss calls Haiku + writes row | unit | `pnpm --filter server test -- cookingTips` | ❌ Wave 0 |
| SKIL-04 | `/progression/variations/:recipeId` only returns for `cook_count >= 3` | unit | `pnpm --filter server test -- progression.route` | ❌ Wave 0 |
| FOUN-07 | `recipeStore` rehydrates persisted state on cold start | unit | `pnpm --filter mobile test -- recipeStore.persist` | ❌ Wave 0 |
| FOUN-07 | `networkStore` flips on NetInfo event | unit | `pnpm --filter mobile test -- networkStore` | ❌ Wave 0 |
| FOUN-07 | Offline queue flushes pending markCooked on reconnect | unit | `pnpm --filter mobile test -- offlineQueue` | ❌ Wave 0 |
| FOUN-07 | Persisted recipe cache renders offline without network calls | integration (mocked NetInfo) | `pnpm --filter mobile test -- recipes.offline` | ❌ Wave 0 |
| SKIL-03 | Cooking tip renders on active step in cook screen | integration (RN renderer) | `pnpm --filter mobile test -- cook.tips` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** quick run on the touched package
- **Per wave merge:** `pnpm test` full suite
- **Phase gate:** Full suite green + manual device test of airplane-mode recipe browsing before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/services/__tests__/progression.test.ts` — cook stats + ambition ranker
- [ ] `packages/server/src/services/__tests__/cookingTips.test.ts` — cache hit/miss + Haiku mock
- [ ] `packages/server/src/routes/__tests__/progression.test.ts` — route authorization + thresholds
- [ ] `apps/mobile/src/stores/__tests__/networkStore.test.ts` — NetInfo mock + state transitions
- [ ] `apps/mobile/src/stores/__tests__/recipeStore.persist.test.ts` — AsyncStorage mock + rehydrate
- [ ] `apps/mobile/src/lib/__tests__/offlineQueue.test.ts` — enqueue/flush lifecycle
- [ ] `apps/mobile/__tests__/cook.tips.test.tsx` — integration w/ existing cook.tsx
- [ ] NetInfo mock in `apps/mobile/vitest.setup.ts` alongside existing expo-speech mocks
- [ ] AsyncStorage mock in mobile setup (likely already present via supabase client test — verify)
- [ ] `supabase/migrations/00008_skill_progression.sql` — `recipe_cooks` + `recipe_step_tips` tables w/ RLS

## Sources

### Primary (HIGH confidence)
- `/Users/patrickrichards/DinnerTime/CLAUDE.md` — stack, Claude models, conventions
- `/Users/patrickrichards/DinnerTime/.planning/REQUIREMENTS.md` — SKIL-01..04, FOUN-07 definitions
- `/Users/patrickrichards/DinnerTime/.planning/STATE.md` — phase 07 decisions (`status='cooked'`, regenerate delete-then-insert), phase 08-06 variations pattern, phase 09 cook screen
- `/Users/patrickrichards/DinnerTime/supabase/migrations/00006_meal_plans.sql` — existing cooked-status schema
- [Zustand persist middleware docs](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- [TanStack Query React Native guide](https://tanstack.com/query/latest/docs/framework/react/react-native) — onlineManager + NetInfo pattern

### Secondary (MEDIUM confidence)
- [React Native Offline First with TanStack Query (dev.to)](https://dev.to/fedorish/react-native-offline-first-with-tanstack-query-1pe5)
- [Building Offline-First Apps with RN + AsyncStorage (dev.to)](https://dev.to/msaadullah/building-offline-first-apps-using-react-native-react-query-and-asyncstorage-1h4i)
- [@react-native-community/netinfo README](https://github.com/react-native-netinfo/react-native-netinfo)

### Tertiary (LOW confidence)
- Culinary technique reference articles — used only to inform Haiku prompt framing (not code)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Zustand persist, NetInfo, AsyncStorage are all well-established
- Architecture: HIGH — mirrors existing phase patterns (services/routes/stores); only one new table migration
- Pitfalls: HIGH for stack-level (persist versioning, NetInfo flags); MEDIUM for project-specific (cook-count double-count identified from STATE.md regenerate decision)
- Validation: HIGH — Vitest patterns already established across 9 prior phases

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days; stack is stable, no imminent major releases)
