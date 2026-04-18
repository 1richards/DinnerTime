import { ActionSheetIOS, Pressable } from 'react-native';
import { SymbolIcon } from './SymbolIcon';

/**
 * A single row in the ActionSheet presented by a HeaderEllipsis overflow menu.
 *
 *   label:        user-visible label, sent to ActionSheetIOS as-is.
 *   onPress:      handler invoked when the user selects this row.
 *   destructive:  marks the row as destructive (iOS renders it red). At most
 *                 ONE action in the list should be destructive; if multiple are
 *                 flagged, the first destructive action wins.
 */
export type EllipsisAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export interface HeaderEllipsisProps {
  actions: EllipsisAction[];
  /**
   * Optional override of the tint color applied to the SF Symbol glyph. Defaults
   * to Phase 15's warmGray header tint `#1F2937`. Consumers placing the ellipsis
   * over a dark background (e.g. a hero image) should override to `#FFFFFF`.
   */
  tintColor?: string;
  /**
   * Accessibility label for the touchable. Defaults to "More options" per iOS
   * conventions (VoiceOver reads this prior to the sheet opening).
   */
  accessibilityLabel?: string;
}

/**
 * Renders a single SF Symbol `ellipsis` icon that, on press, opens a native
 * iOS ActionSheet populated with the supplied actions plus a Cancel row.
 *
 * Used in lieu of 3+ inline header action icons — matches Apple's Mail/Notes
 * overflow pattern (see Phase 15 CONTEXT D-05).
 */
export function HeaderEllipsis({
  actions,
  tintColor = '#1F2937',
  accessibilityLabel = 'More options',
}: HeaderEllipsisProps) {
  const showSheet = () => {
    const labels = actions.map((a) => a.label);
    const destructiveIdx = actions.findIndex((a) => a.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, 'Cancel'],
        cancelButtonIndex: labels.length,
        destructiveButtonIndex: destructiveIdx >= 0 ? destructiveIdx : undefined,
      },
      (idx) => {
        if (idx != null && idx < actions.length) {
          actions[idx].onPress();
        }
      },
    );
  };

  return (
    <Pressable onPress={showSheet} hitSlop={12} accessibilityLabel={accessibilityLabel}>
      <SymbolIcon name="ellipsis" size="body" weight="medium" tintColor={tintColor} />
    </Pressable>
  );
}
