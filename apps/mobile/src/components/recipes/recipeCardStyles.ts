/**
 * Pure mode-to-className resolver for RecipeCard.
 *
 * Decoupled from the component so the class-string contract is testable under
 * vitest node env without mounting the RN renderer. RecipeCard.tsx consumes
 * `resolveCardClasses(mode)` and spreads the strings into NativeWind
 * `className` props.
 *
 * All class strings must resolve against Phase 19 tokens (`bg-surface`,
 * `rounded-card`, `text-text-primary`, `text-text-secondary`, `text-title`,
 * `text-body`, `text-caption`, `bg-surface-subtle`). Per the Phase 19
 * purity invariant, NO hex literals and NO `orange-N` Tailwind classes may
 * appear here.
 */

export type RecipeCardMode = 'grid' | 'list';

export interface CardClasses {
  container: string;
  imageContainer: string;
  body: string;
  title: string;
  metaRow: string;
  metaText: string;
}

export function resolveCardClasses(mode: RecipeCardMode): CardClasses {
  if (mode === 'list') {
    return {
      container: 'bg-surface rounded-card mx-4 mb-3 flex-row overflow-hidden',
      imageContainer: 'w-24 h-24 bg-surface-subtle',
      body: 'flex-1 p-3 justify-center',
      title: 'text-body text-text-primary font-semibold',
      metaRow: 'flex-row items-center mt-1',
      metaText: 'text-caption text-text-secondary',
    };
  }
  // grid (default)
  return {
    container: 'bg-surface rounded-card mx-4 mb-4 overflow-hidden',
    imageContainer: 'aspect-[4/3] bg-surface-subtle',
    body: 'p-4',
    title: 'text-title text-text-primary',
    metaRow: 'flex-row items-center mt-2',
    metaText: 'text-caption text-text-secondary',
  };
}
