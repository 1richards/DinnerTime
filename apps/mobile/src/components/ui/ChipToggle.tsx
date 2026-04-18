/**
 * DEPRECATED — use `Chip` from './Chip' instead.
 *
 * Kept as a thin shim so Plan 19-02 doesn't break the ~6 existing call sites
 * (settings/IngredientSearch, DislikesSection, CuisineSection, DietarySection,
 * MemberFormModal). Plan 19-05's sweep migrates every call site to `Chip` and
 * removes this file.
 *
 * Notes:
 * - `variant='removable'` appends a trailing "×" when selected; the underlying
 *   Chip does not render a close affordance.
 * - `colorScheme='red'` is a DELIBERATE visual regression in the shim — those
 *   call sites should migrate to `kind='display' tone='destructive'` in Plan
 *   05. For now both colorSchemes render as the standard filter kind (brand
 *   terracotta when selected, neutral when not).
 */

import React from 'react';
import { Chip } from './Chip';

interface ChipToggleProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  variant?: 'default' | 'removable';
  colorScheme?: 'orange' | 'red';
}

export function ChipToggle({
  label,
  selected,
  onToggle,
  variant,
  // colorScheme intentionally ignored — see deprecation note above.
  colorScheme: _colorScheme,
}: ChipToggleProps) {
  const displayLabel =
    variant === 'removable' && selected ? `${label} \u00d7` : label;
  return (
    <Chip
      label={displayLabel}
      kind="filter"
      selected={selected}
      onPress={onToggle}
    />
  );
}
