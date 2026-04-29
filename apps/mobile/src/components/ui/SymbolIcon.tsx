import { SymbolView, type SymbolViewProps } from 'expo-symbols';

/**
 * Type-scale tokens that align SF Symbol sizes with SF Pro text weights,
 * plus an interaction-target token for standalone tap targets.
 *
 *   body       → 17pt — inline text decoration (clock + 35m, label leading
 *                glyph). Pairs visually with body text; does NOT signal
 *                tappability on its own.
 *   action     → 26pt — REQUIRED size for any standalone interaction icon
 *                (toolbar cart, header ellipsis, overflow buttons, badge
 *                affordances). Sits inside a 44pt min hit target so the
 *                glyph reads as tappable from arm's length without the
 *                user squinting. Default for icon-only Pressables.
 *   title      → 22pt — non-tappable section heading glyphs.
 *   largeTitle → 34pt — hero / empty-state glyphs.
 *
 * Rule: if the icon IS the affordance (no adjacent text label, the icon is
 * what the user taps), use `action`. If the icon decorates text, use `body`.
 * Raw numbers are an escape hatch for special-case overlays (e.g. action
 * cluster badges over hero photos already at 24pt) but new code should
 * prefer the tokens so the size sweep stays meaningful.
 */
export type SymbolIconSize = 'body' | 'action' | 'title' | 'largeTitle';

const SIZE_MAP: Record<SymbolIconSize, number> = {
  body: 17,
  action: 26,
  title: 22,
  largeTitle: 34,
};

export type SymbolIconProps = Omit<SymbolViewProps, 'size'> & {
  size?: SymbolIconSize | number;
  weight?: SymbolViewProps['weight'];
  // NOTE: tintColor MUST be passed as a prop (not a className). NativeWind
  // cannot color SF Symbol glyphs — the native renderer reads `tintColor`
  // directly. See 15-RESEARCH.md Pitfall 7.
};

/**
 * Resolves a `SymbolIconSize` token (or raw pixel number) to the pixel
 * size that expo-symbols' SymbolView expects. Exported for unit tests.
 */
export function resolveSymbolSize(size: SymbolIconSize | number | undefined): number {
  if (typeof size === 'number') return size;
  if (size === undefined) return SIZE_MAP.body;
  return SIZE_MAP[size];
}

export function SymbolIcon({
  size = 'body',
  weight = 'regular',
  ...rest
}: SymbolIconProps) {
  const px = resolveSymbolSize(size);
  return <SymbolView size={px} weight={weight} {...rest} />;
}
