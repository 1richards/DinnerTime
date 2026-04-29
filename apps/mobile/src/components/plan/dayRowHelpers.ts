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

  // Per-entry health hint. Skip on cooked/skipped rows — the user has
  // already moved on, the label is noise. Only show when the verdict
  // is meaningful (we don't want a "Balanced" chip on every row).
  if (args.entry && args.status !== 'cooked' && args.status !== 'skipped') {
    const health = entryHealthChip(args.entry);
    if (health) out.push(health);
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
