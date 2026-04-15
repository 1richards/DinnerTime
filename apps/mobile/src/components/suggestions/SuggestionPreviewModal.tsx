import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { FOOD_IMAGES } from '../../constants/foodImages';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import type { DinnerSuggestion } from '../../types/suggestions';

interface Props {
  visible: boolean;
  suggestion: DinnerSuggestion | null;
  onClose: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function todayDayOfWeek(): number {
  // JS getDay(): Sun=0..Sat=6. Shift so Mon=0.
  const js = new Date().getDay();
  return js === 0 ? 6 : js - 1;
}

const getApiBaseUrl = (): string =>
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Not authenticated');
  return data.session.access_token;
}

export function SuggestionPreviewModal({ visible, suggestion, onClose }: Props) {
  const fetchCurrentPlan = useMealPlanStore((s) => s.fetchCurrent);
  const [selectedDay, setSelectedDay] = useState<number>(todayDayOfWeek());
  const [planning, setPlanning] = useState(false);
  const [planned, setPlanned] = useState(false);

  // Reset state each time the modal opens for a new suggestion.
  React.useEffect(() => {
    if (visible) {
      setSelectedDay(todayDayOfWeek());
      setPlanned(false);
      setPlanning(false);
    }
  }, [visible, suggestion?.title]);

  const handleAddToPlan = async () => {
    if (!suggestion) return;
    setPlanning(true);
    try {
      const token = await getAuthToken();
      const body = {
        day: selectedDay,
        title: suggestion.title,
        description: suggestion.description,
        ingredients: [
          ...(suggestion.ingredients_used ?? []).map((name) => ({ name })),
          ...(suggestion.ingredients_needed ?? []).map((name) => ({ name })),
        ],
        estimated_time_minutes: suggestion.estimated_time_minutes,
        difficulty: suggestion.difficulty,
        kid_friendly: suggestion.kid_friendly,
        why_suggested: suggestion.why_suggested,
      };
      const res = await fetch(`${getApiBaseUrl()}/api/v1/meal-plans/entries/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Could not plan meal', err.error ?? 'Please try again.');
        setPlanning(false);
        return;
      }
      setPlanned(true);
      setPlanning(false);
      // Refresh the plan cache so the Plan tab reflects the new entry.
      fetchCurrentPlan().catch(() => {});
    } catch (err) {
      Alert.alert('Could not plan meal', err instanceof Error ? err.message : String(err));
      setPlanning(false);
    }
  };

  if (!suggestion) return null;

  const heroUri = FOOD_IMAGES.hero[
    (suggestion.title.length + (suggestion.cuisine_type?.length ?? 0)) %
      FOOD_IMAGES.hero.length
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
          {/* Hero image */}
          <View style={{ position: 'relative' }}>
            <Image
              source={{ uri: heroUri }}
              style={styles.hero}
              contentFit="cover"
              transition={300}
              placeholder="L6A,o^4n00D%-;j[t7of~qt7xuIU"
            />
            <View style={styles.heroOverlay} />
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
            <View style={styles.heroText}>
              <Text style={styles.tag}>DINNER SUGGESTION</Text>
              <Text style={styles.title} numberOfLines={3}>
                {suggestion.title}
              </Text>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.82)" />
                <Text style={styles.metaText}>
                  {suggestion.estimated_time_minutes} min
                </Text>
                {suggestion.cuisine_type && (
                  <>
                    <Text style={styles.metaSep}>·</Text>
                    <Text style={styles.metaText}>{suggestion.cuisine_type}</Text>
                  </>
                )}
                {suggestion.kid_friendly && (
                  <>
                    <Text style={styles.metaSep}>·</Text>
                    <Text style={styles.metaText}>👶 Kid-friendly</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Description */}
          {suggestion.description && (
            <View style={styles.section}>
              <Text style={styles.description}>{suggestion.description}</Text>
            </View>
          )}

          {/* Ingredients from pantry */}
          {suggestion.ingredients_used.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionHeading}>From your pantry</Text>
              <View style={styles.tagRow}>
                {suggestion.ingredients_used.map((ing) => (
                  <View key={ing} style={styles.tagFromPantry}>
                    <Ionicons name="checkmark-circle" size={12} color="#047857" />
                    <Text style={styles.tagFromPantryText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Ingredients needed */}
          {suggestion.ingredients_needed.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionHeading}>You may need</Text>
              <View style={styles.tagRow}>
                {suggestion.ingredients_needed.map((ing) => (
                  <View key={ing} style={styles.tagNeeded}>
                    <Ionicons name="cart-outline" size={12} color="#C05A00" />
                    <Text style={styles.tagNeededText}>{ing}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Why suggested */}
          {suggestion.why_suggested && (
            <View style={styles.card}>
              <Text style={styles.sectionHeading}>Why we picked this</Text>
              <Text style={styles.whyText}>{suggestion.why_suggested}</Text>
            </View>
          )}

          {/* Day picker */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Add to meal plan</Text>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, i) => {
                const isToday = i === todayDayOfWeek();
                const isSelected = i === selectedDay;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setSelectedDay(i)}
                    style={[
                      styles.dayChip,
                      isSelected && styles.dayChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        isSelected && styles.dayChipTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    {isToday && (
                      <Text
                        style={[
                          styles.dayChipTodayDot,
                          isSelected && { color: '#FFFFFF' },
                        ]}
                      >
                        ·
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Sticky bottom action bar */}
        <View style={styles.bottomBar}>
          {planned ? (
            <View style={styles.plannedRow}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              <Text style={styles.plannedText}>
                Added to {DAY_LABELS[selectedDay]}
              </Text>
              <View style={{ flex: 1 }} />
              <Button title="Done" variant="outline" onPress={onClose} />
            </View>
          ) : (
            <Button
              title={
                planning
                  ? 'Planning...'
                  : selectedDay === todayDayOfWeek()
                    ? 'Add to tonight'
                    : `Add to ${DAY_LABELS[selectedDay]}`
              }
              onPress={handleAddToPlan}
              loading={planning}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  hero: {
    width: '100%',
    height: 240,
    backgroundColor: '#2A221A',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,10,5,0.35)',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
  },
  tag: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  metaSep: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginHorizontal: 2,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#5C4B39',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A140F',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagFromPantry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagFromPantryText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
  },
  tagNeeded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFEDD5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagNeededText: {
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
  },
  whyText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#5C4B39',
    fontStyle: 'italic',
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8F1E5',
    borderWidth: 1,
    borderColor: '#E5D9CA',
  },
  dayChipSelected: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A6651',
  },
  dayChipTextSelected: {
    color: '#FFFFFF',
  },
  dayChipTodayDot: {
    fontSize: 16,
    lineHeight: 14,
    color: '#F97316',
    marginTop: -2,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#FFFBF5',
    borderTopWidth: 1,
    borderTopColor: '#F1EAE0',
  },
  plannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  plannedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
  },
});
