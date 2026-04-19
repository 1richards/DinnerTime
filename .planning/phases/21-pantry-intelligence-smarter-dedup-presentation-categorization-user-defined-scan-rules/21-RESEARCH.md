# Phase 21: Pantry Intelligence - Research

**Researched:** 2026-04-19
**Domain:** Settings-layer user-defined rules + staples + pantry-tab presentation + silent learning, layered on Phase 24a canonical substrate
**Confidence:** HIGH (all substrate shipped; all scope locked in 21-CONTEXT)

## Summary

Phase 21 layers user intelligence on top of the Phase 24a canonical-ingredient substrate. All heavy lifting (canonical/alias schema, identity dedup, quantity JSONB, scan_events, canonicalResolver, reconcileItems) shipped in 24-01..24-06. Phase 21 ships **three new tables, three new services, one new RPC, two new Settings route files, one Pantry-tab refactor, and a silent learning pipeline** that reads Phase 18's `item_override_events`.

Fuzzy dedup (original ROADMAP criterion #1) is **dropped** — 24a identity dedup supersedes it. No algorithmic dedup work remains.

**Primary recommendation:** Keep the rule evaluator trivial and loud (first-match-wins, in-memory, small N). Keep the suggestion aggregator fire-and-forget on scan-confirm. Keep the promotion RPC stateless and idempotent. Do NOT over-index on performance — this is a private-beta phase with single-digit rule counts per user.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rules UI (ROADMAP #4, #6):**
- Two rule types: `name_mapping` (writes `ingredient_aliases` rows with `source='user_rule'`) + `location_mapping` (new `user_location_rules` table). Category overrides are learning-pipeline only, not a manually-created rule type.
- Creation entry: Settings-only. Settings → "Pantry Rules" list view, Add/edit/delete/drag-to-reorder. No inline "Save as rule" on review screen. No auto-prompts.
- Precedence: explicit user-defined order via drag-to-reorder. First matching rule wins. `precedence int8` column.
- 30-day preview panel: queries `scan_events.final_items` last 30 days, shows N affected items + tappable list.
- Rule evaluation point: **AFTER** canonical resolution, **BEFORE** pantry commit, inside `reconcileItems`.

**Staples + auto-accept (ROADMAP #5):**
- Keyed by `(user_id, canonical_ingredient_id)`.
- Aggressive auto-accept threshold: **0.3** (vs default 0.7 from Phase 14).
- Mark/unmark: Pantry ItemRow ellipsis menu (Phase 15 HeaderEllipsis + ActionSheetIOS pattern).
- Management UI: Settings → "Staples" section (full list) AND Pantry tab filter chip "Staples" (read-only quick view).

**Pantry-tab presentation (ROADMAP #2):**
- 4-way grouping toggle at top: Location / Category / Staples / Recently added. Phase 19 filter-chip pattern. Default persisted in Zustand.
- Phase 19 `StickySearchPill` always visible; tap → `/search?context=pantry` modal.
- Stale treatment: dashed border + opacity ~0.5 when confidence < 0.5. Inline within natural group; no dedicated "might be gone" section.
- Row density: compact ~48pt. Phase 19 ItemRow primitive. `size="compact"` variant OR className override (Claude's Discretion).

**Learning pipeline (ROADMAP #3):**
- Aggregate mode. No toasts, no auto-prompts, no silent rule writes. Background aggregator writes to `suggested_rules` table. User browses Settings → Pantry Rules → Suggestions and accepts/dismisses.
- Repeat threshold: 2 occurrences within 30 days.
- Category overrides: **silent on first correction**. Writes immediately to Phase 24a `canonical_category_override`. Next scan reflects the override.
- Candidate canonical auto-promotion: global **M=5** scan_event occurrences. RPC invoked on scan commit.

**Schema additions (on top of 24a substrate):**
- `user_staples(user_id, canonical_ingredient_id, created_at, PK(user_id, canonical_ingredient_id))` — RLS `user_id = auth.uid()`
- `user_location_rules(id, user_id, canonical_ingredient_id, source_location, precedence int8, created_at)` — RLS
- `suggested_rules(id, user_id, rule_type, payload jsonb, occurrence_count, first_seen, last_seen, dismissed_at null)` — RLS. Enum: `'name_mapping' | 'location_mapping'`
- `ingredient_aliases` gains rows with `source='user_rule'` when user accepts a name-mapping suggestion.

### Claude's Discretion

- Suggested-rules UI placement (inline vs separate section vs modal sheet)
- Aggregator timing: on-scan vs nightly vs app-foreground — pick lightest
- Preview panel query strategy: naive first, optimize if slow
- Exact Settings copy and placeholder text
- "Recently added" window: default 7 days
- ItemRow compact variant: new `size` prop vs className override
- Preview scan_events aggregation caching

### Deferred Ideas (OUT OF SCOPE)

- Admin UI for canonical promotion (Phase 21 ships RPC only)
- Household-shared staples/rules
- Global rules marketplace
- Rule chains / conditional rules
- Rule-testing playground (30-day preview is the extent)
- Auto-dismissing suggestions after N days
- Push notifications / email alerts
- Instacart-order-history special-case learning
- Smart reordering by usage frequency
- Undo history for rule applications
- Toast/banner learning signals

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROADMAP #2 | Improved pantry-tab presentation | Q6-Q11: 4-way grouping, StickySearchPill wire-up, stale treatment, compact ItemRow |
| ROADMAP #3 | Learning pipeline | Q3: suggestionAggregator; Q4: canonicalPromoter RPC |
| ROADMAP #4 | User-defined scan rules | Q1: schema; Q2: ruleEvaluator; Q5: Settings pages; Q12: preview; Q13: precedence |
| ROADMAP #5 | Staples list + auto-accept | Q1: user_staples; Q10: threshold; Q11: filter chip |
| ROADMAP #6 | Rules manageable (edit/delete/reorder/preview) | Q5, Q12, Q13 |
| ROADMAP #1 | ~~Smarter dedup~~ | **DROPPED** — Phase 24a identity dedup supersedes |

## Project Constraints (from CLAUDE.md)

- **Platform:** iOS-first Expo/React Native (SDK 55 + RN 0.83 + TS 5.6).
- **State:** Zustand for client, TanStack Query optional for server state. New actions live on `pantryStore.ts`.
- **Styling:** NativeWind 4.x tokens from Phase 19 (`bg-brand`, `text-text-primary`, `bg-surface-subtle`, `border-dashed`, opacity modifiers).
- **Database:** Supabase Postgres; migrations under `supabase/migrations/NNNNN_name.sql`. Next numbers available: **00016, 00017, 00018**.
- **AI provider:** Claude via Phase 11 AIClient — Phase 21 does **NOT** call AI; rule evaluator is deterministic.
- **Dev workflow:** GSD commands only. No direct edits outside `/gsd:execute-phase`.
- **UAT:** Maestro flow on iPhone 17 Pro simulator for every UI change. New flow file naming avoids slots 21/22/23 (taken).
- **Env:** server loads `.env` from root; iOS camera quality pinned 0.4.

## Standard Stack

Phase 21 uses **only already-installed libraries**. No new deps.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.101+ | DB client, RLS-aware | Phase 1 infra |
| Zustand | 5.0 | Client state (rules/staples/suggestions lists) | Phase 1 infra |
| expo-router | bundled w/ SDK 55 | New `/settings/pantry-rules.tsx` + `/settings/staples.tsx` file-based routes | Phase 15 pattern |
| react-native-draggable-flatlist or react-native-reanimated (existing) | — | Drag-to-reorder in rules list | **Recommend** `react-native-reanimated` + `react-native-gesture-handler` (both bundled) to hand-roll simple reorder. `react-native-draggable-flatlist` (~100KB) is the standard third-party choice if reorder UX needs polish. |
| Hono | 4.x | Route additions | Phase 1 infra |
| Vitest | — | Unit/integration tests | Phase 1 infra |

### Drag-to-reorder recommendation
**Use `react-native-draggable-flatlist`** (v4.x, ~30k weekly downloads, compatible with Reanimated 3 / RN 0.83). Small surface area, exactly matches our need. Alternative: hand-roll with `PanResponder` + `LayoutAnimation` (~80 lines) but reorder animations are fiddly; prefer the library.
Install: `pnpm -F mobile add react-native-draggable-flatlist`

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| draggable-flatlist | Hand-roll with Reanimated | Saves 30KB but ~80 lines + tricky gesture math |
| Postgres trigger for aggregator | Service-layer logic | Decided service-layer per Phase 18 pattern (easier to unit-test) |
| RPC for promotion | Server service + raw SQL | RPC is idempotent + invocable from scan route with single round-trip |

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
├── 00016_user_staples.sql
├── 00017_user_location_rules.sql
└── 00018_suggested_rules.sql  (+ canonical_promotion RPC DDL)

packages/server/src/
├── services/
│   ├── ruleEvaluator.ts          (new — applies user rules to ScanResult[])
│   ├── suggestionAggregator.ts   (new — reads item_override_events, writes suggested_rules)
│   ├── canonicalPromoter.ts      (new — invokes RPC on scan commit)
│   └── pantry.ts                  (MODIFY — insert rule evaluator call into reconcileItems)
├── routes/
│   └── pantry.ts                  (MODIFY — add /rules, /staples, /suggestions endpoints)
└── __tests__/
    ├── ruleEvaluator.test.ts
    ├── suggestionAggregator.test.ts
    └── canonicalPromoter.test.ts

apps/mobile/src/
├── app/settings/
│   ├── pantry-rules.tsx           (new — list view + editor + preview)
│   └── staples.tsx                (new — list + add/remove)
├── app/(tabs)/
│   ├── pantry.tsx                 (MODIFY — 4-way grouping, StickySearchPill, stale)
│   └── settings.tsx               (MODIFY — two new section rows linking to above)
├── components/pantry/
│   └── PantryItemCard.tsx         (MODIFY — ellipsis "Mark as staple"; dashed border; ~48pt)
├── components/ui/
│   └── ItemRow.tsx                (MODIFY — add `size="compact"` variant)
└── stores/
    └── pantryStore.ts             (MODIFY — add rules/staples/suggestions actions)
```

### Pattern 1: Rule evaluator slot (Q2)

**Insertion point:** `packages/server/src/services/pantry.ts` line 150 — inside the `for (const raw of items)` loop, **AFTER** canonical resolution (line 154 `resolveMap.get`), **BEFORE** `source_location = resolveSourceLocation` (line 158).

The evaluator receives the canonical-resolved item + user's rules in precedence order and returns a mutated `ScanResult` (new name, new canonicalId, new source_location). Runs once per scanned item; ~O(N × R) where N = scan items (~10-20), R = user rule count (~0-20). No perf concern.

```typescript
// services/ruleEvaluator.ts (~20 lines)
import type { ScanResult } from './vision.js';
import type { CanonicalMatch } from './canonicalResolver.js';

export interface UserRules {
  locationRules: Array<{
    canonical_ingredient_id: string;
    source_location: 'fridge' | 'pantry' | 'freezer';
    precedence: number;
  }>;
  // Name-mapping rules already live in ingredient_aliases (source='user_rule')
  // and are applied by canonicalResolver — no separate table read here.
}

export function applyLocationRules(
  match: CanonicalMatch,
  scanItem: ScanResult,
  rules: UserRules,
): ScanResult {
  const hit = rules.locationRules.find(
    (r) => r.canonical_ingredient_id === match.canonicalId,
  );
  if (!hit) return scanItem;
  return { ...scanItem, source_location: hit.source_location };
}
```

### Pattern 2: Suggestion aggregator (Q3)

**Trigger recommendation: on scan-confirm (fire-and-forget).** 5-line rationale:
1. Scan-confirm is already the natural write moment for `item_override_events`
2. Same RLS + supabase client already in scope
3. No cron infrastructure on Fly.io/Railway
4. Idempotent upsert makes repeat-invocation safe
5. Async `void` (not awaited) so scan commits are never blocked by aggregation

```typescript
// services/suggestionAggregator.ts (~25 lines)
import type { SupabaseClient } from '@supabase/supabase-js';

const THRESHOLD = 2;
const WINDOW_DAYS = 30;

export async function aggregateLocationSuggestions(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
  const { data } = await supabase
    .from('item_override_events')
    .select('item_name, user_location, created_at')
    .eq('user_id', userId)
    .gte('created_at', since);

  // Group by (item_name, user_location) and keep groups with count >= THRESHOLD
  const groups = new Map<string, { count: number; firstSeen: string; lastSeen: string }>();
  for (const ev of (data ?? []) as Array<{ item_name: string; user_location: string; created_at: string }>) {
    const key = `${ev.item_name}::${ev.user_location}`;
    const g = groups.get(key) ?? { count: 0, firstSeen: ev.created_at, lastSeen: ev.created_at };
    g.count++;
    if (ev.created_at < g.firstSeen) g.firstSeen = ev.created_at;
    if (ev.created_at > g.lastSeen) g.lastSeen = ev.created_at;
    groups.set(key, g);
  }
  for (const [key, g] of groups) {
    if (g.count < THRESHOLD) continue;
    const [item_name, user_location] = key.split('::');
    await supabase.from('suggested_rules').upsert(
      {
        user_id: userId,
        rule_type: 'location_mapping',
        payload: { item_name, user_location },
        occurrence_count: g.count,
        first_seen: g.firstSeen,
        last_seen: g.lastSeen,
        dismissed_at: null,
      },
      { onConflict: 'user_id,rule_type,payload' }, // composite unique index required
    );
  }
}
```

### Pattern 3: Canonical promoter RPC (Q4)

**Trigger:** on scan commit (fire-and-forget), BEFORE aggregator. Invoked **once per scan** (not per item) over the set of `canonicalId`s whose `match.matchType === 'candidate_created'` OR whose canonical has `status='candidate'`.

```sql
-- Embedded in migration 00018 (or a new 00019_promote_candidate_canonicals.sql)
CREATE OR REPLACE FUNCTION promote_candidate_canonicals(threshold INT DEFAULT 5)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  promoted INT := 0;
BEGIN
  WITH counts AS (
    SELECT ci.id, COUNT(se.id) AS n
    FROM canonical_ingredients ci
    JOIN scan_events se ON se.final_items @? FORMAT('$[*] ? (@.name == "%s")', ci.canonical_name)::jsonpath
    WHERE ci.status = 'candidate'
    GROUP BY ci.id
  )
  UPDATE canonical_ingredients ci
  SET status = 'active', updated_at = NOW()
  FROM counts
  WHERE ci.id = counts.id
    AND counts.n >= threshold;
  GET DIAGNOSTICS promoted = ROW_COUNT;
  RETURN promoted;
END $$;
```

**Invocation point:** `pantry.ts` scan route, after `reconcileItems` success — `await supabase.rpc('promote_candidate_canonicals').catch(() => {})`. Fire-and-forget. Cheap: one query over an indexed `status` column + JSONB containment check against `scan_events`.

**Simpler alternative (recommend):** Track a per-canonical scan counter via a small `canonical_scan_counts(canonical_ingredient_id, count)` table incremented inline during reconcile (single UPSERT). RPC then becomes a trivial `UPDATE ... WHERE status='candidate' AND count >= 5`. Avoids JSONB containment hack. **Use this unless planner objects.**

### Anti-Patterns to Avoid

- **Loading all scan_events into memory for the preview panel.** Use `?interval=30d` server query, paginate results (LIMIT 50), stream if needed.
- **Applying user rules inside `canonicalResolver.ts`.** Keep canonical resolution generic/global; user-scoped rules are a separate stage in `reconcileItems`.
- **Silent writes for anything OTHER than category override.** Name/location rules must go through Settings → Suggestions. Do not auto-apply.
- **Cron jobs.** We have no cron infra in private beta. On-scan + app-foreground are sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-to-reorder list | PanResponder + LayoutAnimation | `react-native-draggable-flatlist` | Library handles the tricky shift+settle math; ~30KB |
| Fuzzy name dedup | Your own Levenshtein | **NOTHING** — 24a canonicalResolver ships this | Phase 24a descoped this; identity dedup wins |
| ActionSheet for "Mark as staple" | Custom modal | Phase 15 `HeaderEllipsis` + `ActionSheetIOS` pattern | Already-shipped, iOS-native |
| Settings section dividers | Hand-draw | `View className="border-b border-warmGray-100 my-4"` | Existing settings.tsx convention |
| Debouncing preview query | setTimeout | `useDeferredValue` (already used in preferencesStore search) | React 19 primitive |

## Runtime State Inventory

> Phase 21 is primarily additive (3 new tables + code). Migration risks are low. No renames.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `item_override_events` rows (Phase 18) are consumed read-only by aggregator. `scan_events.final_items` JSONB (Phase 24a) is consumed read-only by preview panel. `canonical_ingredients.status` column is mutated by promoter RPC. | No data migration needed. Code edits only. |
| Live service config | None — no external services touched. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None added. | None |
| Build artifacts | New migration files must be applied via `supabase db push` (or the project's migration runner). Zustand `persist` middleware may need a version bump on `pantryStore` if the shape changes — **verify during planning**. | Run migrations; test offline queue replay. |

## Environment Availability

> Skipping — Phase 21 adds no external dependencies. All tooling (Supabase, Hono, Vitest, Expo/Maestro, Reanimated) verified in prior phases and currently installed. One optional library install (`react-native-draggable-flatlist`) is pnpm-standard and will be verified during planning.

## Common Pitfalls

### Pitfall 1: RLS on `suggested_rules` with aggregate queries
**What goes wrong:** Aggregator writes `suggested_rules` rows under the user's JWT but reads `item_override_events` across the user's rows. If the aggregator is invoked via scan route (authenticated), RLS is respected. If scheduled via service-role, RLS is bypassed and a bad `user_id` filter corrupts state.
**How to avoid:** Invoke aggregator on scan commit under the request's `authedSupabaseClient` (not service role). Assert `user_id = auth.uid()` check in policy.
**Warning signs:** Cross-user row leakage in integration tests.

### Pitfall 2: Rule evaluator ordering vs. canonicalResolver
**What goes wrong:** Name-mapping rules (written to `ingredient_aliases` with `source='user_rule'`) are applied by `canonicalResolver` automatically — they're just high-priority aliases. Location rules however must fire in `reconcileItems` AFTER resolution. Conflating the two leads to applying location rules before knowing the canonicalId.
**How to avoid:** Name-mapping = `ingredient_aliases` row with `source='user_rule'`, confidence=1.0 → picked up by existing resolver Stage 2 (alias exact match). Location-mapping = separate evaluator called in `reconcileItems` line ~155 after `resolveMap.get`.

### Pitfall 3: Candidate-promotion race conditions
**What goes wrong:** Two concurrent scans by different users could each promote the same candidate → row-level UPDATE with `WHERE status='candidate'` is fine (idempotent) but counting logic double-runs.
**How to avoid:** `UPDATE ... WHERE status='candidate' AND ...` is inherently safe. Use `SET status='active'` — second run is a no-op. RPC returns `0` on no-op.

### Pitfall 4: Staples auto-accept interaction with canonical candidate
**What goes wrong:** User marks a candidate-status canonical as staple. Aggressive 0.3 threshold auto-accepts → pantry gains low-quality data.
**How to avoid:** Only allow marking `status='active'` canonicals as staples. Filter out candidates in the "Mark as staple" picker. Server-side validation on POST /staples: `if (canonical.status !== 'active') return 400`.
**Warning signs:** User staples list shows misspelled/odd names.

### Pitfall 5: Override-event aggregation cost
**What goes wrong:** On every scan commit, we read all 30-day override events for the user. User with heavy historical usage (~1000 events) causes slow scans.
**How to avoid:** Index `(user_id, created_at DESC)` already exists on `item_override_events` (migration 00010, `idx_override_events_created`). Wrap aggregator in `try/catch` + fire-and-forget `void` (do NOT await). Monitor during beta; add 10-minute debounce if needed.

### Pitfall 6: scan_events JSONB query performance for preview
**What goes wrong:** Preview panel queries `scan_events.final_items @> '[{"name":"..."}]'::jsonb` without an index. Full table scan on ~1000 events.
**How to avoid:** Use `WHERE user_id = auth.uid() AND created_at > NOW() - INTERVAL '30 days'` first (hits `idx_scan_events_user_time`). Filter JSONB client-side after ≤50 rows. OR add GIN index on `final_items` if preview slows down; skip until measured.

### Pitfall 7: Pantry-tab chip density
**What goes wrong:** 4-way grouping chips + 4 location chips + Staples chip = 9 chips, wrap-heavy on narrow iPhone widths.
**How to avoid:** Render grouping as **segmented control** (single-row, fixed-width) rather than filter chips. Location + Staples remain filter chips on a second row.
**Warning signs:** Maestro smoke assertion on "Location" chip fails because it wrapped to line 3.

### Pitfall 8: Zustand persist migration
**What goes wrong:** pantryStore adds `rules`, `staples`, `suggestions`, `groupingMode` to persisted state. Existing users with v0 cached state hit a type-error on hydration.
**How to avoid:** Bump `persist({ version: N+1 })` and provide `migrate` hook that merges defaults.

## Code Examples

### Preview panel query (Q12)
```typescript
// Fetch 30 days of scan_events, filter client-side by rule's target canonical
async function previewRuleImpact(
  supabase: SupabaseClient,
  userId: string,
  canonicalId: string,
): Promise<{ count: number; items: Array<{ name: string; at: string }> }> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await supabase
    .from('scan_events')
    .select('id, final_items, created_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100); // 100 × ~15 items = 1500 checks, cheap client-side

  const hits: Array<{ name: string; at: string }> = [];
  for (const ev of (data ?? [])) {
    for (const item of (ev.final_items ?? []) as any[]) {
      // Match after canonical resolution would happen here. Preview
      // approximates via name-match against the rule's target.
      if (item.canonical_ingredient_id === canonicalId) {
        hits.push({ name: item.name, at: ev.created_at });
      }
    }
  }
  return { count: hits.length, items: hits.slice(0, 50) };
}
```

### Rule evaluator call in reconcileItems (Q2)
```typescript
// packages/server/src/services/pantry.ts — modify loop ~line 150
// BEFORE (line 158): const source_location = resolveSourceLocation(raw.source_location);
// AFTER: evaluate user location rules AFTER canonical resolve, BEFORE commit

const rulesCache = await loadUserLocationRules(supabase, profileId); // once per reconcile

for (const raw of items) {
  // ... existing match resolution ...
  const canonicalId = match.canonicalId;

  // NEW — user location rule fires here.
  const ruled = applyLocationRules(match, raw, { locationRules: rulesCache });
  const source_location = resolveSourceLocation(ruled.source_location);
  // ... rest of loop uses `ruled` and `source_location` ...
}
```

### Settings → Pantry Rules route template (Q5)
**Template to follow:** `apps/mobile/src/app/(tabs)/settings.tsx` (flat ScrollView + section headers) OR, for nested routes, pattern from `apps/mobile/src/app/shopping/orders.tsx`. Phase 21 adds a new `settings/` **directory** sibling to `(tabs)/settings.tsx`. Route: `dinnertime://settings/pantry-rules`.

Recommended skeleton:
```tsx
// apps/mobile/src/app/settings/pantry-rules.tsx (~120 lines)
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Chip } from '../../components/ui/Chip';
import { usePantryStore } from '../../stores/pantryStore';

export default function PantryRulesScreen() {
  const { rules, suggestions, reorderRules, acceptSuggestion, dismissSuggestion } = usePantryStore();
  // Two sections: Active Rules (draggable) + Suggestions (accept/dismiss row)
}
```

### ItemRow compact variant (Q9)

**Recommendation:** **new `size` prop on ItemRow** (5-line add, not className override). Reason: className override requires consumers to know the internal NativeWind structure; a `size` prop keeps the contract clean and enables Phase 19 parity in tokens.test.

```typescript
// Add to ItemRowProps:
size?: 'default' | 'compact'; // default = 64pt (today); compact = 48pt

// In CONTAINER_CLASSES derivation (itemRowHelpers.ts):
const CONTAINER_CLASSES_COMPACT = 'flex-row items-center px-4 py-2 bg-surface'; // 48pt
// default stays 'flex-row items-center px-4 py-3 bg-surface' (64pt)
```

### Stale treatment on PantryItemCard (Q8)

**Where it applies:** `PantryItemCard.tsx` currently sets `opacity-60` when `item.isUncertain`. Extend:

```typescript
// PantryItemCard wrapper className:
<View className={`mb-2 mx-4 ${
  isStale ? 'opacity-50 border border-dashed border-warmGray-300 rounded-xl' : ''
}`}>
```
Where `isStale = item.effectiveConfidence < 0.5` (exclusive of `isUncertain`, which is the 7-day-grace signal from Phase 3). **Decision:** apply at `PantryItemCard` wrapper, NOT inside `ItemRow` — ItemRow must remain stale-agnostic for reuse on Shopping tab.

### 4-way grouping implementation (Q6)
```tsx
type GroupingMode = 'location' | 'category' | 'staples' | 'recently-added';
const GROUPING_TABS: { value: GroupingMode; label: string }[] = [
  { value: 'location', label: 'Location' },
  { value: 'category', label: 'Category' },
  { value: 'staples', label: 'Staples' },
  { value: 'recently-added', label: 'Recent' },
];

// Persisted via Zustand persist. Phase 19 Chip kind="filter":
<View className="flex-row px-4 mb-2 gap-2">
  {GROUPING_TABS.map((t) => (
    <Chip key={t.value} label={t.label} kind="filter"
      selected={groupingMode === t.value}
      onPress={() => setGroupingMode(t.value)} />
  ))}
</View>
```

Grouping transform happens in `usePantryItems` hook or a new `groupPantryItems(items, mode)` helper.

### StickySearchPill wire-up (Q7)

Current `pantry.tsx` line 100-110 uses a collapsing header but NO StickySearchPill. Add above `PantryItemList`:
```tsx
<StickySearchPill
  placeholder="Search pantry"
  context="pantry"
  scrollY={scrollY}  // expose from useCollapsingHeader
/>
```
`useCollapsingHeader` already returns `onScroll`; extend to expose the underlying `Animated.Value`. `SearchContext` type already includes `'pantry'` (line 22 of SearchBar.tsx). Confirm `/search?context=pantry` route handles the query in `app/search.tsx` (existing modal).

### Staples filter chip (Q11)

Current location filter row (pantry.tsx line 21-26):
```tsx
const FILTER_TABS: { value: LocationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'freezer', label: 'Freezer' },
];
```
Extend to `LocationFilter = 'all' | SourceLocation | 'staples'`. When `'staples'`, filter items where `item.canonical_ingredient_id ∈ user_staples`.

### Auto-accept threshold for staples (Q10)

Current: `apps/mobile/src/stores/pantryStore.ts:125` — `confidenceThreshold = 0.7`.
Phase 21 change:
```typescript
const STAPLE_THRESHOLD = 0.3;
const DEFAULT_THRESHOLD = 0.7;

// In startBatchScan loop, per item:
const isStaple = userStaples.has(item.canonical_ingredient_id);
const threshold = isStaple ? STAPLE_THRESHOLD : DEFAULT_THRESHOLD;
const accepted = !probableDupe && confidence >= threshold;
```

Requires `user_staples` data available client-side via `pantryStore.staples: Set<canonicalId>`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fuzzy name dedup planned in 21 | Canonical-identity dedup via 24a | Phase 24a (2026-04-19) | Phase 21 criterion #1 dropped entirely |
| Forced location picker | AI-inferred source_location | Phase 18 | Phase 21 location rules override AI inference when user sets them |
| Flat `pantry_items.quantity NUMERIC` | Quantity JSONB `{value, unit, system}` | Phase 24-02/04/05 | Reconcile uses `units.add`; incompatible units emit 2nd row |
| AI category per scan | canonical.category > override > 'other' | Phase 24-05 | Rule evaluator does not touch category — learning pipeline handles via `canonical_category_override` |

## Open Questions

1. **Preview panel: apply rule against canonical_ingredient_id OR raw name?**
   - What we know: `scan_events.final_items` contains `{name, canonical_ingredient_id?}` — canonical_ingredient_id is set at /confirm, NOT at scan time per 24-05 note (scan_events writes are pre-canonical). So historic events may lack canonicalId.
   - What's unclear: Whether preview should re-resolve each item's canonical_ingredient_id or approximate via normalized-name match.
   - Recommendation: **Normalized-name match** (no re-resolve). Simpler and faithful to what the user sees. Document as "approximate" in UI copy.

2. **draggable-flatlist version compatibility with RN 0.83 New Architecture?**
   - What we know: v4.x supports Reanimated 3; RN 0.83 requires New Architecture.
   - Recommendation: Verify compatibility during Wave 1 task (pnpm add + pod install + Maestro smoke). Fall back to hand-rolled reorder if blocker.

3. **Which Settings entry pattern — nested stack vs modal?**
   - What we know: Phase 15-02 decided Settings sub-screens are **card-presentation push** (not modal). `shopping/orders.tsx` follows this.
   - Recommendation: Push cards. Matches Phase 15 conventions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) for server + mobile units; Maestro 2.4.0 for iOS smoke |
| Config file | `packages/server/vitest.config.ts`, `apps/mobile/vitest.config.ts`, `apps/mobile/.maestro/*.yaml` |
| Quick run command | `pnpm test --run` at package root |
| Full suite command | `pnpm test --run` at repo root (both workspaces) + `npx tsc --noEmit -p .` per workspace |
| iOS UAT | `apps/mobile/.maestro/scripts/uat.sh all` (per CLAUDE.md) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROADMAP #4 — name-mapping rule applies | Creating name-mapping rule writes ingredient_aliases(source='user_rule'); next scan of that alias resolves to target canonical via existing canonicalResolver | unit + integration | `pnpm -F server test --run src/services/__tests__/ruleEvaluator.test.ts` + `pnpm -F server test --run src/routes/__tests__/pantry.rules.test.ts` | ❌ Wave 0 |
| ROADMAP #4 — location-mapping rule applies | Creating rule; next reconcileItems call honors user_location_rules over resolveSourceLocation default | unit | `pnpm -F server test --run src/services/__tests__/ruleEvaluator.test.ts` | ❌ Wave 0 |
| ROADMAP #4 — precedence order | First-match-wins across 3 conflicting rules | unit | `pnpm -F server test --run src/services/__tests__/ruleEvaluator.test.ts` | ❌ Wave 0 |
| ROADMAP #4 — 30-day preview query | previewRuleImpact returns ≤50 items from last 30 days; paginates | unit + integration | `pnpm -F server test --run src/routes/__tests__/pantry.preview.test.ts` | ❌ Wave 0 |
| ROADMAP #5 — staple auto-accept | Item with canonicalId in user_staples auto-accepts at 0.3 confidence | unit (mobile) | `pnpm -F mobile test --run src/stores/__tests__/pantryStore.staples.test.ts` | ❌ Wave 0 |
| ROADMAP #5 — mark as staple via ellipsis | POST /staples inserts row; PantryItemCard renders | integration + Maestro | `pnpm -F server test --run src/routes/__tests__/pantry.staples.test.ts` + `maestro test apps/mobile/.maestro/24-pantry-staples.yaml` | ❌ Wave 0 |
| ROADMAP #6 — reorder rules | Drag-to-reorder persists precedence order | unit (mobile helpers) | `pnpm -F mobile test --run src/app/settings/__tests__/pantryRulesHelpers.test.ts` | ❌ Wave 0 |
| ROADMAP #2 — 4-way grouping | Grouping transform returns correct sections for each mode | unit | `pnpm -F mobile test --run src/hooks/__tests__/usePantryItemsGrouped.test.ts` | ❌ Wave 0 |
| ROADMAP #2 — StickySearchPill on pantry | Tap navigates to /search?context=pantry | Maestro | `maestro test apps/mobile/.maestro/25-pantry-search-pill.yaml` | ❌ Wave 0 |
| ROADMAP #2 — stale treatment | PantryItemCard applies dashed border when confidence < 0.5 | unit | `pnpm -F mobile test --run src/components/pantry/__tests__/PantryItemCard.stale.test.ts` | ❌ Wave 0 |
| ROADMAP #2 — compact ItemRow | size='compact' renders 48pt container class | unit | `pnpm -F mobile test --run src/components/ui/__tests__/ItemRow.compact.test.ts` | ❌ Wave 0 |
| ROADMAP #3 — suggestion aggregator | Group 2+ same-override events in 30 days → write suggested_rules row | unit + integration | `pnpm -F server test --run src/services/__tests__/suggestionAggregator.test.ts` | ❌ Wave 0 |
| ROADMAP #3 — silent category override | Review-screen category change → canonical_category_override row; no toast | integration | `pnpm -F server test --run src/routes/__tests__/pantry.confirm.override.test.ts` | ❌ Wave 0 |
| ROADMAP #3 — candidate promotion RPC | 5th scan of candidate → status flips to 'active' | integration | `pnpm -F server test --run src/services/__tests__/canonicalPromoter.test.ts` | ❌ Wave 0 |
| Migration shape | 3 migrations apply cleanly; RLS policies correct | migration | `pnpm -F server test --run src/services/__tests__/migrations.test.ts` (extend existing) | ✅ (extend) |
| Typecheck | All workspaces compile | static | `npx tsc --noEmit -p packages/server/tsconfig.json && npx tsc --noEmit -p apps/mobile/tsconfig.json` | ✅ |

### Sampling Rate
- **Per task commit:** `pnpm test --run` in the modified package + affected typecheck
- **Per wave merge:** `pnpm test --run` across both workspaces + `npx tsc --noEmit` per workspace
- **Phase gate:** Full suite green + Maestro flows `24-pantry-staples.yaml`, `25-pantry-search-pill.yaml`, `26-pantry-rules.yaml` green on iPhone 17 Pro sim

### Wave 0 Gaps
- [ ] `packages/server/src/services/ruleEvaluator.ts` + `src/services/__tests__/ruleEvaluator.test.ts`
- [ ] `packages/server/src/services/suggestionAggregator.ts` + tests
- [ ] `packages/server/src/services/canonicalPromoter.ts` + tests
- [ ] `packages/server/src/routes/__tests__/pantry.rules.test.ts` (rules CRUD)
- [ ] `packages/server/src/routes/__tests__/pantry.staples.test.ts` (staples CRUD)
- [ ] `packages/server/src/routes/__tests__/pantry.suggestions.test.ts` (read/accept/dismiss)
- [ ] `packages/server/src/routes/__tests__/pantry.preview.test.ts` (30-day preview)
- [ ] `packages/server/src/routes/__tests__/pantry.confirm.override.test.ts` (silent category write)
- [ ] `apps/mobile/src/stores/__tests__/pantryStore.staples.test.ts` (threshold + actions)
- [ ] `apps/mobile/src/stores/__tests__/pantryStore.rules.test.ts` (reorder/CRUD)
- [ ] `apps/mobile/src/hooks/__tests__/usePantryItemsGrouped.test.ts` (4-way grouping helper)
- [ ] `apps/mobile/src/components/pantry/__tests__/PantryItemCard.stale.test.ts` (dashed border)
- [ ] `apps/mobile/src/components/ui/__tests__/ItemRow.compact.test.ts` (size variant)
- [ ] `apps/mobile/src/app/settings/__tests__/pantryRulesHelpers.test.ts` (reorder helper)
- [ ] Migration tests for `00016_user_staples.sql`, `00017_user_location_rules.sql`, `00018_suggested_rules.sql` — extend existing `migrations.test.ts`
- [ ] Maestro: `24-pantry-staples.yaml` (mark via ellipsis + filter chip view)
- [ ] Maestro: `25-pantry-search-pill.yaml` (pill → modal)
- [ ] Maestro: `26-pantry-rules.yaml` (Settings → Pantry Rules → Add rule → preview → save)

## Sources

### Primary (HIGH confidence)
- `.planning/phases/21-pantry-intelligence-*/21-CONTEXT.md` — all decisions locked
- `.planning/STATE.md` — Phase 24a complete, substrate ready
- `.planning/REQUIREMENTS.md` — scope mapping
- `.planning/ROADMAP.md` lines 418-431 — Phase 21 criteria
- `packages/server/src/services/canonicalResolver.ts` — identity engine (verified)
- `packages/server/src/services/pantry.ts` — line 150 insertion point (verified)
- `supabase/migrations/00010_item_override_events.sql` — aggregator input (verified)
- `supabase/migrations/00011_canonical_ingredients.sql` — candidate promotion target (verified)
- `supabase/migrations/00012_ingredient_aliases.sql` — name-rule write target (verified)
- `supabase/migrations/00014_scan_events.sql` — preview panel source (verified)
- `apps/mobile/src/components/ui/ItemRow.tsx` + `Chip.tsx` + `SearchBar.tsx` — Phase 19 primitives (verified)
- `apps/mobile/src/app/(tabs)/pantry.tsx` — refactor surface (verified)
- `apps/mobile/src/components/pantry/PantryItemCard.tsx` — stale treatment surface (verified)

### Secondary (MEDIUM confidence)
- Draft RPC SQL uses JSONB path matching — alternative counter-table pattern recommended as simpler; both verified against Postgres 15 syntax from memory.

### Tertiary (LOW confidence)
- `react-native-draggable-flatlist` v4 compatibility with RN 0.83 New Architecture — unverified, Wave 0 task flag.

## Metadata

**Confidence breakdown:**
- Schema: HIGH — 3 table shapes fully locked in CONTEXT
- Rule evaluator: HIGH — insertion point verified in pantry.ts line 150
- Aggregator: HIGH — Phase 18 override_events shape verified
- Promoter RPC: MEDIUM — 2 design options (JSONB path vs counter-table); recommendation documented
- Mobile refactor: HIGH — Phase 19 primitives verified in codebase
- Compact ItemRow: MEDIUM — recommendation is `size` prop; alternative className override acceptable
- draggable-flatlist: LOW — compatibility unverified, Wave 0 verification needed

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable — all dependencies are internal substrates)
