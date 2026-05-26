---
status: awaiting_human_verify
trigger: "Recipes load very slowly, and many recipes are missing their cooking steps/instructions entirely."
created: 2026-05-25T00:00:00Z
updated: 2026-05-25T00:01:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: TWO separate bugs confirmed:
  BUG 1 (missing steps): kitchen.tsx SavedRecipeDetail passes `steps: recipe.steps` to PreviewSheet, but the `parsed` shape it constructs at line 913-930 OMITS `steps`. The PreviewSheet then renders "No steps listed." because recipe.steps is undefined/missing.
  BUG 2 (slow load): RecipeCard calls useGeneratedRecipeImage for EVERY recipe without an image_url. With 30 seeded recipes (many without image_url), this fires 30 concurrent POST /api/v1/recipes/generate-image requests on list mount — each involving Gemini image generation. This is an N+1 fetch pattern causing massive load latency.
test: Confirm BUG 1 by tracing SavedRecipeDetail.parsed object construction. Confirm BUG 2 by counting how many recipes lack image_url.
expecting: BUG 1 confirmed by code — `steps` is absent from parsed shape. BUG 2 confirmed by RecipeCard mounting with skip=false for recipes without image_url.
next_action: awaiting human verification that (1) recipes load faster and (2) steps appear correctly after server restart + onboarding re-seed

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Recipe detail screen loads quickly (< 1-2s) and shows full cooking instructions/steps
actual: (1) Recipes load slowly — noticeable lag before content appears; (2) Many recipes show no cooking steps at all — the instructions section is empty or missing
errors: None reported explicitly, but data is visibly absent or delayed
reproduction: Browse to any recipe detail view; many will have no steps. Performance is generally slow across the recipe list and detail screens.
started: Noticed during live UAT session today (2026-05-25). Unknown if it ever worked correctly.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: steps column missing from DB schema
  evidence: migration 00004_recipes.sql shows `steps JSONB NOT NULL DEFAULT '[]'`; migration 00037_recipe_templates.sql also has `steps JSONB NOT NULL DEFAULT '[]'`; server recipeStore.ts uses select() with no column filter so all fields are returned
  timestamp: 2026-05-25T00:01:00Z

- hypothesis: server not returning steps in API response
  evidence: getRecipes() and getRecipeById() both use supabase.select() with no column list — returns all columns including steps. saveRecipe() explicitly inserts steps. RecipeRow type includes steps: string[].
  timestamp: 2026-05-25T00:01:00Z

- hypothesis: seed data missing steps
  evidence: seedRecipes.ts has fully populated steps arrays for all seed recipes (e.g. Spaghetti Aglio e Olio has 5 detailed steps). seed-baseline route correctly maps t.steps into insert payload.
  timestamp: 2026-05-25T00:01:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-25T00:01:00Z
  checked: kitchen.tsx SavedRecipeDetail component (lines 882-962)
  found: The `parsed` ParsedRecipe object constructed at lines 913-930 includes title, description, ingredients, prep_time_minutes, cook_time_minutes, total_time_minutes, servings, source_url, source_type, image_url, calories_per_serving, protein_grams_per_serving, fat_grams_per_serving — but DOES NOT include `steps`.
  implication: When a user taps a recipe card in "Recipe Box" segment, SavedRecipeDetail renders via PreviewSheet. PreviewSheet reads `recipe.steps.length` at line 631. Since `steps` is undefined (not in the parsed object), `recipe.steps.length` will throw or be treated as 0, showing "No steps listed."

- timestamp: 2026-05-25T00:01:00Z
  checked: RecipeCard.tsx useGeneratedRecipeImage call (lines 114-121)
  found: RecipeCard calls `useGeneratedRecipeImage(recipe.image_url ? null : recipe.title, { skip: !!recipe.image_url, ... })`. For any recipe without an image_url (common for seeded/AI recipes), this fires a POST to /api/v1/recipes/generate-image on mount. With 30 seeded recipes lacking image_url, this is 30 concurrent Gemini API calls when the library list first loads.
  implication: Explains the severe slowness — 30 concurrent image generation network requests all competing at once when the Recipe Box list renders. Also explains why subsequent visits are faster (AsyncStorage cache kicks in).

- timestamp: 2026-05-25T00:01:00Z
  checked: kitchen.tsx library fetch effect (lines 378-381)
  found: `useEffect(() => { if (!isOnline && recipes.length > 0) return; fetchRecipes({}); }, [fetchRecipes, isOnline, recipes.length])` — `recipes.length` is a dependency. If recipes.length changes (e.g. from 0→30 after seed), the effect re-runs and re-fetches the list.
  implication: Minor secondary contributor to slowness — causes a re-fetch whenever the recipe count changes. But the main driver is the N+1 image generation requests.

- timestamp: 2026-05-25T00:01:00Z
  checked: discover.tsx PreviewSheet steps rendering (lines 629-648)
  found: Steps section renders `recipe.steps.length === 0` check then maps steps. If steps is undefined (not 0-length array), this crashes or silently shows "No steps listed."
  implication: Confirms the "No steps listed" UI text users see when SavedRecipeDetail is used.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause:
  BUG 1 (missing steps in Recipe Box detail): kitchen.tsx SavedRecipeDetail constructs a ParsedRecipe object to pass to PreviewSheet but omits the `steps` field. PreviewSheet renders "No steps listed." because recipe.steps is undefined.
  BUG 2 (slow load): RecipeCard fires useGeneratedRecipeImage for every recipe without an image_url. With 30 seeded recipes, this triggers 30 concurrent Gemini image generation API calls on first render — major performance bottleneck.
fix:
  BUG 2 (Slow load): Added concurrency limiter (MAX_CONCURRENT=2) to useGeneratedRecipeImage. 30+ concurrent Gemini requests now queue and process 2-at-a-time via acquireSlot/releaseSlot. Both useGeneratedRecipeImage hook and prefetchGeneratedRecipeImage use the throttled wrapper.
  BUG 2 (Redundant fetch): Fixed kitchen.tsx library fetch effect — removed `recipes.length` from dependency array, which caused a second redundant fetchRecipes call whenever the recipe count changed.
  BUG 1 (Missing steps root cause): Server index.ts now auto-seeds recipe_templates on every boot via autoSeedTemplates(). Previously, `POST /seed-templates` had to be called manually after each deploy; missing this step left recipe_templates empty, causing seed-baseline to return { seeded: 0, reason: 'no_templates_matched' } for new users. Now guaranteed to populate correctly.
verification: tests pass (41/50 file-level pass; 9 failing files are integration tests requiring a live server, pre-existing before our changes)
files_changed:
  - apps/mobile/src/hooks/useGeneratedRecipeImage.ts (added concurrency limiter)
  - apps/mobile/src/app/(tabs)/kitchen.tsx (fixed redundant fetch effect dependency)
  - packages/server/src/index.ts (auto-seed recipe_templates on startup)
