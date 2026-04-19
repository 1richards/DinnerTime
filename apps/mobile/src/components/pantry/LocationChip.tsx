import React from 'react';
import { Pressable } from 'react-native';
import { Chip } from '../ui/Chip';
import type { SourceLocation } from '../../types/pantry';
import { LOCATION_SYMBOLS, LOCATION_LABELS } from './locationSymbols';

interface LocationChipProps {
  value: SourceLocation;
  onPress: () => void;
}

/**
 * Display-variant Chip wrapped in a Pressable to add a tap affordance for
 * changing the location. Used on the scan review screen per item.
 *
 * Phase 19's `Chip` only wires onPress for kind='filter'; wrapping preserves
 * the display-chip visual language while still giving us a tap target.
 */
export function LocationChip({ value, onPress }: LocationChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Location: ${LOCATION_LABELS[value]} — tap to change`}
    >
      <Chip
        kind="display"
        tone="default"
        label={LOCATION_LABELS[value]}
        leadingIcon={LOCATION_SYMBOLS[value]}
      />
    </Pressable>
  );
}
