/**
 * Pure className resolvers for ItemRow.
 *
 * Extracted from ItemRow.tsx so the conditional styling logic is unit-testable
 * without needing an RN renderer — ItemRow itself imports these constants +
 * helpers and composes them in JSX. Every variant combination used by the
 * Phase 19 Wave 3 sweep (ShoppingItemRow + PantryItemCard migrations in Plan
 * 19-05) has a covering assertion in ItemRow.test.ts.
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

export const CONTAINER_CLASSES =
  'flex-row items-center bg-surface px-4 py-3 border-b border-border-subtle min-h-[56px]';

export const STEPPER_BUTTON_CLASSES =
  'w-8 h-8 rounded-button bg-surface-subtle items-center justify-center';
