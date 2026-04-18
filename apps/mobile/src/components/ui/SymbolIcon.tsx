import { SymbolView, type SymbolViewProps } from 'expo-symbols';

/**
 * Type-scale tokens that align SF Symbol sizes with SF Pro text weights.
 *
 *   body       → 17pt (matches body text)
 *   title      → 22pt (matches section headers)
 *   largeTitle → 34pt (matches hero / empty state)
 *
 * Using tokens instead of hand-rolled pixel sizes keeps icon sizing aligned
 * with iOS Dynamic Type scaling. Raw numbers are supported as an escape hatch
 * (e.g. floating action buttons) but should be rare.
 */
export type SymbolIconSize = 'body' | 'title' | 'largeTitle';

const SIZE_MAP: Record<SymbolIconSize, number> = {
  body: 17,
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
