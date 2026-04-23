/**
 * Phase 22-04 — Day drill-down: IngredientChecklist.
 *
 * Renders one checkable row per ingredient. Local state only — deliberately
 * NOT persisted (PLAN 22-04 behavior: "users crossing off while shopping is
 * a v2 feature"). Refreshing the route resets all checks.
 *
 * Composition pattern: reuses the shared `ItemRow` primitive with
 * `leading: { kind: 'checkbox', ... }` so shopping, pantry, and the
 * day-drill surface all share the same visual language.
 *
 * Testability: pure helpers (`formatIngredientSubtitle`, `buildRows`,
 * `toggleIndex`) are exported so the test file can exercise the row
 * rendering logic without a React renderer — mirrors the dayRowHelpers
 * pattern the plan calls for. The React component itself is a thin
 * `useState` wrapper that delegates to `buildRows`. Interactive coverage
 * lives in Maestro flow 34.
 */
import React, { useState, useCallback } from 'react';
import { View, Text } from 'react-native';
import { ItemRow } from '../ui/ItemRow';
import type { MealPlanIngredient } from '../../types/mealPlan';

interface IngredientChecklistProps {
  ingredients: MealPlanIngredient[];
}

// ---------------------------------------------------------------------------
// Pure helpers (test surface)
// ---------------------------------------------------------------------------

/**
 * Build a concise "qty unit" subtitle string. Returns undefined when both
 * are absent so ItemRow skips rendering the subtitle row entirely.
 */
export function formatIngredientSubtitle(
  ing: MealPlanIngredient,
): string | undefined {
  const hasQty = typeof ing.quantity === 'number';
  const hasUnit = typeof ing.unit === 'string' && ing.unit.length > 0;
  if (hasQty && hasUnit) return `${ing.quantity} ${ing.unit}`;
  if (hasQty) return String(ing.quantity);
  if (hasUnit) return ing.unit;
  return undefined;
}

/**
 * Toggle index `i` in a Set of checked indices, returning a new Set (does
 * not mutate input). Exported for the test harness.
 */
export function toggleIndex(prev: Set<number>, i: number): Set<number> {
  const next = new Set(prev);
  if (next.has(i)) next.delete(i);
  else next.add(i);
  return next;
}

/**
 * Build the ItemRow props array for a given ingredients list + checked
 * set + per-row toggle factory. Pure — takes no hooks — so the test can
 * call this directly and assert shape.
 *
 * Returns an array of `RowSpec` objects that mirror ItemRow's props
 * surface (title, subtitle, leading.checkbox {checked, onToggle}).
 */
export interface RowSpec {
  key: string;
  title: string;
  subtitle: string | undefined;
  leading: {
    kind: 'checkbox';
    checked: boolean;
    onToggle: () => void;
  };
  struck: boolean;
}

export function buildRows(
  ingredients: MealPlanIngredient[],
  checked: Set<number>,
  makeToggle: (i: number) => () => void,
): RowSpec[] {
  return ingredients.map((ing, i) => ({
    key: `${ing.name}-${i}`,
    title: ing.name,
    subtitle: formatIngredientSubtitle(ing),
    leading: {
      kind: 'checkbox' as const,
      checked: checked.has(i),
      onToggle: makeToggle(i),
    },
    struck: checked.has(i),
  }));
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export function IngredientChecklist({
  ingredients,
}: IngredientChecklistProps) {
  // Empty path is stateless so the component is safe to call as a plain
  // function under vitest-node (no useState runs). The non-empty path
  // delegates to `IngredientChecklistRows` which owns the hook.
  if (ingredients.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No ingredients listed</Text>
      </View>
    );
  }
  return <IngredientChecklistRows ingredients={ingredients} />;
}

/**
 * Inner hook-bearing component. Rendered only when `ingredients.length > 0`
 * so the outer `IngredientChecklist` can be invoked as a plain function
 * (for static tree-walking tests) in the empty branch.
 */
function IngredientChecklistRows({
  ingredients,
}: {
  ingredients: MealPlanIngredient[];
}) {
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  const makeToggle = useCallback(
    (i: number) => () => {
      setChecked((prev) => toggleIndex(prev, i));
    },
    [],
  );

  const rows = buildRows(ingredients, checked, makeToggle);

  return (
    <View>
      {rows.map((r) => (
        <ItemRow
          key={r.key}
          leading={r.leading}
          title={r.title}
          subtitle={r.subtitle}
          struck={r.struck}
        />
      ))}
    </View>
  );
}

const styles = {
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#5C4D3D',
    textAlign: 'center' as const,
  },
};
