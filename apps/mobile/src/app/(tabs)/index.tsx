import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { usePantryStore } from '../../stores/pantryStore';
import { SuggestionList } from '../../components/suggestions/SuggestionList';
import { HeroImage } from '../../components/ui/HeroImage';
import { FOOD_IMAGES } from '../../constants/foodImages';

// Stable hero image for the home screen (changes daily but not per render)
const HERO_URI = FOOD_IMAGES.hero[new Date().getDay() % FOOD_IMAGES.hero.length];

export default function HomeScreen() {
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const profileId = useAuthStore((s) => s.profile?.id);
  const pantryItems = usePantryStore((s) => s.items);
  const loadItems = usePantryStore((s) => s.loadItems);

  // Load pantry items on mount if not already loaded
  useEffect(() => {
    if (profileId && pantryItems.length === 0) {
      loadItems(profileId);
    }
  }, [profileId, pantryItems.length, loadItems]);

  const greeting = displayName
    ? `Hey, ${displayName}! 👋`
    : 'Your Dinner Dashboard';

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      {/* Hero header with food photography */}
      <HeroImage uri={HERO_URI} height={200}>
        <View>
          <Text
            style={{
              fontSize: 26,
              fontWeight: '900',
              color: '#FFFFFF',
              letterSpacing: -0.5,
            }}
            numberOfLines={1}
          >
            {greeting}
          </Text>
          <Text
            style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)', marginTop: 4 }}
          >
            What should we cook tonight?
          </Text>
        </View>
      </HeroImage>

      {/* Suggestions */}
      <SuggestionList />
    </SafeAreaView>
  );
}
