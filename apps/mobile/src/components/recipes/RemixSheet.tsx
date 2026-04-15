import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { useProgressionStore, type RemixMode } from '../../stores/progressionStore';

interface RemixSheetProps {
  visible: boolean;
  recipeId: string;
  recipeTitle: string;
  onClose: () => void;
}

interface ModeOption {
  mode: RemixMode;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
}

const MODES: ModeOption[] = [
  {
    mode: 'surprise',
    label: 'Surprise me',
    sub: 'A bold creative twist',
    icon: 'sparkles',
    emoji: '🎲',
  },
  {
    mode: 'protein',
    label: 'Swap protein',
    sub: 'Keep the dish, change the star',
    icon: 'fish-outline',
    emoji: '🥩',
  },
  {
    mode: 'veggies',
    label: 'Swap veggies',
    sub: 'Different flavor profile',
    icon: 'leaf-outline',
    emoji: '🥗',
  },
  {
    mode: 'quicker',
    label: 'Make it quicker',
    sub: 'Shortcut the cook time',
    icon: 'time-outline',
    emoji: '⏱️',
  },
];

/**
 * RemixSheet — a bottom-sheet modal letting the user pick HOW they want to
 * remix a recipe before hitting the AI. Four modes steer the prompt on the
 * server side: surprise, protein swap, veggie swap, or quicker.
 *
 * Reusable anywhere a recipe is displayed — Recipe Detail, RecipeCard,
 * DayRow, home suggestions.
 */
export function RemixSheet({
  visible,
  recipeId,
  recipeTitle,
  onClose,
}: RemixSheetProps) {
  const fetchVariations = useProgressionStore((s) => s.fetchVariations);
  const [selectedMode, setSelectedMode] = useState<RemixMode | null>(null);
  const [variations, setVariations] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    // Reset state so next open starts fresh
    setSelectedMode(null);
    setVariations(null);
    setLoading(false);
    setError(null);
    onClose();
  };

  const handleMode = async (mode: RemixMode) => {
    setSelectedMode(mode);
    setLoading(true);
    setError(null);
    setVariations(null);
    const result = await fetchVariations(recipeId, mode);
    setLoading(false);
    if (result === null) {
      setError('Could not fetch variations. Try again?');
      return;
    }
    setVariations(result);
  };

  const handleTryAnother = () => {
    setSelectedMode(null);
    setVariations(null);
    setError(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>REMIX</Text>
            <Text style={styles.title} numberOfLines={1}>
              {recipeTitle}
            </Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#3E332A" />
          </Pressable>
        </View>

        {/* Mode picker */}
        {!selectedMode && (
          <ScrollView contentContainerStyle={styles.modesContainer}>
            <Text style={styles.helperText}>
              How do you want to shake it up?
            </Text>
            {MODES.map((m) => (
              <Pressable
                key={m.mode}
                onPress={() => handleMode(m.mode)}
                style={({ pressed }) => [
                  styles.modeCard,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.modeEmoji}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeLabel}>{m.label}</Text>
                  <Text style={styles.modeSub}>{m.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#A89178" />
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Loading state */}
        {selectedMode && loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F97316" />
            <Text style={styles.loadingText}>Brewing ideas...</Text>
          </View>
        )}

        {/* Error state */}
        {selectedMode && error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={32} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
            <View style={{ height: 12 }} />
            <Button title="Try Another Mode" variant="outline" onPress={handleTryAnother} />
          </View>
        )}

        {/* Results */}
        {selectedMode && variations && !loading && (
          <ScrollView contentContainerStyle={styles.resultsContainer}>
            <Text style={styles.resultsLabel}>
              {MODES.find((m) => m.mode === selectedMode)?.emoji}{' '}
              {MODES.find((m) => m.mode === selectedMode)?.label}
            </Text>
            {variations.map((v, i) => (
              <View key={i} style={styles.variationCard}>
                <View style={styles.variationNum}>
                  <Text style={styles.variationNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.variationText}>{v}</Text>
              </View>
            ))}
            <View style={{ height: 16 }} />
            <Button
              title="Try Another Mode"
              variant="outline"
              onPress={handleTryAnother}
            />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
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
  modesContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  helperText: {
    fontSize: 14,
    color: '#7A6651',
    marginBottom: 14,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  modeEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A140F',
    marginBottom: 2,
  },
  modeSub: {
    fontSize: 13,
    color: '#7A6651',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
  },
  loadingText: {
    fontSize: 14,
    color: '#7A6651',
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    textAlign: 'center',
    marginTop: 8,
  },
  resultsContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7A6651',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  variationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  variationNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  variationNumText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C05A00',
  },
  variationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#3E332A',
  },
});
