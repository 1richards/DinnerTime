/**
 * Pure helpers for DayRow — decoupled from the component so status-chip
 * derivation is unit-tested under vitest node env without the RN renderer.
 *
 * The matrix (status × isStretch × pantryReady) drives the visual hierarchy of
 * the Plan tab; a silent regression here makes the Plan tab look "done" on
 * screenshots while misrepresenting meal state. Test coverage is therefore
 * matrix-complete (see dayRowHelpers.test.ts).
 */

import type { ChipTone } from '../ui/Chip';
import {
  scoreWeekHealth,
  type ScoredEntry,
} from '../../plan/weekHealthScore';

export type DayRowStatus = 'cooked' | 'planned' | 'skipped' | 'unplanned';

/**
 * Structural descriptor for a status chip. DayRow.tsx maps descriptors to
 * <Chip kind="display" ... /> JSX. Decoupling shape from JSX keeps the test
 * node-pure.
 */
export interface StatusChipDescriptor {
  label: string;
  tone: ChipTone;
  /** SF Symbol name for an optional leading glyph. */
  leadingIcon?: string;
}

export interface DeriveArgs {
  status: DayRowStatus;
  isStretch?: boolean;
  pantryReady?: boolean;
  /**
   * When provided, derive a per-entry health label (Healthy / High fat /
   * Carb-heavy / Veg-forward / Light) using the same keyword scorer as
   * the week-level chip. Reusing the scorer keeps row-level and
   * week-level signals aligned — if the week is "Indulgent", at least
   * one row will be tagged "High fat" or similar.
   */
  entry?: ScoredEntry | null;

  // ---- Quick-task 6 — skill scaffolding chips ----
  /**
   * Difficulty tier. When set, emits a chip labeled "Easy" | "Medium" |
   * "Hard" with tone scaling by tier (easy=success, medium=default,
   * hard=warning). Null/undefined → no chip (legacy rows).
   */
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  /**
   * Practiced skills tagged on this entry by the AI. Used for the
   * matching-focus chip — when an entry exercises the week's focus
   * theme, we surface that fact on the day card.
   */
  practicedSkills?: string[] | null;
  /**
   * Active weekly focus theme (free-form string from
   * meal_plans.focus_theme). When `practicedSkills` contains a key
   * case-insensitively equal to this, emit a single matching-focus
   * chip with warm tone.
   */
  focusTheme?: string | null;
}

/**
 * Derive the ordered list of status chips to render on a DayRow.
 *
 * Rules:
 * - `cooked` status contributes `Cooked` (success tone, checkmark glyph).
 * - `skipped` status contributes `Skipped` (default tone).
 * - `planned` / `unplanned` contribute no chip on their own — the flags below
 *   carry the meaning.
 * - `isStretch` flag always appends `Stretch` (warning tone, sparkles glyph)
 *   — even on top of `cooked` / `skipped`.
 * - `pantryReady` flag always appends `Pantry ready` (default tone).
 *
 * Order is stable: status chip first, then stretch, then pantry-ready.
 */
export function deriveStatusChips(args: DeriveArgs): StatusChipDescriptor[] {
  const out: StatusChipDescriptor[] = [];

  if (args.status === 'cooked') {
    out.push({
      label: 'Cooked',
      tone: 'success',
      leadingIcon: 'checkmark.circle.fill',
    });
  } else if (args.status === 'skipped') {
    out.push({ label: 'Skipped', tone: 'default' });
  }
  // 'planned' and 'unplanned' contribute no status chip on their own.

  if (args.isStretch) {
    out.push({ label: 'Stretch', tone: 'warning', leadingIcon: 'sparkles' });
  }
  if (args.pantryReady) {
    out.push({ label: 'Pantry ready', tone: 'default' });
  }

  // Quick-task 6 — Difficulty chip. Always render when set so users get a
  // glanceable read on each day's effort. Tone scales: easy=success
  // (green = low risk), medium=default (neutral), hard=warning (amber =
  // bring focus). null/undefined → no chip (legacy rows).
  if (args.difficulty) {
    const label =
      args.difficulty[0]!.toUpperCase() + args.difficulty.slice(1);
    const tone: ChipTone =
      args.difficulty === 'hard'
        ? 'warning'
        : args.difficulty === 'easy'
          ? 'success'
          : 'default';
    out.push({
      label,
      tone,
      leadingIcon: 'gauge.with.dots.needle.33percent',
    });
  }

  // Quick-task 7 — Practiced-skills chips. Emit ALL practiced_skills as
  // chips so users see the full skill payload of every meal at a glance.
  // The chip whose lowercase value matches the (trimmed) focus theme
  // renders FIRST in 'warning' tone; every other skill renders AFTER in
  // 'default' tone in source order. Drops the previous single-match-only
  // branch (quick-task 6) which hid non-matching skills entirely.
  //
  // Sentence-case display: "pan sauces" → "Pan sauces" (single capital)
  // so chips don't shout next to the difficulty chip. Case-insensitive
  // match on focus theme + whitespace-trim on theme preserved.
  if (args.practicedSkills && args.practicedSkills.length > 0) {
    const themeLc =
      typeof args.focusTheme === 'string'
        ? args.focusTheme.trim().toLowerCase()
        : null;
    const sentenceCase = (s: string): string => {
      const lc = s.toLowerCase();
      return lc.length === 0 ? lc : lc[0]!.toUpperCase() + lc.slice(1);
    };
    // Partition: matched skill (if any) first, others preserve source order.
    const matched = themeLc
      ? args.practicedSkills.find((s) => s.toLowerCase() === themeLc) ?? null
      : null;
    if (matched) {
      out.push({
        label: sentenceCase(matched),
        tone: 'warning',
        leadingIcon: 'sparkles',
      });
    }
    for (const skill of args.practicedSkills) {
      if (matched && skill === matched) continue;
      out.push({
        label: sentenceCase(skill),
        tone: 'default',
        leadingIcon: 'sparkles',
      });
    }
  }

  // Per-entry health hint. Skip on cooked/skipped rows — the user has
  // already moved on, the label is noise. Only show when the verdict
  // is meaningful (we don't want a "Balanced" chip on every row).
  // Also dedupe against practiced_skills: when the AI already tagged
  // the recipe as "plant-forward" the keyword scorer's "Veg-forward"
  // chip is restating the same thing. Drop the redundant health chip
  // — the practiced_skill is curated and wins.
  if (args.entry && args.status !== 'cooked' && args.status !== 'skipped') {
    const health = entryHealthChip(args.entry);
    if (health) {
      const skillSet = new Set(
        (args.practicedSkills ?? []).map((s) => s.toLowerCase()),
      );
      const isRedundant =
        health.label === 'Veg-forward' && skillSet.has('plant-forward');
      if (!isRedundant) out.push(health);
    }
  }

  return out;
}

/**
 * Run the keyword scorer over a single entry and translate its
 * dominant axis into a chip descriptor. Returns null when no axis
 * dominates — we don't want a tepid "Balanced" tag on every row.
 */
export function entryHealthChip(
  entry: ScoredEntry,
): StatusChipDescriptor | null {
  const score = scoreWeekHealth([entry]);
  if (score.planned === 0) return null;
  // Pick the strongest signal. Thresholds are intentionally lower than
  // the week-level verdict because we're scoring a single dish — even
  // 2-3 keyword hits is meaningful at the per-row level.
  if (score.indulgent >= 3 && score.indulgent > score.light + score.lean) {
    return { label: 'High fat', tone: 'warning', leadingIcon: 'flame.fill' };
  }
  if (score.carbs >= 3 && score.carbs > score.veg) {
    return { label: 'Carb-heavy', tone: 'warning', leadingIcon: 'fork.knife' };
  }
  if (score.veg >= 3 && score.veg > score.indulgent) {
    return { label: 'Veg-forward', tone: 'success', leadingIcon: 'leaf.fill' };
  }
  if (score.light + score.lean >= 3 && score.light + score.lean > score.indulgent) {
    return { label: 'Healthy', tone: 'success', leadingIcon: 'sparkle' };
  }
  return null;
}
