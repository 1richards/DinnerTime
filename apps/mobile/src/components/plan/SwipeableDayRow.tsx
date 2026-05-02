/**
 * Phase 22-06 — SwipeableDayRow wraps DayRow with left-swipe quick actions.
 *
 * The three revealed actions — Swap, Cooked, Skip — mirror the inline
 * overflow buttons on the existing DayRow, but trade the row's right-side
 * icon cluster for a more discoverable gesture. Each action fires the
 * parent-owned handler AND a `plan.swipe_action` telemetry event (sanitized
 * 14-key whitelist, `variant` ∈ 'swap' | 'cook' | 'skip') so we can measure
 * adoption of the gesture vs the inline buttons.
 *
 * Design decisions (22-CONTEXT D-41..D-43 + 22-RESEARCH Pattern 3):
 *   - Uses `ReanimatedSwipeable` (NOT the legacy `Swipeable`) — the
 *     Reanimated-backed implementation runs on the UI thread, keeping the
 *     gesture buttery at 60fps under scroll-list pressure.
 *   - Tints come from the Phase 19 `colors` token set only (brand / success
 *     / warning). Zero raw hex literals. PLAN-X-15 compliance is a grep
 *     target — keep it that way.
 *   - When the entry is null (unplanned day), we short-circuit to the
 *     underlying DayRow so the swipe-revealed actions don't dangle on a
 *     meal that doesn't exist.
 *
 * GestureHandlerRootView is already wired at app root (src/app/_layout.tsx
 * line 91 — `<GestureHandlerRootView style={{ flex: 1 }}>`), so callers do
 * not need additional provider plumbing. This module is therefore safe to
 * drop into FlatList renderItem without further setup.
 *
 * Test contract: the `renderRightActions` render-prop is exercised in the
 * unit test by invoking it directly — see SwipeableDayRow.test.ts.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { SymbolViewProps } from 'expo-symbols';
import { colors } from '../../design/tokens';
import { DayRow } from './DayRow';
import { logPlanEvent, sanitizePayload } from '../../plan/telemetry';
import type { MealPlanEntry } from '../../types/mealPlan';

export interface SwipeableDayRowProps {
  entry: MealPlanEntry | null;
  dayLabel: string;
  dateLabel?: string;
  isSwapping: boolean;
  isCooking: boolean;
  onSwap: () => void;
  onCook: () => void;
  onSkip: () => void;
  onPress: () => void;
  /** Drag-to-reorder handle. When provided, long-press on the row hands
      control to the parent DraggableFlatList's drag gesture. */
  onLongPress?: () => void;
  isDragActive?: boolean;
  /** Quick-task 6 — active weekly focus theme (meal_plans.focus_theme).
      Forwarded into DayRow via the existing rest-spread so the
      matching-focus chip can fire when this entry practices the theme. */
  focusTheme?: string | null;
}

interface ActionProps {
  icon: SymbolViewProps['name'];
  label: string;
  tint: string;
  onPress: () => void;
  testID?: string;
}

/** Single action pill revealed behind the DayRow on swipe. */
function Action({ icon, label, tint, onPress, testID }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.action, { backgroundColor: tint }]}
      accessibilityLabel={label}
      accessibilityRole="button"
      testID={testID}
    >
      <SymbolIcon name={icon} size={20} tintColor="#FFFFFF" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * Build the `renderRightActions` payload. Exported for direct test-time
 * invocation (the Reanimated swipeable doesn't expose a render-prop hook
 * that vitest-node can exercise, so the test imports this helper and
 * exercises each Pressable's onPress directly).
 */
export function renderRightActionsFor(props: {
  entry: MealPlanEntry;
  onSwap: () => void;
  onCook: () => void;
  onSkip: () => void;
}): React.ReactElement {
  const { entry, onSwap, onCook, onSkip } = props;
  const fire = (
    variant: 'swap' | 'cook' | 'skip',
    fn: () => void,
  ): (() => void) =>
    () => {
      // Telemetry fires BEFORE the handler — the handler may cause the
      // entry to unmount (e.g. after a swap/cook), and we want the analytics
      // event either way.
      logPlanEvent({
        name: 'plan.swipe_action',
        session_id: `swipe-${entry.id}`,
        meal_plan_id: entry.meal_plan_id,
        meal_plan_entry_id: entry.id,
        payload: sanitizePayload({
          variant,
          meal_plan_entry_id: entry.id,
          meal_plan_id: entry.meal_plan_id,
        }),
      });
      fn();
    };

  return (
    <View style={styles.actionGroup}>
      <Action
        icon="arrow.left.arrow.right"
        label="Swap"
        tint={colors.brand}
        onPress={fire('swap', onSwap)}
        testID="swipe-action-swap"
      />
      <Action
        icon="checkmark"
        label="Cooked"
        tint={colors.success}
        onPress={fire('cook', onCook)}
        testID="swipe-action-cook"
      />
      <Action
        icon="xmark"
        label="Clear"
        tint={colors.warning}
        onPress={fire('skip', onSkip)}
        testID="swipe-action-skip"
      />
    </View>
  );
}

export function SwipeableDayRow(props: SwipeableDayRowProps): React.ReactElement {
  const { entry, onSwap, onCook, onSkip, onLongPress, isDragActive, ...dayRowProps } = props;

  // Unplanned-day rows don't reveal any actions — the three handlers have
  // nothing to act on, and the visual affordance would be misleading.
  if (!entry) {
    return (
      <View style={styles.tileWrap}>
        <DayRow
          entry={null}
          {...dayRowProps}
          onSwap={onSwap}
          onCook={onCook}
          onLongPress={onLongPress}
          isDragActive={isDragActive}
        />
      </View>
    );
  }

  // Margins live OUTSIDE the swipeable so the action background aligns
  // exactly with the tile's visible bounds. Inside the swipeable, the
  // tile's mx-4 mb-2 would have left the colored action band stretched
  // edge-to-edge while the tile sat inset — a visual mismatch.
  return (
    <View style={styles.tileWrap}>
      <ReanimatedSwipeable
        renderRightActions={() =>
          renderRightActionsFor({ entry, onSwap, onCook, onSkip })
        }
        rightThreshold={80}
        overshootRight={false}
        // Disable swipe while a drag is active so the two gestures
        // don't fight each other on the same row.
        enabled={!isDragActive}
      >
        <DayRow
          entry={entry}
          {...dayRowProps}
          onSwap={onSwap}
          onCook={onCook}
          onLongPress={onLongPress}
          isDragActive={isDragActive}
        />
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  tileWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  actionGroup: {
    flexDirection: 'row',
  },
  action: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
