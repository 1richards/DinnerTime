import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { colors } from '../../design/tokens';

export type CuisineFilter =
  | 'all'
  | 'italian'
  | 'mexican'
  | 'chinese'
  | 'japanese'
  | 'indian'
  | 'thai'
  | 'mediterranean'
  | 'american'
  | 'korean'
  | 'french';
export type TimeFilter = 'any' | 'quick' | 'medium' | 'long';

export interface RecipeFilterState {
  favoritesOnly: boolean;
  pantryOnly: boolean;
  cuisine: CuisineFilter;
  time: TimeFilter;
}

export const EMPTY_FILTERS: RecipeFilterState = {
  favoritesOnly: false,
  pantryOnly: false,
  cuisine: 'all',
  time: 'any',
};

export function countActiveFilters(s: RecipeFilterState): number {
  return (
    (s.favoritesOnly ? 1 : 0) +
    (s.pantryOnly ? 1 : 0) +
    (s.cuisine !== 'all' ? 1 : 0) +
    (s.time !== 'any' ? 1 : 0)
  );
}

const CUISINE_OPTIONS: Array<{ key: CuisineFilter; label: string; emoji: string }> = [
  { key: 'all', label: 'Any', emoji: '✨' },
  { key: 'italian', label: 'Italian', emoji: '🇮🇹' },
  { key: 'mexican', label: 'Mexican', emoji: '🇲🇽' },
  { key: 'chinese', label: 'Chinese', emoji: '🥡' },
  { key: 'japanese', label: 'Japanese', emoji: '🍱' },
  { key: 'indian', label: 'Indian', emoji: '🍛' },
  { key: 'thai', label: 'Thai', emoji: '🌶️' },
  { key: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
  { key: 'american', label: 'American', emoji: '🍔' },
  { key: 'korean', label: 'Korean', emoji: '🥢' },
  { key: 'french', label: 'French', emoji: '🥖' },
];

/**
 * Heuristic cuisine match — Recipe rows don't carry a normalized
 * cuisine_type field yet, so we keyword-search the title, description,
 * and ingredient names. False negatives are expected (a "Carne Asada"
 * recipe with no mexican-specific tokens won't match) but false
 * positives are rare — the keyword sets are dish/aromatic-specific.
 *
 * Exported alongside the type so the consumer (Recipe Box) can keep
 * the matcher and filter state in one place.
 */
const CUISINE_KEYWORDS: Record<Exclude<CuisineFilter, 'all'>, string[]> = {
  italian: [
    'pasta', 'pizza', 'lasagna', 'risotto', 'marinara', 'parmesan',
    'mozzarella', 'ricotta', 'pesto', 'gnocchi', 'alfredo', 'carbonara',
    'prosciutto', 'bolognese', 'focaccia', 'bruschetta', 'tiramisu',
    'spaghetti', 'penne', 'linguine', 'fettuccine', 'ravioli', 'calzone',
    'italian',
  ],
  mexican: [
    'taco', 'burrito', 'enchilada', 'quesadilla', 'tamale', 'salsa',
    'guacamole', 'tortilla', 'fajita', 'mole', 'chipotle', 'jalapeño',
    'jalapeno', 'cilantro', 'queso', 'carne asada', 'al pastor',
    'pozole', 'mexican',
  ],
  chinese: [
    'stir-fry', 'stir fry', 'lo mein', 'fried rice', 'kung pao',
    'szechuan', 'sichuan', 'dim sum', 'sweet and sour', 'dumpling',
    'wonton', 'hoisin', 'soy sauce', 'bok choy', 'mapo', 'chow mein',
    'general tso', 'orange chicken', 'chinese',
  ],
  japanese: [
    'sushi', 'ramen', 'tempura', 'teriyaki', 'miso', 'udon', 'soba',
    'donburi', 'katsu', 'yakitori', 'edamame', 'wasabi', 'nori',
    'tonkatsu', 'gyoza', 'onigiri', 'okonomiyaki', 'japanese',
  ],
  indian: [
    'curry', 'masala', 'tikka', 'biryani', 'naan', 'samosa', 'tandoori',
    'paneer', 'garam', 'vindaloo', 'dal', 'chutney', 'korma', 'raita',
    'saag', 'pakora', 'chana', 'indian',
  ],
  thai: [
    'pad thai', 'tom yum', 'tom kha', 'green curry', 'red curry',
    'massaman', 'satay', 'larb', 'som tam', 'panang', 'lemongrass',
    'fish sauce', 'thai basil', 'galangal', 'thai',
  ],
  mediterranean: [
    'hummus', 'falafel', 'tzatziki', 'kebab', 'gyro', 'tahini', 'feta',
    'olive', 'pita', 'dolma', 'shawarma', 'tabbouleh', 'baba ganoush',
    'mediterranean', 'greek',
  ],
  american: [
    'burger', 'hot dog', 'mac and cheese', 'meatloaf', 'bbq', 'barbecue',
    'fried chicken', 'cornbread', 'biscuit', 'pulled pork', 'sloppy joe',
    'meatballs', 'ribs', 'wings', 'american',
  ],
  korean: [
    'kimchi', 'bulgogi', 'bibimbap', 'gochujang', 'japchae',
    'korean bbq', 'tteokbokki', 'galbi', 'banchan', 'kimchee', 'korean',
  ],
  french: [
    'croissant', 'baguette', 'ratatouille', 'coq au vin', 'bouillabaisse',
    'beurre', 'crepe', 'crêpe', 'soufflé', 'souffle', 'brie', 'dijon',
    'cassoulet', 'beef bourguignon', 'au gratin', 'french',
  ],
};

export function matchesCuisineFilter(
  recipe: { title: string; description: string | null; ingredients?: Array<{ name?: string }> | null },
  cuisine: CuisineFilter,
): boolean {
  if (cuisine === 'all') return true;
  const keywords = CUISINE_KEYWORDS[cuisine];
  const haystack = [
    recipe.title,
    recipe.description ?? '',
    ...(recipe.ingredients ?? []).map((i) => i.name ?? ''),
  ]
    .join(' ')
    .toLowerCase();
  return keywords.some((kw) => haystack.includes(kw));
}

const TIME_OPTIONS: Array<{ key: TimeFilter; label: string; sub: string }> = [
  { key: 'any', label: 'Any', sub: '' },
  { key: 'quick', label: 'Quick', sub: 'under 30 min' },
  { key: 'medium', label: 'Medium', sub: '30 – 60 min' },
  { key: 'long', label: 'Long', sub: 'over 60 min' },
];

interface Props {
  visible: boolean;
  initial: RecipeFilterState;
  onClose: () => void;
  onApply: (next: RecipeFilterState) => void;
}

/**
 * Bottom sheet exposing every recipe filter at once. Users compose the
 * filter set locally, then tap Apply to commit. Clear all wipes in place.
 *
 * Replaces the previous horizontal-scroll pill rows — hidden
 * off-screen options are a UX anti-pattern.
 */
export function RecipeFilterSheet({ visible, initial, onClose, onApply }: Props) {
  const [state, setState] = useState<RecipeFilterState>(initial);

  // Re-sync when the sheet opens so state doesn't leak across opens.
  useEffect(() => {
    if (visible) setState(initial);
  }, [visible, initial]);

  const activeCount = countActiveFilters(state);
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>FILTERS</Text>
            <Text style={styles.title}>Narrow your recipes</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Close">
            <SymbolIcon name="xmark" size={22} tintColor="#3E332A" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {/* Toggles */}
          <View style={styles.toggleCard}>
            <Pressable
              onPress={() => setState((s) => ({ ...s, favoritesOnly: !s.favoritesOnly }))}
              style={styles.toggleRow}
            >
              <View style={styles.toggleIcon}>
                <SymbolIcon name="heart.fill" size={18} tintColor={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Favorites only</Text>
                <Text style={styles.toggleSub}>Recipes you&apos;ve hearted</Text>
              </View>
              <View
                style={[
                  styles.switch,
                  state.favoritesOnly && styles.switchOn,
                ]}
              >
                <View
                  style={[
                    styles.switchKnob,
                    state.favoritesOnly && styles.switchKnobOn,
                  ]}
                />
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={() => setState((s) => ({ ...s, pantryOnly: !s.pantryOnly }))}
              style={styles.toggleRow}
            >
              <View style={styles.toggleIcon}>
                <SymbolIcon name="basket" size={18} tintColor="#C05A00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>From my pantry</Text>
                <Text style={styles.toggleSub}>
                  Only recipes I can make right now
                </Text>
              </View>
              <View
                style={[
                  styles.switch,
                  state.pantryOnly && styles.switchOn,
                ]}
              >
                <View
                  style={[
                    styles.switchKnob,
                    state.pantryOnly && styles.switchKnobOn,
                  ]}
                />
              </View>
            </Pressable>
          </View>

          {/* Cuisine segmented — heuristic match against title /
              description / ingredient names. See matchesCuisineFilter
              above for the keyword tables. */}
          <Text style={styles.sectionHeading}>Cuisine</Text>
          <View style={styles.segmentedRow}>
            {CUISINE_OPTIONS.map((opt) => {
              const selected = state.cuisine === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setState((s) => ({ ...s, cuisine: opt.key }))}
                  style={[
                    styles.segmentChip,
                    selected && styles.segmentChipSelected,
                  ]}
                >
                  <Text style={styles.segmentEmoji}>{opt.emoji}</Text>
                  <Text
                    style={[
                      styles.segmentLabel,
                      selected && styles.segmentLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Time */}
          <Text style={styles.sectionHeading}>Cook time</Text>
          <View style={styles.timeColumn}>
            {TIME_OPTIONS.map((opt) => {
              const selected = state.time === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setState((s) => ({ ...s, time: opt.key }))}
                  style={[
                    styles.timeRow,
                    selected && styles.timeRowSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeLabel,
                      selected && styles.timeLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {opt.sub ? (
                    <Text
                      style={[
                        styles.timeSub,
                        selected && styles.timeSubSelected,
                      ]}
                    >
                      {opt.sub}
                    </Text>
                  ) : null}
                  {selected && (
                    <SymbolIcon
                      name="checkmark"
                      size={18}
                      tintColor="#FFFFFF"
                      style={{ marginLeft: 'auto' }}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => setState(EMPTY_FILTERS)}
            disabled={activeCount === 0}
            style={styles.clearBtn}
          >
            <Text
              style={[
                styles.clearText,
                activeCount === 0 && styles.clearTextDisabled,
              ]}
            >
              Clear all
            </Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button
              title={
                activeCount === 0
                  ? 'Show all recipes'
                  : `Show ${activeCount === 1 ? '1 filter' : activeCount + ' filters'}`
              }
              onPress={() => {
                onApply(state);
                onClose();
              }}
              disabled={!dirty}
            />
          </View>
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
    paddingBottom: 14,
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
    padding: 20,
    paddingBottom: 40,
  },
  toggleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A140F',
  },
  toggleSub: {
    fontSize: 12,
    color: '#7A6651',
    marginTop: 2,
  },
  switch: {
    width: 46,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5D9CA',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: {
    backgroundColor: colors.brand,
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  switchKnobOn: {
    transform: [{ translateX: 18 }],
  },
  divider: {
    height: 1,
    backgroundColor: '#F1EAE0',
    marginHorizontal: 16,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A140F',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  segmentedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  segmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5D9CA',
  },
  segmentChipSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  segmentEmoji: {
    fontSize: 14,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7A6651',
  },
  segmentLabelSelected: {
    color: '#FFFFFF',
  },
  timeColumn: {
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1EAE0',
    gap: 10,
  },
  timeRowSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A140F',
  },
  timeLabelSelected: {
    color: '#FFFFFF',
  },
  timeSub: {
    fontSize: 12,
    color: '#7A6651',
  },
  timeSubSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#F1EAE0',
    backgroundColor: '#FFFBF5',
  },
  clearBtn: {
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C05A00',
  },
  clearTextDisabled: {
    color: '#A89178',
  },
});
