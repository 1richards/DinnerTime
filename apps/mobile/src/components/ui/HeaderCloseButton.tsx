import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { SymbolIcon } from './SymbolIcon';

/**
 * Shared "X" close affordance for the `headerLeft` slot of modal-root screens.
 *
 * Calls `router.dismissAll()` (NOT `router.back()`) so tapping "X" fully exits
 * the modal stack even when the user has pushed sub-screens inside the modal
 * group. On sub-screens inside a modal, leave the chevron-back default —
 * `router.back()` correctly pops one level.
 *
 * See 15-RESEARCH.md Pitfall 4 and "Scan flow modal migration" section.
 */
export function HeaderCloseButton() {
  return (
    <Pressable
      onPress={() => router.dismissAll()}
      hitSlop={12}
      accessibilityLabel="Close"
    >
      <SymbolIcon name="xmark" size="body" weight="medium" tintColor="#1F2937" />
    </Pressable>
  );
}
