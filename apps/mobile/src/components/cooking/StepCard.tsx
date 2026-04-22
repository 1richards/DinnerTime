/**
 * StepCard — Phase 16 Wave 2 (16-04) — single step card for the cooking
 * scrollable recipe.
 *
 * Flips typography + surface + left-edge rail based on `isCurrent`:
 *   - `isCurrent === true`  → display (34pt/700) on bg-surface, 4pt brand rail.
 *   - `isCurrent === false` → title (22pt/700) on bg-bg, invisible rail (the
 *     rail column is still reserved so text alignment does NOT shift between
 *     states — only the rail fill color changes).
 *
 * Tokens only — no hardcoded hex. Typography + color map to UI-SPEC
 * §Typography / §Color. COOK-UX-03 is satisfied by the size + surface
 * differentiation; COOK-UX-04 needs the current-step emphasis so the user can
 * spot "what am I on?" at a glance.
 */
import React from 'react';
import { View, Text } from 'react-native';

export interface StepCardProps {
  stepNumber: number;
  totalSteps: number;
  text: string;
  isCurrent: boolean;
}

export function StepCard({ stepNumber, totalSteps, text, isCurrent }: StepCardProps) {
  // Reserve a fixed-width rail column so the body doesn't reflow when the
  // highlight moves between cards. The rail color swaps; the width stays.
  const railClass = isCurrent ? 'w-1 bg-brand' : 'w-1 bg-transparent';

  // Current step: 24pt body padding + secondary surface (cream/white swap).
  // Non-current: 16pt body padding + dominant surface.
  const bodyClass = isCurrent ? 'flex-1 p-6 bg-surface' : 'flex-1 p-4 bg-bg';

  // Step number label tone — brand tint when current, tertiary text when not.
  const labelClass = isCurrent
    ? 'text-label text-brand mb-2'
    : 'text-label text-text-tertiary mb-2';

  // Body typography — UI-SPEC §Typography display (current) / title (non-current).
  const textClass = isCurrent
    ? 'text-display text-text-primary'
    : 'text-title text-text-primary';

  return (
    <View
      className="flex-row"
      accessibilityRole="text"
      accessibilityState={isCurrent ? { selected: true } : undefined}
    >
      <View className={railClass} />
      <View className={bodyClass}>
        <Text className={labelClass}>
          STEP {stepNumber} of {totalSteps}
        </Text>
        <Text className={textClass}>{text}</Text>
      </View>
    </View>
  );
}

export default StepCard;
