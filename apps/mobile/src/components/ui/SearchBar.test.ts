import { describe, it, expect } from 'vitest';
import { buildSearchHref, shadowOpacityConfig } from './SearchBar';

describe('SearchBar helpers', () => {
  it('buildSearchHref builds /search?context=<ctx>', () => {
    expect(buildSearchHref('library')).toBe('/search?context=library');
    expect(buildSearchHref('something-new')).toBe('/search?context=something-new');
    expect(buildSearchHref('pantry')).toBe('/search?context=pantry');
  });

  it('shadowOpacityConfig returns matched inputRange/outputRange', () => {
    const cfg = shadowOpacityConfig();
    expect(cfg.inputRange).toEqual([0, 40]);
    expect(cfg.outputRange).toEqual([0.05, 0.18]);
    expect(cfg.inputRange.length).toBe(cfg.outputRange.length);
  });

  it('shadow grows monotonically with scroll', () => {
    const cfg = shadowOpacityConfig();
    for (let i = 1; i < cfg.inputRange.length; i++) {
      expect(cfg.inputRange[i]).toBeGreaterThan(cfg.inputRange[i - 1]);
      expect(cfg.outputRange[i]).toBeGreaterThanOrEqual(cfg.outputRange[i - 1]);
    }
  });
});
