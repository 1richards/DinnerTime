# Phase 18: AI Auto-Location for Pantry Imports — Research

**Researched:** 2026-04-18
**Domain:** AI classification + data-model extension + mobile UX removal + review screen chip primitive
**Confidence:** HIGH (codebase-heavy; all upstream patterns are in-tree and verified)

## Summary

Phase 18 removes the `LocationPicker` gating step from all four pantry import flows (camera `/scan`, batch scan, receipt `/scan/receipt`, Instacart `/scan/instacart`). The AI classifies `source_location` per item using a hybrid strategy that exactly mirrors Phase 8's `ingredientCategories.ts` (STATIC_MAP fast path + Haiku/Gemini fallback). A new backend service `packages/server/src/services/itemLocation.ts` exports `classifyItems(items, ai) -> Record<name, location>` and a new review-screen chip primitive opens a 3-choice bottom sheet on tap.

The data model gets a forward-compatible `pantry_items.item_attributes JSONB` column (dual-written alongside `source_location` for zero-risk migration) and a new immutable `item_override_events` table that seeds Phase 21's rules UI and Phase 24's canonical-ingredient resolution. No bulk re-classify sweep of existing pantry items.

**Primary recommendation:** Fold location classification INTO the existing vision tool schema (Option C in Q4) — single round-trip, no added latency, STATIC_MAP applied post-AI as an override-and-correction layer rather than a separate pass. This minimizes Gemini-path divergence (vision routes to Anthropic only — see Phase 14 decision) and preserves the batch/receipt/Instacart parity that Phase 13/14 worked hard to establish.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**LocationPicker removal (all scan flows)**
- **Camera scan (single-photo):** LocationPicker removed entirely. Tap camera FAB → straight to camera. AI classifies per item on photo analysis.
- **Batch scan (multi-photo, Phase 14):** Session-level location lock REMOVED. AI classifies each item across all photos independently. Matches ROADMAP #5 ("distribute across all three locations in one session").
- **Receipt scan:** Phase 13's hardcoded `source_location='pantry'` replaced with per-item AI fan-out. Dairy→fridge, frozen→freezer, shelf-stable→pantry automatically.
- **Instacart import:** Same treatment as receipt — unified code path. AI per-item classification.

**Hybrid classifier (AI + static rules)**
- Static rule layer first: curated `name → location` map in the backend (analogous to Phase 8's `ingredientCategories` STATIC_MAP pattern). Covers the ~150 most common ingredients.
- AI fallback for unknowns. Keeps cost low + prompt focused.
- Unified across flows: same hybrid classifier serves camera/batch/receipt/Instacart.
- Backend service: `packages/server/src/services/itemLocation.ts` consumes the AI result post-identification.
- User-editable rules: OUT of scope. Phase 21 owns the Settings UI.

**Review screen chip UX**
- Chip appearance: SF Symbol + label ("Fridge" / "Pantry" / "Freezer"). Uses Phase 19 `Chip` component with `kind="display"`.
- Tap interaction: Tap opens a 3-choice bottom sheet with current value highlighted. User taps new value; sheet dismisses.
- No special visual treatment for AI-classified vs user-overridden.
- No special visual treatment for low-confidence classifications.
- Per-item only: no bulk multi-select.

**Data model (forward-compatible)**
- New column: `pantry_items.item_attributes JSONB NOT NULL DEFAULT '{}'::jsonb`. Phase 18 writes `{"source_location": "fridge"}`. No Zod validation at application layer.
- Keep existing `pantry_items.source_location` in parallel. Dual-write so mobile UI reading column directly keeps working. Phase 24 drops the column.
- New table: `item_override_events`. Append-only, RLS-gated, minimal shape (id, user_id, item_name, ai_location, user_location, created_at). RLS: `user_id = auth.uid()` on SELECT/INSERT. No UPDATE/DELETE.
- Phase 21 consumes this table; Phase 24 may add `canonical_ingredient_id`.

**Instacart fan-out UX**
- Same review screen pattern across camera/receipt/Instacart. List view, each item row has a location chip.
- No summary bar, no grouped-by-location sections.

**Existing pantry items**
- Default: "leave them alone" — existing items keep their current `source_location` and get `item_attributes='{}'` or `{"source_location": <existing>}` via dual-write.
- Phase 24 handles canonical-ingredient rollup naturally on next scan.
- Planner may propose a lazy re-classify on user edit; do not ship an app-open background sweep.

### Claude's Discretion

- Exact static-map ingredient list (~150 entries for hybrid classifier fast path).
- AI prompt wording for location classification (tool schema addition).
- Existing-item migration approach (default: leave alone; planner may propose lazy re-classify).
- Whether dual-write happens in service layer or Postgres trigger.
- Bottom sheet component pattern (reuse existing `BulkImportSheet`/`SwapSheet` Modal pattern; no new dependency).
- Confidence threshold for location (default 0.7 if implemented; not user-facing in Phase 18).

### Deferred Ideas (OUT OF SCOPE)

- User-editable location rules UI — Phase 21.
- Canonical ingredient resolution — Phase 24.
- Quantity + unit semantics refactor — Phase 24.
- Consuming `item_override_events` — Phase 21.
- Bulk multi-select edit mode — future polish phase.
- Background re-classify sweep of existing pantry_items.
- Additional locations beyond fridge/pantry/freezer.
- AI prompt learning from historical overrides — Phase 24+.
- Client-side location suggestions before AI round-trip.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Pantry-UX-01 | AI returns a suggested `source_location` per item across camera, batch, receipt, Instacart | Tool-schema extension (Q2), hybrid `itemLocation.ts` (Q3), classifier placement Option C folded into vision call (Q4) |
| Pantry-UX-02 | Review screen shows location per item as editable chip (override possible) | `LocationChip` + bottom sheet (Q7), ReviewItemRow integration (Q8) |
| Pantry-UX-03 | LocationPicker removed as gating step | Removal mechanics (Q9), camera flow UX change (Q11), Maestro impact (Q14) |
| Pantry-UX-04 | Default locations sensible: dairy/meat/produce→fridge, frozen→freezer, shelf-stable→pantry | STATIC_MAP seed (Q1) |
| Pantry-UX-05 | Receipt/Instacart distribute items across all three locations in one session | Classifier applied per-item at service layer, `reconcileItems` already keys by (name + location), dual-write column map preserves correctness (Q5) |

Phase requirement IDs are expressed as "Pantry UX improvement (post-v1)" in ROADMAP — the above five criteria from Phase 18 §Success Criteria are the operative list.

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Platform:** iOS-first; iPhone + simulator; no cross-platform fallback.
- **AI:** All AI calls route through backend (`getClientFor(task)`), never direct SDK on mobile.
- **Database:** Supabase Postgres. RLS on every user-scoped table (`user_id = auth.uid()`).
- **Styling:** NativeWind; tokens via `src/design/tokens.ts` and `tailwind.config.js`. No raw hex (`#F97316` forbidden after Phase 19).
- **GSD workflow:** Phase 18 work must flow through `/gsd:execute-phase`; no direct edits outside GSD.
- **UAT:** Maestro 2.4.0 + iOS Simulator is the acceptance harness. Existing flow inventory in `apps/mobile/.maestro/`.
- **Camera quality cap:** `quality: 0.4` on `ImagePicker.launchCameraAsync` (5MB Anthropic ceiling). Do not raise.
- **Dev env:** Server on port 3000, Metro `--lan` for simulator; physical iPhone requires Cloudflare tunnel + Metro `--clear` after `.env` change.

## Standard Stack

### Core (existing, in-repo — no new deps)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.82.x (installed) | Claude Sonnet 4.6 vision | Already the provider for `vision.pantryScan` (Phase 11). No change. |
| @google/genai | 1.48+ | Gemini fallback | Unused for vision today; this phase keeps vision on Anthropic. |
| @supabase/supabase-js | 2.101.x | DB + RLS | Migration pattern verified in Phases 3/7/8/10. |
| zustand | 5.0.12 | Client state | `pantryStore` already manages scan lifecycle. |
| expo-router | 55 (bundled with Expo 55) | Navigation + modal routing | `scan/_layout.tsx` already cascades modal presentation. |
| react-native | 0.83 (Expo 55) | Modal + Pressable | `BulkImportSheet` Modal pattern is the bottom-sheet template. |
| expo-symbols | (bundled) | SF Symbols via `SymbolIcon` | `snowflake` + `archivebox` already mapped (Phase 15). |

### Supporting (existing)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| NativeWind | 4.x | className styling | Location chip + bottom sheet (token-only, no raw hex). |
| Phase 19 Chip | in-repo `Chip.tsx` | Display chip primitive | `kind='display' tone='default' leadingIcon='snowflake'` for the LocationChip wrapper. |
| Phase 15 SymbolIcon | in-repo `SymbolIcon.tsx` | Location glyphs | Reuse mapping: fridge + freezer = `snowflake`, pantry = `archivebox`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `Chip`-wrapping `LocationChip` component | Inline chip in `ReviewItemRow` | Inline keeps file count small but duplicates tap/sheet wiring across row variants. Separate component wins on testability (pure tap handler, pure "value-to-glyph" resolver) and matches Phase 19's pattern of tiny pure primitives. |
| Dedicated bottom-sheet lib (`@gorhom/bottom-sheet`) | Native `Modal` + slide animation | Phase 7/13 established native Modal is sufficient (`SwapSheet`, `CookConfirm`, `BulkImportSheet`). No new dep. |
| Postgres trigger for dual-write | Service-layer dual-write in `reconcileItems` | Trigger is invisible to TS callers (harder to audit); service-layer write keeps the "write everywhere" honest in one function. Recommended: service-layer. |
| New `vision.pantryScan.withLocation` task route | Extend existing `vision.pantryScan` tool schema | New route fragments AIClient routing for no routing benefit (same model). Extend the existing tool. |

**Installation:** none. Phase 18 adds zero dependencies. All primitives exist.

**Version verification:**
```bash
npm view @anthropic-ai/sdk version    # 0.90.0 current; repo pinned at 0.82
npm view zustand version              # 5.0.12 (matches repo)
npm view @google/genai version        # 1.50.1 current (repo uses 1.48+, fine)
```
Repo is within one minor; no upgrade needed for this phase.

## Architecture Patterns

### Recommended Project Structure

```
packages/server/src/
├── services/
│   ├── itemLocation.ts          # NEW — STATIC_MAP + Haiku/Gemini fallback, mirrors ingredientCategories.ts
│   ├── itemLocation.test.ts     # unit — mirrors ingredientCategories.test.ts
│   ├── vision.ts                # EXTEND — tool schema gains `source_location` field
│   └── pantry.ts                # EXTEND — reconcileItems dual-writes item_attributes
├── routes/
│   ├── pantry.ts                # EXTEND — /scan, /scan-batch, /scan-receipt, /import-instacart drop source_location
│   └── overrideEvents.ts        # NEW — POST /api/v1/pantry/override-events
supabase/migrations/
├── 00009_item_attributes.sql         # NEW — adds pantry_items.item_attributes JSONB
└── 00010_item_override_events.sql    # NEW — immutable override log
apps/mobile/src/
├── components/
│   └── pantry/
│       ├── LocationChip.tsx           # NEW — wraps Phase 19 Chip kind='display'
│       ├── LocationChoiceSheet.tsx    # NEW — Modal, 3 options, mirrors BulkImportSheet
│       ├── LocationPicker.tsx         # DELETE (or leave for Phase 21 Settings; Q9 recommendation: delete)
│       └── ReviewItemRow.tsx          # EXTEND — add location chip slot
├── app/scan/
│   ├── index.tsx                      # STRIP — remove LocationPicker, remove selectedLocation state
│   ├── receipt.tsx                    # STRIP — remove LocationPicker
│   ├── instacart.tsx                  # EXTEND — no longer hardcodes 'pantry' in nav param
│   └── review.tsx                     # EXTEND — per-item location, log overrides on confirm
├── stores/
│   └── pantryStore.ts                 # EXTEND — startScan/startBatchScan/etc. lose sourceLocation param; confirm fans out per-item
└── types/
    └── pantry.ts                      # EXTEND — ScanResult.source_location; ReviewItem gets aiLocation field for override detection
```

### Pattern 1: Hybrid Classifier (mirror of `ingredientCategories.ts`)

**What:** Two-layer classification. Static map resolves ~150 common ingredients instantly; unknowns batch to a single Haiku/Gemini call with a strict enum tool schema.

**When to use:** Any time the AI pipeline needs per-item categorical metadata that is mostly deterministic but occasionally needs model judgement. This phase's location inference is the exact shape Phase 8 used for grocery categories.

**Example (template pattern from `ingredientCategories.ts`):**

```typescript
// packages/server/src/services/itemLocation.ts
import { getClientFor } from '../ai/clientFactory.js';
import type { StructuredTool } from '../ai/types.js';
import type { SourceLocation } from './vision.js';

const SOURCE_LOCATIONS: SourceLocation[] = ['fridge', 'pantry', 'freezer'];

export const LOCATION_STATIC_MAP: Record<string, SourceLocation> = {
  // See full seed in § "Static Map Seed Content" below.
  milk: 'fridge',
  butter: 'fridge',
  // ... ~150 entries
};

export function classifyLocationStatic(normName: string): SourceLocation | null {
  const direct = LOCATION_STATIC_MAP[normName];
  if (direct) return direct;
  const tokens = normName.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return null;
  for (const t of tokens) {
    const hit = LOCATION_STATIC_MAP[t];
    if (hit) return hit;
  }
  return null;
}

interface LocationBatchOutput {
  classifications: Array<{ name: string; source_location: SourceLocation }>;
}

const classifyLocationsTool: StructuredTool<LocationBatchOutput> = {
  name: 'classify_item_locations',
  description: 'Classify each item into fridge, pantry, or freezer. Every input name MUST appear.',
  schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            source_location: { type: 'string', enum: SOURCE_LOCATIONS },
          },
          required: ['name', 'source_location'],
        },
      },
    },
    required: ['classifications'],
  },
};

async function classifyBatchWithAI(
  names: string[]
): Promise<Record<string, SourceLocation>> {
  if (names.length === 0) return {};
  const ai = getClientFor('ingredient.categorize'); // reuse existing task route (Gemini flash-lite)
  const { classifications } = await ai.generateStructured({
    user: `Classify each ingredient by where a typical US household stores it.\n\nIngredients:\n${names.map(n => `- ${n}`).join('\n')}`,
    tool: classifyLocationsTool,
    maxTokens: 1024,
  });
  const out: Record<string, SourceLocation> = {};
  for (const { name, source_location } of classifications ?? []) {
    out[name] = source_location;
  }
  return out;
}

export async function classifyItems(
  items: Array<{ normalizedName: string }>
): Promise<Record<string, SourceLocation>> {
  const result: Record<string, SourceLocation> = {};
  const unknowns: string[] = [];
  for (const { normalizedName } of items) {
    if (result[normalizedName] !== undefined) continue;
    const hit = classifyLocationStatic(normalizedName);
    if (hit) result[normalizedName] = hit;
    else unknowns.push(normalizedName);
  }
  if (unknowns.length > 0) {
    const ai = await classifyBatchWithAI(unknowns);
    for (const n of unknowns) {
      result[n] = ai[n] ?? 'pantry'; // default unknown to pantry (shelf-stable bias)
    }
  }
  return result;
}
```

This is structurally identical to `classifyItems` in `ingredientCategories.ts`; the planner can `cp` the file and sed-replace the schema and static map.

### Pattern 2: Tool-schema extension (single round-trip, Option C)

**What:** Extend the existing `foodItemsSchema` in `vision.ts` so Claude returns `source_location` per item in the same structured call. STATIC_MAP is applied post-AI as a correction layer (overrides AI output for known items — STATIC_MAP is ground truth when defined).

**When to use:** When location inference can piggy-back on an existing structured vision call without materially increasing token usage. Each location enum adds ~1 token per item — negligible.

**Before/after schemas:** See Q2 section below for the concrete diff for `foodItemsSchema` and `RECEIPT_FILTERING_RULES`.

### Anti-Patterns to Avoid

- **Per-flow classifier duplication.** The whole Phase-8-like point is *one* `classifyItems` used by four flows. Never let `receipt.ts` get its own static map.
- **AI picks first, ignore STATIC_MAP.** Always run STATIC_MAP post-AI to correct model drift (the model sometimes says "pantry" for eggs; STATIC_MAP forces fridge). STATIC_MAP wins.
- **Bulk re-classify on app open.** Explicitly OUT of scope. Do not touch existing `pantry_items` rows.
- **Postgres trigger for dual-write.** Invisible to TypeScript audit. Keep dual-write in `reconcileItems` so the next developer can grep for it.
- **RLS bypass via service role for override logging.** Events are user-scoped; use the user's authenticated Supabase client, never `SUPABASE_SERVICE_ROLE_KEY`.
- **Chip component reinvention.** Phase 19's `Chip kind='display'` is the primitive. Write a `LocationChip` wrapper, not a from-scratch chip.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chip component | New rounded pill | Phase 19 `<Chip kind='display' leadingIcon={…} />` | Already token-driven, test-covered, visually matches the rest of the app. |
| Bottom sheet | `react-native-bottom-sheet` dep | React Native `Modal` + slide animation (copy `BulkImportSheet.tsx`) | Phases 7/13 proved native Modal is fine. No new dep. |
| Hybrid classifier scaffolding | New architecture | Copy `ingredientCategories.ts` → rename + new static map + new enum | One-hour work; full test pattern mirrors. |
| AI tool schema wire-up | New task route | Extend `foodItemsSchema` in `vision.ts`; reuse `vision.pantryScan` task | Same model, same provider — no routing added. |
| Dual-write | Trigger | Single line in `reconcileItems` that writes both `source_location` column AND `item_attributes->>source_location` | Grep-visible, test-able. |
| Location icon mapping | New constant | `PantryItemCard` already has `LOCATION_SYMBOLS` — export it from a shared module | Don't fork the icon map. |

**Key insight:** Phase 18 is 90% reuse. The only genuinely new artifacts are: migrations (×2), `itemLocation.ts` (mirror), `LocationChip.tsx` + `LocationChoiceSheet.tsx` (wrappers), and `/api/v1/pantry/override-events` route.

## Answers to 16 Planning-Critical Unknowns

### Q1. Static map seed content (~150 ingredient → location)

Organized by category. Defaults are US-household conventions. Edge cases noted.

```typescript
// packages/server/src/services/itemLocation.ts
export const LOCATION_STATIC_MAP: Record<string, SourceLocation> = {
  // === FRIDGE (60 entries) ===
  // Dairy
  milk: 'fridge',
  'whole milk': 'fridge',
  'skim milk': 'fridge',
  'almond milk': 'fridge',          // opened — unopened shelf-stable, but user scan implies opened
  'oat milk': 'fridge',
  butter: 'fridge',                 // edge case: salted butter can live out; US default = fridge
  'salted butter': 'fridge',
  'unsalted butter': 'fridge',
  cheese: 'fridge',
  cheddar: 'fridge',
  mozzarella: 'fridge',
  parmesan: 'fridge',
  feta: 'fridge',
  ricotta: 'fridge',
  'cream cheese': 'fridge',
  'cottage cheese': 'fridge',
  yogurt: 'fridge',
  'greek yogurt': 'fridge',
  'sour cream': 'fridge',
  cream: 'fridge',
  'heavy cream': 'fridge',
  'half and half': 'fridge',

  // Eggs + protein
  egg: 'fridge',                    // edge case: UK/EU stores on counter; US = fridge (app is US-first)
  eggs: 'fridge',
  chicken: 'fridge',                // fresh — frozen variant below
  'chicken breast': 'fridge',
  'chicken thigh': 'fridge',
  beef: 'fridge',
  'ground beef': 'fridge',
  steak: 'fridge',
  pork: 'fridge',
  'pork chop': 'fridge',
  bacon: 'fridge',
  sausage: 'fridge',
  turkey: 'fridge',
  'ground turkey': 'fridge',
  lamb: 'fridge',
  ham: 'fridge',
  prosciutto: 'fridge',
  deli: 'fridge',
  'deli meat': 'fridge',

  // Fresh seafood
  salmon: 'fridge',
  tuna: 'fridge',                   // fresh; canned goes to pantry
  cod: 'fridge',
  tilapia: 'fridge',
  shrimp: 'fridge',                 // fresh; frozen variant below
  'fresh shrimp': 'fridge',

  // Produce that refrigerates in US
  lettuce: 'fridge',
  spinach: 'fridge',
  kale: 'fridge',
  arugula: 'fridge',
  romaine: 'fridge',
  carrot: 'fridge',
  celery: 'fridge',
  cucumber: 'fridge',
  'bell pepper': 'fridge',
  broccoli: 'fridge',
  cauliflower: 'fridge',
  mushroom: 'fridge',
  cilantro: 'fridge',
  parsley: 'fridge',
  mint: 'fridge',
  dill: 'fridge',
  berry: 'fridge',
  strawberry: 'fridge',
  blueberry: 'fridge',
  raspberry: 'fridge',
  grape: 'fridge',
  lemon: 'fridge',                  // edge case: lemons hold on counter; fridge extends shelf
  lime: 'fridge',

  // Opened condiments (US convention)
  ketchup: 'fridge',                // "refrigerate after opening" label → assume opened
  mayo: 'fridge',
  mayonnaise: 'fridge',
  mustard: 'fridge',
  'hot sauce': 'fridge',            // edge case: many hot sauces are shelf-stable even opened; default fridge to be safe
  ranch: 'fridge',
  salsa: 'fridge',                  // fresh; jarred shelf-stable but user scan = opened
  hummus: 'fridge',
  pesto: 'fridge',                  // jarred refrigerate after opening
  jam: 'fridge',
  jelly: 'fridge',

  // Misc refrigerated
  tofu: 'fridge',
  tempeh: 'fridge',

  // === FREEZER (25 entries) ===
  'ice cream': 'freezer',
  'frozen pea': 'freezer',
  'frozen peas': 'freezer',
  'frozen corn': 'freezer',
  'frozen berry': 'freezer',
  'frozen berries': 'freezer',
  'frozen fruit': 'freezer',
  'frozen pizza': 'freezer',
  'frozen vegetable': 'freezer',
  'frozen vegetables': 'freezer',
  'frozen chicken': 'freezer',
  'frozen shrimp': 'freezer',
  'frozen fish': 'freezer',
  'frozen dinner': 'freezer',
  'frozen meal': 'freezer',
  'frozen waffle': 'freezer',
  'frozen waffles': 'freezer',
  'frozen dumpling': 'freezer',
  'frozen dumplings': 'freezer',
  popsicle: 'freezer',
  edamame: 'freezer',               // edge case: counter tokenization 'edamame' = freezer default
  sorbet: 'freezer',
  gelato: 'freezer',

  // === PANTRY (65 entries) ===
  // Grains/baking
  rice: 'pantry',
  'brown rice': 'pantry',
  'white rice': 'pantry',
  pasta: 'pantry',
  spaghetti: 'pantry',
  penne: 'pantry',
  flour: 'pantry',
  sugar: 'pantry',
  'brown sugar': 'pantry',
  salt: 'pantry',
  oat: 'pantry',
  oats: 'pantry',
  quinoa: 'pantry',
  bread: 'pantry',                  // edge case: some users fridge bread; counter/pantry is mainstream US default
  bagel: 'pantry',
  tortilla: 'pantry',               // edge case: opened can go fridge; default pantry
  cereal: 'pantry',
  'baking powder': 'pantry',
  'baking soda': 'pantry',
  'nuts': 'pantry',
  almond: 'pantry',
  walnut: 'pantry',
  pecan: 'pantry',

  // Oils + vinegars (shelf-stable, fridge debate irrelevant for US default)
  oil: 'pantry',
  'olive oil': 'pantry',            // edge case: EU refrigerates extra-virgin; US pantry default
  'vegetable oil': 'pantry',
  'canola oil': 'pantry',
  'sesame oil': 'pantry',           // edge case: some sources say fridge after opening; pantry default matches grocery shelf expectation
  vinegar: 'pantry',
  'balsamic vinegar': 'pantry',

  // Canned + jarred shelf-stable
  'canned tomato': 'pantry',
  'canned tomatoes': 'pantry',
  'tomato sauce': 'pantry',
  'tomato paste': 'pantry',
  'canned beans': 'pantry',
  'black bean': 'pantry',
  chickpea: 'pantry',
  lentil: 'pantry',
  'canned tuna': 'pantry',
  'chicken broth': 'pantry',
  'vegetable broth': 'pantry',
  stock: 'pantry',
  broth: 'pantry',
  coconut: 'pantry',
  'coconut milk': 'pantry',
  'peanut butter': 'pantry',
  honey: 'pantry',
  'maple syrup': 'pantry',          // edge case: once opened, fridge-refrigerate is common; pantry default acceptable
  'soy sauce': 'pantry',

  // Spices
  cumin: 'pantry',
  paprika: 'pantry',
  'black pepper': 'pantry',
  oregano: 'pantry',
  basil: 'pantry',                  // dried; fresh basil would normalize to 'basil' — STATIC_MAP collision accepted (user override 1-tap)
  thyme: 'pantry',
  cinnamon: 'pantry',
  'chili powder': 'pantry',
  turmeric: 'pantry',
  ginger: 'pantry',                 // ground; fresh ginger → fridge but same normalized name → override tap
  rosemary: 'pantry',
  'garlic powder': 'pantry',
  'onion powder': 'pantry',
  'bay leaf': 'pantry',

  // Produce that pantries in US
  onion: 'pantry',
  'red onion': 'pantry',
  garlic: 'pantry',
  shallot: 'pantry',
  potato: 'pantry',
  'sweet potato': 'pantry',
  squash: 'pantry',
  tomato: 'pantry',                 // edge case: ripe tomatoes on counter is the norm; fridge controversial. Default pantry (= counter-adjacent) is least wrong.
  banana: 'pantry',
  apple: 'pantry',                  // edge case: many fridge apples; pantry = "counter bowl" default
  avocado: 'pantry',                // ripens on counter; fridge once ripe. Pantry default.
  mango: 'pantry',
  pineapple: 'pantry',

  // Drinks shelf-stable
  coffee: 'pantry',
  tea: 'pantry',
  wine: 'pantry',                   // edge case: white + rosé → fridge; red → pantry. Default pantry (typical red).
  beer: 'pantry',                   // same — depends. Pantry default.

  // Unambiguous pantry misc
  ramen: 'pantry',
  noodle: 'pantry',
  granola: 'pantry',
  'protein bar': 'pantry',
  cookie: 'pantry',
  cracker: 'pantry',
  chip: 'pantry',
};
```

**Coverage:** ~150 entries (fridge 60 + freezer 25 + pantry 65 ≈ 150). Matches the Phase 8 `STATIC_MAP` size target exactly.

**Token-fallback pattern (from Phase 8):** "organic granny smith apple" → tokens `[organic, granny, smith, apple]` → static hit on `apple` → `pantry`. This covers brand-prefixed and varietal-prefixed misses for free.

**Edge cases documented inline:** tomato (counter vs fridge), eggs (US vs EU), olive oil (US vs EU), butter (salted hold), wine/beer (color-dependent). All resolve 1-tap via the override chip; that's the whole point of the chip.

### Q2. Tool schema extension for Claude calls

**Approach (recommended, Option C per Q4):** Fold `source_location` directly into the existing `foodItemsSchema` so Claude returns it in the same vision round-trip. STATIC_MAP overrides AI output post-call.

**Before (current `foodItemsSchema` in `vision.ts`):**
```typescript
const foodItemsSchema: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Common name of the food item (lowercase, singular)' },
          quantity: { type: 'number', description: 'Estimated quantity (default 1)' },
          unit: { type: 'string', description: 'Unit of measurement' },
          confidence: { type: 'number', description: 'Confidence score 0.0-1.0' },
          category: { type: 'string', enum: [...VALID_CATEGORIES], description: '...' },
        },
        required: ['name', 'quantity', 'unit', 'confidence', 'category'],
      },
    },
  },
  required: ['items'],
};
```

**After:**
```typescript
const SOURCE_LOCATIONS = ['fridge', 'pantry', 'freezer'] as const;

const foodItemsSchema: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Common name of the food item (lowercase, singular)' },
          quantity: { type: 'number', description: 'Estimated quantity (default 1)' },
          unit: { type: 'string', description: 'Unit of measurement' },
          confidence: { type: 'number', description: 'Confidence score 0.0-1.0' },
          category: { type: 'string', enum: [...VALID_CATEGORIES], description: '...' },
          source_location: {
            type: 'string',
            enum: [...SOURCE_LOCATIONS],
            description: 'Where a US household stores this item: "fridge" (refrigerated — dairy, fresh meat/produce, opened condiments), "freezer" (frozen items, ice cream), "pantry" (shelf-stable — canned, dried, spices, oils, packaged). Match the visual cues in the photo when visible (frost → freezer, shelf → pantry).',
          },
        },
        required: ['name', 'quantity', 'unit', 'confidence', 'category', 'source_location'],
      },
    },
  },
  required: ['items'],
};
```

**Ripple changes:**

1. `ScanResult` interface gains `source_location: SourceLocation` (co-located — already `'fridge' | 'pantry' | 'freezer'` elsewhere; define the union in `vision.ts` and re-export).
2. `identifyFoodItems(base64, sourceLocation)` signature drops the `sourceLocation` param entirely. Callers already know they removed the LocationPicker.
3. `identifyFoodItemsBatch(base64Images, existingItemNames)` same — drops `sourceLocation`.
4. `identifyReceiptItems(base64, existingItemNames, variant)` same — drops `sourceLocation`.
5. Prompt templates change `You are analyzing a photo of a ${sourceLocation}` → `You are analyzing a kitchen photo. Identify each item and infer where the user stores it (fridge/pantry/freezer).`
6. `RECEIPT_FILTERING_RULES` and receipt preamble gain the same classification instruction: "For each item, infer where a typical US household stores it."
7. Post-call correction: `items.map(i => ({ ...i, source_location: LOCATION_STATIC_MAP[normalize(i.name)] ?? i.source_location }))` — STATIC_MAP wins.

**Gemini-path divergence:** Not a concern for vision. `analyzeImagesStructured` throws `not implemented` on `GeminiAdapter` (see adapter code) — vision routes go to Anthropic exclusively. For the **classifier fallback path** (`classifyBatchWithAI`, used only when a receipt line item wasn't in the photo — edge case that won't fire for Option C since AI already classified during vision), that DOES hit Gemini Flash Lite via `ingredient.categorize` task and must use the `classifyLocationsTool` schema above. Gemini respects `enum: [...]` on string fields (verified by Phase 8 which uses the identical pattern).

### Q3. Hybrid classifier service shape

`packages/server/src/services/itemLocation.ts`, mirroring `ingredientCategories.ts` 1:1.

**Exports:**
- `LOCATION_STATIC_MAP: Record<string, SourceLocation>` (150 entries, from Q1)
- `classifyLocationStatic(normName: string): SourceLocation | null`
- `classifyBatchWithAI(names: string[]): Promise<Record<string, SourceLocation>>`
- `classifyItems(items: Array<{ normalizedName: string }>): Promise<Record<string, SourceLocation>>`

**Name normalization pitfalls:**

| Pitfall | Input | Normalized by | Result |
|---------|-------|---------------|--------|
| Uppercase | `"MILK"` | `.trim().toLowerCase()` | `"milk"` → hit |
| Plurals | `"eggs"`, `"apples"` | pantryService `normalizeName` (no stripping) | miss unless `"eggs"` is in map; add plurals for common cases (done in seed) |
| Brand prefix | `"organic bananas"` | token fallback | tokens `[organic, bananas]` → miss on `bananas` unless `banana` plural hit; add token-strip (not done) OR include both `banana` + `bananas` (lightweight; recommended) |
| Trailing qualifier | `"milk 2%"` | token fallback | tokens `[milk, 2%]` → hit on `milk` |
| Receipt abbrev | `"CHKN BRST"` | AI prompt already expands (`RECEIPT_FILTERING_RULES`) → `"chicken breast"` | handled upstream |

**Critical normalization rule:** The classifier consumes `normalizedName` from the vision output, which is the AI's already-normalized name ("chicken breast" not "CHKN BRST"). The mobile `pantryStore.mapScanResultsToReview` uses `item.name.trim().toLowerCase()` to dedup-check against pantry. Reuse the same normalization rule in `itemLocation.ts`.

**Test pattern:** Copy `ingredientCategories.test.ts` verbatim, swap schema/seed, add one test per edge case (eggs, olive oil, butter, tomato). 12-test suite target.

### Q4. Where does the classifier plug in? (THE critical design question)

Three options:

**Option A: BEFORE the vision call** — pass known locations into the vision prompt as a seed.
- Pro: AI sees patterns and is consistent.
- Con: Doubles prompt length; requires knowing item names before the AI identifies them (impossible for camera scan); circular.
- Verdict: **Rejected** (circular dependency for photo flows).

**Option B: AFTER vision, separate pass** — vision returns items without location; `classifyItems` runs on the returned names; two round-trips per scan.
- Pro: Clean separation; can reuse `ingredientCategories` call pattern.
- Con: Adds 1-3s per scan (second AI call for unknowns), even though the vision call already saw the items in-context.
- Verdict: **Acceptable fallback** if Option C proves unreliable in practice.

**Option C (RECOMMENDED): Folded into vision tool schema** — location is a field on each returned item; STATIC_MAP applied post-call as a correction.
- Pro: Zero added latency. Single round-trip. Claude has visual context (frost, shelf, cold-storage cues) it can use to improve classification beyond what a name-only classifier could do.
- Con: Slightly larger tool schema (~1 extra token per item in output); model might ignore enum (mitigated by same `coerceCategory`-style post-call guard).
- Verdict: **Recommended.** Mirror: Phase 8's `ingredientCategories` also lives post-AI, but that's because grocery categorization happens at shopping-list generation (no vision context). For vision, Option C wins on latency.

**What Option C looks like in `reconcileItems`:**

```typescript
// Pseudocode addition in pantry.ts
for (const rawItem of items) {
  const normalized = normalizeName(item.name);
  // STATIC_MAP wins over AI
  const inferredLocation =
    classifyLocationStatic(normalized) ?? rawItem.source_location ?? 'pantry';
  // ... insert with source_location=inferredLocation AND item_attributes={source_location: inferredLocation}
}
```

The receipt/Instacart flows get the same treatment — because Option C puts the classification inside the vision call, receipts benefit identically without a separate classifier invocation.

### Q5. `item_attributes` JSONB migration

**File:** `supabase/migrations/00009_item_attributes.sql`

```sql
-- Add forward-compatible item_attributes JSONB column to pantry_items.
-- Phase 18 writes { "source_location": "fridge" } as a dual-write alongside
-- the existing source_location column. Phase 24 migrates readers to this
-- column and drops source_location.

ALTER TABLE pantry_items
  ADD COLUMN item_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- No index in Phase 18. Pantry queries still use source_location (which
-- is indexed). A GIN index on item_attributes is premature until Phase 24
-- migrates readers.

COMMENT ON COLUMN pantry_items.item_attributes IS
  'Forward-compatible item metadata. Phase 18 writes { "source_location": fridge|pantry|freezer }. Phase 24 formalizes schema and may add brand, size_tier, freshness, canonical_ingredient_id, etc. No application-layer Zod validation — shape is documented here and in types/pantry.ts.';
```

**Dual-write pattern (service layer, recommended over trigger):** Update `reconcileItems` in `packages/server/src/services/pantry.ts`:

```typescript
// INSERT path
.insert({
  profile_id: profileId,
  name: item.name.trim(),
  normalized_name: normalized,
  quantity: item.quantity,
  unit: item.unit,
  category: item.category,
  source_location: location,               // existing
  item_attributes: { source_location: location }, // NEW
  confidence: item.confidence,
  status: 'available',
  last_seen_at: new Date().toISOString(),
})

// UPDATE path — merge, don't replace
.update({
  quantity: item.quantity,
  confidence: item.confidence,
  status: 'available',
  last_seen_at: new Date().toISOString(),
  item_attributes: { ...(existing[0].item_attributes ?? {}), source_location: location },
  // source_location unchanged on update — reconcile is keyed on it
})
```

**Index decision:** **No index in Phase 18.** Rationale: all pantry queries continue to use `source_location` column (indexed via `idx_pantry_items_lookup`). A GIN index on `item_attributes` is deferred to Phase 24 when the column becomes the read path.

### Q6. `item_override_events` table migration

**File:** `supabase/migrations/00010_item_override_events.sql`

```sql
-- Append-only event log capturing user corrections to AI-classified source_location.
-- Phase 21 consumes this table to derive user-specific location rules.
-- Immutable: RLS allows SELECT and INSERT only. No UPDATE/DELETE.
-- No FK to pantry_items: item_name is the grouping key, survives item deletion
-- (decouples the event log from pantry-item lifecycle).

CREATE TABLE item_override_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  ai_location TEXT NOT NULL CHECK (ai_location IN ('fridge', 'pantry', 'freezer')),
  user_location TEXT NOT NULL CHECK (user_location IN ('fridge', 'pantry', 'freezer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_override_events_user ON item_override_events(user_id);
CREATE INDEX idx_override_events_user_name ON item_override_events(user_id, item_name);
CREATE INDEX idx_override_events_created ON item_override_events(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE item_override_events ENABLE ROW LEVEL SECURITY;

-- SELECT: users see their own
CREATE POLICY "Users can view own override events"
  ON item_override_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can add their own
CREATE POLICY "Users can insert own override events"
  ON item_override_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy (table is append-only).
-- No DELETE policy (events are immutable).

COMMENT ON TABLE item_override_events IS
  'Append-only log of user corrections to AI-inferred source_location. Phase 21 consumes this to derive per-user location rules. Phase 24 may join canonical_ingredient_id.';
```

**Why no FK to pantry_items:** `item_name` is the rollup key for Phase 21 rule inference. If a user deletes a pantry item, we still want the override signal retained ("user historically moves 'avocado' to fridge"). Decoupled by design.

### Q7. Review screen `LocationChip` component

**File:** `apps/mobile/src/components/pantry/LocationChip.tsx`

```typescript
import React from 'react';
import { Pressable } from 'react-native';
import { Chip } from '../ui/Chip';
import type { SourceLocation } from '../../types/pantry';

const LABELS: Record<SourceLocation, string> = {
  fridge: 'Fridge',
  pantry: 'Pantry',
  freezer: 'Freezer',
};

const ICONS: Record<SourceLocation, string> = {
  fridge: 'snowflake',
  pantry: 'archivebox',
  freezer: 'snowflake',
};

interface LocationChipProps {
  value: SourceLocation;
  onPress: () => void;
}

export function LocationChip({ value, onPress }: LocationChipProps) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={`Location: ${LABELS[value]} — tap to change`}>
      <Chip
        kind="display"
        tone="default"
        label={LABELS[value]}
        leadingIcon={ICONS[value] as never}
      />
    </Pressable>
  );
}
```

**Why wrap a Pressable around `<Chip kind='display'>`:** Phase 19's `Chip` only wires `onPress` for `kind='filter'`. Wrapping preserves the display-chip visual language while adding the tap affordance. Cleaner than adding an `onPress` prop to the display variant.

**File:** `apps/mobile/src/components/pantry/LocationChoiceSheet.tsx` — copy `BulkImportSheet.tsx` verbatim, replace the three option icons/labels/nav handlers with `{ value, onSelect }`:

```typescript
export function LocationChoiceSheet({
  visible, currentValue, onSelect, onClose
}: Props) {
  // Modal with slide animation, three Pressable rows (Fridge / Pantry / Freezer),
  // currentValue row has ring-2 border in colors.brand.
  // onSelect(newValue) calls onClose after selection.
}
```

### Q8. Review screen integration

`scan/review.tsx` today (see line 144-150) uses `<ReviewItemRow item={item} onUpdate onRemove />`. To add per-item location:

**Option 1 (RECOMMENDED): Add slot to ReviewItemRow**

Extend `ReviewItemRow.tsx`:
- Add `onLocationPress?: (itemId: string) => void` prop
- Render `<LocationChip value={item.source_location} onPress={() => onLocationPress?.(item.id)} />` between name/subtitle and the confidence badge
- Parent `review.tsx` owns:
  - `const [sheetItemId, setSheetItemId] = useState<string | null>(null)` — which row's sheet is open
  - `const sheetItem = scanResults.find(i => i.id === sheetItemId)`
  - `onLocationPress={(id) => setSheetItemId(id)}`
  - `<LocationChoiceSheet visible={!!sheetItemId} currentValue={sheetItem?.source_location} onSelect={(newLoc) => { handleUpdateItem(sheetItemId, { source_location: newLoc, userEdited: true }); setSheetItemId(null); }} onClose={() => setSheetItemId(null)} />`

**Layout impact:** ReviewItemRow is currently a `flex-row` with checkbox + details (flex-1) + confidence badge + remove. Adding a location chip goes in the details column below the subtitle OR to the right of the subtitle. Given the current "name / quantity unit · category" stack, the chip belongs on its own line under the subtitle — cleanest visually, no width competition.

**Option 2 (rejected):** Separate row below ReviewItemRow with just the chip. Breaks visual grouping; bad.

### Q9. LocationPicker removal mechanics

**Grep inventory (`rg 'LocationPicker' apps/mobile` in-repo):**
```
apps/mobile/src/components/pantry/LocationPicker.tsx   (component)
apps/mobile/src/app/scan/index.tsx                      (import + usage)
apps/mobile/src/app/scan/receipt.tsx                    (import + usage)
```
`scan/instacart.tsx` does NOT import LocationPicker (hardcodes 'pantry' server-side).

**Recommendation: DELETE the component.** Rationale:
- Phase 21 will build a full Settings rules UI, not re-use a picker. A 3-option picker is not a reusable abstraction worth preserving across 3 months of phase drift.
- Leaving the file as dead code invites CLAUDE.md pattern drift (imports reappear).
- File is 63 lines; Phase 21 can re-create a more-appropriate picker if needed.

**Removal blast radius (verified by grep):**
- `apps/mobile/src/app/scan/index.tsx` — delete lines 16 + 39 + 174-184 (LocationPicker JSX block + `selectedLocation` state); delete the `sourceLocation` param passed in navigation (lines 52-55).
- `apps/mobile/src/app/scan/receipt.tsx` — delete lines 6 + 15 + 91-93 (state + JSX); delete `sourceLocation` nav param (line 28).
- `apps/mobile/src/app/scan/instacart.tsx` — already doesn't use picker, but delete `sourceLocation: 'pantry'` nav param (line 24). Review screen no longer consumes it.
- `apps/mobile/src/app/scan/review.tsx` — delete `locationParam`, `sourceLocation` local state (lines 28-33). `confirmScan` signature changes (Q10).

### Q10. Pantry store action signatures

Current signatures (verified in `apps/mobile/src/stores/pantryStore.ts`):

```typescript
startScan: (base64Image, sourceLocation) => Promise<void>
startBatchScan: (base64Images, sourceLocation) => Promise<void>
startReceiptScan: (base64Image, sourceLocation) => Promise<void>
startInstacartImport: (base64Image) => Promise<void>                          // already no sourceLocation
confirmScan: (profileId, sourceLocation) => Promise<void>
```

**New signatures:**

```typescript
startScan: (base64Image) => Promise<void>
startBatchScan: (base64Images) => Promise<void>
startReceiptScan: (base64Image) => Promise<void>
startInstacartImport: (base64Image) => Promise<void>                          // unchanged
confirmScan: (profileId) => Promise<void>                                     // sourceLocation removed; each item carries its own
```

**Blast radius:**
- `apps/mobile/src/app/scan/index.tsx` — `handleSubmitBatch` calls `startBatchScan(photos.map(p=>p.base64))` (drop second arg).
- `apps/mobile/src/app/scan/receipt.tsx` — `startReceiptScan(base64)` (drop second arg).
- `apps/mobile/src/app/scan/review.tsx` — `confirmScan(profile.id)` (drop second arg); `handleConfirm` already has `sourceLocation` only because it reads the route param — both go away.
- `apps/mobile/src/stores/__tests__/pantryStore.test.ts` — signature updates; grep tests and fix.

**Server route changes (`packages/server/src/routes/pantry.ts`):**
- `POST /scan` — body becomes `{ image }` only; drop `source_location` param + validation.
- `POST /scan-batch` — body becomes `{ images }`.
- `POST /scan-receipt` — body becomes `{ image }`.
- `POST /import-instacart` — unchanged (already no `source_location` in body).
- `POST /confirm` — body becomes `{ items, profile_id }`. Each `item` in `items[]` now carries its own `source_location`. `reconcileItems` signature changes to take item-level location (already loops per-item; just read it off the item).
- Fetching `existingItemNames` for dedup used to be filtered by `source_location`; now must fetch across all three locations (or only the one the AI predicted per item). Simplest fix: fetch ALL existing item names regardless of location (dedup is cross-location anyway; "milk" in fridge is the same item as "milk" in pantry for dedup purposes).

### Q11. Camera flow UX change

Currently `scan/index.tsx` renders LocationPicker at the top, then EmptyState with "Take Photo" or photo thumbnails below. With picker removed:

**Specific routing change:** None — the route `/scan` already exists and is the camera-only surface. Just removing the LocationPicker section trims the top of the screen.

**Cold-start UX after removal:** The EmptyState subtitle currently reads `"Take a photo of your ${selectedLocation} and we'll identify what's inside"`. Replace with a location-agnostic string: `"Take photos of your fridge, pantry, or freezer — we'll sort each item automatically."` Still gives the user context about what the feature does without requiring up-front classification.

No need to add a "welcome/help" step — the EmptyState primitive already serves that role.

### Q12. Telemetry for override events

**Recommendation: new API endpoint**, not a direct Supabase RPC call from mobile.

**Reason:** Mobile RPC with RLS works, but:
- Keeps AI/telemetry concerns server-side — easier to swap backing store later (e.g., send to analytics separately).
- Matches the pattern of every other write path (`POST /pantry/confirm`, `POST /shopping/order`, etc. — mobile never writes Supabase directly except for auth session).
- Allows server-side enrichment (e.g., attach `ai_location` source — was it STATIC_MAP or AI?) without mobile coupling.

**Endpoint:** `POST /api/v1/pantry/override-events`

**File:** `packages/server/src/routes/pantry.ts` (add new handler, same file as other pantry routes)

```typescript
pantry.post('/override-events', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    events: Array<{ item_name: string; ai_location: SourceLocation; user_location: SourceLocation }>;
  }>();

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return c.json({ error: 'Missing or empty events array' }, 400);
  }
  // Validate locations
  const validLocs = ['fridge', 'pantry', 'freezer'];
  const rows = body.events
    .filter(e => e.item_name && validLocs.includes(e.ai_location) && validLocs.includes(e.user_location) && e.ai_location !== e.user_location)
    .map(e => ({
      user_id: user.id,
      item_name: e.item_name.trim().toLowerCase(),
      ai_location: e.ai_location,
      user_location: e.user_location,
    }));

  if (rows.length === 0) return c.json({ data: { inserted: 0 } });

  const { error } = await supabase.from('item_override_events').insert(rows);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: { inserted: rows.length } });
});
```

**Mobile wiring:** In `confirmScan` in `pantryStore.ts`:

```typescript
const overrideEvents = scanResults
  .filter(i => i.userEdited && i.aiLocation && i.source_location !== i.aiLocation)
  .map(i => ({ item_name: i.name, ai_location: i.aiLocation!, user_location: i.source_location }));

if (overrideEvents.length > 0) {
  // Fire-and-forget; failure must not block the confirm.
  fetch(`${getApiBaseUrl()}/api/v1/pantry/override-events`, { /* POST events */ })
    .catch(err => console.warn('Override event log failed:', err));
}
```

**`ReviewItem` type extension:**
```typescript
export interface ReviewItem extends ScanResult {
  // ...existing fields...
  aiLocation?: SourceLocation;  // NEW — original AI prediction, unchanged by user edits
}
```

At AI-result mapping time (`mapScanResultsToReview`), copy `source_location` → `aiLocation` so later user edits preserve the original signal.

### Q13. Test strategy

**Per-task `<automated>` verify command template** (no `grep -c` masked patterns):

```yaml
<task id="N">
  <action>...</action>
  <automated>
    cd packages/server && pnpm vitest run src/services/__tests__/itemLocation.test.ts
    cd packages/server && npx tsc --noEmit -p .
  </automated>
  <verify>AI agent reviews test output — classifier covers all edge cases, no tsc errors</verify>
</task>
```

**Test matrix (15 targets):**

| Layer | File | Scope |
|-------|------|-------|
| Server service | `packages/server/src/services/__tests__/itemLocation.test.ts` | STATIC_MAP direct hits, token fallback, AI fallback mocked, edge cases (eggs, olive oil, butter, tomato) |
| Server service | existing `vision.test.ts` | Extended tool schema returns `source_location`; coerces bad enum; receipt + batch paths |
| Server service | existing `pantry.test.ts` (reconcile) | Dual-write populates `item_attributes.source_location`; UPDATE merges attrs; INSERT creates both columns in sync |
| Server route | `packages/server/src/routes/__tests__/pantry.test.ts` | `/scan`, `/scan-batch`, `/scan-receipt`, `/import-instacart` no longer validate `source_location` in body; `/confirm` accepts per-item `source_location`; new `/override-events` inserts/validates |
| Migration | `packages/server/__tests__/pantry.test.ts` (integration) | `item_attributes` column exists with JSONB type + `{}::jsonb` default; `item_override_events` exists with RLS policies (SELECT, INSERT only, blocks UPDATE/DELETE) |
| Mobile store | `apps/mobile/src/stores/__tests__/pantryStore.test.ts` | `startScan`/`startBatchScan`/`startReceiptScan` signatures dropped; `confirmScan(profileId)` per-item location; override events POST'd on dirty confirm |
| Mobile UI (pure) | `apps/mobile/src/components/pantry/__tests__/LocationChip.test.ts` | Pure className resolution — fridge/pantry/freezer → correct label + icon (no RN renderer needed; mirrors `Chip.test.ts`) |
| Mobile UI (pure) | `apps/mobile/src/components/pantry/__tests__/LocationChoiceSheet.test.ts` | Three Pressable rows present; onSelect dispatches correct value; current selection has ring class |
| Mobile screen | `apps/mobile/src/app/scan/__tests__/review.test.ts` (if exists; otherwise helper extraction) | Override detection: edit → `userEdited && source_location !== aiLocation` truth table |
| Integration | existing Maestro flows | Flows 07, 16, 19 rebased (see Q14) |

**Gate commands:**
- Per task: `cd packages/server && pnpm vitest run <narrow test file> && npx tsc --noEmit -p .`
- Per wave: `cd packages/server && pnpm test --run && cd apps/mobile && pnpm test --run && npx tsc --noEmit -p .` (full suite)
- Phase gate: full suite + `maestro test apps/mobile/.maestro/smoke.yaml`

### Q14. Maestro flow impact

**At-risk flows (verified by reading `.maestro/` inventory):**

| Flow | Current scope | Phase 18 impact |
|------|---------------|------------------|
| `07-pantry-add.yaml` | login → Pantry tab → filter tabs (Fridge/Pantry/Freezer) | No impact — tests pantry-tab filter, not scan flow. Filter tabs still exist (pantry tab groups by location). |
| `16-pantry-scan-stub.yaml` | STUB — documents camera unavailable on sim | No test-runnable changes. Update comments noting "LocationPicker removed; flow begins directly at camera." |
| `19-receipt-scan-stub.yaml` | Deep-link to `/scan/receipt` + `/scan/instacart`, assert header + CTA | No impact — flow never asserts on LocationPicker, only on `.*Scan Receipt.*` / `.*Import from Instacart.*` / `.*Take Photo.*` / `.*Choose Screenshot.*`. All still present. |
| `smoke.yaml` | full suite | No impact unless `smoke` includes a scan that taps a location. |

**Action:** No flow rebase needed for functional testing. Comment-only updates on flows 16 + 19 to note the UX change. Consider adding (not required for phase close):
- Optional new flow `24-scan-auto-location.yaml` — stub pattern, deep-link into `/scan/review` with seed data in store via dev-only helper, assert `LocationChip` present. Deferred unless planner sees value.

**Verify:**
```bash
cd apps/mobile && maestro test .maestro/07-pantry-add.yaml
cd apps/mobile && maestro test .maestro/19-receipt-scan-stub.yaml
cd apps/mobile && maestro test .maestro/smoke.yaml
```

### Q15. Phase-specific pitfalls

See § "Common Pitfalls" below.

### Q16. Validation Architecture

See § "Validation Architecture" below — full mandatory section.

## Static Map Seed Content (reference)

See Q1 above — full 150-entry seed with category groupings and edge-case annotations.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `pantry_items.source_location` column has ~all existing user items populated with `fridge`/`pantry`/`freezer`. Phase 18 dual-writes; existing rows unaffected. | None — existing rows get `item_attributes='{}'::jsonb` via default. Phase 24 will backfill `item_attributes.source_location` from the column at a controlled time. |
| **Live service config** | None. Supabase RLS policies and config are code-as-migrations; no drift. | None. |
| **OS-registered state** | None. App-store-distributed binary with no OS-side registration. | None. |
| **Secrets/env vars** | None renamed. `ANTHROPIC_API_KEY` + `GOOGLE_API_KEY` unchanged. No new secrets required. | None. |
| **Build artifacts** | None renamed. `packages/server/dist/`, `apps/mobile/ios/` unaffected by service-layer additions. | Reinstall `node_modules` only if `pnpm-lock.yaml` changes (no new deps expected). |

**Nothing found in any category requiring migration beyond the planned SQL migrations.** Phase 18 is additive — new column, new table, new service file, no deletions of runtime state.

## Common Pitfalls

### Pitfall 1: STATIC_MAP vs AI conflict handling
**What goes wrong:** AI confidently says "fridge" for `olive oil`; STATIC_MAP says `pantry`. If the code uses AI result first, users see inconsistent classifications across scans.
**Why it happens:** No clear authority hierarchy.
**How to avoid:** **STATIC_MAP always wins.** Apply it post-AI as a correction layer in `reconcileItems`. Document this as the one-line rule at the top of `itemLocation.ts`.
**Warning signs:** Users report "it sometimes puts soy sauce in fridge and sometimes pantry."

### Pitfall 2: Name normalization collisions
**What goes wrong:** `"basil"` (dried spice → pantry) and `"fresh basil"` (→ fridge) both normalize to `"basil"` via tokenization; STATIC_MAP resolves to pantry regardless.
**Why it happens:** Static map uses normalized names; qualifier tokens get stripped.
**How to avoid:** Document collisions in STATIC_MAP comments; rely on 1-tap user override. Do not over-engineer a qualifier-aware resolver in Phase 18 (that's Phase 24 canonical-ingredient territory).
**Warning signs:** User has to override `fresh basil` in every scan.

### Pitfall 3: Dual-write drift
**What goes wrong:** A service-layer update patches `source_location` without patching `item_attributes->>source_location`; over time, the columns drift.
**Why it happens:** Future code additions forget the dual-write.
**How to avoid:** Add a unit test on `reconcileItems` asserting the two columns stay equal after insert + update. Add a lint-style grep in the CI gate ensuring every `.update({... source_location: ...})` is paired with `item_attributes`.
**Warning signs:** `item_attributes->>source_location` diverges from `source_location` column in prod data.

### Pitfall 4: Override-event RLS violation
**What goes wrong:** Server code writes to `item_override_events` using the service-role key instead of the user-authenticated Supabase client; events end up in the wrong user's bucket or no bucket.
**Why it happens:** Copy-paste from service-role patterns in other services.
**How to avoid:** Always use `c.get('supabase')` from auth middleware — that's the user-scoped client. Test: insert an event, query as a different user, assert 0 rows returned.
**Warning signs:** Dev sees another user's override events in `select * from item_override_events`.

### Pitfall 5: Gemini tool-schema divergence for fallback classifier
**What goes wrong:** `classifyBatchWithAI` hits Gemini Flash Lite (`ingredient.categorize` route); Gemini occasionally returns `MALFORMED_FUNCTION_CALL` (per `GeminiAdapter` — one retry is built-in); after retry, throws.
**Why it happens:** Gemini SDK is 1.48+ and the function-call path is pre-GA.
**How to avoid:** Wrap `classifyBatchWithAI` in a try/catch; on `MalformedFunctionCallError`, default all unknowns to `'pantry'` with a console.warn. STATIC_MAP already covers ~80% of items; the fallback path is rare.
**Warning signs:** Receipt scan with a novel item name returns 500 instead of a sensible fallback.

### Pitfall 6: Breaking existing pantryStore consumers on signature change
**What goes wrong:** Removing `sourceLocation` param from `startScan(...)` breaks an unnoticed caller.
**Why it happens:** 10+ screens import from `pantryStore`.
**How to avoid:** `rg 'startScan\(' apps/mobile` + `rg 'confirmScan\(' apps/mobile` — audit every call site before the signature change lands. tsc should catch all; run `npx tsc --noEmit` as a Wave 2 gate.
**Warning signs:** Mobile builds but runtime crashes with "sourceLocation is undefined" somewhere.

### Pitfall 7: Camera flow permission flow regression
**What goes wrong:** Removing LocationPicker removes a visible UI element that used to serve as a "lead-in" before the permission dialog. Users tap FAB → immediate permission prompt without context.
**Why it happens:** Picker was an implicit "we're about to use the camera" cue.
**How to avoid:** EmptyState title "Ready to scan your kitchen" and subtitle "Take photos of your fridge, pantry, or freezer…" serve the same warm-up role. Verify on real device (not just simulator) that the permission dialog feels natural post-removal.
**Warning signs:** TestFlight users report confusion about why the app wants camera access.

### Pitfall 8: Tool schema bloat
**What goes wrong:** Adding `source_location` enum to every item in every vision response pushes token count above the `maxTokens` ceiling (4096 for single, 8192 for batch).
**Why it happens:** Each enum value adds ~2 tokens in the tool-use response; an item now costs ~15 tokens instead of ~13.
**How to avoid:** Measure on a 5-photo batch before merging. Current 8192 budget has plenty of headroom (~400 items-worth). Safe.
**Warning signs:** Batch scans start failing with "response truncated" errors.

## Code Examples

### Example 1: Extending `foodItemsSchema` with source_location
```typescript
// packages/server/src/services/vision.ts
// Source: mirrors Phase 8 ingredientCategories enum-constrained pattern
const SOURCE_LOCATIONS = ['fridge', 'pantry', 'freezer'] as const;
export type SourceLocation = (typeof SOURCE_LOCATIONS)[number];

const foodItemsSchema: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          confidence: { type: 'number' },
          category: { type: 'string', enum: [...VALID_CATEGORIES] },
          source_location: {
            type: 'string',
            enum: [...SOURCE_LOCATIONS],
            description: 'Where a US household stores this item. fridge: dairy/fresh/opened condiments. freezer: frozen/ice. pantry: shelf-stable/canned/dried.',
          },
        },
        required: ['name', 'quantity', 'unit', 'confidence', 'category', 'source_location'],
      },
    },
  },
  required: ['items'],
};
```

### Example 2: Post-call STATIC_MAP override in `identifyFoodItems`
```typescript
// packages/server/src/services/vision.ts (post-call transform)
import { classifyLocationStatic } from './itemLocation.js';
import { normalizeName } from './pantry.js';

return (result.items ?? []).map((item) => {
  const normalized = normalizeName(item.name);
  const staticHit = classifyLocationStatic(normalized);
  return {
    ...item,
    category: coerceCategory(item.category),
    source_location: staticHit ?? (isValidLocation(item.source_location) ? item.source_location : 'pantry'),
  };
});
```

### Example 3: Mobile LocationChoiceSheet (copy from BulkImportSheet)
```typescript
// apps/mobile/src/components/pantry/LocationChoiceSheet.tsx
// Source: mirrors apps/mobile/src/components/pantry/BulkImportSheet.tsx pattern
import React from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import type { SourceLocation } from '../../types/pantry';

const OPTIONS: Array<{ value: SourceLocation; label: string; icon: string; subtitle: string }> = [
  { value: 'fridge', label: 'Fridge', icon: 'snowflake', subtitle: 'Dairy, fresh meat, produce' },
  { value: 'pantry', label: 'Pantry', icon: 'archivebox', subtitle: 'Shelf-stable, canned, dried' },
  { value: 'freezer', label: 'Freezer', icon: 'snowflake', subtitle: 'Frozen items, ice cream' },
];

export function LocationChoiceSheet({
  visible, currentValue, onSelect, onClose
}: { visible: boolean; currentValue: SourceLocation; onSelect: (v: SourceLocation) => void; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable onPress={() => {}}>
          <View className="bg-bg rounded-t-3xl p-6 pb-10">
            <View className="w-12 h-1 bg-border rounded-full self-center mb-4" />
            <Text className="text-title font-semibold text-text-primary mb-4">Move to…</Text>
            {OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => { onSelect(opt.value); onClose(); }}
                className={`bg-surface rounded-2xl p-4 flex-row items-center gap-4 mb-3 ${
                  currentValue === opt.value ? 'border-2 border-brand' : 'border border-border'
                }`}
              >
                <View className="w-12 h-12 rounded-full bg-brand/10 items-center justify-center">
                  <SymbolIcon name={opt.icon as never} size={26} tintColor={colors.brand} />
                </View>
                <View className="flex-1">
                  <Text className="text-body font-semibold text-text-primary">{opt.label}</Text>
                  <Text className="text-caption text-text-secondary">{opt.subtitle}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LocationPicker required before scan | AI per-item inference | Phase 18 | Removes 1 tap from every import flow; scales to mixed-location sessions. |
| Receipt hardcoded `source_location='pantry'` | AI fan-out per item | Phase 18 | Grocery hauls auto-distribute across fridge/pantry/freezer. |
| `source_location` as dedicated column | Dual-write to `item_attributes` JSONB | Phase 18 (transitional) / Phase 24 (final) | Forward-compat for arbitrary item metadata. |
| No user-correction telemetry | `item_override_events` append-only log | Phase 18 | Seeds Phase 21 rules UI and Phase 24 learning. |

**Deprecated/outdated:**
- `LocationPicker.tsx` component — slated for deletion. If Phase 21 needs similar UI, build fresh against its final rules schema.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (for migration application) | Local dev migrations | Assumed ✓ (Phase 3-13 migrations applied) | — | Manual `psql` against Supabase connection string. |
| Anthropic API key (`ANTHROPIC_API_KEY`) | Vision tool call | ✓ (existing, unchanged) | — | None — vision is non-degradable. |
| Google API key (`GOOGLE_API_KEY`) | Gemini classifier fallback | ✓ (existing, Phase 11) | — | Default unknowns to `'pantry'` on `MalformedFunctionCallError`. |
| Node 22 LTS | Server runtime | ✓ | 22.x | N/A — required. |
| Expo SDK 55 / RN 0.83 | Mobile | ✓ | 55 / 0.83 | N/A. |
| Maestro 2.4.0 | UAT | ✓ | 2.4.0 | N/A (UAT-only). |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None (Gemini fallback for classifier is structural, not environmental).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Server framework | Vitest 1.x + Hono test client |
| Server config | `packages/server/vitest.config.ts` (existing) |
| Mobile framework | Vitest 1.x (node env; RN components via function-as-component pattern — Phase 15-01 convention) |
| Mobile config | `apps/mobile/vitest.config.ts` (existing; narrows `src/components/!(ui)/**` exclude; helpers accessible) |
| Quick run (server) | `cd packages/server && pnpm vitest run <file>` |
| Quick run (mobile) | `cd apps/mobile && pnpm vitest run <file>` |
| Full suite (server) | `cd packages/server && pnpm test --run` |
| Full suite (mobile) | `cd apps/mobile && pnpm test --run` |
| TypeScript gate | `npx tsc --noEmit -p .` in each package |
| Maestro | `cd apps/mobile && maestro test .maestro/<flow>.yaml` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| Pantry-UX-01 | Vision call returns `source_location` per item across camera/batch | unit | `cd packages/server && pnpm vitest run src/services/__tests__/vision.test.ts -t "source_location"` | ❌ Wave 0 (extend existing) |
| Pantry-UX-01 | `classifyItems` hybrid: static hit, token fallback, AI fallback, unknown default | unit | `cd packages/server && pnpm vitest run src/services/__tests__/itemLocation.test.ts` | ❌ Wave 0 (new file) |
| Pantry-UX-01 | Receipt + Instacart flows include per-item location | unit | `cd packages/server && pnpm vitest run src/services/__tests__/vision.test.ts -t "receipt" -t "instacart_screenshot"` | ❌ Wave 0 (extend) |
| Pantry-UX-02 | LocationChip resolves correct icon + label per value | unit | `cd apps/mobile && pnpm vitest run src/components/pantry/__tests__/LocationChip.test.ts` | ❌ Wave 0 (new file) |
| Pantry-UX-02 | LocationChoiceSheet emits onSelect with correct value; current selection visually distinct | unit | `cd apps/mobile && pnpm vitest run src/components/pantry/__tests__/LocationChoiceSheet.test.ts` | ❌ Wave 0 (new file) |
| Pantry-UX-02 | Review screen: tap chip → sheet open → select → item updated; override flag set | unit (extracted helper) | `cd apps/mobile && pnpm vitest run src/app/scan/__tests__/reviewHelpers.test.ts` | ❌ Wave 0 (new file — extract pure handlers) |
| Pantry-UX-03 | `startScan`/`startBatchScan`/`startReceiptScan` signatures dropped sourceLocation | unit | `cd apps/mobile && pnpm vitest run src/stores/__tests__/pantryStore.test.ts` | ✅ (extend existing) |
| Pantry-UX-03 | TypeScript catches any caller still passing sourceLocation | gate | `cd apps/mobile && npx tsc --noEmit -p . && cd packages/server && npx tsc --noEmit -p .` | ✅ (existing config) |
| Pantry-UX-03 | Scan flow Maestro smoke still green | smoke | `cd apps/mobile && maestro test .maestro/smoke.yaml` | ✅ (rebase comments only) |
| Pantry-UX-04 | STATIC_MAP seeds match expected defaults (dairy→fridge, frozen→freezer, shelf-stable→pantry) | unit | `cd packages/server && pnpm vitest run src/services/__tests__/itemLocation.test.ts -t "STATIC_MAP defaults"` | ❌ Wave 0 |
| Pantry-UX-04 | AI confidence-low items default-to-pantry (shelf-stable bias on unknowns) | unit | `cd packages/server && pnpm vitest run src/services/__tests__/itemLocation.test.ts -t "unknown defaults"` | ❌ Wave 0 |
| Pantry-UX-05 | Single receipt produces items with distinct locations (fridge + pantry + freezer in one response) | unit | `cd packages/server && pnpm vitest run src/services/__tests__/vision.test.ts -t "mixed locations"` | ❌ Wave 0 |
| Pantry-UX-05 | `reconcileItems` dual-writes `item_attributes.source_location` matching `source_location` column | unit | `cd packages/server && pnpm vitest run src/services/__tests__/pantry.test.ts -t "item_attributes"` | ❌ Wave 0 |
| Pantry-UX-05 | Migration applies: `pantry_items.item_attributes` JSONB NOT NULL DEFAULT `'{}'::jsonb`; `item_override_events` table + RLS | integration | `cd packages/server && pnpm vitest run __tests__/pantry.test.ts -t "migration"` | ❌ Wave 0 |
| Pantry-UX-05 | Override events API validates input, inserts on correct user, rejects cross-user reads (RLS) | route test | `cd packages/server && pnpm vitest run src/routes/__tests__/pantry.test.ts -t "override-events"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** task-scoped `pnpm vitest run <file>` + `npx tsc --noEmit -p .`
- **Per wave merge:** full suite for touched packages (`cd packages/server && pnpm test --run` + `cd apps/mobile && pnpm test --run`)
- **Phase gate:** Full server + mobile suites green, all tsc clean, `maestro test .maestro/smoke.yaml` green, `/gsd:verify-work` passes.

### Wave 0 Gaps

- [ ] `packages/server/src/services/itemLocation.ts` — classifier implementation (copy from `ingredientCategories.ts`)
- [ ] `packages/server/src/services/__tests__/itemLocation.test.ts` — 12+ tests (STATIC_MAP hits, token fallback, AI fallback mocked, edge cases)
- [ ] `supabase/migrations/00009_item_attributes.sql` — new column
- [ ] `supabase/migrations/00010_item_override_events.sql` — new table + RLS
- [ ] `apps/mobile/src/components/pantry/LocationChip.tsx` — display chip wrapper
- [ ] `apps/mobile/src/components/pantry/LocationChoiceSheet.tsx` — Modal bottom sheet
- [ ] `apps/mobile/src/components/pantry/__tests__/LocationChip.test.ts` — pure className resolution
- [ ] `apps/mobile/src/components/pantry/__tests__/LocationChoiceSheet.test.ts` — option rendering + onSelect
- [ ] `apps/mobile/src/app/scan/__tests__/reviewHelpers.test.ts` — pure override-detection helper tests
- [ ] Extend `packages/server/src/services/__tests__/vision.test.ts` — cover `source_location` in response + STATIC_MAP override + mixed-location receipts
- [ ] Extend `packages/server/src/services/__tests__/pantry.test.ts` — dual-write assertion on `reconcileItems`
- [ ] Extend `packages/server/src/routes/__tests__/pantry.test.ts` — `/override-events` endpoint tests
- [ ] Extend `apps/mobile/src/stores/__tests__/pantryStore.test.ts` — new signatures + override-event POST on confirm
- [ ] Framework install: none (all present).

## Sources

### Primary (HIGH confidence — in-repo code read during research)
- `packages/server/src/services/vision.ts` — current tool schemas + receipt service (lines 1-259)
- `packages/server/src/services/ingredientCategories.ts` — Phase 8 hybrid template (lines 1-341)
- `packages/server/src/services/pantry.ts` — `reconcileItems` dual-write target (lines 1-127)
- `packages/server/src/routes/pantry.ts` — four scan routes + `/confirm` (lines 1-258)
- `packages/server/src/ai/types.ts` — AIClient interface (77 lines)
- `packages/server/src/ai/adapters/*.ts` — Anthropic + Gemini adapter behaviors
- `packages/server/src/ai/taskRouting.ts` — task→provider map (65 lines)
- `apps/mobile/src/stores/pantryStore.ts` — store signatures (367 lines)
- `apps/mobile/src/app/scan/{index,receipt,instacart,review}.tsx` — current UX
- `apps/mobile/src/components/pantry/{LocationPicker,ReviewItemRow,BulkImportSheet,PantryItemCard}.tsx` — UI primitives
- `apps/mobile/src/components/ui/{Chip,SymbolIcon,chipStyles}.tsx` — Phase 19 primitives
- `apps/mobile/src/design/tokens.ts` — color tokens
- `apps/mobile/src/types/pantry.ts` — current ReviewItem/ScanResult shapes
- `supabase/migrations/00003_pantry_items.sql` — current pantry schema + RLS pattern
- `apps/mobile/.maestro/{07-pantry-add,16-pantry-scan-stub,19-receipt-scan-stub}.yaml` — UAT inventory
- `.planning/phases/18-.../18-CONTEXT.md` — locked decisions
- `.planning/STATE.md` — decision log, Phase 13/14/15/19 completed state

### Secondary (MEDIUM confidence — cross-referenced)
- `.planning/ROADMAP.md` § Phase 18, Phase 21, Phase 24 — boundary lines
- `.planning/phases/{13,14,15,19}-*.md` — predecessor patterns (BulkImportSheet, collapsing headers, SF Symbols, Chip kinds)

### Tertiary (LOW confidence)
- None. Phase 18 is codebase-heavy and every architectural assertion in this doc traces to an in-repo file.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps verified in-repo, versions pinned in package.json.
- Architecture patterns: HIGH — direct mirror of Phase 8 (verified working in prod).
- Data model: HIGH — migration pattern verified in Phases 3-13.
- Tool schema extension: HIGH — exact diff against in-repo `vision.ts`.
- Mobile UX: HIGH — existing primitives verified reusable.
- Override event API: MEDIUM — pattern established (mobile→server→Supabase RLS) but new endpoint; first insertion may surface edge cases in validation.
- STATIC_MAP seed: MEDIUM — 150 entries are defensible US-household defaults but some (butter, eggs, olive oil, tomato) will provoke user overrides regardless of which default we pick. That's expected behavior per CONTEXT decision.
- Pitfalls: HIGH — all grounded in actual in-repo gotchas from predecessor phases (Pitfall 5 from Phase 11 Gemini, Pitfall 6 from Phase 15 tsc sweep, etc.).

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stable domain, no external API changes imminent).
