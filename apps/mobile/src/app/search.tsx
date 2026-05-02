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
import { useRecipeStore } from '../stores/recipeStore';
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
  if (context === 'library') return <LibrarySearch />;

  // Other contexts (e.g. 'pantry') still placeholder until they get their own surfaces.
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
  const recentQueries = useSuggestionsStore((s) => s.recentQueries);

  // The search bar always opens empty even when a previous query is still
  // populating the results behind the modal. Prior queries are surfaced
  // under the "Recent searches" section below the input — the field
  // itself stays a clean slate so the user is never editing a stale
  // string they didn't intend to type.
  const [query, setQuery] = useState('');
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

      {(recentQueries.length > 0 || prompts.length > 0) && (
        <ScrollView
          style={styles.promptsScroll}
          contentContainerStyle={styles.promptsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {recentQueries.length > 0 && (
            <>
              <Text style={styles.promptsHeading}>RECENT SEARCHES</Text>
              <View style={[styles.promptsWrap, { marginBottom: 20 }]}>
                {recentQueries.map((q) => (
                  <Pressable
                    key={`recent-${q}`}
                    onPress={() => {
                      setQuery(q);
                      submitQuery(q);
                    }}
                    style={styles.promptChip}
                    accessibilityLabel={`Search again for ${q}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.promptChipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          {prompts.length > 0 && (
            <>
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
            </>
          )}
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

// ---- Library search ---------------------------------------------------------
// Sets recipeStore.searchQuery and dismisses the modal. Kitchen.tsx reads the
// store value directly and filters the saved-recipe list. When invoked from
// the Plan tab's AddMealRow (context="library"), submit additionally routes
// the user to the Kitchen tab so they land on the filtered results — Plan
// itself doesn't render a recipe list, so dropping back there would feel like
// nothing happened.

const LIBRARY_PROMPTS: string[] = [
  'tacos',
  'pasta',
  'one-pan',
  'soup',
  'salad',
  'breakfast',
  'kid favorites',
  'leftover-friendly',
];

function LibrarySearch() {
  const setSearchQuery = useRecipeStore((s) => s.setSearchQuery);
  const lastQuery = useRecipeStore((s) => s.searchQuery);

  // The input opens empty even when a previous filter is still applied
  // to the saved-recipe list. The active filter is acknowledged via the
  // "Clear current search" pill below; the field itself starts blank so
  // the user is never editing a stale string they didn't intend to type.
  const [query, setQuery] = useState('');

  const submitQuery = (raw: string) => {
    const trimmed = raw.trim();
    setSearchQuery(trimmed);
    // Always close the modal first so the next-frame tab nav has a clean
    // stack. router.back() resolves the parent screen the user came from
    // (kitchen.tsx Recipe Box, plan.tsx AddMealRow, etc.). Plan-tab callers
    // want to land on Kitchen filtered, so additionally push to /kitchen
    // — expo-router treats that as a tab switch (no stack growth).
    router.back();
    router.push('/(tabs)/kitchen' as never);
  };

  const handleSubmit = () => submitQuery(query);
  const handleClear = () => {
    setSearchQuery('');
    setQuery('');
    router.back();
  };

  return (
    <View style={styles.screen}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search saved recipes"
        placeholderTextColor={colors.textTertiary}
        autoFocus
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
        style={styles.input}
        accessibilityLabel="Search saved recipes"
      />
      <View style={styles.submit}>
        <Button
          title="Search"
          onPress={handleSubmit}
          disabled={query.trim().length === 0}
        />
      </View>

      {lastQuery ? (
        <View style={{ marginTop: 12 }}>
          <Pressable
            onPress={handleClear}
            accessibilityRole="button"
            accessibilityLabel="Clear current search"
            style={({ pressed }) => [
              styles.promptChip,
              { alignSelf: 'flex-start' },
              pressed && styles.promptChipPressed,
            ]}
          >
            <Text style={styles.promptChipText}>
              Clear current search ({lastQuery})
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.promptsScroll}
        contentContainerStyle={styles.promptsContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.promptsHeading}>BROWSE BY KEYWORD</Text>
        <View style={styles.promptsWrap}>
          {LIBRARY_PROMPTS.map((p) => (
            <Pressable
              key={p}
              onPress={() => {
                setQuery(p);
                submitQuery(p);
              }}
              style={({ pressed }) => [
                styles.promptChip,
                pressed && styles.promptChipPressed,
              ]}
              accessibilityLabel={`Search saved recipes for ${p}`}
              accessibilityRole="button"
            >
              <Text style={styles.promptChipText}>{p}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
