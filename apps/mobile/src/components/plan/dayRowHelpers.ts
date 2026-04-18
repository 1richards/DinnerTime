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

  return out;
}
