/**
 * Recipe text sanitization — defends against LLM degeneration that leaks
 * non-Latin (esp. CJK) filler tokens into English recipe fields.
 *
 * Background: all recipe-text generation routes to Gemini Flash preview
 * models (see ai/taskRouting.ts). Preview models occasionally fall into a
 * repetition/degeneration loop and inject CJK tokens mid-string, e.g.
 *   "1 large Yellow onion块"   (块 = "chunk")
 *   "3 large调整 Carrots条"     (调整 = "adjust", 条 = "strip")
 * with the repetition count GROWING down the list. tool_use / structured
 * output constrains the JSON shape but NOT token content inside string
 * values, so this passes straight through unless we scrub it.
 *
 * Strategy: recipe content is English-only by product definition. We strip
 * any CJK / non-Latin script characters from the affected fields, collapse
 * the whitespace they leave behind, and report whether anything was removed
 * so callers can log / surface contamination.
 */

// CJK Unified Ideographs + Extension A, Hiragana, Katakana, Hangul, and the
// CJK symbols/punctuation block. Covers the observed 调整/碎/块/条 leak and
// the broader family of tokens these models degenerate into.
const CJK_AND_NON_LATIN =
  /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿가-힯＀-￯]/g;

/** True if the string contains any CJK / non-Latin-script contamination. */
export function hasCjkContamination(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  CJK_AND_NON_LATIN.lastIndex = 0;
  return CJK_AND_NON_LATIN.test(input);
}

/**
 * Remove CJK / non-Latin characters from a single string and tidy the
 * whitespace they leave behind. Returns the cleaned string. Leaves clean
 * input byte-identical.
 */
export function sanitizeText(input: string): string {
  if (!hasCjkContamination(input)) return input;
  return input
    .replace(CJK_AND_NON_LATIN, '')
    // Collapse runs of whitespace introduced by removals.
    .replace(/\s{2,}/g, ' ')
    // Tidy spaces left before punctuation / dashes.
    .replace(/\s+([—–-])/g, ' $1')
    .trim();
}

export interface SanitizedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

export interface RecipeTextFields {
  title?: string | null;
  description?: string | null;
  ingredients?: Array<{
    name?: string | null;
    quantity?: number | null;
    unit?: string | null;
    notes?: string | null;
  }> | null;
  steps?: Array<string> | null;
}

export interface SanitizeResult<T> {
  value: T;
  /** True if any field was modified. */
  changed: boolean;
}

/**
 * Sanitize the human-readable text fields of a recipe-shaped object
 * (title, description, ingredient name/unit/notes, steps). Numeric fields
 * are passed through untouched. Returns the cleaned object plus a `changed`
 * flag so callers can log contamination events.
 */
export function sanitizeRecipeTextFields<T extends RecipeTextFields>(
  recipe: T,
): SanitizeResult<T> {
  let changed = false;

  const clean = (v: string | null | undefined): string | null | undefined => {
    if (typeof v !== 'string') return v;
    const out = sanitizeText(v);
    if (out !== v) changed = true;
    return out;
  };

  const out: RecipeTextFields = { ...recipe };

  if (typeof out.title === 'string') out.title = clean(out.title) as string;
  if (typeof out.description === 'string') out.description = clean(out.description) ?? null;

  if (Array.isArray(out.ingredients)) {
    out.ingredients = out.ingredients.map((ing) => ({
      ...ing,
      name: typeof ing?.name === 'string' ? (clean(ing.name) as string) : ing?.name,
      unit: typeof ing?.unit === 'string' ? clean(ing.unit) : ing?.unit,
      notes: typeof ing?.notes === 'string' ? clean(ing.notes) : ing?.notes,
    }));
  }

  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((s) =>
      typeof s === 'string' ? (clean(s) as string) : s,
    );
  }

  return { value: out as T, changed };
}
