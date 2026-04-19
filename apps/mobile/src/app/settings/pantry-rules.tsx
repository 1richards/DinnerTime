import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { usePantryStore, type SuggestedRule } from '../../stores/pantryStore';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { supabase } from '../../lib/supabase';
import { colors } from '../../design/tokens';

/**
 * Phase 21-05 Settings → Pantry Rules screen.
 *
 * Sections:
 * 1. ACTIVE RULES — draggable location rules (first-match-wins)
 * 2. NAME MAPPINGS — non-draggable alias list (order is irrelevant)
 * 3. SUGGESTIONS — accept/dismiss rows from suggestionAggregator
 * 4. Add Rule FAB — opens inline editor modal with 30-day preview
 */

type SourceLoc = 'fridge' | 'pantry' | 'freezer';
type RuleType = 'name_mapping' | 'location_mapping';

interface CanonicalRow {
  id: string;
  canonical_name: string;
}

function renderSuggestionSummary(s: SuggestedRule): string {
  const payload = s.payload ?? {};
  if (s.rule_type === 'location_mapping') {
    const name = (payload as { item_name?: string }).item_name ?? 'item';
    const loc = (payload as { user_location?: string }).user_location ?? '?';
    return `Always put "${name}" in ${loc}`;
  }
  const alias = (payload as { alias_name?: string }).alias_name ?? 'alias';
  return `Treat "${alias}" as a known ingredient`;
}

export default function PantryRulesScreen() {
  const rules = usePantryStore((s) => s.rules);
  const suggestions = usePantryStore((s) => s.suggestions);
  const loadRules = usePantryStore((s) => s.loadRules);
  const loadSuggestions = usePantryStore((s) => s.loadSuggestions);
  const reorderRules = usePantryStore((s) => s.reorderRules);
  const deleteRule = usePantryStore((s) => s.deleteRule);
  const acceptSuggestion = usePantryStore((s) => s.acceptSuggestion);
  const dismissSuggestion = usePantryStore((s) => s.dismissSuggestion);

  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    loadRules().catch(() => {});
    loadSuggestions().catch(() => {});
  }, [loadRules, loadSuggestions]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteRule(id).catch(() => {
        Alert.alert('Delete failed', 'Please try again.');
      });
    },
    [deleteRule],
  );

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1">
        {/* The outer ScrollView handles name mapping + suggestions + chrome.
            DraggableFlatList is NOT nested inside a ScrollView in production
            paths; we render it in a fixed-height container at the top so its
            gesture responder isn't stolen by ScrollView. On an iPhone the
            Active Rules section is typically short (~3-8 rules) so capping at
            a sensible height keeps the UX sane. */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="pb-24"
        >
          {/* ─── ACTIVE RULES ─── */}
          <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider px-4 pt-4 pb-2">
            Active Rules
          </Text>
          {rules.location_mapping.length === 0 ? (
            <EmptyState
              visual={{ kind: 'symbol', name: 'slider.horizontal.3' }}
              title="No rules yet"
              subtitle="Add a rule to always place items in a specific location."
            />
          ) : (
            <View style={{ height: Math.min(rules.location_mapping.length * 56, 320) }}>
              <DraggableFlatList
                data={rules.location_mapping}
                keyExtractor={(r) => r.id}
                onDragEnd={({ data }) => {
                  reorderRules(data.map((r) => r.id)).catch(() => {
                    Alert.alert('Reorder failed', 'Please try again.');
                  });
                }}
                renderItem={({ item, drag }) => (
                  <Pressable
                    onLongPress={drag}
                    className="flex-row items-center px-4 py-3 border-b border-warmGray-100 bg-warmWhite"
                  >
                    <SymbolIcon name="line.3.horizontal" size="body" tintColor={colors.textSecondary} />
                    <View className="flex-1 ml-3">
                      <Text className="text-base text-warmGray-900">
                        {item.canonical_name ?? item.canonical_ingredient_id}
                      </Text>
                      <Text className="text-xs text-warmGray-500">
                        → {item.source_location}
                      </Text>
                    </View>
                    <Pressable
                      testID={`rule-delete-${item.canonical_name ?? item.canonical_ingredient_id}`}
                      onPress={() => handleDelete(item.id)}
                      hitSlop={8}
                      accessibilityLabel="Delete rule"
                    >
                      <SymbolIcon name="trash" size="body" tintColor={colors.destructive} />
                    </Pressable>
                  </Pressable>
                )}
              />
            </View>
          )}

          {/* ─── NAME MAPPINGS ─── */}
          {rules.name_mapping.length > 0 && (
            <>
              <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider px-4 pt-6 pb-2">
                Name Mappings
              </Text>
              {rules.name_mapping.map((r) => (
                <View
                  key={r.id}
                  className="flex-row items-center px-4 py-3 border-b border-warmGray-100 bg-warmWhite"
                >
                  <View className="flex-1">
                    <Text className="text-base text-warmGray-900">
                      {r.alias_name} → {r.canonical_ingredients?.canonical_name ?? r.canonical_ingredient_id}
                    </Text>
                  </View>
                  <Pressable
                    testID={`rule-delete-${r.alias_name}`}
                    onPress={() => handleDelete(r.id)}
                    hitSlop={8}
                    accessibilityLabel="Delete rule"
                  >
                    <SymbolIcon name="trash" size="body" tintColor={colors.destructive} />
                  </Pressable>
                </View>
              ))}
            </>
          )}

          {/* ─── SUGGESTIONS ─── */}
          {suggestions.length > 0 && (
            <>
              <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider px-4 pt-6 pb-2">
                Suggestions
              </Text>
              {suggestions.map((s) => (
                <View
                  key={s.id}
                  className="px-4 py-3 border-b border-warmGray-100 bg-warmWhite"
                >
                  <Text className="text-base text-warmGray-900">
                    {renderSuggestionSummary(s)}
                  </Text>
                  <Text className="text-xs text-warmGray-500 mt-0.5">
                    Seen {s.occurrence_count}× in last 30 days
                  </Text>
                  <View className="flex-row mt-2 gap-2">
                    <View className="flex-1">
                      <Button
                        title="Dismiss"
                        variant="ghost"
                        onPress={() =>
                          dismissSuggestion(s.id).catch(() => {})
                        }
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        title="Accept"
                        variant="primary"
                        onPress={() =>
                          acceptSuggestion(s.id).catch((err: Error) => {
                            // W3 guard: candidate canonical returns 400.
                            if (err.message.includes('CANONICAL_NOT_ACTIVE')) {
                              Alert.alert(
                                'Not ready yet',
                                'This ingredient is still being promoted. Try again later.',
                              );
                            }
                          })
                        }
                      />
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* ─── Add Rule FAB ─── */}
        <Pressable
          testID="add-rule-fab"
          onPress={() => setEditorOpen(true)}
          className="absolute bottom-8 right-6 w-14 h-14 rounded-full bg-brand items-center justify-center shadow-lg"
          accessibilityLabel="Add rule"
        >
          <SymbolIcon name="plus" size="title" tintColor="#FFFFFF" />
        </Pressable>
      </View>

      <RuleEditorModal
        visible={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          loadRules().catch(() => {});
        }}
      />
    </SafeAreaView>
  );
}

// ── Rule Editor Modal ────────────────────────────────────────────────────

interface RuleEditorModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function RuleEditorModal({ visible, onClose, onSaved }: RuleEditorModalProps) {
  const createRule = usePantryStore((s) => s.createRule);
  const [ruleType, setRuleType] = useState<RuleType>('location_mapping');
  const [canonicalQuery, setCanonicalQuery] = useState('');
  const [canonicalResults, setCanonicalResults] = useState<CanonicalRow[]>([]);
  const [pickedCanonical, setPickedCanonical] = useState<CanonicalRow | null>(null);
  const [aliasName, setAliasName] = useState('');
  const [sourceLocation, setSourceLocation] = useState<SourceLoc>('pantry');
  const [preview, setPreview] = useState<{ count: number; loading: boolean }>({
    count: 0,
    loading: false,
  });
  const [saving, setSaving] = useState(false);

  // Reset state each time the modal re-opens.
  useEffect(() => {
    if (visible) {
      setRuleType('location_mapping');
      setCanonicalQuery('');
      setCanonicalResults([]);
      setPickedCanonical(null);
      setAliasName('');
      setSourceLocation('pantry');
      setPreview({ count: 0, loading: false });
      setSaving(false);
    }
  }, [visible]);

  // Canonical search (supabase direct — canonical_ingredients is globally readable).
  useEffect(() => {
    let cancelled = false;
    if (canonicalQuery.trim().length < 2) {
      setCanonicalResults([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('canonical_ingredients')
        .select('id, canonical_name')
        .eq('status', 'active')
        .ilike('canonical_name', `%${canonicalQuery.trim()}%`)
        .limit(10);
      if (!cancelled) setCanonicalResults((data ?? []) as CanonicalRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [canonicalQuery]);

  // 30-day preview panel (CONTEXT: informational only, per-rule-target).
  useEffect(() => {
    if (!pickedCanonical) {
      setPreview({ count: 0, loading: false });
      return;
    }
    let cancelled = false;
    setPreview({ count: 0, loading: true });
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;
        const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
        const response = await fetch(
          `${base}/api/v1/pantry/preview?canonical_id=${pickedCanonical.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) throw new Error('preview failed');
        const body = (await response.json()) as { count: number };
        if (!cancelled) setPreview({ count: body.count ?? 0, loading: false });
      } catch {
        if (!cancelled) setPreview({ count: 0, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickedCanonical]);

  const handleSave = useCallback(async () => {
    if (!pickedCanonical) return;
    setSaving(true);
    try {
      if (ruleType === 'location_mapping') {
        await createRule({
          rule_type: 'location_mapping',
          canonical_ingredient_id: pickedCanonical.id,
          source_location: sourceLocation,
        });
      } else {
        if (!aliasName.trim()) {
          Alert.alert('Alias required', 'Enter the name to remap.');
          setSaving(false);
          return;
        }
        await createRule({
          rule_type: 'name_mapping',
          alias_name: aliasName.trim(),
          target_canonical_id: pickedCanonical.id,
        });
      }
      onSaved();
    } catch (err) {
      Alert.alert('Save failed', (err as Error).message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [aliasName, createRule, onSaved, pickedCanonical, ruleType, sourceLocation]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-warmWhite">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-warmGray-100">
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="text-base text-warmGray-600">Cancel</Text>
          </Pressable>
          <Text className="text-base font-semibold text-warmGray-900">New Rule</Text>
          <Pressable
            onPress={handleSave}
            disabled={!pickedCanonical || saving}
            hitSlop={8}
          >
            <Text
              className={`text-base font-semibold ${
                !pickedCanonical || saving ? 'text-warmGray-300' : 'text-brand'
              }`}
            >
              Save
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="px-4 py-4">
          {/* Rule type picker */}
          <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-2">
            Rule Type
          </Text>
          <View className="flex-row gap-2 mb-4">
            {(['location_mapping', 'name_mapping'] as RuleType[]).map((rt) => (
              <Pressable
                key={rt}
                onPress={() => setRuleType(rt)}
                className={`flex-1 px-3 py-2 rounded-lg border ${
                  ruleType === rt ? 'bg-brand border-brand' : 'border-warmGray-200 bg-warmWhite'
                }`}
              >
                <Text
                  className={`text-center text-sm ${
                    ruleType === rt ? 'text-white' : 'text-warmGray-700'
                  }`}
                >
                  {rt === 'location_mapping' ? 'Location' : 'Name'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Alias name input (only for name_mapping) */}
          {ruleType === 'name_mapping' && (
            <>
              <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-2">
                Alias
              </Text>
              <TextInput
                value={aliasName}
                onChangeText={setAliasName}
                placeholder="e.g. creamer"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-warmGray-50 border border-warmGray-200 rounded-lg px-3 py-2.5 text-base text-warmGray-900 mb-4"
              />
            </>
          )}

          {/* Canonical picker */}
          <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-2">
            {ruleType === 'location_mapping' ? 'Ingredient' : 'Treat as'}
          </Text>
          {pickedCanonical ? (
            <View className="flex-row items-center justify-between bg-warmGray-50 border border-warmGray-200 rounded-lg px-3 py-2.5 mb-4">
              <Text className="text-base text-warmGray-900">{pickedCanonical.canonical_name}</Text>
              <Pressable onPress={() => setPickedCanonical(null)} hitSlop={8}>
                <SymbolIcon name="xmark.circle.fill" size="body" tintColor={colors.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <>
              <TextInput
                value={canonicalQuery}
                onChangeText={setCanonicalQuery}
                placeholder="Search ingredients..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-warmGray-50 border border-warmGray-200 rounded-lg px-3 py-2.5 text-base text-warmGray-900 mb-2"
              />
              {canonicalResults.map((row) => (
                <Pressable
                  key={row.id}
                  onPress={() => {
                    setPickedCanonical(row);
                    setCanonicalQuery('');
                    setCanonicalResults([]);
                  }}
                  className="px-3 py-2 border-b border-warmGray-100"
                >
                  <Text className="text-base text-warmGray-900">{row.canonical_name}</Text>
                </Pressable>
              ))}
            </>
          )}

          {/* Location picker (location_mapping only) */}
          {ruleType === 'location_mapping' && (
            <>
              <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-2">
                Put in
              </Text>
              <View className="flex-row gap-2 mb-4">
                {(['fridge', 'pantry', 'freezer'] as SourceLoc[]).map((loc) => (
                  <Pressable
                    key={loc}
                    onPress={() => setSourceLocation(loc)}
                    className={`flex-1 px-3 py-2 rounded-lg border ${
                      sourceLocation === loc
                        ? 'bg-brand border-brand'
                        : 'border-warmGray-200 bg-warmWhite'
                    }`}
                  >
                    <Text
                      className={`text-center text-sm capitalize ${
                        sourceLocation === loc ? 'text-white' : 'text-warmGray-700'
                      }`}
                    >
                      {loc}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          {/* 30-day preview panel */}
          {pickedCanonical && (
            <View className="bg-warmGray-50 border border-warmGray-200 rounded-lg px-3 py-3 mt-2">
              <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-1">
                30-Day Preview
              </Text>
              {preview.loading ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Text className="text-sm text-warmGray-700">
                  {preview.count} item{preview.count === 1 ? '' : 's'} in the last 30 days would be affected.
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
