import { describe, it, expect, vi } from 'vitest';

// Mock expo-symbols BEFORE importing SymbolIcon so the mocked SymbolView
// is what React.createElement captures in the returned element tree.
const mocks = vi.hoisted(() => ({
  MockSymbolView: (_props: unknown) => null,
}));
vi.mock('expo-symbols', () => ({ SymbolView: mocks.MockSymbolView }));

import { SymbolIcon, resolveSymbolSize } from '../SymbolIcon';
import { SymbolView } from 'expo-symbols';

describe('resolveSymbolSize', () => {
  it("maps 'body' to 17px", () => {
    expect(resolveSymbolSize('body')).toBe(17);
  });
  it("maps 'title' to 22px", () => {
    expect(resolveSymbolSize('title')).toBe(22);
  });
  it("maps 'largeTitle' to 34px", () => {
    expect(resolveSymbolSize('largeTitle')).toBe(34);
  });
  it('passes a raw number through unchanged', () => {
    expect(resolveSymbolSize(20)).toBe(20);
    expect(resolveSymbolSize(56)).toBe(56);
  });
  it('defaults to body (17) when size is undefined', () => {
    expect(resolveSymbolSize(undefined)).toBe(17);
  });
});

describe('SymbolIcon', () => {
  it("renders SymbolView with size=17 when size='body'", () => {
    const el = SymbolIcon({ name: 'cart' as never, size: 'body' });
    expect(el).not.toBeNull();
    expect(el!.type).toBe(SymbolView);
    expect(el!.props.size).toBe(17);
  });

  it("renders SymbolView with size=22 when size='title'", () => {
    const el = SymbolIcon({ name: 'cart' as never, size: 'title' });
    expect(el!.props.size).toBe(22);
  });

  it("renders SymbolView with size=34 when size='largeTitle'", () => {
    const el = SymbolIcon({ name: 'cart' as never, size: 'largeTitle' });
    expect(el!.props.size).toBe(34);
  });

  it('renders SymbolView with the raw pixel size when a number is passed', () => {
    const el = SymbolIcon({ name: 'cart' as never, size: 20 });
    expect(el!.props.size).toBe(20);
  });

  it('forwards tintColor as a prop (NOT via className) per Pitfall 7', () => {
    const el = SymbolIcon({
      name: 'cart' as never,
      size: 'body',
      tintColor: '#F97316',
    });
    expect(el!.props.tintColor).toBe('#F97316');
    // className must NOT be how tint is expressed
    expect(el!.props.className).toBeUndefined();
  });

  it("defaults weight to 'regular' when weight prop is omitted", () => {
    const el = SymbolIcon({ name: 'cart' as never });
    expect(el!.props.weight).toBe('regular');
  });

  it('forwards an explicit weight override', () => {
    const el = SymbolIcon({ name: 'cart' as never, weight: 'semibold' });
    expect(el!.props.weight).toBe('semibold');
  });

  it('forwards the name prop to SymbolView', () => {
    const el = SymbolIcon({ name: 'checkmark' as never });
    expect(el!.props.name).toBe('checkmark');
  });
});
