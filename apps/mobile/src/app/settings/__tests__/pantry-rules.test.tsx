/**
 * Phase 21-05 — pantry-rules helper coverage (plan W6 Nyquist-rate sampling).
 *
 * The pantry-rules screen is hook-heavy (useState/useEffect) and cannot be
 * invoked as a plain function under vitest node env. Per the existing
 * PantryItemCard.test.tsx pattern (Phase 21-04), coverage lives on the pure
 * helpers the component delegates to 1:1 — plus a static source-level check
 * that the screen file wires the expected Maestro testIDs.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderSuggestionSummary } from '../pantryRulesHelpers';

describe('renderSuggestionSummary', () => {
  it('formats location_mapping suggestion with item and location', () => {
    const msg = renderSuggestionSummary({
      rule_type: 'location_mapping',
      payload: { item_name: 'butter', user_location: 'fridge' },
    });
    expect(msg).toBe('Always put "butter" in fridge');
  });

  it('formats name_mapping suggestion with alias', () => {
    const msg = renderSuggestionSummary({
      rule_type: 'name_mapping',
      payload: { alias_name: 'creamer' },
    });
    expect(msg).toBe('Treat "creamer" as a known ingredient');
  });

  it('tolerates null / missing payload without crashing', () => {
    expect(
      renderSuggestionSummary({ rule_type: 'location_mapping', payload: null }),
    ).toBe('Always put "item" in ?');
    expect(
      renderSuggestionSummary({ rule_type: 'name_mapping', payload: {} }),
    ).toBe('Treat "alias" as a known ingredient');
  });
});

describe('pantry-rules.tsx source-level contract', () => {
  const src = readFileSync(
    resolve(__dirname, '..', 'pantry-rules.tsx'),
    'utf8',
  );

  it('wires the add-rule-fab testID for 21-06 Maestro (I2)', () => {
    expect(src).toContain('testID="add-rule-fab"');
  });

  it('wires per-rule-delete testID on both location and name-mapping rows', () => {
    // Pattern: testID={`rule-delete-${…}`}
    expect(src).toContain('rule-delete-');
  });

  it('imports DraggableFlatList for the reorderable Active Rules section', () => {
    expect(src).toContain("from 'react-native-draggable-flatlist'");
  });

  it('delegates suggestion copy to the pure renderSuggestionSummary helper', () => {
    expect(src).toContain('renderSuggestionSummary');
  });
});
