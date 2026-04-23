/**
 * Phase 22-02 — WeekActionSheet.
 *
 * Apple-style iOS ActionSheet listing the 5 week-level actions that the
 * Plan tab's overflow (ellipsis) icon opens:
 *   - Regenerate week       (destructive — replaces the current plan)
 *   - Shift +1 week
 *   - Shift -1 week
 *   - Duplicate last week
 *   - Shopping list for week
 *   + Cancel
 *
 * Rendering: uses the native `ActionSheetIOS` module — matches the pattern
 * established in `components/ui/HeaderEllipsis.tsx`. The component renders
 * nothing (`return null`); it only owns the side-effect of presenting the
 * sheet when `visible` flips to true.
 *
 * Lifecycle contract:
 *   - Parent owns `visible`. When `visible` becomes `true`, the sheet opens.
 *   - When the user selects an option OR taps Cancel, the component fires
 *     the matching `on*` callback (or none, for Cancel) AND calls
 *     `onDismiss()` so the parent flips `visible` back to false. The parent
 *     is then free to re-open the sheet by flipping `visible` again.
 *   - Opening is gated on the `visible` transition from false → true via a
 *     `useEffect` dep on `visible`. Hiding the sheet programmatically is
 *     not supported by ActionSheetIOS (it auto-dismisses on any tap).
 */
import { useEffect } from 'react';
import { ActionSheetIOS } from 'react-native';

export interface WeekActionSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onRegenerate: () => void;
  onShiftForward: () => void;
  onShiftBackward: () => void;
  onDuplicateLastWeek: () => void;
  onShoppingList: () => void;
}

export function WeekActionSheet({
  visible,
  onDismiss,
  onRegenerate,
  onShiftForward,
  onShiftBackward,
  onDuplicateLastWeek,
  onShoppingList,
}: WeekActionSheetProps): null {
  useEffect(() => {
    if (!visible) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [
          'Regenerate week',
          'Shift +1 week',
          'Shift -1 week',
          'Duplicate last week',
          'Shopping list for week',
          'Cancel',
        ],
        cancelButtonIndex: 5,
        destructiveButtonIndex: 0,
        title: 'Week actions',
      },
      (idx) => {
        if (idx === 0) onRegenerate();
        else if (idx === 1) onShiftForward();
        else if (idx === 2) onShiftBackward();
        else if (idx === 3) onDuplicateLastWeek();
        else if (idx === 4) onShoppingList();
        // idx === 5 → Cancel; no callback, only dismiss
        onDismiss();
      }
    );
    // Intentionally only depend on `visible` — we open the sheet exactly
    // once per visible→true transition. Callback identities may change
    // between renders without triggering re-opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return null;
}
