/**
 * SF Symbol sizing helpers tied to the 5-step type scale.
 *
 * Downstream Phase 19 plans (Button iconOnly, Chip leading icon, ItemRow icon
 * variant, StickySearchPill) pass `iconPropsForText(scale)` into
 * `<SymbolView>` so icon weight always matches the adjacent text weight.
 *
 * Mapping rationale (Pattern 3 in 19-RESEARCH.md):
 *   - caption (13pt text)  -> 14pt icon
 *   - body    (17pt text)  -> 18pt icon
 *   - title   (22pt text)  -> 22pt icon
 *   - display (34pt text)  -> 28pt icon (visual balance — symbols read heavy at display size)
 */

import type { SymbolViewProps } from 'expo-symbols';
import { typography } from './tokens';

export type IconSize = 'caption' | 'body' | 'title' | 'display';

export const iconSize: Record<IconSize, number> = {
  caption: 14,
  body: 18,
  title: 22,
  display: 28,
};

/**
 * Returns the `size` + `weight` props for a `<SymbolView>` that should render
 * alongside text at the given type-scale step. Weight mirrors the typography
 * token's fontWeight so icon + glyph weight stay consistent.
 */
export function iconPropsForText(size: IconSize): Pick<SymbolViewProps, 'size' | 'weight'> {
  return {
    size: iconSize[size],
    weight: typography[size].fontWeight as SymbolViewProps['weight'],
  };
}
