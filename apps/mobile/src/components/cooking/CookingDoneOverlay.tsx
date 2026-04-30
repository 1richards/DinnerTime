/**
 * CookingDoneOverlay — full-screen celebration shown when the user
 * taps "Done" on the cooking-mode finale.
 *
 * Renders a brand-orange backdrop with a centered scale+fade-in
 * `checkmark.circle.fill`, a "Nice cooking!" heading, and a brief
 * subtitle. Auto-calls `onComplete` after ~1500ms so the parent can
 * navigate to the Plan tab and let the celebration fade naturally.
 */
import React, { useEffect } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { SymbolView } from 'expo-symbols';
import { colors } from '../../design/tokens';

export interface CookingDoneOverlayProps {
  visible: boolean;
  /** Fires after the celebration has played long enough to register
      ("you cooked this") but before it overstays its welcome. Parent
      typically uses it to mark the meal cooked + nav to Plan. */
  onComplete: () => void;
}

const HOLD_MS = 1500;

export function CookingDoneOverlay({
  visible,
  onComplete,
}: CookingDoneOverlayProps) {
  const iconScale = useSharedValue(0.4);
  const iconOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      iconScale.value = 0.4;
      iconOpacity.value = 0;
      textOpacity.value = 0;
      return;
    }

    iconScale.value = withSequence(
      withSpring(1.15, { damping: 8, stiffness: 110 }),
      withSpring(1.0, { damping: 14, stiffness: 140 }),
    );
    iconOpacity.value = withTiming(1, { duration: 220 });
    textOpacity.value = withTiming(1, { duration: 360 });

    const timer = setTimeout(() => {
      onComplete();
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [visible, onComplete, iconScale, iconOpacity, textOpacity]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Disable native dismissal so the user can't accidentally swipe it
      // away before markCooked fires.
      onRequestClose={() => {}}
      accessibilityLabel="Cooking complete celebration"
    >
      <View style={styles.backdrop}>
        <Animated.View style={iconStyle}>
          <SymbolView
            name="checkmark.circle.fill"
            size={120}
            tintColor="#FFFFFF"
          />
        </Animated.View>
        <Animated.View style={[styles.textWrap, textStyle]}>
          <Text style={styles.heading}>Nice cooking!</Text>
          <Text style={styles.subtitle}>
            We'll mark this day as cooked.
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  textWrap: {
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
  },
});
