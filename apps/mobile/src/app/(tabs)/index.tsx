import React, { useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { usePantryStore } from '../../stores/pantryStore';
import { SuggestionList } from '../../components/suggestions/SuggestionList';
import { HeroImage } from '../../components/ui/HeroImage';
import { FOOD_IMAGES } from '../../constants/foodImages';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
  LARGE_HEADER_HEIGHT,
} from '../../components/ui/useCollapsingHeader';

// Stable hero image for the home screen (changes daily but not per render)
const HERO_URI = FOOD_IMAGES.hero[new Date().getDay() % FOOD_IMAGES.hero.length];

export default function HomeScreen() {
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const profileId = useAuthStore((s) => s.profile?.id);
  const pantryItems = usePantryStore((s) => s.items);
  const loadItems = usePantryStore((s) => s.loadItems);

  const { onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } =
    useCollapsingHeader();

  // Load pantry items on mount if not already loaded
  useEffect(() => {
    if (profileId && pantryItems.length === 0) {
      loadItems(profileId);
    }
  }, [profileId, pantryItems.length, loadItems]);

  const titleText = displayName ? `Hey, ${displayName}!` : 'Home';

  const hero = (
    <HeroImage uri={HERO_URI} height={160}>
      <View>
        <Text
          style={{
            fontSize: 24,
            fontWeight: '900',
            color: '#FFFFFF',
            letterSpacing: -0.5,
          }}
          numberOfLines={1}
        >
          {titleText}
        </Text>
        <Text
          style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 4 }}
        >
          What should we cook tonight?
        </Text>
      </View>
    </HeroImage>
  );

  const listHeader = (
    <Animated.View
      style={{
        opacity: largeTitleOpacity,
        transform: [{ translateY: largeTitleTranslate }],
      }}
    >
      <View style={styles.largeHeader}>
        <Text style={styles.largeTitle}>{titleText}</Text>
        <Text style={styles.largeSubtitle}>What should we cook tonight?</Text>
      </View>
      {hero}
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['top', 'bottom']}>
      {/* Compact nav bar fades in on scroll */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.compactHeader, { opacity: compactHeaderOpacity }]}
      >
        <Text style={styles.compactTitle}>
          {displayName ? `Hey, ${displayName}!` : 'Home'}
        </Text>
      </Animated.View>

      {/* Action row — settings gear */}
      <View style={styles.actionRow} pointerEvents="box-none">
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={20} color="#3E332A" />
        </Pressable>
      </View>

      <SuggestionList HeaderComponent={listHeader} onScroll={onScroll} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
});
