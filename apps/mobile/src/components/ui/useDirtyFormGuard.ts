import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { Alert } from 'react-native';

/**
 * Suspends swipe-back / chevron-back / programmatic navigation while a form
 * has unsaved edits, surfacing an iOS Alert with Discard / Keep-editing
 * affordances.
 *
 * Internally delegates to React Navigation 7's `usePreventRemove` hook
 * (supersedes the `beforeRemove` listener pattern). Navigator-agnostic —
 * works with native stack, tabs, and drawer.
 *
 * Usage:
 *   useDirtyFormGuard(draft !== original);
 *
 * Alert button semantics match iOS Mail / Notes discard flow:
 *   - "Keep editing" (cancel): closes the alert, navigation stays blocked
 *   - "Discard" (destructive): dispatches the blocked NavigationAction so
 *     the original back/swipe proceeds.
 */
export function useDirtyFormGuard(isDirty: boolean): void {
  const navigation = useNavigation();

  usePreventRemove(isDirty, ({ data }) => {
    Alert.alert(
      'Unsaved changes',
      "You'll lose your edits if you leave now.",
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
}
