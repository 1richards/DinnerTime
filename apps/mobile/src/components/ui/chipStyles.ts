/**
 * Chip class resolver — pure, token-driven, no React / RN imports.
 *
 * Separated from Chip.tsx so vitest can assert className strings without
 * pulling the RN renderer. See 19-02-PLAN.md Task 2.
 */

export type ChipKind = 'filter' | 'display';
export type ChipTone = 'default' | 'success' | 'warning' | 'destructive';

interface ResolveArgs {
  kind: ChipKind;
  /** filter kind only — ignored on display kind. */
  selected?: boolean;
  /** display kind only — ignored on filter kind. Defaults to 'default'. */
  tone?: ChipTone;
}

export interface ChipStyle {
  container: string;
  label: string;
}

const BASE_CONTAINER = 'h-8 px-3 rounded-pill flex-row items-center';
const BASE_LABEL = 'text-caption';

export function resolveChipClasses(args: ResolveArgs): ChipStyle {
  if (args.kind === 'filter') {
    if (args.selected) {
      return {
        container: `${BASE_CONTAINER} bg-brand`,
        label: `${BASE_LABEL} text-white font-semibold`,
      };
    }
    return {
      container: `${BASE_CONTAINER} bg-surface border border-border`,
      label: `${BASE_LABEL} text-text-primary`,
    };
  }

  const tone: ChipTone = args.tone ?? 'default';
  switch (tone) {
    case 'success':
      return {
        container: `${BASE_CONTAINER} bg-success/15`,
        label: `${BASE_LABEL} text-success font-semibold`,
      };
    case 'warning':
      return {
        container: `${BASE_CONTAINER} bg-warning/15`,
        label: `${BASE_LABEL} text-warning font-semibold`,
      };
    case 'destructive':
      return {
        container: `${BASE_CONTAINER} bg-destructive/15`,
        label: `${BASE_LABEL} text-destructive font-semibold`,
      };
    default:
      return {
        container: `${BASE_CONTAINER} bg-surface-subtle`,
        label: `${BASE_LABEL} text-text-secondary`,
      };
  }
}
