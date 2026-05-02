---
phase: 6-add-recipe-difficulty
plan: 6
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/00035_recipes_difficulty_skills.sql
  - packages/server/src/services/recipeStore.ts
  - packages/server/src/services/recipeDiscovery.ts
  - packages/server/src/services/mealPlanner.ts
  - packages/server/src/routes/recipes.ts
  - apps/mobile/src/types/recipe.ts
  - apps/mobile/src/types/mealPlan.ts
  - apps/mobile/src/components/plan/dayRowHelpers.ts
  - apps/mobile/src/components/plan/DayRow.tsx
  - apps/mobile/src/app/(tabs)/plan.tsx
  - apps/mobile/src/app/recipes/[id]/index.tsx
  - apps/mobile/src/components/plan/dayRowHelpers.test.ts
autonomous: false
requirements:
  - DIFF-01  # Difficulty enum + practiced_skills + skill_note persisted on recipes
  - DIFF-02  # AI populates difficulty/practiced_skills/skill_note at generation time (mealPlanner + recipeDiscovery)
  - DIFF-03  # Plan day card surfaces difficulty chip + matching-focus skill chip when active focus_theme matches
  - DIFF-04  # Recipe detail surfaces difficulty + all practiced_skills as chips + skill_note as italic line

must_haves:
  truths:
    - "AI-generated recipes (Discover + meal-plan generation) include difficulty (easy|medium|hard), practiced_skills (1-3 from 8-key taxonomy), and skill_note (≤120 chars or null)"
    - "Database recipes table accepts and persists difficulty, practiced_skills (TEXT[]), and skill_note (TEXT) — all nullable so legacy rows still load"
    - "Plan day cards display a difficulty chip when entry.difficulty is non-null"
    - "Plan day cards display a single matching-focus chip ONLY when one of entry.practiced_skills equals currentPlan.focus_theme (case-insensitive); the chip uses warm brand styling (mirrors FocusBanner #FFF4E6 vibe)"
    - "Recipe detail screen shows a difficulty chip (above ingredients), every practiced_skill as a chip, and skill_note as an italic line — only when those fields are populated"
    - "Legacy rows (null fields) render WITHOUT chips — no fallback/default badges appear"
  artifacts:
    - path: "supabase/migrations/00035_recipes_difficulty_skills.sql"
      provides: "Adds difficulty TEXT, practiced_skills TEXT[], skill_note TEXT to recipes table"
      contains: "ALTER TABLE recipes"
    - path: "apps/mobile/src/types/recipe.ts"
      provides: "Recipe + ParsedRecipe gain difficulty, practiced_skills, skill_note fields"
      exports: ["Recipe", "ParsedRecipe"]
    - path: "apps/mobile/src/components/plan/dayRowHelpers.ts"
      provides: "deriveStatusChips emits difficulty + matching-focus chips"
      exports: ["deriveStatusChips", "PRACTICED_SKILLS"]
    - path: "apps/mobile/src/app/recipes/[id]/index.tsx"
      provides: "Recipe detail surfaces difficulty + practiced_skills + skill_note"
  key_links:
    - from: "packages/server/src/services/mealPlanner.ts"
      to: "generateMealPlanTool schema + entryRows insert"
      via: "tool schema additions + entryRows.{difficulty, practiced_skills, skill_note}"
      pattern: "practiced_skills"
    - from: "packages/server/src/services/recipeDiscovery.ts"
      to: "suggestRecipesTool schema + ParsedRecipe mapping"
      via: "tool schema additions + recipeStore.saveRecipe persistence"
      pattern: "practiced_skills"
    - from: "apps/mobile/src/components/plan/DayRow.tsx"
      to: "dayRowHelpers.deriveStatusChips"
      via: "passes entry.difficulty + entry.practiced_skills + currentPlan.focus_theme"
      pattern: "deriveStatusChips"
---

<objective>
Add a "skill scaffolding" layer to recipes — every AI-generated recipe gets a difficulty (Easy/Medium/Hard), 1-3 practiced_skills from the same 8-key taxonomy as FocusPickerSheet, and an optional one-line skill_note. Surface these on plan day cards (difficulty always; matching-focus skill chip when day's recipe practices the active focus_theme) and on recipe detail (difficulty + all practiced_skills + skill_note).

Purpose: Ties the existing weekly "focus theme" intent loop to per-recipe execution. Today the focus theme nudges the AI but the user can't see WHICH recipes are practicing the theme. This plan closes the loop visually so users feel themselves leveling up day by day.

Output: One migration, server-side AI prompt + tool-schema changes, mobile type + UI changes, and an extended unit test for dayRowHelpers covering difficulty + matching-focus chip derivation.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

<!-- Server context -->
@packages/server/src/services/mealPlanner.ts
@packages/server/src/services/recipeDiscovery.ts
@packages/server/src/services/recipeStore.ts
@packages/server/src/routes/recipes.ts

<!-- Mobile context -->
@apps/mobile/src/types/recipe.ts
@apps/mobile/src/types/mealPlan.ts
@apps/mobile/src/components/plan/FocusPickerSheet.tsx
@apps/mobile/src/components/plan/FocusBanner.tsx
@apps/mobile/src/components/plan/DayRow.tsx
@apps/mobile/src/components/plan/dayRowHelpers.ts
@apps/mobile/src/components/ui/Chip.tsx
@apps/mobile/src/app/(tabs)/plan.tsx
@apps/mobile/src/app/recipes/[id]/index.tsx

<!-- Reference migration (latest applied) -->
@supabase/migrations/00034_meal_plan_entries_full_recipe.sql

<interfaces>
<!-- Canonical 8-key practiced-skill taxonomy (from FocusPickerSheet.tsx). -->
<!-- The AI MUST pick from these EXACT keys; the matching-focus chip compares -->
<!-- entry.practiced_skills against meal_plans.focus_theme using lowercase compare. -->

```ts
export const PRACTICED_SKILLS = [
  'knife skills',
  'pan sauces',
  'braising',
  'stir-frying',
  'plant-forward',
  'pasta from scratch',
  'global flavors',
  'baking & breads',
] as const;
export type PracticedSkill = (typeof PRACTICED_SKILLS)[number];
```

From apps/mobile/src/types/recipe.ts (current — must extend):
```ts
export interface ParsedRecipe { /* …existing fields… */ }
export interface Recipe { /* …existing fields… */ }
```

From apps/mobile/src/types/mealPlan.ts (current — already has `Difficulty`):
```ts
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface MealPlanEntry {
  // existing fields incl. difficulty: Difficulty | null
  // ADD: practiced_skills?: string[] | null;
  // ADD: skill_note?: string | null;
}
export interface MealPlan {
  focus_theme?: string | null;  // existing
}
```

From apps/mobile/src/components/ui/Chip.tsx:
```ts
export function Chip(props: { label: string; kind: 'display' | 'filter'; tone?: ChipTone; leadingIcon?: SymbolViewProps['name'] });
// ChipTone = 'default' | 'success' | 'warning' | 'destructive' | 'info'
```

From apps/mobile/src/components/plan/dayRowHelpers.ts:
```ts
export interface StatusChipDescriptor { label: string; tone: ChipTone; leadingIcon?: string }
export interface DeriveArgs {
  status: DayRowStatus;
  isStretch?: boolean;
  pantryReady?: boolean;
  entry?: ScoredEntry | null;
  // ADD: difficulty?: 'easy'|'medium'|'hard'|null;
  // ADD: practicedSkills?: string[] | null;
  // ADD: focusTheme?: string | null;
}
export function deriveStatusChips(args: DeriveArgs): StatusChipDescriptor[];
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: DB migration + server-side AI generation (difficulty + practiced_skills + skill_note)</name>
  <files>
    supabase/migrations/00035_recipes_difficulty_skills.sql,
    packages/server/src/services/recipeStore.ts,
    packages/server/src/services/recipeDiscovery.ts,
    packages/server/src/services/mealPlanner.ts,
    packages/server/src/routes/recipes.ts
  </files>
  <action>
    Add per-recipe skill scaffolding end-to-end on the server.

    **1. Migration `supabase/migrations/00035_recipes_difficulty_skills.sql`:**
    ```sql
    -- 00035_recipes_difficulty_skills.sql
    -- Add per-recipe skill scaffolding: difficulty tier + practiced skills
    -- (taxonomy-bound to the 8-key set used by FocusPickerSheet) + an optional
    -- one-line note explaining the skill payoff.
    --
    -- All columns are nullable. Legacy rows continue to load and render
    -- without chips; the AI populates the new fields going forward.

    ALTER TABLE recipes
      ADD COLUMN difficulty TEXT
        CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
      ADD COLUMN practiced_skills TEXT[],
      ADD COLUMN skill_note TEXT;

    -- Helpful for "find recipes practicing X" queries (matching-focus surface,
    -- and any future "skills you've practiced this month" analytics).
    CREATE INDEX idx_recipes_practiced_skills ON recipes USING GIN (practiced_skills);
    ```
    Run via `pnpm --filter server supabase db push` if a Supabase CLI is wired; otherwise note in summary that the user must apply migration via their existing flow (per CLAUDE.md, never run destructive DB ops without explicit approval — but ALTER TABLE ADD COLUMN nullable is safe + reversible). Do NOT run the migration automatically; just create the file.

    **2. `packages/server/src/services/recipeStore.ts`:**
    - Extend `RecipeRow` with `difficulty: 'easy'|'medium'|'hard'|null`, `practiced_skills: string[] | null`, `skill_note: string | null`.
    - Extend `saveRecipe()` to insert these three fields from the incoming `ParsedRecipe` (use `recipe.difficulty ?? null`, `recipe.practiced_skills ?? null`, `recipe.skill_note ?? null`).
    - The `ParsedRecipe` type is imported from `recipeParser.ts` — extend it there too (mirror the optional-with-null shape used for nutrition fields). Search for `calories_per_serving` in recipeParser.ts and apply the same shape.

    **3. `packages/server/src/services/recipeDiscovery.ts`:**
    - Extend `suggestRecipesSchema` with three new properties on each item:
      - `difficulty`: `{ type: 'string', enum: ['easy', 'medium', 'hard'], description: "Tier based on technique count + active cook time + ingredient count. easy=≤30min, basic technique. medium=30-60min OR one new technique. hard=>60min OR multiple advanced techniques (braise, lamination, fermentation)." }`
      - `practiced_skills`: `{ type: 'array', items: { type: 'string', enum: ['knife skills', 'pan sauces', 'braising', 'stir-frying', 'plant-forward', 'pasta from scratch', 'global flavors', 'baking & breads'] }, minItems: 1, maxItems: 3, description: "1-3 skills this recipe genuinely exercises. Pick from the EXACT 8-key list — do not invent new keys." }`
      - `skill_note`: `{ type: 'string', description: "One short line (≤120 chars) explaining the technique payoff, e.g. 'Practices fond → reduction → mounted butter'. Optional — omit when there's no specific technique to call out." }`
    - Add `difficulty` and `practiced_skills` to the `required` array (skill_note stays optional).
    - In `buildDiscoveryPrompt`, append a short SKILL TAGGING block after SOFT PREFERENCES:
      ```
      SKILL TAGGING (every recipe MUST tag these):
      - difficulty: pick "easy" | "medium" | "hard". easy = ≤30min, basic technique. medium = 30-60min OR one new technique. hard = >60min OR advanced technique (braise, fresh pasta, lamination).
      - practiced_skills: 1-3 keys from EXACTLY this set: knife skills, pan sauces, braising, stir-frying, plant-forward, pasta from scratch, global flavors, baking & breads. Match what the recipe genuinely exercises — don't tag "knife skills" on something that's just chop-and-toss.
      - skill_note: optional one-line explanation of the technique payoff (e.g. "Practices fond → reduction → mounted butter"). Omit when there's no specific technique to call out.
      ```
    - In the function that maps the AI tool output → ParsedRecipe (search for `recipes.map` or wherever `suggestRecipesTool` results are normalized), pass through `difficulty`, `practiced_skills`, and `skill_note`. Validate practiced_skills against the 8-key allowlist; drop invalid keys silently (don't fail the whole recipe).

    **4. `packages/server/src/services/mealPlanner.ts`:**
    - Update `generateMealPlanSchema` (in the `properties` of each `days` item):
      - Add `practiced_skills`: array, items enum to the 8-key taxonomy, minItems 1, maxItems 3.
      - Add `skill_note`: string, optional.
      - `difficulty` is already there — keep it.
      - Add `practiced_skills` to each day's `required` array.
    - In `ClaudeMealDay` interface, add `practiced_skills: string[]` and `skill_note?: string`.
    - In `buildMealPlanPrompt`, append the same SKILL TAGGING block as in recipeDiscovery (right before OUTPUT CONTRACT). When `focusTheme` is set, ADD this guidance: "At least 2 themed recipes MUST include the theme in their practiced_skills array (when the theme matches one of the 8 keys; for free-form custom themes, tag the closest match or omit)."
    - In the `entryRows` map (around line 550), add: `practiced_skills: validateSkills(d.practiced_skills)`, `skill_note: typeof d.skill_note === 'string' && d.skill_note.length > 0 ? d.skill_note.slice(0, 200) : null`. Define `validateSkills` as a top-level helper that filters input to the 8-key allowlist and returns null if empty.
    - In `regenerateDay`, mirror the same patch fields so a single-day regen also gets the new tags.

    **5. `packages/server/src/routes/recipes.ts`:**
    - Add `'difficulty', 'practiced_skills', 'skill_note'` to the `PATCHABLE_FIELDS` const so users can edit these on saved recipes if needed (defensive; keeps PATCH symmetry with other recipe fields).
    - In the `POST /` body acceptance, no validation needed — `saveRecipe` reads these from the body via the extended ParsedRecipe shape.

    **Why these locations:** `recipeDiscovery` covers the "Something New" + library generation path (which calls `saveRecipe` via `POST /recipes`). `mealPlanner` covers the weekly plan path (which inserts directly into `meal_plan_entries` — those rows are now full recipes per recent commit `626ce70`, so practiced_skills/skill_note belong on entries too via `meal_plan_entries` JSONB-flexible columns).

    **Important:** `meal_plan_entries` table separately needs columns for these fields if we want them on plan-only entries. Check migration 00034 — if `meal_plan_entries` already stores `difficulty` (it does, per types), then we need ALTER TABLE for `practiced_skills` and `skill_note` on meal_plan_entries TOO. Add to the same migration:
    ```sql
    ALTER TABLE meal_plan_entries
      ADD COLUMN practiced_skills TEXT[],
      ADD COLUMN skill_note TEXT;
    CREATE INDEX idx_meal_plan_entries_practiced_skills
      ON meal_plan_entries USING GIN (practiced_skills);
    ```
    `meal_plan_entries.difficulty` already exists — confirm by inspecting recent migrations / the existing entryRows insert (the field is referenced unconditionally, so the column exists).

    Do NOT add fallbacks/defaults in the AI parsing layer when fields are missing — let null/empty propagate. Backwards compat: legacy rows have null and the UI hides chips on null (per task 2 & 3).
  </action>
  <verify>
    <automated>cd packages/server && pnpm typecheck && pnpm test -- mealPlanner recipeDiscovery</automated>
  </verify>
  <done>
    - Migration file exists at `supabase/migrations/00035_recipes_difficulty_skills.sql` with ALTER TABLE for both `recipes` and `meal_plan_entries` adding `difficulty` (recipes only), `practiced_skills`, `skill_note`, plus GIN indexes.
    - `RecipeRow` (recipeStore.ts) and `ParsedRecipe` (recipeParser.ts) include the three new fields.
    - `suggestRecipesSchema` and `generateMealPlanSchema` declare difficulty + practiced_skills (enum-bound to 8 keys) + skill_note; difficulty + practiced_skills are required, skill_note optional.
    - `buildDiscoveryPrompt` and `buildMealPlanPrompt` include the SKILL TAGGING instruction block.
    - `saveRecipe` persists the three fields.
    - mealPlanner `entryRows` and `regenerateDay` patch persist the three fields with allowlist filtering.
    - `PATCHABLE_FIELDS` in routes/recipes.ts includes the three field names.
    - `pnpm typecheck` passes; existing mealPlanner/recipeDiscovery tests still pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Mobile types + plan day card UI (difficulty chip + matching-focus chip)</name>
  <files>
    apps/mobile/src/types/recipe.ts,
    apps/mobile/src/types/mealPlan.ts,
    apps/mobile/src/components/plan/dayRowHelpers.ts,
    apps/mobile/src/components/plan/dayRowHelpers.test.ts,
    apps/mobile/src/components/plan/DayRow.tsx,
    apps/mobile/src/app/(tabs)/plan.tsx
  </files>
  <behavior>
    Pure-helper TDD via `dayRowHelpers.test.ts`. Add the following test cases to the existing test file (matrix-extend, don't replace):
    - When `difficulty='easy'` → output chips include `{ label: 'Easy', tone: 'default', leadingIcon: 'gauge.with.dots.needle.33percent' }` (or any chip — exact icon name negotiable, just present a difficulty chip).
    - When `difficulty='medium'` → label 'Medium' chip.
    - When `difficulty='hard'` → label 'Hard' chip.
    - When `difficulty=null` (legacy) → NO difficulty chip in output.
    - When `practicedSkills=['pan sauces']` and `focusTheme='pan sauces'` → output includes a matching-focus chip with label 'Pan sauces' and tone 'warning' (warm brand tone).
    - When `practicedSkills=['pan sauces']` and `focusTheme='knife skills'` (no match) → NO matching-focus chip.
    - When `practicedSkills=['Pan Sauces']` and `focusTheme='pan sauces'` (case mismatch) → matching chip STILL appears (case-insensitive compare).
    - When `practicedSkills=null` → NO matching-focus chip even if focusTheme is set.
    - When `practicedSkills=['knife skills', 'pan sauces']` and `focusTheme='pan sauces'` → exactly ONE matching chip (the matching skill, not all skills).
    - Existing matrix tests for status/stretch/pantry-ready chips MUST still pass unchanged.
  </behavior>
  <action>
    **1. `apps/mobile/src/types/recipe.ts`:**
    Extend `ParsedRecipe` and `Recipe` interfaces with:
    ```ts
    difficulty?: 'easy' | 'medium' | 'hard' | null;
    practiced_skills?: string[] | null;
    skill_note?: string | null;
    ```
    Add a top-of-file exported constant + type:
    ```ts
    export const PRACTICED_SKILLS = [
      'knife skills',
      'pan sauces',
      'braising',
      'stir-frying',
      'plant-forward',
      'pasta from scratch',
      'global flavors',
      'baking & breads',
    ] as const;
    export type PracticedSkill = (typeof PRACTICED_SKILLS)[number];
    ```

    **2. `apps/mobile/src/types/mealPlan.ts`:**
    Extend `MealPlanEntry` with `practiced_skills?: string[] | null;` and `skill_note?: string | null;` (the `difficulty` field is already there).

    **3. `apps/mobile/src/components/plan/dayRowHelpers.ts`:**
    - Extend `DeriveArgs` interface with `difficulty?: 'easy' | 'medium' | 'hard' | null;`, `practicedSkills?: string[] | null;`, `focusTheme?: string | null;`.
    - In `deriveStatusChips`, AFTER status/stretch/pantry-ready/health and BEFORE return:
      ```ts
      // Difficulty chip — always render when set. Tone scales with difficulty.
      if (args.difficulty) {
        const label = args.difficulty[0]!.toUpperCase() + args.difficulty.slice(1);
        const tone: ChipTone =
          args.difficulty === 'hard' ? 'warning' :
          args.difficulty === 'medium' ? 'info' : 'default';
        out.push({ label, tone, leadingIcon: 'gauge.with.dots.needle.33percent' });
      }

      // Matching-focus chip — only when day's recipe practices the active focus.
      // Case-insensitive; only the matched skill is shown (not all skills).
      if (args.practicedSkills && args.practicedSkills.length > 0 && args.focusTheme) {
        const themeLc = args.focusTheme.trim().toLowerCase();
        const match = args.practicedSkills.find((s) => s.toLowerCase() === themeLc);
        if (match) {
          // Title-case for display, e.g. 'pan sauces' → 'Pan sauces'
          const display = match[0]!.toUpperCase() + match.slice(1).toLowerCase();
          out.push({ label: display, tone: 'warning', leadingIcon: 'sparkles' });
        }
      }
      ```
    - The chip iconography choices (`gauge.with.dots.needle.33percent`, `sparkles`) should match SF Symbols already used in the app — `sparkles` is already used for stretch/focus banner so it carries the right "this week's theme" semantics.

    **4. `apps/mobile/src/components/plan/dayRowHelpers.test.ts`:**
    Extend with the test cases listed in the `<behavior>` block. Run RED → confirm failures → implement helper changes → GREEN.

    **5. `apps/mobile/src/components/plan/DayRow.tsx`:**
    - Component currently calls `deriveStatusChips({ status, isStretch, pantryReady, entry })`.
    - Add a `focusTheme?: string | null` prop (optional, default null) to `DayRowProps`.
    - Pass `difficulty: entry.difficulty ?? null`, `practicedSkills: entry.practiced_skills ?? null`, and `focusTheme: focusTheme ?? null` into the deriveStatusChips call.

    **6. `apps/mobile/src/app/(tabs)/plan.tsx`:**
    - The `SwipeableDayRow` props don't currently include focusTheme. Add a passthrough: `SwipeableDayRowProps` gains `focusTheme?: string | null`, and SwipeableDayRow forwards it to DayRow as part of `dayRowProps`. (Edit `apps/mobile/src/components/plan/SwipeableDayRow.tsx` too — add to file list above.)
    - In plan.tsx where `<SwipeableDayRow ...>` is rendered (line ~900), add `focusTheme={currentPlan.focus_theme ?? null}`.

    Note: SwipeableDayRow.tsx must be added to `files_modified` — update the frontmatter on that file too (it's already implied by `<files>` mention, but PLAN.md frontmatter list should include it). Actually, simpler: do the focusTheme pass-through inline in plan.tsx by using existing prop spread, OR edit SwipeableDayRow. Choose simpler: edit SwipeableDayRow to pass focusTheme through the existing `dayRowProps` rest spread (it's already there: `const { entry, onSwap, onCook, onSkip, onLongPress, isDragActive, ...dayRowProps } = props;`). So just add `focusTheme` to SwipeableDayRowProps and DayRowProps and the rest-spread carries it. Update files_modified accordingly.
  </action>
  <verify>
    <automated>cd apps/mobile && pnpm test -- dayRowHelpers && pnpm typecheck</automated>
  </verify>
  <done>
    - `PRACTICED_SKILLS` constant + `PracticedSkill` type exported from types/recipe.ts.
    - `Recipe` and `ParsedRecipe` include `difficulty`, `practiced_skills`, `skill_note` (optional, nullable).
    - `MealPlanEntry` includes `practiced_skills` and `skill_note` (optional, nullable).
    - `deriveStatusChips` emits a difficulty chip when `args.difficulty` is set, and a single matching-focus chip when `args.practicedSkills` contains a skill case-insensitively equal to `args.focusTheme`.
    - All new tests in `dayRowHelpers.test.ts` pass; existing tests still pass.
    - `DayRow` passes the new fields through to the helper; `SwipeableDayRow` forwards `focusTheme` via its existing rest spread.
    - `plan.tsx` wires `currentPlan.focus_theme ?? null` into the row.
    - `pnpm typecheck` passes.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Recipe detail UI (difficulty + practiced_skills + skill_note) + UAT visual confirmation</name>
  <files>
    apps/mobile/src/app/recipes/[id]/index.tsx
  </files>
  <action>
    **Implementation portion (auto):**

    Edit `apps/mobile/src/app/recipes/[id]/index.tsx` to add a "Skills practiced" card (or extend the description section) above the Servings card. The card MUST:
    - Render ONLY when at least one of `recipe.difficulty`, `recipe.practiced_skills`, or `recipe.skill_note` is non-null/non-empty. If all three are absent, render nothing — legacy recipes get no extra section.
    - Show a difficulty chip when `recipe.difficulty` is set (same component + tone mapping as DayRow: easy=default, medium=info, hard=warning).
    - Show every entry in `recipe.practiced_skills` as a chip (tone='default', leadingIcon='sparkles'). Use the same `<Chip kind="display" .../>` component used elsewhere.
    - Show `recipe.skill_note` as italic body text below the chips when present. Use `fontStyle: 'italic'`, color `#7A6651` (matches existing subtle text in this file).

    Suggested JSX pattern (insert AFTER the description `<View style={styles.section}>` block, around line 188, BEFORE the Servings card):
    ```tsx
    {(recipe.difficulty || (recipe.practiced_skills && recipe.practiced_skills.length > 0) || recipe.skill_note) && (
      <View style={styles.card}>
        <Text style={styles.sectionHeading}>Skills practiced</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: recipe.skill_note ? 10 : 0 }}>
          {recipe.difficulty && (
            <Chip
              kind="display"
              tone={recipe.difficulty === 'hard' ? 'warning' : recipe.difficulty === 'medium' ? 'info' : 'default'}
              label={recipe.difficulty[0].toUpperCase() + recipe.difficulty.slice(1)}
              leadingIcon="gauge.with.dots.needle.33percent"
            />
          )}
          {(recipe.practiced_skills ?? []).map((skill) => (
            <Chip
              key={skill}
              kind="display"
              tone="default"
              label={skill[0].toUpperCase() + skill.slice(1).toLowerCase()}
              leadingIcon="sparkles"
            />
          ))}
        </View>
        {recipe.skill_note && (
          <Text style={{ fontSize: 14, color: '#7A6651', fontStyle: 'italic', lineHeight: 20 }}>
            {recipe.skill_note}
          </Text>
        )}
      </View>
    )}
    ```
    Add the `Chip` import: `import { Chip } from '../../../components/ui/Chip';`.

    Run typecheck: `cd apps/mobile && pnpm typecheck` — must pass.

    **UAT portion (human-verify):**

    Per CLAUDE.md UAT section, validate visually on iOS Simulator with Maestro. Use the prebuilt dev client.
  </action>

  <what-built>
    - End-to-end skill-scaffolding feature: AI generates difficulty + practiced_skills + skill_note.
    - DB migration adds the three nullable columns to `recipes` and adds `practiced_skills` + `skill_note` to `meal_plan_entries`.
    - Plan day cards render a difficulty chip on every newly generated entry, plus a matching-focus chip in warm tone when the day's practiced_skills includes the active focus_theme.
    - Recipe detail shows a "Skills practiced" card with difficulty chip + all practiced_skills chips + italic skill_note line. Legacy recipes (no AI tagging) show nothing.
  </what-built>

  <how-to-verify>
    1. **Apply the migration.** From the repo root, run `pnpm supabase db push` (or your usual local migration apply path). Confirm both `recipes` and `meal_plan_entries` tables have the new columns:
       ```sql
       SELECT column_name FROM information_schema.columns
         WHERE table_name = 'recipes' AND column_name IN ('difficulty','practiced_skills','skill_note');
       SELECT column_name FROM information_schema.columns
         WHERE table_name = 'meal_plan_entries' AND column_name IN ('practiced_skills','skill_note');
       ```
       Both queries should return all expected rows.

    2. **Boot the simulator + reinstall the dev client app:**
       ```bash
       xcrun simctl boot "iPhone 17 Pro" || true
       open -a Simulator
       cd apps/mobile
       xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
       ```

    3. **Start backend + Metro** (per CLAUDE.md Dev Environment Startup):
       ```bash
       # Terminal 1
       set -a && source .env && set +a && cd packages/server && pnpm dev
       # Terminal 2
       cd apps/mobile && rm -rf .expo && npx expo start --dev-client --lan --clear
       ```

    4. **In the simulator app:**
       a. Sign in (or use the existing test session if persisted).
       b. Set a weekly focus theme — tap the `Set focus` button on the FocusBanner and pick "Pan sauces" (or any of the 8 taxonomy entries). Confirm regen prompt and tap Regenerate.
       c. Wait for plan generation (10-20s overlay).
       d. **Verify on Plan tab:**
          - Every day card displays a difficulty chip (Easy / Medium / Hard) below the title.
          - At least 1-2 day cards display a warm-toned chip with the focus skill (e.g. "Pan sauces") next to the difficulty chip — these are the days that practice the active focus.
          - Days NOT practicing the focus show difficulty only (no extra chip).
       e. **Tap a day card → opens PreviewSheet or saved-recipe detail.** If it opens the saved-recipe detail (`/recipes/[id]`):
          - "Skills practiced" card appears with difficulty + 1-3 skill chips.
          - skill_note (if AI included one) renders as italic line.
       f. **Open Recipe Box → tap any AI-saved recipe** → Skills practiced card visible.
       g. **Open a legacy recipe (one saved before this feature)** → NO Skills practiced card (legacy null fields).

    5. **Take screenshots** with `xcrun simctl io booted screenshot ~/skills-plan.png` and `~/skills-detail.png`. Attach to summary.

    6. **Maestro smoke** (optional but encouraged):
       ```bash
       cd apps/mobile && maestro test .maestro/smoke.yaml
       ```
       Smoke flow shouldn't regress.

    Report any visual issues (e.g. chip overflow on long titles, color clash with stretch chip when both fire) or behavioral issues (matching-focus chip appearing on a day whose recipe doesn't actually practice the focus).
  </how-to-verify>

  <resume-signal>
    Type "approved" when both Plan tab AND Recipe detail show the chips correctly with a freshly regenerated week. Or describe issues seen (e.g. "matching chip never fires" or "legacy recipe shows empty Skills card").
  </resume-signal>

  <verify>
    <automated>cd apps/mobile && pnpm typecheck</automated>
  </verify>
  <done>
    - "Skills practiced" card renders on `/recipes/[id]` when any of difficulty / practiced_skills / skill_note is set; absent on legacy recipes.
    - Migration applied; recipes + meal_plan_entries have new columns.
    - User has visually confirmed (Plan tab + Recipe detail) on the iOS Simulator and typed "approved".
  </done>
</task>

</tasks>

<verification>

End-to-end checks (user-runnable):
1. AI generation:
   ```bash
   curl -X POST http://localhost:3000/api/v1/recipes/discover \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"prompt":"weeknight pan-seared chicken"}' | jq '.data[0] | {title, difficulty, practiced_skills, skill_note}'
   ```
   MUST return non-null difficulty + ≥1 practiced_skills + (optional) skill_note for every recipe.

2. Plan generation:
   ```bash
   curl -X POST http://localhost:3000/api/v1/meal-plans/generate \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"weekStart":"2026-05-04"}' | jq '.entries[0] | {title, difficulty, practiced_skills, skill_note}'
   ```
   MUST return populated fields on every entry.

3. Mobile chip rendering visually verified at task 3 checkpoint.

4. Regression: existing dayRowHelpers tests + mealPlanner/recipeDiscovery server tests pass.

</verification>

<success_criteria>
- [ ] `00035_recipes_difficulty_skills.sql` exists; user has applied (or noted as pending application).
- [ ] Server `pnpm typecheck` + tests pass with new fields wired through ParsedRecipe / RecipeRow / mealPlanner.
- [ ] Mobile `pnpm typecheck` + dayRowHelpers tests pass.
- [ ] On a freshly regenerated week with focus_theme="pan sauces", every day card shows a difficulty chip; days whose practiced_skills include "pan sauces" show a warm-toned matching-focus chip.
- [ ] Recipe detail screen shows a "Skills practiced" card on AI-generated recipes; absent on legacy recipes.
- [ ] User has typed "approved" at the Task 3 UAT checkpoint.
</success_criteria>

<output>
After completion, create `.planning/quick/6-add-recipe-difficulty-easy-medium-hard-a/6-SUMMARY.md` summarizing:
- Migration file path + the columns added (recipes + meal_plan_entries).
- Schema additions to recipeDiscovery + mealPlanner tools (paste the JSON enum block).
- The `PRACTICED_SKILLS` constant location.
- `dayRowHelpers` chip derivation rules (case-insensitive match; difficulty tone mapping).
- Recipe detail rendering rule (null-suppress).
- Screenshots from the UAT checkpoint (paths).
- Any deferred follow-ups (e.g. "AI sometimes returns 'wok / stir-fry' label vs. 'stir-frying' key — allowlist filter caught it; consider tightening prompt example list").
</output>
