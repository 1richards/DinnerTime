---
phase: quick-12
plan: 12
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00036_meal_plan_entries_nutrition.sql
  - packages/server/src/__tests__/migrations.test.ts
  - packages/server/src/services/mealPlanner.ts
  - packages/server/src/services/__tests__/mealPlanner.test.ts
  - packages/server/src/routes/meal-plans.ts
  - apps/mobile/src/types/mealPlan.ts
  - apps/mobile/src/app/(tabs)/plan.tsx
autonomous: true
requirements: [QUICK-12]
must_haves:
  truths:
    - "Fresh AI-generated meal plans carry per-serving calories + protein on every entry row (not just on linked saved recipes)."
    - "The 'This Week' weekly average chip in plan.tsx renders for AI-generated weeks with no Recipe Box save needed."
    - "Legacy meal_plan_entries rows (pre-migration) keep loading and rendering; both new fields tolerate NULL."
    - "POST /entries/assign accepts the two new fields and persists them when present."
    - "Single-day regenerate (regenerateDay) preserves the new nutrition fields on the swapped row."
  artifacts:
    - path: "supabase/migrations/00036_meal_plan_entries_nutrition.sql"
      provides: "Adds calories_per_serving INTEGER + protein_grams_per_serving NUMERIC(5,1) to meal_plan_entries (both nullable)."
      contains: "ALTER TABLE meal_plan_entries"
    - path: "packages/server/src/services/mealPlanner.ts"
      provides: "Extended generateMealPlanTool schema + ClaudeMealDay type + entry insert/update payloads to carry nutrition."
    - path: "packages/server/src/routes/meal-plans.ts"
      provides: "/entries/assign body type + entryPayload extended with the two nullable nutrition fields."
    - path: "apps/mobile/src/types/mealPlan.ts"
      provides: "MealPlanEntry interface gains calories_per_serving + protein_grams_per_serving (nullable)."
    - path: "apps/mobile/src/app/(tabs)/plan.tsx"
      provides: "weekNutrition memo prefers entry-level nutrition, falls back to recipeStore lookup."
  key_links:
    - from: "packages/server/src/services/mealPlanner.ts (entryRows insert)"
      to: "meal_plan_entries.calories_per_serving / protein_grams_per_serving"
      via: "Spread of d.calories_per_serving / d.protein_grams_per_serving (?? null) into the row payload"
      pattern: "calories_per_serving:\\s*d\\.calories_per_serving"
    - from: "packages/server/src/services/mealPlanner.ts (regenerateDay patch)"
      to: "meal_plan_entries update statement"
      via: "Same two fields included in the patch object"
      pattern: "calories_per_serving:\\s*replacement\\.calories_per_serving"
    - from: "apps/mobile/src/app/(tabs)/plan.tsx weekNutrition memo"
      to: "entry.calories_per_serving / entry.protein_grams_per_serving"
      via: "Direct read from entry, recipe lookup as fallback only"
      pattern: "e\\.calories_per_serving"
---

<objective>
Extend the meal planner pipeline so AI-generated plan entries carry per-serving nutrition (calories + protein) directly on `meal_plan_entries` rows. The Recipe Box `recipes` table already has these fields (migration 00033); this plan mirrors them onto plan entries so the existing weekly-average chip on the Plan tab (commit f6ae91c) renders for fresh AI-generated weeks too — not only after the user has linked a saved Recipe Box recipe.

Purpose: Close the visible regression where the chip only fires for users who have already saved recipes. Mirrors the recipes-table column shapes/copy from migration 00033.
Output: One migration, schema/test/persistence/route/type/UI updates threaded through the existing planner pipeline. All new columns/types nullable so legacy rows survive.
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@supabase/migrations/00033_recipe_nutrition.sql
@supabase/migrations/00035_recipes_difficulty_skills.sql
@packages/server/src/services/mealPlanner.ts
@packages/server/src/services/recipeParser.ts
@packages/server/src/routes/meal-plans.ts
@packages/server/src/__tests__/migrations.test.ts
@packages/server/src/services/__tests__/mealPlanner.test.ts
@apps/mobile/src/types/mealPlan.ts
@apps/mobile/src/types/recipe.ts
@apps/mobile/src/app/(tabs)/plan.tsx

<interfaces>
<!-- Extracted contracts the executor needs. Use these directly — no codebase exploration. -->

From recipes-table migration 00033 (the shape to mirror):
```sql
ALTER TABLE recipes
  ADD COLUMN calories_per_serving INTEGER,
  ADD COLUMN protein_grams_per_serving NUMERIC(5, 1),
  ADD COLUMN fat_grams_per_serving NUMERIC(5, 1);

COMMENT ON COLUMN recipes.calories_per_serving IS 'Estimated kcal per serving. Populated by Claude at recipe save time. Nullable for legacy rows.';
COMMENT ON COLUMN recipes.protein_grams_per_serving IS 'Estimated grams of protein per serving. NUMERIC(5,1) supports up to 9999.9 g.';
```
For meal_plan_entries we mirror **only calories + protein** (not fat — out of scope; chip only shows kcal + protein).

From recipeParser.ts (the existing AI tool description copy to reuse byte-identical for the planner schema):
```
calories_per_serving: 'Estimated kcal per serving. Best-effort from ingredient list and quantities — omit if uncertain.'
protein_grams_per_serving: 'Estimated grams of protein per serving (whole or 1-decimal). Omit if uncertain.'
```

From mealPlanner.ts ClaudeMealDay (interface to extend, after `skill_note?`):
```typescript
interface ClaudeMealDay {
  // ... existing ...
  practiced_skills?: string[];
  skill_note?: string;
  // NEW:
  calories_per_serving?: number;
  protein_grams_per_serving?: number;
}
```

From mealPlanner.ts entryRows literal (current shape — extend with two new fields, both `?? null`):
```typescript
const entryRows = days.map((d) => ({
  meal_plan_id: newPlanRow.id,
  // ... existing fields ...
  practiced_skills: validatePracticedSkills(d.practiced_skills),
  skill_note: ...,
  kid_friendly: d.kid_friendly,
  why_suggested: d.why_suggested,
  status: 'planned' as const,
  // NEW: insert per-serving nutrition (null when AI omitted)
  calories_per_serving: typeof d.calories_per_serving === 'number' ? d.calories_per_serving : null,
  protein_grams_per_serving: typeof d.protein_grams_per_serving === 'number' ? d.protein_grams_per_serving : null,
}));
```
Same shape applies to `regenerateDay`'s `patch` object (line ~795).

From routes/meal-plans.ts /entries/assign body type (around line 243):
```typescript
let body: {
  date?: string | null;
  day?: number;
  title?: string;
  // ... existing ...
  recipe_id?: string | null;
  // NEW:
  calories_per_serving?: number | null;
  protein_grams_per_serving?: number | null;
};
```
And entryPayload (around line 316) gets the two new fields, defaulting to null.

From mealPlan.ts MealPlanEntry interface (insert after `skill_note?`):
```typescript
export interface MealPlanEntry {
  // ... existing ...
  practiced_skills?: string[] | null;
  skill_note?: string | null;
  // NEW: Quick task 12 — per-serving nutrition mirrored from recipes table.
  calories_per_serving?: number | null;
  protein_grams_per_serving?: number | null;
}
```

From plan.tsx weekNutrition memo (lines 717-741) — the current behavior reads ONLY from cachedRecipes.find(...). New behavior: prefer entry.calories_per_serving / entry.protein_grams_per_serving, fall back to the recipe lookup only when the entry-level value is null/undefined.

Migration test pattern (from migrations.test.ts) — static SQL string assertions:
```typescript
describe('00036_meal_plan_entries_nutrition.sql (static)', () => {
  const sql = readMigration('00036_meal_plan_entries_nutrition.sql');

  it('adds calories_per_serving INTEGER (nullable) to meal_plan_entries', () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+meal_plan_entries/i);
    expect(sql).toMatch(/calories_per_serving\s+INTEGER/i);
  });
  // ...
});
```
Use the same `(static)` describe pattern. Live-DB section is OPTIONAL — skip it; existing 00033/00035 nutrition migrations don't have a live probe either.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migration 00036 + static test assertions</name>
  <files>supabase/migrations/00036_meal_plan_entries_nutrition.sql, packages/server/src/__tests__/migrations.test.ts</files>
  <behavior>
    Static SQL contract (asserted by migrations.test.ts):
    - File exists at supabase/migrations/00036_meal_plan_entries_nutrition.sql
    - ALTERs `meal_plan_entries` table
    - Adds `calories_per_serving INTEGER` (nullable — no NOT NULL on the ADD COLUMN clause)
    - Adds `protein_grams_per_serving NUMERIC(5, 1)` (nullable)
    - Mirrors the column shapes from migration 00033 (recipes table). NUMERIC(5,1) — same precision/scale.
    - Includes COMMENT ON COLUMN for both columns documenting (a) per-serving semantics, (b) "Populated by Claude at meal-plan generation time", (c) "Nullable for legacy rows".
    - Does NOT add fat_grams_per_serving (out of scope — chip shows kcal + protein only).
    - Does NOT include CREATE INDEX (no query path needs one for averages — entries are read in batches by meal_plan_id which is already indexed).
    - Does NOT use NOT NULL anywhere on the new columns.
  </behavior>
  <action>
    1. Create `supabase/migrations/00036_meal_plan_entries_nutrition.sql`:

       ```sql
       -- 00036_meal_plan_entries_nutrition.sql
       -- Per-serving nutrition fields on meal_plan_entries.
       --
       -- Mirrors recipes.calories_per_serving + recipes.protein_grams_per_serving
       -- (added in migration 00033) so AI-generated plan entries carry these
       -- values directly without requiring the user to first save the entry as
       -- a Recipe Box recipe. The "This Week" weekly-average chip in plan.tsx
       -- (added in commit f6ae91c) reads from entry-level fields when present,
       -- falling back to the linked recipe row.
       --
       -- Why nullable: legacy meal_plan_entries rows (pre-this-migration) won't
       -- have values; the AI may also omit the fields when it can't estimate
       -- confidently. Existing flows must keep working with NULL.
       --
       -- Why no fat_per_serving: the Plan-tab chip surfaces only kcal + protein.
       -- Adding fat here would be dead schema; the recipes table already has it
       -- for the recipe detail screen, which is sufficient.

       ALTER TABLE meal_plan_entries
         ADD COLUMN calories_per_serving INTEGER,
         ADD COLUMN protein_grams_per_serving NUMERIC(5, 1);

       COMMENT ON COLUMN meal_plan_entries.calories_per_serving IS 'Estimated kcal per serving. Populated by Claude at meal-plan generation time. Nullable for legacy rows.';
       COMMENT ON COLUMN meal_plan_entries.protein_grams_per_serving IS 'Estimated grams of protein per serving. NUMERIC(5,1) supports up to 9999.9 g. Nullable for legacy rows.';
       ```

    2. Add a static-test describe block to `packages/server/src/__tests__/migrations.test.ts`. Place it after the existing `00029_beta_invites.sql` / `00030_feedback_submissions.sql` / Phase 22 cluster — anywhere reasonable, but add a clear `// ----- Quick task 12 -----` divider comment. The block:

       ```typescript
       describe('00036_meal_plan_entries_nutrition.sql (static)', () => {
         const sql = readMigration('00036_meal_plan_entries_nutrition.sql');

         it('targets meal_plan_entries via ALTER TABLE', () => {
           expect(sql).toMatch(/ALTER\s+TABLE\s+meal_plan_entries/i);
         });

         it('adds calories_per_serving INTEGER (nullable)', () => {
           expect(sql).toMatch(/ADD\s+COLUMN\s+calories_per_serving\s+INTEGER/i);
           // The column declaration line must NOT carry NOT NULL.
           const line = sql.match(/ADD\s+COLUMN\s+calories_per_serving[^,;]*/i)?.[0] ?? '';
           expect(line).not.toMatch(/NOT\s+NULL/i);
         });

         it('adds protein_grams_per_serving NUMERIC(5,1) (nullable)', () => {
           expect(sql).toMatch(/ADD\s+COLUMN\s+protein_grams_per_serving\s+NUMERIC\s*\(\s*5\s*,\s*1\s*\)/i);
           const line = sql.match(/ADD\s+COLUMN\s+protein_grams_per_serving[^,;]*/i)?.[0] ?? '';
           expect(line).not.toMatch(/NOT\s+NULL/i);
         });

         it('does NOT add fat_grams_per_serving (out of scope — chip shows kcal+protein only)', () => {
           const withoutComments = sql
             .split('\n')
             .map((l) => l.replace(/--.*$/, ''))
             .join('\n');
           expect(withoutComments).not.toMatch(/fat_grams_per_serving/i);
         });

         it('does NOT create new indexes or NOT NULL constraints', () => {
           expect(sql).not.toMatch(/CREATE\s+INDEX/i);
           expect(sql).not.toMatch(/NOT\s+NULL/i);
         });

         it('documents both columns via COMMENT ON COLUMN', () => {
           expect(sql).toMatch(/COMMENT\s+ON\s+COLUMN\s+meal_plan_entries\.calories_per_serving/i);
           expect(sql).toMatch(/COMMENT\s+ON\s+COLUMN\s+meal_plan_entries\.protein_grams_per_serving/i);
         });
       });
       ```

    3. Apply the migration to the live Supabase project so PostgREST's schema cache picks up the columns before Task 2 inserts try to write them. Two options:
       - Preferred: run `supabase db push` (or whichever CLI command this project uses — check `package.json` scripts, or look at how 00035 was applied).
       - Fallback: paste the SQL into the Supabase dashboard SQL editor and run it. After applying, run `NOTIFY pgrst, 'reload schema';` in the SQL editor to force-refresh the cache (per CLAUDE.md "PostgREST schema cache" gotcha).

       If neither path is available in the executor's environment, leave a clear comment in the SUMMARY: "Migration committed but not yet applied to live DB — apply via Supabase dashboard before next /generate call".

    4. Do NOT modify migration 00033 or 00034 or 00035 — those are already shipped.
  </action>
  <verify>
    <automated>cd packages/server && pnpm vitest run src/__tests__/migrations.test.ts -t "00036_meal_plan_entries_nutrition"</automated>
  </verify>
  <done>
    - File `supabase/migrations/00036_meal_plan_entries_nutrition.sql` exists and matches the spec above.
    - All 6 new test cases in the `00036_meal_plan_entries_nutrition.sql (static)` describe pass.
    - No existing migration tests regress (run the whole `migrations.test.ts` file once to confirm).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend planner tool schema, ClaudeMealDay, and BOTH server insert paths (generate + regenerate + /entries/assign)</name>
  <files>packages/server/src/services/mealPlanner.ts, packages/server/src/services/__tests__/mealPlanner.test.ts, packages/server/src/routes/meal-plans.ts</files>
  <behavior>
    - generateMealPlanTool's per-day schema includes `calories_per_serving` (number) and `protein_grams_per_serving` (number) properties with descriptions copied byte-identical from recipeParser.ts (lines 76-77).
    - Both new fields are OPTIONAL on the per-day schema (NOT in the `required` list) — Claude can omit them when it can't estimate confidently. This matches the recipeParser pattern.
    - ClaudeMealDay TS interface gains both fields as `?: number`.
    - `entryRows` in `generateMealPlan` (line ~611) inserts both fields per row, coerced to null when the AI omits or returns a non-number.
    - `patch` in `regenerateDay` (line ~795) includes both fields, same null-coercion, so swapped days don't lose the nutrition.
    - `/entries/assign` body type accepts the two new fields as `number | null`, and `entryPayload` writes them (defaulting to null when absent).
    - Existing tests still pass — including the existing `generateMealPlanTool` and `generateMealPlan` describe blocks. The mock day fixtures intentionally omit the new fields to prove legacy AI output (no nutrition) still inserts cleanly with null values.
    - Two new test cases in `generateMealPlanTool` describe:
      1. Schema's per-day `properties` includes `calories_per_serving` + `protein_grams_per_serving` with `type: 'number'` and a non-empty description.
      2. Neither field appears in the per-day `required` list (they're optional — Claude can omit when uncertain).
  </behavior>
  <action>
    1. **packages/server/src/services/mealPlanner.ts** — Extend `generateMealPlanSchema`:

       Inside the per-day `properties` object (where `practiced_skills` and `skill_note` are defined), add — keeping the existing comment style:
       ```typescript
       // Quick task 12 — per-serving nutrition. Mirrors the recipes table
       // (migration 00033) and the parse_recipe tool's existing fields. Both
       // optional — Claude omits when it can't estimate confidently.
       calories_per_serving: {
         type: 'number',
         description:
           'Estimated kcal per serving. Best-effort from ingredient list and quantities — omit if uncertain.',
       },
       protein_grams_per_serving: {
         type: 'number',
         description:
           'Estimated grams of protein per serving (whole or 1-decimal). Omit if uncertain.',
       },
       ```

       The existing `required` array for per-day items must NOT change — both new fields stay optional.

    2. Extend the `ClaudeMealDay` interface (around line 366-385) by adding the two fields after `skill_note?: string`:
       ```typescript
       // Quick task 12 — per-serving nutrition (optional in tool output).
       calories_per_serving?: number;
       protein_grams_per_serving?: number;
       ```

    3. In `generateMealPlan`'s `entryRows.map` (around line 611-643), append two fields to each row literal — placement matters for git-diff readability; put them right after `skill_note` and before `kid_friendly` to mirror the type ordering:
       ```typescript
       // Quick task 12 — per-serving nutrition straight from the tool.
       // Coerce to null when the AI omits OR returns a non-number; the
       // INTEGER + NUMERIC(5,1) columns reject strings.
       calories_per_serving:
         typeof d.calories_per_serving === 'number' ? d.calories_per_serving : null,
       protein_grams_per_serving:
         typeof d.protein_grams_per_serving === 'number' ? d.protein_grams_per_serving : null,
       ```

    4. In `regenerateDay`'s `patch` object (around line 795-822), add the same two fields with the same coercion (note: the variable is `replacement`, not `d`):
       ```typescript
       // Quick task 12 — preserve nutrition on day-swap so the chip
       // doesn't lose the value when a single day is regenerated.
       calories_per_serving:
         typeof replacement.calories_per_serving === 'number'
           ? replacement.calories_per_serving
           : null,
       protein_grams_per_serving:
         typeof replacement.protein_grams_per_serving === 'number'
           ? replacement.protein_grams_per_serving
           : null,
       ```

    5. **packages/server/src/services/__tests__/mealPlanner.test.ts** — Inside the existing `describe('generateMealPlanTool', ...)` block (line ~240), add two new `it(...)` cases AFTER Test 2:
       ```typescript
       it('Test 3 (quick-12): per-day properties include calories_per_serving + protein_grams_per_serving as type:number with descriptions', () => {
         const daysSchema = (generateMealPlanTool.schema.properties as Record<string, unknown>)
           .days as { items: { properties: Record<string, { type: string; description: string }> } };
         const cal = daysSchema.items.properties.calories_per_serving;
         const protein = daysSchema.items.properties.protein_grams_per_serving;
         expect(cal).toBeDefined();
         expect(cal.type).toBe('number');
         expect(cal.description.length).toBeGreaterThan(10);
         expect(protein).toBeDefined();
         expect(protein.type).toBe('number');
         expect(protein.description.length).toBeGreaterThan(10);
       });

       it('Test 4 (quick-12): nutrition fields are NOT in the per-day required list (Claude may omit when uncertain)', () => {
         const daysSchema = (generateMealPlanTool.schema.properties as Record<string, unknown>)
           .days as { items: { required: string[] } };
         expect(daysSchema.items.required).not.toContain('calories_per_serving');
         expect(daysSchema.items.required).not.toContain('protein_grams_per_serving');
       });
       ```

    6. **packages/server/src/routes/meal-plans.ts** — `/entries/assign` (around line 239):

       Extend the body type definition (around line 243):
       ```typescript
       let body: {
         // ... existing fields preserved verbatim ...
         recipe_id?: string | null;
         // Quick task 12 — accept entry-level nutrition for non-/generate paths
         // (e.g. assigning a saved Recipe Box recipe to a day, or accepting AI
         // suggestions from Home/Discover that already carry nutrition).
         calories_per_serving?: number | null;
         protein_grams_per_serving?: number | null;
       };
       ```

       Extend `entryPayload` (around line 316), placed after `why_suggested`:
       ```typescript
       const entryPayload = {
         // ... existing fields preserved ...
         why_suggested: body.why_suggested ?? null,
         status: 'planned' as const,
         // Quick task 12 — null-coerce so the upsert always sets the
         // columns explicitly (avoids onConflict skip-update gotchas).
         calories_per_serving:
           typeof body.calories_per_serving === 'number' ? body.calories_per_serving : null,
         protein_grams_per_serving:
           typeof body.protein_grams_per_serving === 'number'
             ? body.protein_grams_per_serving
             : null,
       };
       ```

    7. Do NOT modify the existing `generateMealPlan` describe block in mealPlanner.test.ts — the mock days deliberately omit the new fields, which proves legacy/incomplete AI output still inserts (the test mocks Supabase, so it doesn't hit the live schema cache). If TypeScript complains about `mockDays` not matching the new ClaudeMealDay (it shouldn't, because both fields are optional), that's a real bug to fix in the schema before relaxing the test.

    8. Do NOT touch `buildMealPlanPrompt`'s text — the schema descriptions are sufficient guidance; no need to add a separate "NUTRITION" block to the prose prompt. Claude follows the tool schema strictly.
  </action>
  <verify>
    <automated>cd packages/server && pnpm vitest run src/services/__tests__/mealPlanner.test.ts && pnpm tsc --noEmit</automated>
  </verify>
  <done>
    - generateMealPlanTool schema exposes both new properties; both new mealPlanner.test.ts cases pass.
    - All existing mealPlanner.test.ts cases still pass (generateMealPlan mock-Supabase tests included).
    - `pnpm tsc --noEmit` from `packages/server` reports zero errors (ClaudeMealDay extension, route body type extension, and entry payload extension all type-check).
    - `entryRows` literal contains `calories_per_serving:` and `protein_grams_per_serving:` keys.
    - `patch` literal in `regenerateDay` contains the same two keys.
    - `/entries/assign` body type and entryPayload contain the two new fields.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Mobile types + plan.tsx weekNutrition memo prefer entry-level fields</name>
  <files>apps/mobile/src/types/mealPlan.ts, apps/mobile/src/app/(tabs)/plan.tsx</files>
  <behavior>
    - MealPlanEntry interface gains `calories_per_serving?: number | null` and `protein_grams_per_serving?: number | null`, placed alongside the existing Quick-task 6 extensions block.
    - `weekNutrition` memo in plan.tsx (lines 717-741) prefers the entry-level fields when non-null. Falls back to `cachedRecipes.find(...)` lookup ONLY when the entry-level value is null/undefined. This means:
      - AI-generated entries from a fresh /generate call → chip renders immediately (no Recipe Box save needed).
      - Pre-migration legacy entries with linked recipes → still works (falls back to recipe lookup).
      - Pre-migration legacy entries without recipes → still skipped (returns null from the memo, hides the chip).
    - Memo dependency array stays correct: `[currentPlan?.entries, cachedRecipes]` is sufficient because both branches read from those two sources only.
    - No visual regression: the chip's existing rendering (kcal + g protein, single line) is unchanged. Only the input data path changes.
  </behavior>
  <action>
    1. **apps/mobile/src/types/mealPlan.ts** — Inside the `MealPlanEntry` interface, add the two new fields right after the existing Quick-task 6 extensions (after `skill_note?: string | null`):
       ```typescript
       // ---- Quick task 12 extensions ----
       /**
        * Per-serving calorie estimate from the AI planner. Mirrors
        * recipes.calories_per_serving (migration 00033) for entries that
        * aren't linked to a saved recipe. NULL on legacy rows generated
        * before migration 00036.
        */
       calories_per_serving?: number | null;
       /**
        * Per-serving protein grams from the AI planner. NUMERIC(5,1)
        * server-side, so values arrive as numbers (e.g. 24.5). NULL on
        * legacy rows.
        */
       protein_grams_per_serving?: number | null;
       ```

    2. **apps/mobile/src/app/(tabs)/plan.tsx** — Replace the `weekNutrition` memo body (lines ~717-741) so the lookup prefers entry-level fields. Update both the lookup logic and the comment:

       ```typescript
       // Weekly per-serving nutrition averages.
       //
       // Quick task 12 — Prefer entry-level fields (calories_per_serving,
       // protein_grams_per_serving) populated by /generate after migration
       // 00036. Fall back to the linked recipe row only when the entry
       // doesn't carry the value (legacy plan entries, or assignments
       // from a saved Recipe Box recipe where the entry payload didn't
       // forward the nutrition). Returns null when no entry contributed,
       // hiding the chip entirely.
       const weekNutrition = useMemo<{ kcal: number; protein: number } | null>(() => {
         const entries = currentPlan?.entries ?? [];
         let calorieSum = 0;
         let calorieN = 0;
         let proteinSum = 0;
         let proteinN = 0;
         for (const e of entries) {
           // Calories: entry first, then linked recipe.
           let kcal: number | null | undefined = e.calories_per_serving;
           if (kcal == null && e.recipe_id) {
             const r = cachedRecipes.find((x) => x.id === e.recipe_id);
             kcal = r?.calories_per_serving;
           }
           if (typeof kcal === 'number') {
             calorieSum += kcal;
             calorieN += 1;
           }

           // Protein: entry first, then linked recipe.
           let protein: number | null | undefined = e.protein_grams_per_serving;
           if (protein == null && e.recipe_id) {
             const r = cachedRecipes.find((x) => x.id === e.recipe_id);
             protein = r?.protein_grams_per_serving;
           }
           if (typeof protein === 'number') {
             proteinSum += protein;
             proteinN += 1;
           }
         }
         if (calorieN === 0 && proteinN === 0) return null;
         return {
           kcal: calorieN > 0 ? Math.round(calorieSum / calorieN) : 0,
           protein: proteinN > 0 ? Math.round(proteinSum / proteinN) : 0,
         };
       }, [currentPlan?.entries, cachedRecipes]);
       ```

       Notes:
       - Use `kcal == null` (loose equality with null) to catch BOTH null and undefined in one check. This is the standard pattern in this codebase — same as `r.calories_per_serving != null` in the original.
       - Don't use `??` for the recipe lookup because we need to distinguish "value was present and 0" from "value was absent" — `0` is a valid (if weird) calorie estimate that should still contribute to the average. The explicit `typeof === 'number'` guard handles this.
       - Per-field fallback (instead of all-or-nothing) lets a partial-AI-output entry (e.g. only protein, not calories) still contribute to the protein side of the average.

    3. Do NOT modify the chip's render block (lines 812-822). The visual surface is unchanged.

    4. Do NOT add any new imports — `MealPlanEntry` already flows through `currentPlan.entries`; the new fields are accessed through the existing typed entry object.
  </action>
  <verify>
    <automated>cd apps/mobile && pnpm tsc --noEmit</automated>
  </verify>
  <done>
    - `apps/mobile/src/types/mealPlan.ts` MealPlanEntry has both new optional nullable fields.
    - `weekNutrition` memo in plan.tsx reads `e.calories_per_serving` and `e.protein_grams_per_serving` directly.
    - Mobile typecheck (`pnpm tsc --noEmit` from apps/mobile) passes with zero errors.
    - Existing tests in apps/mobile (if any cover plan.tsx) still pass — run `cd apps/mobile && pnpm test` if a test script exists, otherwise typecheck alone is sufficient (the memo's branching is straightforward and not currently covered).
  </done>
</task>

</tasks>

<verification>
End-to-end check after all 3 tasks:

1. **Server build clean:**
   ```bash
   cd packages/server && pnpm tsc --noEmit && pnpm vitest run
   ```
   Expect: 0 TS errors. All migrations.test.ts + mealPlanner.test.ts pass.

2. **Mobile build clean:**
   ```bash
   cd apps/mobile && pnpm tsc --noEmit
   ```
   Expect: 0 TS errors.

3. **Migration applied to live DB** (one of):
   - `supabase db push` succeeded, OR
   - SQL run in dashboard + `NOTIFY pgrst, 'reload schema';` issued.

4. **Manual smoke** (post-deploy, optional but high-value — only if dev server is running and a test profile has a fresh week):
   - Start server + Metro per CLAUDE.md "Dev Environment Startup".
   - On the iOS simulator, generate a meal plan for an empty week (POST /meal-plans/generate via the Plan tab "Generate this week" CTA).
   - Verify the "This Week" warm-tinted card now shows `Avg N kcal · Mg` directly after generation, with no Recipe Box save step.
   - Spot-check the DB: a row in `meal_plan_entries` for the new plan should have non-null `calories_per_serving` and `protein_grams_per_serving` for at least most days (Claude may legitimately omit on a few).

5. **Legacy regression check:**
   - Open the app on a profile that has a pre-migration plan in history (week_start before today). The chip should either render (recipe-linked entries) or hide (no recipe links) — same as before this plan. No crashes from missing fields.
</verification>

<success_criteria>
- Migration 00036 file exists, mirrors 00033 column shapes (INTEGER + NUMERIC(5,1)), both new columns nullable, COMMENT ON COLUMN populated, no fat_per_serving, no indexes.
- All 6 new static test cases for the migration pass; existing migrations.test.ts cases unchanged.
- `generateMealPlanTool` schema exposes `calories_per_serving` + `protein_grams_per_serving` (both type:number, both optional, both with non-empty descriptions). 2 new mealPlanner.test.ts cases pass.
- `entryRows` (generateMealPlan) AND `patch` (regenerateDay) write both fields with `typeof === 'number'` null-coercion.
- `/entries/assign` body type + entryPayload accept and persist both fields.
- `MealPlanEntry` (mobile) gains both nullable optional fields.
- `weekNutrition` memo in plan.tsx prefers entry-level fields; recipe-store fallback retained for legacy/linked entries.
- `pnpm tsc --noEmit` clean in both `packages/server` and `apps/mobile`.
- Vitest run green across `packages/server`.
- Legacy plan entries (NULL nutrition) load without errors and the chip behaves identically to pre-plan-12 for those weeks (chip hides if no entries contributed; chip renders if recipe-linked entries have nutrition on the recipe row).
</success_criteria>

<output>
After completion, create `.planning/quick/12-extend-mealplanner-to-populate-per-servi/12-SUMMARY.md` documenting:
- Migration number actually used (should be 00036)
- Whether migration was applied live (dashboard / supabase db push / not yet applied — flag clearly if NOT yet applied)
- Files modified (7 total)
- Test counts added (6 migration cases + 2 schema cases = 8 new)
- Any deviations from this plan and the reason
- Next steps if Maestro UAT needed (e.g. "Generate a fresh week on simulator and screenshot the This Week card with the chip rendering").
</output>
