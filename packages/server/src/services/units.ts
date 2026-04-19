/**
 * Phase 24-02 — Dimension-pure unit conversion library.
 *
 * Pure functions over a Quantity = { value, unit, system } shape.
 * Powers pantry quantity aggregation on re-scan (24-05 reconcileItems)
 * and mirrors the shape used by the vision tool schema (24-04).
 *
 * Deliberate non-goals:
 *   - No density conversion (volume <-> weight) — 24-CONTEXT lockdown.
 *   - No external deps.
 *   - No side effects, no I/O.
 *
 * See 24a-RESEARCH § 6 for the base-unit table and public contract.
 */

export type QuantitySystem =
  | 'count'
  | 'imperial-weight'
  | 'imperial-volume'
  | 'metric-weight'
  | 'metric-volume'
  | 'custom';

export interface Quantity {
  value: number;
  unit: string; // canonical unit name per system (e.g. 'cup', 'oz', 'g')
  system: QuantitySystem;
}

/**
 * Base unit per system:
 *   imperial-volume -> 'tsp' (tsp=1, tbsp=3, cup=48)
 *   imperial-weight -> 'oz'  (oz=1, lb=16)
 *   metric-weight   -> 'g'   (g=1, kg=1000)
 *   metric-volume   -> 'ml'  (ml=1, l=1000)
 *   count           -> 'piece'
 *
 * Every entry's `base` must match another entry's key in the same system,
 * so two units convert iff they share the same `base` value.
 */
interface ConversionEntry {
  base: string;
  toBase: number;
  system: QuantitySystem;
}

const CONVERSION_TABLE: Record<string, ConversionEntry> = {
  // imperial-volume
  tsp: { base: 'tsp', toBase: 1, system: 'imperial-volume' },
  tbsp: { base: 'tsp', toBase: 3, system: 'imperial-volume' },
  cup: { base: 'tsp', toBase: 48, system: 'imperial-volume' },
  // imperial-weight
  oz: { base: 'oz', toBase: 1, system: 'imperial-weight' },
  lb: { base: 'oz', toBase: 16, system: 'imperial-weight' },
  // metric-weight
  g: { base: 'g', toBase: 1, system: 'metric-weight' },
  kg: { base: 'g', toBase: 1000, system: 'metric-weight' },
  // metric-volume
  ml: { base: 'ml', toBase: 1, system: 'metric-volume' },
  l: { base: 'ml', toBase: 1000, system: 'metric-volume' },
  // count
  piece: { base: 'piece', toBase: 1, system: 'count' },
};

const SYSTEMS: readonly QuantitySystem[] = [
  'count',
  'imperial-weight',
  'imperial-volume',
  'metric-weight',
  'metric-volume',
  'custom',
];

/**
 * Two quantities are compatible iff they share a non-custom system.
 * `custom` never matches anything — including itself — so callers are
 * forced into the multi-row pantry-items fallback (24-05 reconcileItems).
 */
export function areCompatible(a: Quantity, b: Quantity): boolean {
  if (a.system === 'custom' || b.system === 'custom') return false;
  return a.system === b.system;
}

/**
 * Convert a Quantity to a target unit within the same dimension.
 * Returns null for unknown units or cross-dimension conversion
 * (e.g. cup -> oz). No density assumption.
 */
export function convert(q: Quantity, targetUnit: string): Quantity | null {
  const from = CONVERSION_TABLE[q.unit];
  const to = CONVERSION_TABLE[targetUnit];
  if (!from || !to) return null;
  if (from.base !== to.base) return null;
  const baseValue = q.value * from.toBase;
  const targetValue = baseValue / to.toBase;
  return { value: targetValue, unit: targetUnit, system: to.system };
}

/**
 * Sum two quantities. Returns a Quantity in the unit/system of `a`,
 * or null when the two quantities are incompatible (including any
 * `custom` system, or cross-dimension).
 *
 * Callers (24-05 reconcileItems) treat null as the multi-row signal:
 * store both quantities as separate pantry_items rows with a UX hint.
 */
export function add(a: Quantity, b: Quantity): Quantity | null {
  if (!areCompatible(a, b)) return null;
  if (a.unit === b.unit) {
    return { value: a.value + b.value, unit: a.unit, system: a.system };
  }
  const converted = convert(b, a.unit);
  if (!converted) return null;
  return { value: a.value + converted.value, unit: a.unit, system: a.system };
}

/**
 * Coerce an untrusted value into a safe Quantity.
 *
 * Defensive against malformed AI output (vision tool returning NaN,
 * Infinity, negative, missing fields, unknown enum values).
 *
 * Rules:
 *   - value: non-number / NaN / Infinity -> 0; negative -> abs
 *   - unit:  non-string / empty -> 'piece'
 *   - system: outside enum -> 'custom' (forces multi-row fallback)
 *   - top-level non-object -> {value:1, unit:'piece', system:'count'}
 */
export function sanitize(q: unknown): Quantity {
  const DEFAULT: Quantity = { value: 1, unit: 'piece', system: 'count' };
  if (!q || typeof q !== 'object') return DEFAULT;

  const raw = q as Partial<Quantity>;

  let value: number = typeof raw.value === 'number' ? raw.value : 1;
  if (!Number.isFinite(value)) value = 0;
  if (value < 0) value = Math.abs(value);

  const unit =
    typeof raw.unit === 'string' && raw.unit.length > 0 ? raw.unit : 'piece';

  const system: QuantitySystem = (SYSTEMS as readonly string[]).includes(
    raw.system as string,
  )
    ? (raw.system as QuantitySystem)
    : 'custom';

  return { value, unit, system };
}
