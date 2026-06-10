import type { AITask } from './types.js';

/**
 * Central model ID map. Keep all vendor model strings in this file so
 * upgrades are a single-file change.
 *
 * TODO: Swap to *-latest aliases when Google promotes Gemini 3.x from preview.
 */
const GEMINI_MODELS = {
  pro: 'gemini-3.1-pro-preview',
  flash: 'gemini-3-flash-preview',
  flashLite: 'gemini-3.1-flash-lite-preview',
} as const;

const ANTHROPIC_MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
  opus: 'claude-opus-4-6',
} as const;

export interface Route {
  provider: 'anthropic' | 'google';
  model: string;
}

export const TASK_ROUTES: Record<AITask, Route> = {
  'vision.pantryScan': { provider: 'anthropic', model: ANTHROPIC_MODELS.sonnet },
  'recipe.parsePhoto': { provider: 'anthropic', model: ANTHROPIC_MODELS.sonnet },
  'recipe.parseUrl': { provider: 'google', model: GEMINI_MODELS.flash },
  // flash-lite: empirically ~3-4x faster than flash on structured recipe gen
  // (live test 2026-06-10: flash 9.2s vs flash-lite 2.6s for the same rich
  // 4-recipe schema). parseText powers /recipes/hydrate (background full-recipe
  // fill) where flash was ~10-14s/recipe; flash-lite drops it to ~3-4s.
  'recipe.parseText': { provider: 'google', model: GEMINI_MODELS.flashLite },
  'suggestions.dinner': { provider: 'google', model: GEMINI_MODELS.flash },
  // Note: gemini-3.1-pro-preview is paid-tier only on Google AI Studio.
  // Using flash here keeps mealPlanner on the free tier; benchmarks suggest
  // Flash 3 handles weekly meal-plan constraint reasoning well.
  // Swap back to GEMINI_MODELS.pro if plan quality regresses.
  'mealPlanner.week': { provider: 'google', model: GEMINI_MODELS.flash },
  // flash-lite: the "Something New" hot path. Live telemetry showed flash at
  // ~23.5s for a light 4-preview /search; the bottleneck is per-call model
  // latency, NOT output size or thinking config (both ruled out by live test
  // 2026-06-10). flash-lite does the same generation 3-4x faster. Swap back to
  // flash if suggestion quality regresses (recipeTextSanitizer still guards CJK).
  'recipe.discovery': { provider: 'google', model: GEMINI_MODELS.flashLite },
  'progression.ambition': { provider: 'google', model: GEMINI_MODELS.flash },
  'progression.variations': { provider: 'google', model: GEMINI_MODELS.flash },
  'shoppingList.variations': { provider: 'google', model: GEMINI_MODELS.flash },
  'cooking.voiceAsk': { provider: 'google', model: GEMINI_MODELS.flashLite },
  'cooking.tips': { provider: 'google', model: GEMINI_MODELS.flashLite },
  'ingredient.categorize': { provider: 'google', model: GEMINI_MODELS.flashLite },
};

/**
 * Exhaustive list of every AITask — tests iterate this to assert the routing
 * map stays in sync with the union type.
 */
export const ALL_TASKS: AITask[] = [
  'vision.pantryScan',
  'recipe.parsePhoto',
  'recipe.parseUrl',
  'recipe.parseText',
  'suggestions.dinner',
  'mealPlanner.week',
  'recipe.discovery',
  'progression.ambition',
  'progression.variations',
  'shoppingList.variations',
  'cooking.voiceAsk',
  'cooking.tips',
  'ingredient.categorize',
];
