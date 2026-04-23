/**
 * Search modal (Phase 19 D-03 + Phase 17 D-02/D-09).
 *
 * StickySearchPill navigates here via router.push('/search?context=...').
 * Phase 17 added a `context === 'something-new'` branch that renders a real
 * search UI (TextInput + pantry-only Switch + Submit) and dispatches through
 * useSuggestionsStore.searchRecipes.
 *
 * Other contexts (`library`, `pantry`) fall through to the placeholder until
 * their own branches land. Pitfall 6 (Wave 0): the placeholder string MUST
 * remain reachable so context echoing still works while those contexts
 * haven't migrated.
 *
 * D-09 — dismiss-first: handleSubmit fires searchRecipes then router.back()
 * immediately. The Something New segment owns the loading skeleton. The
 * modal never holds a spinner.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { useSuggestionsStore } from '../stores/suggestionsStore';
import { Button } from '../components/ui/Button';
import { colors } from '../design/tokens';

// Canned prompts surfaced below the input so users don't stare at a blank
// field. Tapping a chip fills the query + submits in one tap — same path
// the Search button takes. Keep the set diverse (time, cuisine, dietary,
// mood) so there's a natural on-ramp regardless of what the user is craving.
const SUGGESTED_PROMPTS: string[] = [
  'quick weeknight dinners',
  '30-minute one-pan meals',
  'cozy vegetarian soups',
  'family-friendly pasta',
  'Thai takeout classics',
  'light summer salads',
  'comfort food for a rainy day',
  'healthy sheet-pan dinners',
];

export default function SearchModal() {
  const { context } = useLocalSearchParams<{ context?: string }>();
  if (context === 'something-new') return <SomethingNewSearch />;

  // Pitfall 6 fallback: placeholder echo for 'library' | 'pantry' contexts.
  return (
    <View className="flex-1 bg-bg p-4">
      <Text className="text-title text-text-primary">Search</Text>
      <Text className="text-body text-text-secondary mt-2">
        Context: {context ?? 'unknown'}
      </Text>
      <Text className="text-caption text-text-tertiary mt-4">
        Full search for this context ships in a later phase.
      </Text>
    </View>
  );
}

function SomethingNewSearch() {
  const searchRecipes = useSuggestionsStore((s) => s.searchRecipes);
  const storedPantryOnly = useSuggestionsStore((s) => s.pantryOnly);
  const lastQuery = useSuggestionsStore((s) => s.lastQuery);
  const recentQueries = useSuggestionsStore((s) => s.recentQueries);

  const [query, setQuery] = useState(lastQuery ?? '');
  const [pantryOnly, setPantryOnly] = useState(storedPantryOnly);

  const submitQuery = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    void searchRecipes(trimmed, { pantryOnly });
    router.back(); // D-09: dismiss-first; segment owns the loading skeleton.
  };

  const handleSubmit = () => submitQuery(query);

  // Dedupe canned prompts against the user's recent queries (case-insensitive)
  // so we don't echo something they just ran back at them.
  const recentSet = new Set(recentQueries.map((q) => q.trim().toLowerCase()));
  const prompts = SUGGESTED_PROMPTS.filter(
    (p) => !recentSet.has(p.toLowerCase()),
  );

  return (
    <View style={styles.screen}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="What are you craving?"
        placeholderTextColor={colors.textTertiary}
        autoFocus
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
        style={styles.input}
        accessibilityLabel="Search dinner ideas"
      />
      <View style={styles.toggleRow}>
        <Switch
          value={pantryOnly}
          onValueChange={setPantryOnly}
          accessibilityLabel="Only what's in my pantry"
        />
        <Text style={styles.toggleLabel}>Only what's in my pantry</Text>
      </View>
      <View style={styles.submit}>
        <Button
          title="Search"
          onPress={handleSubmit}
          disabled={query.trim().length === 0}
        />
      </View>

      {prompts.length > 0 && (
        <ScrollView
          style={styles.promptsScroll}
          contentContainerStyle={styles.promptsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.promptsHeading}>TRY ONE OF THESE</Text>
          <View style={styles.promptsWrap}>
            {prompts.map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  setQuery(p);
                  submitQuery(p);
                }}
                style={styles.promptChip}
                accessibilityLabel={`Search for ${p}`}
                accessibilityRole="button"
              >
                <Text style={styles.promptChipText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  toggleLabel: {
    marginLeft: 12,
    color: colors.textPrimary,
    fontSize: 15,
  },
  submit: {
    marginTop: 24,
  },
  promptsScroll: {
    marginTop: 28,
    flex: 1,
  },
  promptsContent: {
    paddingBottom: 24,
  },
  promptsHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  promptsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    // White surface with a real shadow so the chip reads as a distinct pill
    // against the creamy bg. The previous surfaceSubtle (#F1EAE0) had only
    // ~5% lightness difference against bg and disappeared visually.
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  promptChipPressed: {
    opacity: 0.6,
  },
  promptChipText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
