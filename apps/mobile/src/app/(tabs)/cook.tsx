import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HeroImage } from '../../components/ui/HeroImage';
import { FOOD_IMAGES } from '../../constants/foodImages';

const COOK_HERO = FOOD_IMAGES.hero[3]; // steam rising

export default function CookTabScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      {/* Full-width hero */}
      <HeroImage uri={COOK_HERO} height={280} gradientDirection="bottom">
        <View>
          <Text style={styles.heroTag}>VOICE-GUIDED</Text>
          <Text style={styles.heroTitle}>Hands-Free Cooking</Text>
          <Text style={styles.heroSub}>
            Pick a recipe and let Claude guide you step by step — no touching your phone.
          </Text>
        </View>
      </HeroImage>

      {/* CTA area */}
      <View style={styles.body}>
        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name="mic-outline" size={22} color="#F97316" />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Ask questions while you cook</Text>
            <Text style={styles.featureDesc}>
              "How long do I sear the chicken?" — Claude listens and answers.
            </Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name="timer-outline" size={22} color="#F97316" />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Hands-free step navigation</Text>
            <Text style={styles.featureDesc}>
              Say "next step" or "repeat that" without touching the screen.
            </Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <View style={styles.featureIcon}>
            <Ionicons name="sparkles-outline" size={22} color="#F97316" />
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Real-time substitutions</Text>
            <Text style={styles.featureDesc}>
              Out of an ingredient? Claude suggests smart swaps on the fly.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push('/(tabs)/recipes')}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
        >
          <Ionicons name="book-outline" size={20} color="#FFFFFF" />
          <Text style={styles.ctaButtonText}>Open Recipes</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(tabs)')}
          style={styles.backLink}
        >
          <Text style={styles.backLinkText}>Go home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroTag: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 21,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 22,
    gap: 14,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A140F',
    marginBottom: 3,
  },
  featureDesc: {
    fontSize: 13,
    color: '#7A6651',
    lineHeight: 19,
  },
  ctaButton: {
    backgroundColor: '#F97316',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaButtonPressed: {
    opacity: 0.88,
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backLink: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  backLinkText: {
    color: '#A89178',
    fontSize: 14,
  },
});
