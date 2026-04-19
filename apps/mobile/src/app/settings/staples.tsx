import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePantryStore } from '../../stores/pantryStore';
import { EmptyState } from '../../components/ui/EmptyState';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { supabase } from '../../lib/supabase';
import { colors } from '../../design/tokens';

interface CanonicalRow {
  id: string;
  canonical_name: string;
}

/**
 * Phase 21-05 Settings → Staples screen.
 *
 * - Full list of staples (canonical_name + trash icon).
 * - "+" button opens a canonical search sheet; picking a row marks it staple.
 * - Primary way to mark items staple is still the Pantry ItemRow ellipsis
 *   (Phase 15 HeaderEllipsis pattern) — this screen is the management surface.
 */
export default function StaplesScreen() {
  const staples = usePantryStore((s) => s.stapleRows);
  const loadStaples = usePantryStore((s) => s.loadStaples);
  const markStaple = usePantryStore((s) => s.markStaple);
  const unmarkStaple = usePantryStore((s) => s.unmarkStaple);

  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    loadStaples().catch(() => {});
  }, [loadStaples]);

  const handleUnmark = (canonicalId: string) => {
    unmarkStaple(canonicalId).catch(() => {
      Alert.alert('Remove failed', 'Please try again.');
    });
  };

  const handleAdd = async (row: CanonicalRow) => {
    try {
      await markStaple(row.id, row.canonical_name);
      setAddOpen(false);
    } catch (err) {
      Alert.alert('Add failed', (err as Error).message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1">
        {staples.length === 0 ? (
          <EmptyState
            visual={{ kind: 'symbol', name: 'star' }}
            title="No staples yet"
            subtitle="Staples auto-accept on scans. Tap + to add, or mark items from the Pantry tab."
            action={{ label: 'Add staple', onPress: () => setAddOpen(true) }}
          />
        ) : (
          <ScrollView contentContainerClassName="pb-24">
            <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider px-4 pt-4 pb-2">
              Staples
            </Text>
            {staples.map((row) => (
              <View
                key={row.canonical_ingredient_id}
                className="flex-row items-center px-4 py-3 border-b border-warmGray-100 bg-warmWhite"
              >
                <SymbolIcon name="star.fill" size="body" tintColor={colors.brand} />
                <Text className="flex-1 ml-3 text-base text-warmGray-900">
                  {row.canonical_name || row.canonical_ingredient_id}
                </Text>
                <Pressable
                  testID={`staple-remove-${row.canonical_name || row.canonical_ingredient_id}`}
                  onPress={() => handleUnmark(row.canonical_ingredient_id)}
                  hitSlop={8}
                  accessibilityLabel="Remove from staples"
                >
                  <SymbolIcon name="trash" size="body" tintColor={colors.destructive} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {staples.length > 0 && (
          <Pressable
            testID="add-staple-fab"
            onPress={() => setAddOpen(true)}
            className="absolute bottom-8 right-6 w-14 h-14 rounded-full bg-brand items-center justify-center shadow-lg"
            accessibilityLabel="Add staple"
          >
            <SymbolIcon name="plus" size="title" tintColor="#FFFFFF" />
          </Pressable>
        )}
      </View>

      <AddStapleModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onPick={handleAdd}
        existingIds={new Set(staples.map((s) => s.canonical_ingredient_id))}
      />
    </SafeAreaView>
  );
}

// ── Add Staple Modal ─────────────────────────────────────────────────────

interface AddStapleModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (row: CanonicalRow) => void;
  existingIds: Set<string>;
}

function AddStapleModal({ visible, onClose, onPick, existingIds }: AddStapleModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CanonicalRow[]>([]);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    let cancelled = false;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('canonical_ingredients')
        .select('id, canonical_name')
        .eq('status', 'active')
        .ilike('canonical_name', `%${query.trim()}%`)
        .limit(20);
      if (!cancelled) setResults((data ?? []) as CanonicalRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-warmWhite">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-warmGray-100">
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="text-base text-warmGray-600">Cancel</Text>
          </Pressable>
          <Text className="text-base font-semibold text-warmGray-900">Add Staple</Text>
          <View style={{ width: 40 }} />
        </View>

        <View className="px-4 py-3">
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search ingredients..."
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            className="bg-warmGray-50 border border-warmGray-200 rounded-lg px-3 py-2.5 text-base text-warmGray-900"
          />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {results.map((row) => {
            const already = existingIds.has(row.id);
            return (
              <Pressable
                key={row.id}
                onPress={() => !already && onPick(row)}
                disabled={already}
                className={`flex-row items-center px-4 py-3 border-b border-warmGray-100 ${
                  already ? 'opacity-50' : ''
                }`}
              >
                <Text className="flex-1 text-base text-warmGray-900">{row.canonical_name}</Text>
                {already ? (
                  <Text className="text-xs text-warmGray-500">Added</Text>
                ) : (
                  <SymbolIcon name="plus.circle" size="body" tintColor={colors.brand} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
