import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import type { Recipe } from '../../types/recipe';

interface Props {
  visible: boolean;
  recipe: Recipe;
  onClose: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function todayDayOfWeek(): number {
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

/**
 * Day-picker modal for scheduling a saved recipe onto the current week's
 * meal plan. Upserts that day's entry via POST /meal-plans/entries/assign
 * and refreshes the cached plan.
 */
export function AddToPlanSheet({ visible, recipe, onClose }: Props) {
  const fetchCurrentPlan = useMealPlanStore((s) => s.fetchCurrent);
  const [selectedDay, setSelectedDay] = useState<number>(todayDayOfWeek());
  const [planning, setPlanning] = useState(false);
  const [plannedOn, setPlannedOn] = useState<number | null>(null);

  React.useEffect(() => {
    if (visible) {
      setSelectedDay(todayDayOfWeek());
      setPlanned(null);
      setPlanning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const setPlanned = (day: number | null) => setPlannedOn(day);

  const handleAdd = async () => {
    setPlanning(true);
    try {
      const token = await getAuthToken();
      const body = {
        day: selectedDay,
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        estimated_time_minutes: recipe.total_time_minutes,
        recipe_id: recipe.id,
      };
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/meal-plans/entries/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Could not plan meal', err.error ?? 'Please try again.');
        setPlanning(false);
        return;
      }
      setPlanned(selectedDay);
      setPlanning(false);
      fetchCurrentPlan().catch(() => {});
    } catch (err) {
      Alert.alert(
        'Could not plan meal',
        err instanceof Error ? err.message : String(err),
      );
      setPlanning(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ADD TO PLAN</Text>
            <Text style={styles.title} numberOfLines={1}>
              {recipe.title}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Close">
            <SymbolIcon name="xmark" size={22} tintColor="#3E332A" />
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.helperText}>Pick a day this week:</Text>
          <View style={styles.dayColumn}>
            {DAY_LABELS.map((label, i) => {
              const isToday = i === todayDayOfWeek();
              const isSelected = i === selectedDay;
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelectedDay(i)}
                  style={[
                    styles.dayRow,
                    isSelected && styles.dayRowSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayRowLabel,
                      isSelected && styles.dayRowLabelSelected,
                    ]}
                  >
                    {label}
                  </Text>
                  {isToday && (
                    <Text
                      style={[
                        styles.todayPill,
                        isSelected && styles.todayPillSelected,
                      ]}
                    >
                      Today
                    </Text>
                  )}
                  {isSelected && (
                    <SymbolIcon
                      name="checkmark"
                      size={20}
                      tintColor="#FFFFFF"
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.bottomBar}>
          {plannedOn !== null ? (
            <View style={styles.plannedRow}>
              <SymbolIcon name="checkmark.circle.fill" size={22} tintColor="#10B981" />
              <Text style={styles.plannedText}>
                Added to {DAY_LABELS[plannedOn]}
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
              onPress={handleAdd}
              loading={planning}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: '#FFFBF5' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EAE0',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C05A00',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A140F',
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1EAE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    padding: 20,
  },
  helperText: {
    fontSize: 14,
    color: '#7A6651',
    marginBottom: 14,
  },
  dayColumn: {
    gap: 8,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1EAE0',
    gap: 12,
  },
  dayRowSelected: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  dayRowLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A140F',
  },
  dayRowLabelSelected: {
    color: '#FFFFFF',
  },
  todayPill: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C05A00',
    backgroundColor: '#FFF4E6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  todayPillSelected: {
    color: '#F97316',
    backgroundColor: '#FFFFFF',
  },
  bottomBar: {
    padding: 16,
    paddingBottom: 28,
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
