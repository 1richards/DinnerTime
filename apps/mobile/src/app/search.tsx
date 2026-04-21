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
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';

import { useSuggestionsStore } from '../stores/suggestionsStore';
import { Button } from '../components/ui/Button';
import { colors } from '../design/tokens';

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

  const [query, setQuery] = useState(lastQuery ?? '');
  const [pantryOnly, setPantryOnly] = useState(storedPantryOnly);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed.length === 0) return;
    void searchRecipes(trimmed, { pantryOnly });
    router.back(); // D-09: dismiss-first; segment owns the loading skeleton.
  };

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
});
