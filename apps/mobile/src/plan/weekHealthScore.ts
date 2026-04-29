/**
 * Heuristic week-level "health vibe" scorer.
 *
 * Recipes don't carry nutrition data yet, so this scores each entry by
 * keyword-matching the title, description, and ingredient names against
 * categorized lexicons (indulgent, carb-heavy, light/veg-forward, lean
 * proteins). Aggregating across the week surfaces a single chip-friendly
 * label so the user can glance at the planActionsRow and know whether
 * the week is balanced, heavy, light, etc.
 *
 * Limitations to call out:
 *   - Keyword heuristic. "Carbonara" hits indulgent + carb-heavy via
 *     pasta/cream/bacon. "Grilled chicken salad" hits light + lean. Real
 *     nutrition data would obviously be more accurate.
 *   - Treats absent ingredients as neutral, not as evidence either way.
 *   - English-only — wouldn't catch "ratatouille" as veg-forward without
 *     the dish-name lexicon (which it does).
 *
 * Pure / easy to unit test. No imports of stores or RN.
 */

export interface ScoredEntry {
  title: string;
  description?: string | null;
  ingredients?: Array<{ name: string }> | null;
}

export interface WeekHealthScore {
  /** Number of planned (non-empty) entries scored. */
  planned: number;
  /** Aggregate counts per axis. */
  indulgent: number;
  carbs: number;
  light: number;
  lean: number;
  veg: number;
}

const INDULGENT_TOKENS = [
  'butter', 'cream', 'heavy cream', 'cream cheese', 'cheese', 'cheddar',
  'mozzarella', 'parmesan', 'gruyère', 'gruyere', 'brie', 'fontina',
  'ricotta', 'mascarpone',
  'bacon', 'pancetta', 'sausage', 'chorizo', 'lard', 'duck fat',
  'fried', 'deep-fried', 'breaded', 'crispy fried',
  'beef', 'short rib', 'brisket', 'pork belly', 'ribeye',
  'mac and cheese', 'macaroni', 'alfredo', 'carbonara', 'lasagna',
  'pizza', 'pot pie', 'casserole', 'gratin',
];

const CARB_TOKENS = [
  'pasta', 'spaghetti', 'penne', 'fettuccine', 'linguine', 'ravioli',
  'rice', 'fried rice', 'risotto', 'biryani',
  'bread', 'baguette', 'focaccia', 'naan', 'pita', 'tortilla',
  'noodle', 'noodles', 'lo mein', 'pho', 'ramen', 'udon', 'soba',
  'potato', 'mashed potato', 'fries', 'gnocchi', 'dumpling',
  'pancakes', 'waffles', 'biscuit',
];

const LIGHT_TOKENS = [
  'salad', 'bowl', 'grain bowl',
  'grilled', 'roasted', 'baked', 'steamed', 'poached',
  'broth', 'soup', 'consommé',
  'lemon', 'herb', 'lighter', 'fresh',
];

const VEG_TOKENS = [
  'vegetable', 'vegetarian', 'vegan',
  'salad', 'kale', 'spinach', 'arugula', 'broccoli', 'cauliflower',
  'zucchini', 'eggplant', 'asparagus', 'mushroom', 'sprouts',
  'lentil', 'chickpea', 'bean', 'tofu', 'tempeh',
  'avocado', 'tomato', 'cucumber', 'pepper',
  'ratatouille', 'shakshuka', 'curry',
];

const LEAN_PROTEIN_TOKENS = [
  'chicken breast', 'turkey', 'fish', 'salmon', 'cod', 'tilapia',
  'tuna', 'shrimp', 'scallop',
  'tofu', 'tempeh', 'edamame', 'lentil', 'lean ground',
  'egg whites',
];

function countTokens(haystack: string, tokens: string[]): number {
  let hits = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) hits += 1;
  }
  return hits;
}

export function scoreWeekHealth(entries: ScoredEntry[]): WeekHealthScore {
  const score: WeekHealthScore = {
    planned: 0,
    indulgent: 0,
    carbs: 0,
    light: 0,
    lean: 0,
    veg: 0,
  };
  for (const e of entries) {
    if (!e || !e.title) continue;
    score.planned += 1;
    const haystack = [
      e.title,
      e.description ?? '',
      ...(e.ingredients ?? []).map((i) => i.name ?? ''),
    ]
      .join(' ')
      .toLowerCase();
    score.indulgent += countTokens(haystack, INDULGENT_TOKENS);
    score.carbs += countTokens(haystack, CARB_TOKENS);
    score.light += countTokens(haystack, LIGHT_TOKENS);
    score.lean += countTokens(haystack, LEAN_PROTEIN_TOKENS);
    score.veg += countTokens(haystack, VEG_TOKENS);
  }
  return score;
}

export type WeekHealthVerdict =
  | { kind: 'balanced'; label: string; tone: 'success' | 'default' }
  | { kind: 'light'; label: string; tone: 'success' }
  | { kind: 'indulgent'; label: string; tone: 'warning' }
  | { kind: 'carb-heavy'; label: string; tone: 'warning' }
  | { kind: 'veg-forward'; label: string; tone: 'success' }
  | { kind: 'unknown'; label: string; tone: 'default' };

/**
 * Render-friendly verdict from the raw score. Picks the strongest signal
 * and falls back to "Balanced" when no axis dominates.
 */
export function verdictFor(score: WeekHealthScore): WeekHealthVerdict {
  if (score.planned === 0) {
    return { kind: 'unknown', label: 'No meals yet', tone: 'default' };
  }
  // Normalize to per-meal so partial weeks don't skew low.
  const perMeal = {
    indulgent: score.indulgent / score.planned,
    carbs: score.carbs / score.planned,
    light: score.light / score.planned,
    lean: score.lean / score.planned,
    veg: score.veg / score.planned,
  };
  // Indulgent dominance — when the week leans rich more than 1.6 hits
  // per meal AND beats the light/lean signals.
  if (
    perMeal.indulgent >= 1.6 &&
    perMeal.indulgent > perMeal.light + perMeal.lean
  ) {
    return { kind: 'indulgent', label: 'Indulgent week', tone: 'warning' };
  }
  if (perMeal.carbs >= 1.5 && perMeal.carbs > perMeal.veg) {
    return { kind: 'carb-heavy', label: 'Carb-heavy', tone: 'warning' };
  }
  if (
    perMeal.veg >= 1.8 &&
    perMeal.veg > perMeal.indulgent + perMeal.carbs
  ) {
    return { kind: 'veg-forward', label: 'Veg-forward', tone: 'success' };
  }
  if (perMeal.light + perMeal.lean >= 1.5 && perMeal.light + perMeal.lean > perMeal.indulgent) {
    return { kind: 'light', label: 'Light week', tone: 'success' };
  }
  return { kind: 'balanced', label: 'Balanced', tone: 'success' };
}

/**
 * Compare this week's verdict to a prior week's score and produce a
 * trend snippet. Returns null when there's no meaningful trend.
 */
export function trendVs(
  current: WeekHealthScore,
  prior: WeekHealthScore | null,
): string | null {
  if (!prior || prior.planned === 0 || current.planned === 0) return null;
  const currIndulge = current.indulgent / current.planned;
  const priorIndulge = prior.indulgent / prior.planned;
  const delta = currIndulge - priorIndulge;
  if (Math.abs(delta) < 0.4) return null;
  return delta < 0 ? 'lighter than last week' : 'richer than last week';
}
