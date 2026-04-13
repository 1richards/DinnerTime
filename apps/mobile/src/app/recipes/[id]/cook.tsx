import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useKeepAwake } from 'expo-keep-awake';
import { useCookingStore } from '../../../stores/cookingStore';
import { useRecipeStore } from '../../../stores/recipeStore';
import { useProgressionStore } from '../../../stores/progressionStore';
import { useStepSpeaker } from '../../../cooking/useStepSpeaker';
import { useVoiceListener } from '../../../cooking/useVoiceListener';
import { askAssistant } from '../../../cooking/askAssistant';
import { handleTranscript } from '../../../cooking/handleTranscript';
import StepDisplay from '../../../components/cooking/StepDisplay';
import StepNavButtons from '../../../components/cooking/StepNavButtons';
import TimerBar from '../../../components/cooking/TimerBar';
import VoiceStatusBadge from '../../../components/cooking/VoiceStatusBadge';
import AskSheet from '../../../components/cooking/AskSheet';

export default function CookScreen() {
  // Pitfall 5 — use the hook, not the imperative activate/deactivate API.
  useKeepAwake();

  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, fetchRecipes } = useRecipeStore();
  const recipe = recipes.find((r) => r.id === id) ?? null;

  const cooking = useCookingStore();
  const {
    stepIndex,
    timers,
    voiceEnabled,
    listening,
    ttsEnabled,
    lastAssistantAnswer,
    enter,
    exit,
    next,
    back,
    repeat,
    addTimer,
    removeTimer,
    setAssistantAnswer,
  } = cooking;

  const [askQuestion, setAskQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);

  // Phase 10: contextual tip per active step (Haiku-backed, cached server-side).
  const fetchTip = useProgressionStore((s) => s.fetchTip);
  const [stepTip, setStepTip] = useState<string>('');
  const tipCacheRef = useRef<Map<string, string>>(new Map());

  // Load recipe if missing (shouldn't normally happen — detail screen caches).
  useEffect(() => {
    if (!recipe) {
      void fetchRecipes();
    }
  }, [recipe, fetchRecipes]);

  // Enter cooking mode when recipe is available; exit on unmount.
  useEffect(() => {
    if (recipe) {
      enter(recipe);
    }
    return () => {
      Speech.stop();
      exit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);

  const currentStepText = recipe?.steps?.[stepIndex];
  const totalSteps = recipe?.steps?.length ?? 0;

  // TTS read-aloud on step change.
  useStepSpeaker(currentStepText, ttsEnabled && !!recipe);

  // Build contextual hints (step text + ingredient names) for STT accuracy.
  const hints = React.useMemo(() => {
    if (!recipe) return ['next step', 'go back', 'repeat', 'timer', 'pause'];
    return [
      'next step',
      'go back',
      'repeat',
      'timer',
      'pause',
      ...recipe.ingredients.map((i) => i.name),
    ];
  }, [recipe?.id]);

  const onAsk = useCallback(
    async (question: string) => {
      if (!recipe) return;
      setAskQuestion(question);
      setAskLoading(true);
      setAssistantAnswer(null);
      try {
        const answer = await askAssistant(recipe.id, stepIndex, question);
        setAssistantAnswer(answer);
        Speech.speak(answer, { language: 'en-US', rate: 0.95 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ASK_FAILED';
        setAssistantAnswer(`Sorry — ${msg}`);
      } finally {
        setAskLoading(false);
      }
    },
    [recipe, stepIndex, setAssistantAnswer],
  );

  const onTranscript = useCallback(
    (transcript: string) => {
      void handleTranscript(transcript, {
        stopSpeech: () => Speech.stop(),
        next,
        back,
        repeat,
        addTimer,
        speak: (text) => Speech.speak(text, { language: 'en-US', rate: 0.95 }),
        onAsk,
      });
    },
    [next, back, repeat, addTimer, onAsk],
  );

  useVoiceListener(onTranscript, voiceEnabled && !!recipe, hints);

  // Fetch contextual tip when the active step changes; never block cooking on
  // tip failures (fail silently). Per-session in-memory cache so we don't
  // re-hit the network on back/forward navigation.
  useEffect(() => {
    if (!recipe || !currentStepText) {
      setStepTip('');
      return;
    }
    const key = `${recipe.id}::${stepIndex}`;
    const cached = tipCacheRef.current.get(key);
    if (cached !== undefined) {
      setStepTip(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tip = await fetchTip(recipe.id, stepIndex, currentStepText);
        if (cancelled) return;
        tipCacheRef.current.set(key, tip);
        setStepTip(tip);
      } catch {
        if (!cancelled) setStepTip('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipe?.id, stepIndex, currentStepText, fetchTip]);

  // Timer tick — decrement remainingMs each second, fire done announcement.
  useEffect(() => {
    if (timers.length === 0) return;
    const iv = setInterval(() => {
      const now = Date.now();
      for (const t of useCookingStore.getState().timers) {
        if (t.endsAt <= now) {
          removeTimer(t.id);
          Speech.speak(`${t.label} timer done.`, { language: 'en-US' });
        } else {
          // Mutate remainingMs via a set (minimal churn).
          useCookingStore.setState({
            timers: useCookingStore
              .getState()
              .timers.map((x) =>
                x.id === t.id ? { ...x, remainingMs: x.endsAt - now } : x,
              ),
          });
        }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [timers.length, removeTimer]);

  const handleExit = useCallback(() => {
    Speech.stop();
    exit();
    router.back();
  }, [exit]);

  if (!recipe) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['top', 'bottom']}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-base text-warmGray-500">Loading recipe…</Text>
      </SafeAreaView>
    );
  }

  const canGoBack = stepIndex > 0;
  const canGoNext = stepIndex < totalSteps - 1;

  return (
    <SafeAreaView
      className="flex-1 bg-warmWhite"
      edges={['top', 'bottom']}
    >
      <Stack.Screen
        options={{ headerShown: false, gestureEnabled: false }}
      />

      {/* Top bar: exit + voice badge */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        <Pressable
          onPress={handleExit}
          hitSlop={12}
          className="flex-row items-center"
          testID="cook-exit"
        >
          <Ionicons name="close" size={28} color="#374151" />
          <Text className="ml-1 text-base font-medium text-warmGray-700">
            Exit
          </Text>
        </Pressable>
        <VoiceStatusBadge
          listening={listening}
          voiceEnabled={voiceEnabled}
          onToggle={() =>
            useCookingStore.setState({ voiceEnabled: !voiceEnabled })
          }
        />
      </View>

      <StepDisplay
        stepNumber={stepIndex + 1}
        totalSteps={totalSteps}
        text={currentStepText ?? ''}
      />

      {stepTip.length > 0 && (
        <View
          testID="cooking-tip"
          className="mx-4 mb-2 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200"
        >
          <Text className="text-xs font-semibold text-amber-700 mb-1">
            TIP
          </Text>
          <Text className="text-sm text-amber-900 leading-5">{stepTip}</Text>
        </View>
      )}

      <TimerBar timers={timers} onCancel={removeTimer} />

      <StepNavButtons
        onBack={() => {
          Speech.stop();
          back();
        }}
        onRepeat={() => {
          Speech.stop();
          repeat();
          if (currentStepText) {
            Speech.speak(currentStepText, { language: 'en-US', rate: 0.95 });
          }
        }}
        onNext={() => {
          Speech.stop();
          next();
        }}
        canGoBack={canGoBack}
        canGoNext={canGoNext}
      />

      <AskSheet
        visible={askLoading || lastAssistantAnswer !== null}
        question={askQuestion}
        answer={lastAssistantAnswer}
        loading={askLoading}
        onClose={() => {
          setAssistantAnswer(null);
          setAskQuestion('');
          Speech.stop();
        }}
      />
    </SafeAreaView>
  );
}
