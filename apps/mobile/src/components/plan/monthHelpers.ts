/**
 * Phase 22-03 — monthHelpers.
 *
 * Four pure helpers that drive the Month view:
 *   - buildMonthGrid(fromWeekStart, entriesByIso): 35-cell deterministic
 *     grid starting on Monday of `fromWeekStart`. Each cell carries iso,
 *     dayOfMonth, status, and (optional) entry.
 *   - aggregateProtein(entries): keyword-match bucketing — chicken / beef /
 *     fish / pork / veg / other. Reads title + description + ingredient
 *     names. Fall-through order: chicken → beef → fish → pork → veg.
 *   - aggregateCuisine(entries): keyword-match bucketing — Italian / Mexican
 *     / Japanese / Thai / Indian / Mediterranean / Chinese / American /
 *     other. Reads title + description + ingredient names.
 *   - findRepeats(entries): titles appearing ≥2 times. Case-insensitive,
 *     trimmed, sorted by count descending.
 *
 * Design notes:
 *   - UTC math throughout — avoids DST / timezone drift that would silently
 *     offset cell→entry matching by ±1 day.
 *   - Text-matching aggregation is a pragmatic v1; future phases can upgrade
 *     to semantic matching via Claude or pgvector.
 *   - Keyword tables are exported so tests (and any downstream consumers)
 *     can reference them without re-deriving.
 */
import type { MealPlanEntry } from '../../types/mealPlan';

export type CellStatus = 'cooked' | 'planned' | 'empty' | 'skipped';

export interface MonthCell {
  iso: string; // 'YYYY-MM-DD'
  dayOfMonth: number; // 1..31
  status: CellStatus;
  entry: MealPlanEntry | null;
}

export type ProteinKey = 'chicken' | 'beef' | 'fish' | 'pork' | 'veg' | 'other';

export interface ProteinBucket {
  key: ProteinKey;
  count: number;
}

export interface CuisineBucket {
  key: string;
  count: number;
}

export interface RepeatMeal {
  title: string;
  count: number;
}

// -----------------------------------------------------------------------------
// Keyword tables (exported for downstream re-use + test assertions).
// -----------------------------------------------------------------------------

export const PROTEIN_KEYWORDS: Record<Exclude<ProteinKey, 'other'>, string[]> = {
  chicken: ['chicken', 'chik'],
  beef: ['beef', 'steak', 'burger', 'meatball'],
  fish: ['fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'cod', 'tilapia'],
  pork: ['pork', 'bacon', 'ham', 'sausage', 'chorizo'],
  veg: ['vegetarian', 'tofu', 'bean', 'lentil', 'chickpea', 'mushroom'],
};

export const CUISINE_KEYWORDS: Record<string, string[]> = {
  Italian: ['italian', 'pasta', 'pizza', 'risotto'],
  Mexican: ['mexican', 'taco', 'burrito', 'enchilada', 'fajita'],
  Japanese: ['japanese', 'sushi', 'ramen', 'teriyaki'],
  Thai: ['thai', 'curry', 'pad'],
  Indian: ['indian', 'masala', 'tikka', 'biryani'],
  Mediterranean: ['mediterranean', 'greek', 'hummus', 'falafel'],
  Chinese: ['chinese', 'stir fry', 'lo mein', 'dumpling'],
  American: ['american', 'bbq', 'cornbread'],
};

// Ordered cuisine probe — earlier entries win ties. Burger is intentionally
// dropped from American so it doesn't compete with beef keyword.
const CUISINE_ORDER: string[] = [
  'Italian',
  'Mexican',
  'Japanese',
  'Thai',
  'Indian',
  'Mediterranean',
  'Chinese',
  'American',
];

// -----------------------------------------------------------------------------
// buildMonthGrid — deterministic 5×7 cell grid.
// -----------------------------------------------------------------------------

/** Return a new Date at UTC midnight parsed from a 'YYYY-MM-DD' string. */
function parseIsoUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Slice a Date to its YYYY-MM-DD string (UTC). */
function toIsoUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function entryStatusToCellStatus(status: string | undefined): CellStatus {
  if (status === 'cooked') return 'cooked';
  if (status === 'skipped') return 'skipped';
  if (status === 'planned') return 'planned';
  return 'empty';
}

/**
 * Build a 5×7 cell grid (35 cells) starting at Monday of `fromWeekStart`.
 * Each cell carries its ISO date, day-of-month, status (inherited from
 * entry if present, else 'empty'), and the entry itself (or null).
 *
 * `fromWeekStart` MUST be a Monday in YYYY-MM-DD — callers compose this
 * from `currentPlan.week_start` or equivalent. Callers that need to shift
 * backwards (e.g., "show last month") should pre-subtract days before
 * passing in.
 */
export function buildMonthGrid(
  fromWeekStart: string,
  entriesByIso: Map<string, MealPlanEntry>
): MonthCell[] {
  const start = parseIsoUtc(fromWeekStart);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 35; i += 1) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = toIsoUtc(d);
    const entry = entriesByIso.get(iso) ?? null;
    cells.push({
      iso,
      dayOfMonth: d.getUTCDate(),
      status: entry ? entryStatusToCellStatus(entry.status) : 'empty',
      entry,
    });
  }
  return cells;
}

// -----------------------------------------------------------------------------
// Text-corpus helpers — concatenate title + description + ingredient names
// into a single lowercase string for keyword matching.
// -----------------------------------------------------------------------------

function corpusForEntry(e: MealPlanEntry): string {
  const parts: string[] = [];
  if (e.title) parts.push(e.title);
  if (e.description) parts.push(e.description);
  for (const ing of e.ingredients ?? []) {
    if (ing.name) parts.push(ing.name);
  }
  return parts.join(' ').toLowerCase();
}

// -----------------------------------------------------------------------------
// aggregateProtein
// -----------------------------------------------------------------------------

const PROTEIN_ORDER: Array<Exclude<ProteinKey, 'other'>> = [
  'chicken',
  'beef',
  'fish',
  'pork',
  'veg',
];

function classifyProtein(e: MealPlanEntry): ProteinKey {
  const corpus = corpusForEntry(e);
  if (!corpus.trim()) return 'other';
  for (const key of PROTEIN_ORDER) {
    const kws = PROTEIN_KEYWORDS[key];
    for (const kw of kws) {
      if (corpus.includes(kw)) return key;
    }
  }
  // Fall-through: everything without a cue is treated as veg per plan spec.
  return 'veg';
}

export function aggregateProtein(entries: MealPlanEntry[]): ProteinBucket[] {
  if (!entries.length) return [];
  const counts = new Map<ProteinKey, number>();
  for (const e of entries) {
    const key = classifyProtein(e);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([key, count]) => ({ key, count }));
}

// -----------------------------------------------------------------------------
// aggregateCuisine
// -----------------------------------------------------------------------------

function classifyCuisine(e: MealPlanEntry): string {
  const corpus = corpusForEntry(e);
  if (!corpus.trim()) return 'other';
  for (const key of CUISINE_ORDER) {
    const kws = CUISINE_KEYWORDS[key];
    if (!kws) continue;
    for (const kw of kws) {
      if (corpus.includes(kw)) return key;
    }
  }
  return 'other';
}

export function aggregateCuisine(entries: MealPlanEntry[]): CuisineBucket[] {
  if (!entries.length) return [];
  const counts = new Map<string, number>();
  for (const e of entries) {
    const key = classifyCuisine(e);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([key, count]) => ({ key, count }));
}

// -----------------------------------------------------------------------------
// findRepeats
// -----------------------------------------------------------------------------

function normalizeTitle(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().toLowerCase();
}

export function findRepeats(entries: MealPlanEntry[]): RepeatMeal[] {
  if (!entries.length) return [];
  // Keep both the display title (first occurrence) and a normalized key.
  const counts = new Map<string, { display: string; count: number }>();
  for (const e of entries) {
    const norm = normalizeTitle(e.title);
    if (!norm) continue;
    const existing = counts.get(norm);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(norm, { display: e.title.trim(), count: 1 });
    }
  }
  const out: RepeatMeal[] = [];
  for (const { display, count } of counts.values()) {
    if (count >= 2) out.push({ title: display, count });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}
