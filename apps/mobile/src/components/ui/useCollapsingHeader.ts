import { useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { colors, typography } from '../../design/tokens';

export const LARGE_HEADER_HEIGHT = 68;
export const COLLAPSED_HEADER_HEIGHT = 52;

export function useCollapsingHeader() {
  const scrollY = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  );

  const largeTitleOpacity = scrollY.interpolate({
    inputRange: [0, LARGE_HEADER_HEIGHT * 0.5, LARGE_HEADER_HEIGHT],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  const largeTitleTranslate = scrollY.interpolate({
    inputRange: [0, LARGE_HEADER_HEIGHT],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  const compactHeaderOpacity = scrollY.interpolate({
    inputRange: [LARGE_HEADER_HEIGHT * 0.5, LARGE_HEADER_HEIGHT],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return { scrollY, onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity };
}

// Translucent compact-header background derived from colors.bg (#FAF7F2) at 95% alpha.
// Inlined as an rgba literal because RN doesn't accept `${hex}F2` — comment documents derivation.
const COMPACT_HEADER_BG = 'rgba(250,247,242,0.95)';
// Surface white at 90% alpha for the neutral action-button fill.
const ACTION_BTN_BG = 'rgba(255,255,255,0.9)';

export const collapsingHeaderStyles = StyleSheet.create({
  largeHeader: {
    paddingHorizontal: 20,
    // ~12pt of breathing room above the big title so it doesn't butt up
    // against the banner/status chrome above it (user feedback after the
    // redundant safe-area inset was removed).
    paddingTop: 12,
    paddingBottom: 4,
    marginTop: 0,
  },
  largeTitle: {
    ...typography.display,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  largeSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  compactHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: COLLAPSED_HEADER_HEIGHT,
    backgroundColor: COMPACT_HEADER_BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  compactTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  actionRow: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    height: COLLAPSED_HEADER_HEIGHT - 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    zIndex: 10,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ACTION_BTN_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.destructive,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
