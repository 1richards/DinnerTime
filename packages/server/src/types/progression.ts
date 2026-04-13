// Phase 10: Skill progression shared types (server)
//
// Mirrored on the mobile side at apps/mobile/src/types/progression.ts.
// Server and mobile keep separate copies so they can diverge independently
// (matches the shopping.ts pattern from Phase 08).

/**
 * Aggregated cook stats for a single recipe in a profile's history.
 * Computed in service code (not a DB view) so it stays unit-testable.
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
 * History = recipes the user has already cooked (with cook counts).
 * Candidates = unseen recipes from the user's library to consider.
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
