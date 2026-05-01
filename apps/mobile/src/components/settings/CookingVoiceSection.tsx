/**
 * v1.0.2 — Cooking-mode voice picker.
 *
 * Lists the curated ElevenLabs voices from `apps/mobile/src/cooking/voices.ts`
 * and persists the user's selection in `settingsStore.cookingVoiceId`. The
 * `useStepSpeaker` hook reads that value at TTS-fetch time and forwards it
 * to `/api/v1/voice/tts`, so swapping voices in Settings takes effect on
 * the very next step (no remount required).
 *
 * "null" persisted state means "use the server default" — visually we map
 * that to the first voice (Daniel) being highlighted, since the server
 * pins Daniel as its DEFAULT_VOICE_ID. When the user picks anything (even
 * Daniel), we persist the explicit ID; this lets us tell "untouched" from
 * "deliberately Daniel" if we ever care.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  COOKING_VOICES,
  DEFAULT_COOKING_VOICE_ID,
  type CookingVoice,
} from '../../cooking/voices';

export function CookingVoiceSection() {
  const cookingVoiceId = useSettingsStore((s) => s.cookingVoiceId);
  const setCookingVoiceId = useSettingsStore((s) => s.setCookingVoiceId);

  const effectiveSelectedId = cookingVoiceId ?? DEFAULT_COOKING_VOICE_ID;

  const handleSelect = (voice: CookingVoice) => {
    if (voice.id === effectiveSelectedId) return;
    setCookingVoiceId(voice.id);
  };

  return (
    <View>
      <Text className="text-lg font-bold text-warmGray-900 mb-1">
        Cooking Voice
      </Text>
      <Text className="text-sm text-warmGray-500 mb-3">
        The voice that reads recipe steps aloud in cooking mode.
      </Text>

      <View className="gap-2">
        {COOKING_VOICES.map((voice) => {
          const isSelected = voice.id === effectiveSelectedId;
          return (
            <Pressable
              key={voice.id}
              onPress={() => handleSelect(voice)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${voice.name}, ${voice.accent}`}
              className={`p-4 rounded-button ${
                isSelected
                  ? 'bg-brand/10 border-l-4 border-brand'
                  : 'bg-surface border border-border-subtle'
              }`}
            >
              <View className="flex-row items-baseline gap-2">
                <Text
                  className={`text-base font-semibold ${
                    isSelected ? 'text-brand-pressed' : 'text-text-primary'
                  }`}
                >
                  {voice.name}
                </Text>
                <Text
                  className={`text-xs ${
                    isSelected ? 'text-brand' : 'text-text-secondary'
                  }`}
                >
                  {voice.accent}
                </Text>
              </View>
              <Text
                className={`text-sm mt-0.5 ${
                  isSelected ? 'text-brand' : 'text-text-secondary'
                }`}
              >
                {voice.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
