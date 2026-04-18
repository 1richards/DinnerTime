/**
 * SearchBar primitives — Phase 19 D-03 (DoorDash-style sticky pill pattern).
 *
 * Exports:
 *   - StickySearchPill: absolute-positioned pill with animated elevation that
 *     navigates to /search?context=... on tap (matches Phase 15 modal=task
 *     convention; Phase 17 ships the real search surface inside that modal).
 *   - SearchBar: legacy inline search input kept for call sites that haven't
 *     migrated yet (Plan 19-05's sweep removes the last consumers).
 *
 *   Pure helpers buildSearchHref + shadowOpacityConfig are exported separately
 *   so SearchBar.test.ts can assert behavior without an RN renderer.
 */

import React from 'react';
import { Pressable, Text, Animated, View, TextInput } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { colors } from '../../design/tokens';
import { iconPropsForText } from '../../design/icons';

export type SearchContext = 'library' | 'something-new' | 'pantry';

// ---------------------------------------------------------------------------
// Pure helpers (testable without RN renderer)
// ---------------------------------------------------------------------------

export function buildSearchHref(context: string): string {
  return `/search?context=${context}`;
}

export function shadowOpacityConfig(): { inputRange: number[]; outputRange: number[] } {
  return { inputRange: [0, 40], outputRange: [0.05, 0.18] };
}

// ---------------------------------------------------------------------------
// StickySearchPill — the DoorDash-style top-of-screen search affordance
// ---------------------------------------------------------------------------

interface StickySearchPillProps {
  placeholder: string;
  context: SearchContext;
  scrollY: Animated.Value;
  onPress?: () => void;
}

export function StickySearchPill({ placeholder, context, scrollY, onPress }: StickySearchPillProps) {
  const cfg = shadowOpacityConfig();
  const shadowOpacity = scrollY.interpolate({ ...cfg, extrapolate: 'clamp' });

  const handlePress =
    onPress ?? (() => router.push(buildSearchHref(context) as `/search?${string}`));

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 8,
        left: 16,
        right: 16,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity,
        shadowRadius: 8,
        elevation: 3,
        zIndex: 20,
      }}
    >
      <Pressable
        onPress={handlePress}
        className="flex-1 flex-row items-center px-3"
        accessibilityRole="search"
        accessibilityLabel={placeholder}
      >
        <SymbolView
          name="magnifyingglass"
          {...iconPropsForText('caption')}
          tintColor={colors.textTertiary}
        />
        <Text className="ml-2 text-body text-text-tertiary">{placeholder}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Legacy SearchBar — inline text input, preserved until Plan 19-05 migration
// ---------------------------------------------------------------------------

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-surface-subtle rounded-button px-3 h-11">
      <SymbolView
        name="magnifyingglass"
        {...iconPropsForText('caption')}
        tintColor={colors.textTertiary}
      />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? 'Search recipes'}
        placeholderTextColor={colors.textTertiary}
        className="flex-1 ml-2 text-body text-text-primary"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <SymbolView
            name="xmark.circle.fill"
            {...iconPropsForText('caption')}
            tintColor={colors.textTertiary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
