import { describe, expect, it } from 'vitest';
import {
  add,
  areCompatible,
  convert,
  sanitize,
  type Quantity,
} from '../units.js';

// Phase 24-02 — RED phase.
// `../units.js` does not exist yet. These tests enumerate the contract
// from 24a-RESEARCH § 6. Task 2 ships the implementation; its GREEN
// run is the single gate for both tasks (no RED-phase automated verify).

describe('areCompatible', () => {
  it('returns true for same system (imperial-volume)', () => {
    expect(
      areCompatible(
        { value: 1, unit: 'cup', system: 'imperial-volume' },
        { value: 1, unit: 'tbsp', system: 'imperial-volume' },
      ),
    ).toBe(true);
  });

  it('returns true for same system (count)', () => {
    expect(
      areCompatible(
        { value: 3, unit: 'piece', system: 'count' },
        { value: 2, unit: 'piece', system: 'count' },
      ),
    ).toBe(true);
  });

  it('returns false cross-system (volume vs weight)', () => {
    expect(
      areCompatible(
        { value: 1, unit: 'cup', system: 'imperial-volume' },
        { value: 1, unit: 'lb', system: 'imperial-weight' },
      ),
    ).toBe(false);
  });

  it('returns false cross-system (imperial vs metric)', () => {
    expect(
      areCompatible(
        { value: 1, unit: 'oz', system: 'imperial-weight' },
        { value: 1, unit: 'g', system: 'metric-weight' },
      ),
    ).toBe(false);
  });

  it('returns false when either side is custom (custom escapes the table)', () => {
    expect(
      areCompatible(
        { value: 1, unit: 'pinch', system: 'custom' },
        { value: 1, unit: 'pinch', system: 'custom' },
      ),
    ).toBe(false);

    expect(
      areCompatible(
        { value: 1, unit: 'pinch', system: 'custom' },
        { value: 1, unit: 'cup', system: 'imperial-volume' },
      ),
    ).toBe(false);
  });
});

describe('convert', () => {
  // --- imperial-volume ---
  it('cup → tbsp (1 cup = 16 tbsp)', () => {
    const r = convert(
      { value: 1, unit: 'cup', system: 'imperial-volume' },
      'tbsp',
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(16, 9);
    expect(r!.unit).toBe('tbsp');
    expect(r!.system).toBe('imperial-volume');
  });

  it('tbsp → tsp (1 tbsp = 3 tsp)', () => {
    const r = convert(
      { value: 1, unit: 'tbsp', system: 'imperial-volume' },
      'tsp',
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(3, 9);
    expect(r!.unit).toBe('tsp');
  });

  it('cup → tsp → cup round-trip preserves value', () => {
    const start: Quantity = { value: 1, unit: 'cup', system: 'imperial-volume' };
    const mid = convert(start, 'tsp');
    expect(mid).not.toBeNull();
    const back = convert(mid!, 'cup');
    expect(back).not.toBeNull();
    expect(back!.value).toBeCloseTo(1, 9);
    expect(back!.unit).toBe('cup');
  });

  // --- imperial-weight ---
  it('oz → lb (16 oz = 1 lb)', () => {
    const r = convert(
      { value: 16, unit: 'oz', system: 'imperial-weight' },
      'lb',
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(1, 9);
    expect(r!.unit).toBe('lb');
    expect(r!.system).toBe('imperial-weight');
  });

  it('lb → oz (1 lb = 16 oz)', () => {
    const r = convert(
      { value: 1, unit: 'lb', system: 'imperial-weight' },
      'oz',
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(16, 9);
    expect(r!.unit).toBe('oz');
  });

  // --- metric-weight ---
  it('g → kg (1000 g = 1 kg)', () => {
    const r = convert(
      { value: 1000, unit: 'g', system: 'metric-weight' },
      'kg',
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(1, 9);
    expect(r!.unit).toBe('kg');
    expect(r!.system).toBe('metric-weight');
  });

  it('kg → g (1 kg = 1000 g)', () => {
    const r = convert(
      { value: 1, unit: 'kg', system: 'metric-weight' },
      'g',
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(1000, 9);
    expect(r!.unit).toBe('g');
  });

  // --- metric-volume ---
  it('ml → l (1000 ml = 1 l)', () => {
    const r = convert(
      { value: 1000, unit: 'ml', system: 'metric-volume' },
      'l',
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(1, 9);
    expect(r!.unit).toBe('l');
    expect(r!.system).toBe('metric-volume');
  });

  it('l → ml (1 l = 1000 ml)', () => {
    const r = convert(
      { value: 1, unit: 'l', system: 'metric-volume' },
      'ml',
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(1000, 9);
    expect(r!.unit).toBe('ml');
  });

  // --- cross-dimension (density-free, returns null) ---
  it('cross-dimension cup → oz returns null (no density assumption)', () => {
    expect(
      convert(
        { value: 1, unit: 'cup', system: 'imperial-volume' },
        'oz',
      ),
    ).toBeNull();
  });

  it('cross-dimension g → ml returns null', () => {
    expect(
      convert(
        { value: 100, unit: 'g', system: 'metric-weight' },
        'ml',
      ),
    ).toBeNull();
  });

  it('cross-system oz → g returns null (imperial-weight vs metric-weight)', () => {
    expect(
      convert(
        { value: 1, unit: 'oz', system: 'imperial-weight' },
        'g',
      ),
    ).toBeNull();
  });

  it('unknown source unit returns null', () => {
    expect(
      convert(
        { value: 1, unit: 'parsec', system: 'custom' },
        'cup',
      ),
    ).toBeNull();
  });

  it('unknown target unit returns null', () => {
    expect(
      convert(
        { value: 1, unit: 'cup', system: 'imperial-volume' },
        'parsec',
      ),
    ).toBeNull();
  });
});

describe('add', () => {
  it('sums same-unit imperial-volume', () => {
    const r = add(
      { value: 2, unit: 'cup', system: 'imperial-volume' },
      { value: 0.5, unit: 'cup', system: 'imperial-volume' },
    );
    expect(r).not.toBeNull();
    expect(r!.unit).toBe('cup');
    expect(r!.value).toBeCloseTo(2.5, 9);
    expect(r!.system).toBe('imperial-volume');
  });

  it('sums compatible units in canonical unit of a (2 cup + 4 tbsp = 2.25 cup)', () => {
    const a: Quantity = { value: 2, unit: 'cup', system: 'imperial-volume' };
    const b: Quantity = { value: 4, unit: 'tbsp', system: 'imperial-volume' };
    const r = add(a, b);
    expect(r).not.toBeNull();
    expect(r!.unit).toBe('cup');
    expect(r!.value).toBeCloseTo(2.25, 6);
    expect(r!.system).toBe('imperial-volume');
  });

  it('sums compatible weights (1 lb + 8 oz = 1.5 lb)', () => {
    const r = add(
      { value: 1, unit: 'lb', system: 'imperial-weight' },
      { value: 8, unit: 'oz', system: 'imperial-weight' },
    );
    expect(r).not.toBeNull();
    expect(r!.unit).toBe('lb');
    expect(r!.value).toBeCloseTo(1.5, 9);
  });

  it('sums metric-weight (1 kg + 500 g = 1.5 kg)', () => {
    const r = add(
      { value: 1, unit: 'kg', system: 'metric-weight' },
      { value: 500, unit: 'g', system: 'metric-weight' },
    );
    expect(r).not.toBeNull();
    expect(r!.unit).toBe('kg');
    expect(r!.value).toBeCloseTo(1.5, 9);
  });

  it('sums count + count, unit stays piece', () => {
    const r = add(
      { value: 3, unit: 'piece', system: 'count' },
      { value: 5, unit: 'piece', system: 'count' },
    );
    expect(r).not.toBeNull();
    expect(r!.unit).toBe('piece');
    expect(r!.value).toBe(8);
    expect(r!.system).toBe('count');
  });

  it('returns null for incompatible systems (volume + weight)', () => {
    expect(
      add(
        { value: 1, unit: 'cup', system: 'imperial-volume' },
        { value: 1, unit: 'lb', system: 'imperial-weight' },
      ),
    ).toBeNull();
  });

  it('returns null for imperial vs metric weight', () => {
    expect(
      add(
        { value: 1, unit: 'oz', system: 'imperial-weight' },
        { value: 28, unit: 'g', system: 'metric-weight' },
      ),
    ).toBeNull();
  });

  it('returns null when either side is custom', () => {
    expect(
      add(
        { value: 1, unit: 'pinch', system: 'custom' },
        { value: 1, unit: 'pinch', system: 'custom' },
      ),
    ).toBeNull();
  });

  it('returns null when count meets non-count', () => {
    expect(
      add(
        { value: 1, unit: 'piece', system: 'count' },
        { value: 1, unit: 'cup', system: 'imperial-volume' },
      ),
    ).toBeNull();
  });

  it('tolerates zero quantity (0 cup + 1 cup = 1 cup)', () => {
    const r = add(
      { value: 0, unit: 'cup', system: 'imperial-volume' },
      { value: 1, unit: 'cup', system: 'imperial-volume' },
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBeCloseTo(1, 9);
    expect(r!.unit).toBe('cup');
  });
});

describe('sanitize', () => {
  it('passes valid input through unchanged', () => {
    const q: Quantity = { value: 2, unit: 'cup', system: 'imperial-volume' };
    expect(sanitize(q)).toEqual({ value: 2, unit: 'cup', system: 'imperial-volume' });
  });

  it('NaN value is coerced to 0', () => {
    expect(
      sanitize({ value: Number.NaN, unit: 'piece', system: 'count' }),
    ).toEqual({ value: 0, unit: 'piece', system: 'count' });
  });

  it('Infinity value is coerced to 0', () => {
    expect(
      sanitize({ value: Number.POSITIVE_INFINITY, unit: 'piece', system: 'count' }),
    ).toEqual({ value: 0, unit: 'piece', system: 'count' });
  });

  it('-Infinity value is coerced to 0', () => {
    expect(
      sanitize({ value: Number.NEGATIVE_INFINITY, unit: 'piece', system: 'count' }),
    ).toEqual({ value: 0, unit: 'piece', system: 'count' });
  });

  it('negative value becomes absolute value', () => {
    expect(
      sanitize({ value: -3, unit: 'cup', system: 'imperial-volume' }),
    ).toEqual({ value: 3, unit: 'cup', system: 'imperial-volume' });
  });

  it('null input returns default Quantity', () => {
    const r = sanitize(null);
    expect(r.system).toBe('count');
    expect(r.unit).toBe('piece');
    expect(typeof r.value).toBe('number');
    expect(Number.isFinite(r.value)).toBe(true);
  });

  it('undefined input returns default Quantity', () => {
    const r = sanitize(undefined);
    expect(r.system).toBe('count');
    expect(r.unit).toBe('piece');
  });

  it('non-object input (string) returns default Quantity', () => {
    const r = sanitize('not a quantity');
    expect(r.system).toBe('count');
    expect(r.unit).toBe('piece');
  });

  it('missing fields produce safe default shape', () => {
    const r = sanitize({});
    expect(r.system).toBe('custom'); // system not in enum → custom
    expect(r.unit).toBe('piece');
    expect(typeof r.value).toBe('number');
    expect(Number.isFinite(r.value)).toBe(true);
  });

  it('malformed system enum is coerced to custom', () => {
    const r = sanitize({ value: 1, unit: 'cup', system: 'bogus-system' });
    expect(r.system).toBe('custom');
    expect(r.unit).toBe('cup');
    expect(r.value).toBe(1);
  });

  it('empty string unit falls back to piece', () => {
    const r = sanitize({ value: 1, unit: '', system: 'count' });
    expect(r.unit).toBe('piece');
  });

  it('non-number value falls back to a finite default', () => {
    const r = sanitize({ value: 'two' as unknown as number, unit: 'cup', system: 'imperial-volume' });
    expect(Number.isFinite(r.value)).toBe(true);
  });
});
