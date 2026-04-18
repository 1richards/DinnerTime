import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { HeroImage } from '../../components/ui/HeroImage';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { FOOD_IMAGES } from '../../constants/foodImages';

const CUISINE_OPTIONS = [
  'Italian',
  'Mexican',
  'Chinese',
  'Japanese',
  'Indian',
  'Thai',
  'Mediterranean',
  'American',
  'Korean',
  'French',
];

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut Allergy',
  'Keto',
  'Paleo',
];

const TOTAL_STEPS = 3;

// One hero image per step
const STEP_IMAGES = [
  FOOD_IMAGES.hero[2],       // step 0: hands cooking
  FOOD_IMAGES.hero[3],       // step 1: steam rising
  FOOD_IMAGES.breakfast[1],  // step 2: preferences
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [householdSize, setHouseholdSize] = useState(2);
  const [hasKids, setHasKids] = useState(false);
  const [kidCount, setKidCount] = useState(1);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  if (!isLoggedIn) return <Redirect href="/(auth)/login" />;
  if (isOnboarded) return <Redirect href="/(tabs)/kitchen" />;

  const toggleItem = (
    item: string,
    list: string[],
    setList: (v: string[]) => void
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleComplete = async () => {
    if (!user) {
      console.log('[onboarding] handleComplete: no user');
      return;
    }

    console.log('[onboarding] handleComplete: starting, user.id =', user.id);
    setSaving(true);
    try {
      console.log('[onboarding] calling supabase.update...');
      const { data, error, status, statusText } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          household_size: householdSize,
          cuisine_preferences: cuisines,
          dietary_preferences: dietary,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select();

      console.log('[onboarding] supabase.update returned', { data, error, status, statusText });

      if (error) {
        Alert.alert('Error', `Could not save: ${error.message}`);
        return;
      }

      console.log('[onboarding] setting isOnboarded=true');
      useAuthStore.setState({ isOnboarded: true });
    } catch (err) {
      console.log('[onboarding] EXCEPTION', err);
      Alert.alert('Exception', String(err));
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return displayName.trim().length > 0;
    return true;
  };

  const stepTitles = [
    'Welcome to DinnerTime!',
    'Your Household',
    'Your Preferences',
  ];

  const stepSubtitles = [
    "Let's get to know you so we can suggest meals you'll love.",
    'This helps us size our recipe suggestions.',
    'Pick your favorites — you can always change these later.',
  ];

  return (
    <SafeAreaView className="flex-1 bg-warmWhite">
      {/* Step hero image */}
      <HeroImage uri={STEP_IMAGES[step]} height={160} gradientDirection="bottom">
        <View>
          {/* Progress dots */}
          <View style={styles.progressDots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step
                    ? styles.dotActive
                    : i < step
                      ? styles.dotPast
                      : styles.dotFuture,
                ]}
              />
            ))}
          </View>
          <Text style={styles.heroTitle}>{stepTitles[step]}</Text>
          <Text style={styles.heroSub}>{stepSubtitles[step]}</Text>
        </View>
      </HeroImage>

      <ScrollView
        contentContainerClassName="flex-grow px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Step 0: Welcome & Display Name */}
        {step === 0 && (
          <View>
            <Input
              label="What should we call you?"
              placeholder="Your name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
            />
          </View>
        )}

        {/* Step 1: Household */}
        {step === 1 && (
          <View>
            <Text style={styles.fieldLabel}>
              How many people are you cooking for?
            </Text>

            <View style={styles.numberGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setHouseholdSize(n)}
                  style={[
                    styles.numberButton,
                    householdSize === n && styles.numberButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.numberButtonText,
                      householdSize === n && styles.numberButtonTextActive,
                    ]}
                  >
                    {n === 8 ? '8+' : n}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Kids toggle */}
            <Pressable
              onPress={() => setHasKids(!hasKids)}
              style={[
                styles.toggleRow,
                hasKids && styles.toggleRowActive,
              ]}
            >
              <Text style={styles.toggleLabel}>We have kids</Text>
              <View
                style={[
                  styles.checkbox,
                  hasKids && styles.checkboxActive,
                ]}
              >
                {hasKids && (
                  <SymbolIcon name="checkmark" size={12} weight="bold" tintColor="#FFFFFF" />
                )}
              </View>
            </Pressable>

            {hasKids && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.fieldLabel}>How many kids?</Text>
                <View style={styles.numberGrid}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setKidCount(n)}
                      style={[
                        styles.numberButton,
                        kidCount === n && styles.numberButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.numberButtonText,
                          kidCount === n && styles.numberButtonTextActive,
                        ]}
                      >
                        {n === 5 ? '5+' : n}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Step 2: Preferences */}
        {step === 2 && (
          <View>
            <Text style={styles.fieldLabel}>Cuisines you enjoy</Text>
            <View style={styles.chipGrid}>
              {CUISINE_OPTIONS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => toggleItem(c, cuisines, setCuisines)}
                  style={[
                    styles.chip,
                    cuisines.includes(c) && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      cuisines.includes(c) && styles.chipTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
              Any dietary needs?
            </Text>
            <View style={styles.chipGrid}>
              {DIETARY_OPTIONS.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => toggleItem(d, dietary, setDietary)}
                  style={[
                    styles.chip,
                    dietary.includes(d) && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      dietary.includes(d) && styles.chipTextActive,
                    ]}
                  >
                    {d}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Navigation buttons */}
        <View style={styles.navButtons}>
          {step > 0 && (
            <Button
              title="Back"
              variant="ghost"
              onPress={() => setStep(step - 1)}
              className="flex-1"
            />
          )}

          {step < TOTAL_STEPS - 1 ? (
            <Button
              title="Next"
              onPress={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1"
            />
          ) : (
            <Button
              title="Get Started"
              onPress={handleComplete}
              loading={saving}
              className="flex-1"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  progressDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  dotPast: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotFuture: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 5,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 19,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3F3429',
    marginBottom: 12,
  },
  numberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  numberButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1EAE0',
    borderWidth: 1,
    borderColor: '#E5D9CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberButtonActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  numberButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3F3429',
  },
  numberButtonTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E5D9CA',
  },
  toggleRowActive: {
    backgroundColor: '#FFF5EB',
    borderColor: '#FED7AA',
  },
  toggleLabel: {
    fontSize: 15,
    color: '#2A221A',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1BFA8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1EAE0',
    borderWidth: 1,
    borderColor: '#E5D9CA',
  },
  chipActive: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3F3429',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
});
