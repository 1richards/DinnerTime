// Phase 10: Skill progression shared types (mobile mirror)
//
// Intentionally a copy of packages/server/src/types/progression.ts rather
// than a cross-package import. Server and mobile evolve independently
// (matches the shopping.ts mirror pattern from Phase 08).

/**
 * Aggregated cook stats for a single recipe in a profile's history.
 */
export interface RecipeCookStats {
  recipe_id: string;
  title: string;
  cook_count: number;
  last_cooked_at: string; // ISO-8601 timestamp
}

/**
 * A recipe surfaced as an "ambition" suggestion -- something the user
 * has not yet cooked but should plausibly try next based on history.
 */
export interface AmbitionSuggestion {
  recipe_id: string;
  title: string;
  rationale: string;
}

/**
 * Cached Haiku-generated cooking tip for a single step of a recipe.
 */
export interface CookingTip {
  recipe_id: string;
  step_index: number;
  tip: string;
}

/**
 * Request payload for the Claude-backed ambition ranker.
 */
export interface AmbitionRankRequest {
  history: Array<{
    recipe_id: string;
    title: string;
    complexity: number;
    cook_count: number;
  }>;
  candidates: Array<{
    recipe_id: string;
    title: string;
    complexity: number;
  }>;
}
