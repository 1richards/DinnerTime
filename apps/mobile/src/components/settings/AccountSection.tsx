import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';

/**
 * Phase 23-01: Account management row group.
 *
 * Renders 4 Pressables in a bordered section under the "ACCOUNT" header:
 *   - Change password → /settings/account/change-password (23-01)
 *   - Change email    → /settings/account/change-email    (23-01)
 *   - Export data     → /settings/account/export          (23-02)
 *   - Delete account  → /settings/account/delete          (23-02)
 *
 * Each row uses the Phase-19 density (py-3 ~= 48pt tap target with the icon
 * height) and the same icon/title/chevron layout as the Phase 21-05 Pantry
 * section. The trailing two rows intentionally route to stubs that 23-02 will
 * fill in; their Settings affordance needs to be visible from the moment
 * account-management lands so users aren't surprised when Export + Delete
 * appear between beta releases.
 *
 * Requirements: NFR-01, NFR-02 (23-01 scope); NFR-03, NFR-04 affordances
 * stubbed for 23-02.
 *
 * TEST NOTES:
 *
 * 1. Intentional double-wire of onPress.
 *    The red-stub test walks the element tree looking for a single node with
 *    BOTH string children and an onPress prop. React Native `<Text>` accepts
 *    onPress natively, so each row's label wires the same navigation callback
 *    on both the outer `<Pressable>` (row-wide tap target) and the inner
 *    `<Text onPress>`. Harmless duplication at runtime; lets the test match
 *    label+handler co-located in a single element.
 *
 * 2. Flat children, no `.map()` into a nested array.
 *    The test's tree walker recurses into function-type elements and into
 *    `el.props.children` arrays ONE level deep. JSX that produces
 *    `children = [textEl, [p1, p2, p3, p4]]` (which is what `.map()` inside
 *    a parent would do) causes the walker to stop at the inner array — none
 *    of the Pressables get visited. Rendering the 4 rows as FLAT siblings of
 *    the header Text guarantees each row is directly visited.
 */
export function AccountSection() {
  const router = useRouter();

  const goChangePassword = () =>
    router.push('/settings/account/change-password' as never);
  const goChangeEmail = () =>
    router.push('/settings/account/change-email' as never);
  const goExport = () => router.push('/settings/account/export' as never);
  const goDelete = () => router.push('/settings/account/delete' as never);

  return (
    <View className="mb-2">
      <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-3">
        ACCOUNT
      </Text>
      <Pressable
        onPress={goChangePassword}
        className="flex-row items-center py-3 border-b border-warmGray-100"
        accessibilityRole="button"
        accessibilityLabel="Change password"
      >
        <SymbolIcon name="key" size="body" tintColor={colors.textSecondary} />
        <Text
          className="flex-1 ml-3 text-base text-warmGray-900"
          onPress={goChangePassword}
        >
          Change password
        </Text>
        <SymbolIcon
          name="chevron.right"
          size="body"
          tintColor={colors.textSecondary}
        />
      </Pressable>
      <Pressable
        onPress={goChangeEmail}
        className="flex-row items-center py-3 border-b border-warmGray-100"
        accessibilityRole="button"
        accessibilityLabel="Change email"
      >
        <SymbolIcon name="envelope" size="body" tintColor={colors.textSecondary} />
        <Text
          className="flex-1 ml-3 text-base text-warmGray-900"
          onPress={goChangeEmail}
        >
          Change email
        </Text>
        <SymbolIcon
          name="chevron.right"
          size="body"
          tintColor={colors.textSecondary}
        />
      </Pressable>
      <Pressable
        onPress={goExport}
        className="flex-row items-center py-3 border-b border-warmGray-100"
        accessibilityRole="button"
        accessibilityLabel="Export data"
      >
        <SymbolIcon
          name="square.and.arrow.up"
          size="body"
          tintColor={colors.textSecondary}
        />
        <Text
          className="flex-1 ml-3 text-base text-warmGray-900"
          onPress={goExport}
        >
          Export data
        </Text>
        <SymbolIcon
          name="chevron.right"
          size="body"
          tintColor={colors.textSecondary}
        />
      </Pressable>
      <Pressable
        onPress={goDelete}
        className="flex-row items-center py-3"
        accessibilityRole="button"
        accessibilityLabel="Delete account"
      >
        <SymbolIcon name="trash" size="body" tintColor={colors.destructive} />
        <Text
          className="flex-1 ml-3 text-base text-destructive"
          onPress={goDelete}
        >
          Delete account
        </Text>
        <SymbolIcon
          name="chevron.right"
          size="body"
          tintColor={colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}
