/**
 * Pure className resolvers for ItemRow.
 *
 * Extracted from ItemRow.tsx so the conditional styling logic is unit-testable
 * without needing an RN renderer — ItemRow itself imports these constants +
 * helpers and composes them in JSX. Every variant combination used by the
 * Phase 19 Wave 3 sweep (ShoppingItemRow + PantryItemCard migrations in Plan
 * 19-05) has a covering assertion in ItemRow.test.ts.
 *
 * Phase 21-04 adds a `size` axis:
 *   - 'default'  → ~64pt tall (py-3); original Phase 19 density. Used by
 *                  Shopping + Plan surfaces and any consumer that doesn't ask.
 *   - 'compact'  → ~48pt tall (py-2); dense pantry-tab density per
 *                  21-CONTEXT ROADMAP #2.
 * Consumers pass `size` via `ItemRow`, which hands it to `resolveContainerClasses`.
 */

export interface TitleClassArgs {
  struck?: boolean;
}

export function resolveTitleClasses({ struck }: TitleClassArgs): string {
  return `text-body text-text-primary${struck ? ' line-through opacity-50' : ''}`;
}

export interface CheckboxBoxArgs {
  checked: boolean;
}

export function resolveCheckboxBoxClasses({ checked }: CheckboxBoxArgs): string {
  const base = 'w-6 h-6 rounded-button border items-center justify-center';
  return checked ? `${base} bg-brand border-brand` : `${base} bg-surface border-border`;
}

/**
 * Default (Phase 19) container density — py-3, min-h 56pt. Used when the
 * consumer doesn't pass a `size` prop or passes `'default'`. Shopping tab,
 * Plan tab, and any legacy consumer falls here.
 */
export const CONTAINER_CLASSES_DEFAULT =
  'flex-row items-center bg-surface px-4 py-3 border-b border-border-subtle min-h-[56px]';

/**
 * Phase 21-04 compact density — py-2, ~48pt target height. Pantry tab rows
 * opt in via `size="compact"` for a denser list scan.
 */
export const CONTAINER_CLASSES_COMPACT =
  'flex-row items-center bg-surface px-4 py-2 border-b border-border-subtle min-h-[48px]';

/**
 * Phase 19 back-compat alias — earlier primitives imported the bare
 * CONTAINER_CLASSES constant. Preserved for any consumer that still references
 * it directly; new code should use `resolveContainerClasses` or the
 * DEFAULT / COMPACT pair.
 */
export const CONTAINER_CLASSES = CONTAINER_CLASSES_DEFAULT;

export type ItemRowSize = 'default' | 'compact';

/**
 * Resolve the container className string for a given density. Default density
 * is returned when no argument or `'default'` is passed.
 */
export function resolveContainerClasses(size: ItemRowSize = 'default'): string {
  return size === 'compact' ? CONTAINER_CLASSES_COMPACT : CONTAINER_CLASSES_DEFAULT;
}

export const STEPPER_BUTTON_CLASSES =
  'w-8 h-8 rounded-button bg-surface-subtle items-center justify-center';
