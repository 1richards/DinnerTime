# Phase 8: Shopping & Instacart - Research

**Researched:** 2026-04-10
**Domain:** Shopping list generation from meal plans + Instacart link-out ordering
**Confidence:** HIGH

## Summary

Phase 8 closes the loop: meal plan -> consolidated shopping list -> Instacart order -> reorder history. The infrastructure for ingredient normalization (`normalizeIngredientName`), pantry matching (`matchIngredientsToPantry`), and meal plan entries with `ingredients_needed` is already in place from Phase 7 and can be reused directly. A stub `shopping.ts` route and a placeholder `shopping.tsx` tab already exist and need to be replaced.

The Instacart Developer Platform API is a **link-based model**: we POST a shopping list (title + line_items) to `POST /idp/v1/products/products_link` and receive a `products_link_url` that the user opens in an external browser to complete checkout. We never manage cart state. Because API access approval is uncertain (flagged as a blocker in STATE.md), the service layer must be architected behind a thin `InstacartClient` interface with two implementations: a **stub** that returns a deterministic placeholder URL (for dev + CI), and a **real** implementation keyed on `INSTACART_API_KEY` env var. Selection happens via env check in a single factory function.

**Primary recommendation:** Build the shopping-list service (consolidate -> subtract pantry -> categorize) as pure server-side TypeScript, persist lists + orders to new Supabase tables, and abstract Instacart behind `packages/server/src/services/instacart.ts` with an env-gated stub. Use Claude Haiku for category classification and reorder variation suggestions to keep costs low. Mobile UI mirrors existing patterns from `plan.tsx` / `pantry.tsx` (Zustand store + authedFetch + optimistic updates).

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase. Constraints taken from additional_context and project state:

### Locked Decisions
- **Instacart integration must be stubbable.** Instacart Developer Platform API access may not be granted in time (STATE.md blocker). Build a stub client returning a placeholder URL now with a clear upgrade path to the real API (single env-gated factory).
- **Link-based ordering only.** No cart state management on our side — Instacart hosts the cart/checkout page.
- **All external API calls go through the Hono backend** (no Instacart API key in mobile).
- **Claude API** is the only AI provider (use Haiku for cheap classification/variations).

### Claude's Discretion
- Data model for shopping lists and orders (new tables vs extend meal_plans).
- Category classification strategy (static map vs Claude Haiku vs hybrid).
- How to render the shopping list UI (grouped sections vs flat list with filter chips).
- Reorder variations UX (inline chip vs modal).

### Deferred Ideas (OUT OF SCOPE)
- Multiple grocery delivery services (Amazon Fresh, Walmart) — ADVN-04, v2.
- Offline shopping list editing — FOUN-07, Phase 10.
- Barcode scanning / UPC entry from user — out of scope per REQUIREMENTS.md.
- Notifications for expiring pantry items — NOTF-02, v2.
- Multi-household shared lists — MULT-01, v2.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHOP-01 | Auto-generate shopping list from meal plan by consolidating ingredients | Reuse `normalizeIngredientName`; new `consolidateIngredients` service groups by norm key + sums quantities when units match |
| SHOP-02 | Subtract pantry inventory from shopping list | Reuse `matchIngredientsToPantry` pattern; subtract pantry quantity from needed; include only positive remainders |
| SHOP-03 | Group items by category (produce, dairy, protein, etc.) | Static category map for ~300 common ingredients + Claude Haiku fallback for unknowns (cached per-item to avoid repeat calls) |
| SHOP-04 | User can check off, add, edit shopping list items | New `shopping_list_items` table with `checked` bool; optimistic Zustand updates per existing stores pattern |
| SHOP-05 | Send shopping list to Instacart for one-tap ordering | POST to `/idp/v1/products/products_link` via server-side `InstacartClient` (stub or real); return `products_link_url`; open via `Linking.openURL` on mobile |
| SHOP-06 | View past orders and reorder with one tap | New `shopping_orders` table stores snapshot of items + returned URL; reorder creates new shopping list seeded from order snapshot |
| SHOP-07 | AI suggests creative variations when reordering ("try harissa this time") | Claude Haiku endpoint takes original ingredient list, returns 3-5 swap suggestions with rationale |

## Standard Stack

### Core (already in project — reuse)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hono | ~4.x | Backend route handler for /shopping | Already mounted at `/api/v1/shopping` as a stub |
| @supabase/supabase-js | ~2.101 | DB reads/writes + RLS | Project standard; matches all prior phases |
| @anthropic-ai/sdk | ~0.82 | Claude Haiku for category + variations | Reuse existing `anthropic` client (lazy singleton, see Phase 03 pattern) |
| Zustand | ~5.0 | `shoppingStore` for mobile state | Matches `mealPlanStore`/`pantryStore` pattern |
| NativeWind | ~4.x | Styling | Project standard |
| expo-router | bundled | `/shopping` tab already exists | Replace placeholder screen |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native` `Linking` | built-in | Open Instacart URL in external browser | `Linking.openURL(products_link_url)` for the "Order on Instacart" button |
| `expo-web-browser` | bundled (SDK 55) | Alternative: in-app browser tab | Preferred over Linking for better UX; use `WebBrowser.openBrowserAsync` |

**Recommendation:** Use `expo-web-browser` — keeps user in-app after checkout via Safari View Controller on iOS.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static category map | Pure Claude Haiku per item | Pure-AI is $/latency overhead; static map covers ~80% of common produce/dairy/protein with zero cost. Hybrid is optimal. |
| New `shopping_lists` table | Derive on-the-fly from `meal_plan_entries` | Derivation breaks SHOP-04 (user edits must persist). Persistent list required. |
| `expo-web-browser` | `Linking.openURL` | Linking boots full Safari; worse return-to-app UX. |

**Installation (new packages):** none — all required deps already present.

## Architecture Patterns

### Recommended File Layout
```
packages/server/src/
├── routes/
│   └── shopping.ts              # REPLACE stub: list CRUD + order + reorder + variations
├── services/
│   ├── shoppingList.ts          # consolidateIngredients, subtractPantry, categorize
│   ├── ingredientCategories.ts  # static category map + Haiku fallback
│   └── instacart.ts             # InstacartClient interface + stub + real impl + factory
├── types/
│   └── shopping.ts              # ShoppingList, ShoppingListItem, ShoppingOrder types
supabase/migrations/
└── 00007_shopping.sql           # shopping_lists, shopping_list_items, shopping_orders

apps/mobile/src/
├── app/(tabs)/shopping.tsx      # REPLACE placeholder: grouped list view
├── app/shopping/
│   ├── orders.tsx               # Past orders list
│   └── order/[id].tsx           # Order detail + reorder + variations
├── stores/shoppingStore.ts      # list, items, orders, actions
└── types/shopping.ts            # client-side types (mirror server)
```

### Pattern 1: InstacartClient Factory (stubbable)
```typescript
// packages/server/src/services/instacart.ts
export interface InstacartLineItem {
  name: string;
  line_item_measurements?: Array<{ quantity: number; unit: string }>;
}
export interface InstacartClient {
  createShoppingListPage(params: {
    title: string;
    line_items: InstacartLineItem[];
    expires_in?: number; // days, max 365
  }): Promise<{ products_link_url: string }>;
}

class StubInstacartClient implements InstacartClient {
  async createShoppingListPage({ title }: { title: string }) {
    // Deterministic placeholder for dev/CI
    const slug = encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'));
    return { products_link_url: `https://example.com/stub-instacart/${slug}` };
  }
}

class RealInstacartClient implements InstacartClient {
  constructor(private apiKey: string, private baseUrl: string) {}
  async createShoppingListPage(params) {
    const res = await fetch(`${this.baseUrl}/idp/v1/products/products_link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...params, link_type: 'shopping_list' }),
    });
    if (!res.ok) throw new Error(`Instacart API ${res.status}: ${await res.text()}`);
    return res.json(); // { products_link_url }
  }
}

export function getInstacartClient(): InstacartClient {
  const apiKey = process.env.INSTACART_API_KEY;
  if (!apiKey) return new StubInstacartClient();
  const baseUrl = process.env.INSTACART_BASE_URL ?? 'https://connect.dev.instacart.tools';
  return new RealInstacartClient(apiKey, baseUrl);
}
```
**When to use:** Service layer calls `getInstacartClient()` once per request. Switch between dev (`connect.dev.instacart.tools`) and prod (`connect.instacart.com`) via `INSTACART_BASE_URL` env.

### Pattern 2: Consolidation + Pantry Subtraction
```typescript
// packages/server/src/services/shoppingList.ts
import { normalizeIngredientName } from './ingredientMatching.js';
import type { MealPlanEntry, MealPlanIngredient } from '../types/mealPlan.js';
import type { PantryItem } from './pantry.js';

export interface ConsolidatedItem {
  name: string;           // canonical display name (first occurrence)
  normalizedName: string;
  quantity: number;
  unit: string | null;    // null if units conflict across recipes
  sources: string[];      // recipe titles for UI "from: chicken tikka, tacos"
}

export function consolidateIngredients(entries: MealPlanEntry[]): ConsolidatedItem[] {
  const byNorm = new Map<string, ConsolidatedItem>();
  for (const entry of entries) {
    for (const ing of entry.ingredients) {
      const norm = normalizeIngredientName(ing.name);
      const existing = byNorm.get(norm);
      if (!existing) {
        byNorm.set(norm, {
          name: ing.name,
          normalizedName: norm,
          quantity: ing.quantity ?? 1,
          unit: ing.unit ?? null,
          sources: [entry.title],
        });
      } else {
        // Sum only when units match; otherwise keep max quantity, null the unit
        if (existing.unit === (ing.unit ?? null)) {
          existing.quantity += ing.quantity ?? 1;
        } else {
          existing.quantity = Math.max(existing.quantity, ing.quantity ?? 1);
          existing.unit = null; // signal "review quantity"
        }
        if (!existing.sources.includes(entry.title)) existing.sources.push(entry.title);
      }
    }
  }
  return Array.from(byNorm.values());
}

export function subtractPantry(
  needed: ConsolidatedItem[],
  pantry: PantryItem[],
): ConsolidatedItem[] {
  const pantryByNorm = new Map<string, PantryItem>();
  for (const p of pantry) {
    const n = normalizeIngredientName(p.name);
    if (!pantryByNorm.has(n)) pantryByNorm.set(n, p);
  }
  return needed
    .map((item) => {
      const p = pantryByNorm.get(item.normalizedName);
      if (!p) return item;
      const remaining = item.quantity - p.quantity;
      return remaining > 0 ? { ...item, quantity: remaining } : null;
    })
    .filter((x): x is ConsolidatedItem => x !== null);
}
```

### Pattern 3: Hybrid Category Classification
```typescript
// packages/server/src/services/ingredientCategories.ts
export type GroceryCategory =
  | 'produce' | 'dairy' | 'protein' | 'pantry' | 'bakery'
  | 'frozen' | 'beverages' | 'condiments' | 'spices' | 'other';

const STATIC_MAP: Record<string, GroceryCategory> = {
  tomato: 'produce', onion: 'produce', garlic: 'produce', lettuce: 'produce',
  milk: 'dairy', butter: 'dairy', cheese: 'dairy', yogurt: 'dairy',
  chicken: 'protein', beef: 'protein', tofu: 'protein', egg: 'protein',
  rice: 'pantry', flour: 'pantry', pasta: 'pantry', bean: 'pantry',
  // ... ~300 common items
};

export function classifyStatic(normName: string): GroceryCategory | null {
  // Try full match, then token match ("ground beef" -> "beef")
  if (STATIC_MAP[normName]) return STATIC_MAP[normName];
  for (const token of normName.split(' ')) {
    if (STATIC_MAP[token]) return STATIC_MAP[token];
  }
  return null;
}

export async function classifyBatchWithHaiku(
  unknownItems: string[],
): Promise<Record<string, GroceryCategory>> {
  // Single Haiku call with tool use, batched list -> category map
  // Cache results in shopping_list_items.category (written once)
}
```

### Anti-Patterns to Avoid
- **Calling Instacart per-item:** Send the entire list in ONE `products_link` call. The API is designed for this.
- **Storing Instacart URLs forever:** Links can expire (`expires_in` max 365 days). Mark orders with `expires_at` and disable reorder button when expired (reorder rebuilds a fresh page).
- **AI category per item on every render:** Classify ONCE on list creation, persist in DB column. Never re-classify.
- **Summing quantities with mismatched units:** 2 cups + 1 tbsp ≠ 3. Null the unit and let the user review (see Pattern 2).
- **Blocking list generation on pantry errors:** If pantry fetch fails, generate the unsubtracted list and show a warning (better than nothing).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grocery cart / checkout flow | Custom cart UI, payment, product search | Instacart `products_link` endpoint | Link-based model eliminates all cart state. Instacart handles store selection, pricing, fulfillment. |
| Ingredient normalization | New regex collapser | Reuse `normalizeIngredientName` from `ingredientMatching.ts` | Already tested, already matches the convention used in Phase 7 pantry deduction. |
| Pantry matching | New matcher | Reuse `matchIngredientsToPantry` pattern (or extend) | Phase 7 already solved this; shopping just needs the subtraction variant. |
| AI category classification | Train a classifier | Static map + Haiku fallback | Static handles 80%, Haiku is $0.0001/call for the rest. Persist result — classify once. |
| URL shortener for shared links | Build one | Instacart already returns a short branded URL | `products_link_url` is the link to share; no further processing needed. |
| Product matching by UPC | Scan barcodes | Send plain names; Instacart searches | UPC is optional; plain name search works for v1. |

**Key insight:** The Instacart link-based model and Phase 7's existing ingredient utilities mean Phase 8 is mostly glue code: consolidate -> subtract -> categorize -> POST one payload -> open URL.

## Common Pitfalls

### Pitfall 1: Instacart API access delay blocks the whole phase
**What goes wrong:** Waiting on Instacart API key before building anything, then rushing integration.
**Why it happens:** STATE.md flags "Apply for Instacart Developer Platform API access early" — but approval timeline is unknown.
**How to avoid:** Build against `InstacartClient` interface from day one. Stub returns `https://example.com/stub-instacart/...`. Mobile UI works identically against stub. When real key arrives, flip one env var.
**Warning signs:** Seeing `fetch('https://connect.instacart.com/...')` called directly from route handler — that's a tight-coupling smell.

### Pitfall 2: Unit conflicts during consolidation
**What goes wrong:** Recipe A wants "2 cups chicken broth," Recipe B wants "1 can chicken broth." Naive sum = 3 of nothing.
**Why it happens:** No unit conversion library, and recipes use freeform units.
**How to avoid:** If units match, sum; if not, take max quantity and null the unit (forces user to eyeball quantity). Show source recipes in UI so user has context.
**Warning signs:** Shopping list items showing "3" with no unit and no source annotation.

### Pitfall 3: Pantry subtraction makes list empty for stocked users
**What goes wrong:** User has a full pantry; shopping list returns zero items even though they want to shop.
**Why it happens:** Confidence-decayed items still count; user may distrust pantry state.
**How to avoid:** Show "X items subtracted from pantry" as an expandable section with an "Add back" button per item. Trust but verify.
**Warning signs:** User reports of "empty shopping list" when they clearly need groceries.

### Pitfall 4: Instacart link expiration silently breaks reorder
**What goes wrong:** User taps "Reorder" on a 6-month-old order, gets a 404 or broken cart.
**Why it happens:** `expires_in` defaults aren't documented clearly; links have a lifespan.
**How to avoid:** Store `expires_at` on `shopping_orders` (compute from `expires_in` at creation). Reorder ALWAYS creates a NEW Instacart page from the stored line_items, never replays the old URL.
**Warning signs:** Reorder button opens a dead link instead of a fresh Instacart page.

### Pitfall 5: Category classification thrash
**What goes wrong:** Haiku classifies "chicken thighs" as protein on Monday, "chicken thigh" as poultry on Tuesday.
**Why it happens:** Freeform AI output, inconsistent prompting.
**How to avoid:** Use Claude tool-use with a strict enum matching `GroceryCategory`. Classify ONCE per `normalizedName` and persist. Cache at server level across users (shared normalized-name table).
**Warning signs:** Same ingredient appearing in two categories across different lists.

### Pitfall 6: Instacart image_url requirement for recipe links
**What goes wrong:** Using `link_type: recipe` requires `image_url` + `instructions`; ours only applies to per-recipe meals.
**Why it happens:** Two endpoint types (recipe page vs shopping list page) have different required fields.
**How to avoid:** Use `link_type: 'shopping_list'` for Phase 8 — it only needs `title` and `line_items`. Recipe-link mode is a Phase 9+ nice-to-have.

## Code Examples

### Instacart shopping list payload shape (verified from official docs)
```typescript
// POST https://connect.instacart.com/idp/v1/products/products_link
// Authorization: Bearer <INSTACART_API_KEY>
// Content-Type: application/json
{
  "title": "DinnerTime — week of Apr 13",
  "link_type": "shopping_list",
  "expires_in": 30,
  "line_items": [
    {
      "name": "chicken thighs",
      "line_item_measurements": [{ "quantity": 2, "unit": "pound" }]
    },
    {
      "name": "yellow onion",
      "line_item_measurements": [{ "quantity": 3, "unit": "each" }]
    }
  ],
  "landing_page_configuration": {
    "partner_linkback_url": "dinnertime://shopping/done"
  }
}
// Response: { "products_link_url": "https://www.instacart.com/store/recipes/..." }
```
Source: https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/

### Opening the Instacart URL from mobile
```typescript
// apps/mobile/src/app/(tabs)/shopping.tsx
import * as WebBrowser from 'expo-web-browser';

async function handleOrder() {
  const { products_link_url } = await createOrder(); // store action
  await WebBrowser.openBrowserAsync(products_link_url);
}
```

### Reorder with AI variations (Claude Haiku tool-use)
```typescript
// packages/server/src/services/shoppingList.ts
export async function suggestVariations(
  originalItems: ConsolidatedItem[],
): Promise<Array<{ swap: string; instead_of: string; rationale: string }>> {
  const result = await anthropic.messages.create({
    model: 'claude-haiku-4-latest',
    max_tokens: 512,
    tools: [{
      name: 'suggest_swaps',
      input_schema: {
        type: 'object',
        properties: {
          swaps: {
            type: 'array',
            maxItems: 5,
            items: {
              type: 'object',
              properties: {
                instead_of: { type: 'string' },
                swap: { type: 'string' },
                rationale: { type: 'string' },
              },
              required: ['instead_of', 'swap', 'rationale'],
            },
          },
        },
        required: ['swaps'],
      },
    }],
    tool_choice: { type: 'tool', name: 'suggest_swaps' },
    messages: [{
      role: 'user',
      content: `Given this shopping list, suggest 3-5 creative ingredient swaps to make the meals more interesting. Keep the core dish, vary the seasoning/protein/style:\n${originalItems.map(i => `- ${i.name}`).join('\n')}`,
    }],
  });
  // Extract tool_use block -> swaps
}
```

## Data Model (recommended)

```sql
-- supabase/migrations/00007_shopping.sql
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  sources JSONB NOT NULL DEFAULT '[]', -- recipe titles
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  user_added BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shopping_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL,
  items_snapshot JSONB NOT NULL, -- frozen line_items for reorder
  instacart_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  placed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shopping_lists_profile ON shopping_lists(profile_id, created_at DESC);
CREATE INDEX idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_shopping_orders_profile ON shopping_orders(profile_id, placed_at DESC);

-- RLS (follow Phase 7 EXISTS subquery pattern for items)
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_orders ENABLE ROW LEVEL SECURITY;
-- ... policies scoped by profile_id = auth.uid()
```

## API Surface (recommended)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/shopping/generate` | `{ meal_plan_id }` -> create shopping_list from meal plan entries (consolidate + subtract + classify) |
| GET | `/api/v1/shopping/current` | Active (most recent) list with items |
| GET | `/api/v1/shopping/:id` | Specific list |
| PATCH | `/api/v1/shopping/items/:id` | Toggle checked, edit quantity/name |
| POST | `/api/v1/shopping/items` | Add ad-hoc item `{ shopping_list_id, name, quantity, unit }` |
| DELETE | `/api/v1/shopping/items/:id` | Remove item |
| POST | `/api/v1/shopping/:id/order` | Call Instacart, persist `shopping_orders`, return `{ url }` |
| GET | `/api/v1/shopping/orders` | Past orders list |
| POST | `/api/v1/shopping/orders/:id/reorder` | Create new list seeded from order snapshot |
| POST | `/api/v1/shopping/orders/:id/variations` | Claude Haiku swap suggestions |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Instacart `quantity` + `unit` fields per line_item | `line_item_measurements: [{quantity, unit}]` array | Recent API update | Allows multiple measurement options per item. Use the new form exclusively. |
| Instacart recipe-only endpoint | Separate `shopping_list` link_type on `/products_link` | 2024-2025 | Shopping list mode has simpler requirements (no image_url, no instructions). |
| Per-item UPC required | UPCs optional, plain name search works | Current | Phase 8 sends names only; UPC support is a v2 optimization. |

**Deprecated/outdated:**
- `quantity` and `unit` top-level fields on LineItem: replaced by `line_item_measurements`.

## Open Questions

1. **Will Instacart API approval land in time?**
   - What we know: STATE.md flags this as a blocker with unknown timeline.
   - What's unclear: Whether the stub will be used in production at launch.
   - Recommendation: Ship with stub as default, wire real client behind env var. Phase is complete without real API key.

2. **Should the shopping list tab show only the current list or a history navigator?**
   - What we know: SHOP-06 requires past orders viewing.
   - What's unclear: Whether orders are a separate screen or inline.
   - Recommendation: Current list on tab root; "Orders" header button navigates to `shopping/orders.tsx`. Matches `plan.tsx` precedent.

3. **Category map coverage vs Haiku fallback cost.**
   - What we know: Claude Haiku is ~$0.0001/call. 300 static entries cover most.
   - What's unclear: Real-world unknown-item rate.
   - Recommendation: Start with 300 static entries + per-item Haiku fallback, cached indefinitely per `normalized_name` in a shared `ingredient_categories` table (created in Phase 8 migration).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (server) + React Native Testing Library (mobile) — project standard |
| Config file | `packages/server/vitest.config.ts`, `apps/mobile/vitest.config.ts` |
| Quick run command | `pnpm -C packages/server test -- --run` |
| Full suite command | `pnpm -w test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOP-01 | Consolidate ingredients across meal plan entries | unit | `pnpm -C packages/server test shoppingList.test.ts -- --run` | Wave 0 |
| SHOP-02 | Subtract pantry items from consolidated list | unit | `pnpm -C packages/server test shoppingList.test.ts -- --run` | Wave 0 |
| SHOP-03 | Classify items into categories (static + Haiku fallback) | unit | `pnpm -C packages/server test ingredientCategories.test.ts -- --run` | Wave 0 |
| SHOP-04 | CRUD shopping list items (check, add, edit, delete) | integration | `pnpm -C packages/server test routes/shopping.test.ts -- --run` | Wave 0 |
| SHOP-05 | Instacart stub returns deterministic URL; real client posts correct payload | unit | `pnpm -C packages/server test instacart.test.ts -- --run` | Wave 0 |
| SHOP-06 | Order snapshot persists; reorder creates new list | integration | `pnpm -C packages/server test routes/shopping.test.ts -- --run` | Wave 0 |
| SHOP-07 | Haiku variations tool-use returns structured swaps (mocked anthropic client) | unit | `pnpm -C packages/server test shoppingList.test.ts -- --run` | Wave 0 |
| SHOP-04 (UI) | Check off item updates store optimistically | unit | `pnpm -C apps/mobile test shoppingStore.test.ts -- --run` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm -C packages/server test -- --run` (affected files) / `pnpm -C apps/mobile test -- --run`
- **Per wave merge:** `pnpm -w test`
- **Phase gate:** `pnpm -w test` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/services/__tests__/shoppingList.test.ts` — SHOP-01, SHOP-02, SHOP-07
- [ ] `packages/server/src/services/__tests__/ingredientCategories.test.ts` — SHOP-03
- [ ] `packages/server/src/services/__tests__/instacart.test.ts` — SHOP-05 (stub determinism + real client fetch mock)
- [ ] `packages/server/src/routes/__tests__/shopping.test.ts` — SHOP-04, SHOP-06 route-level integration (mocked Supabase)
- [ ] `apps/mobile/src/stores/__tests__/shoppingStore.test.ts` — SHOP-04 optimistic updates
- [ ] `supabase/migrations/00007_shopping.sql` — new tables (not a test, but blocks all integration tests)
- [ ] `packages/server/src/types/shopping.ts` — shared types

## Sources

### Primary (HIGH confidence)
- [Instacart — Create Shopping List Page](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/) — endpoint URL, request schema, `line_item_measurements`, `expires_in`, response shape
- [Instacart — Create Recipe Page](https://docs.instacart.com/developer_platform_api/guide/tutorials/create_a_recipe_page/) — dev vs prod base URLs, auth header format, `landing_page_configuration`
- Existing code: `packages/server/src/services/ingredientMatching.ts` — reused normalization + matching
- Existing code: `packages/server/src/routes/meal-plans.ts` — reference pattern for Hono routes + Supabase + auth middleware
- Existing code: `supabase/migrations/00006_meal_plans.sql` — RLS pattern reference
- Existing code: `apps/mobile/src/stores/mealPlanStore.ts` — reference for Zustand store shape
- `CLAUDE.md` — project stack (Hono, Supabase, Zustand, Claude SDK, NativeWind)

### Secondary (MEDIUM confidence)
- [Instacart Shopping List Concepts](https://docs.instacart.com/developer_platform_api/guide/concepts/shopping_list/) — WebSearch discovery, confirmed by primary doc

### Tertiary (LOW confidence)
- None — all claims verified against official Instacart docs or project code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in project; link-based Instacart verified from official docs.
- Architecture: HIGH — mirrors Phase 7 patterns (routes, services, stores, migrations); Instacart abstraction is standard factory pattern.
- Pitfalls: HIGH — Pitfalls 1, 4 come from STATE.md and explicit Instacart docs; Pitfalls 2, 3, 5 are general distributed-data hygiene.
- Data model: MEDIUM — three-table design is the obvious shape but the planner may choose to fold `shopping_orders.items_snapshot` into a separate table if reorder analytics become important.

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (Instacart API is stable; re-verify endpoint shape only if 30+ days pass before implementation)
