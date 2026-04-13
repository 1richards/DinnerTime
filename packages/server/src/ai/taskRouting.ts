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
  'recipe.parseText': { provider: 'google', model: GEMINI_MODELS.flash },
  'suggestions.dinner': { provider: 'google', model: GEMINI_MODELS.flash },
  'mealPlanner.week': { provider: 'google', model: GEMINI_MODELS.pro },
  'recipe.discovery': { provider: 'google', model: GEMINI_MODELS.flash },
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
