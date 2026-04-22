/**
 * cook.tsx — Phase 16 Wave 3 (16-06) cook-screen integration.
 *
 * End-to-end composition of every Phase 16 primitive shipped in Waves 2.
 * This is where the UI-SPEC §Layout structure ("Claude.ai artifact recipe")
 * lands on the user's screen. All the groundwork from 16-01..16-05 flows
 * through this file.
 *
 * Composition (UI-SPEC §Layout structure):
 *   - Root wrapper SafeAreaView + inline `rootStyle` that applies a dark-
 *     palette override when `cookingStore.darkMode === true`. Scoped to
 *     cooking only per CONTEXT D-03.
 *   - StickyCookingHeader (exit + title + voice waveform + timer band +
 *     StopTTSButton).
 *   - ScrollableRecipe attached via a forwardRef handle so voice
 *     "show ingredients" can imperatively scroll the list.
 *   - StepNavButtons (72pt deviation, per UI-SPEC §Spacing §Exceptions).
 *   - CommandToast (renders when cookingStore.lastCommandToast != null).
 *   - AskSheet (visible during / after Ask flow).
 *
 * Voice pipeline:
 *   - useVoiceListener forwards transcripts to handleTranscript with the
 *     COOK-UX-05 deps: onCommandToast, onCommandHaptic, onShowIngredients.
 *   - show_ingredients intent → recipeRef.current?.scrollToIngredients()
 *     (the ScrollableRecipe imperative handle from 16-04).
 *   - Ask flow uses streamAsk (SSE) as the primary path; falls back to
 *     askAssistant() on NO_STREAM_BODY / NO_AUTH (Pitfall 1 — RN 0.83
 *     ReadableStream uncertainty).
 *
 * Telemetry:
 *   - wireSupabaseAuth() once at mount so flushTelemetry() can attach a
 *     real bearer token.
 *   - intent_routed, ask_start / ask_first_chunk / ask_complete events
 *     logged around the Ask flow.
 *   - flushTelemetry() called on exit so the final batch ships before
 *     unmount.
 *
 * Exit flow:
 *   - ActionSheetIOS.showActionSheetWithOptions with UI-SPEC copy: title
 *     "End cooking session?", body "Your place in the recipe won't be
 *     saved.", destructive "End cooking session", cancel "Keep cooking".
 *
 * Timers:
 *   - setInterval(1000) tick updates remainingMs, fires fireTimerWarnHaptic()
 *     once per timer crossing the 10s threshold, fires fireTimerExpireHaptic()
 *     + stepSpeaker.speak("{label} timer done.") at T-0.
 *
 * Phase 9 components StepDisplay + VoiceStatusBadge are NOT imported here —
 * they're the cleanup target for 16-07.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActionSheetIOS } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';

import { useCookingStore } from '../../../stores/cookingStore';
import { useRecipeStore } from '../../../stores/recipeStore';
import { useProgressionStore } from '../../../stores/progressionStore';

import { useStepSpeaker } from '../../../cooking/useStepSpeaker';
import { useVoiceListener } from '../../../cooking/useVoiceListener';
import { askAssistant } from '../../../cooking/askAssistant';
import { streamAsk } from '../../../cooking/streamingAsk';
import { handleTranscript } from '../../../cooking/handleTranscript';
import {
  fireCommandHaptic,
  fireExitConfirmHaptic,
  fireTimerExpireHaptic,
  fireTimerWarnHaptic,
} from '../../../cooking/haptics';
import {
  flushTelemetry,
  logCookingEvent,
  sanitizePayload,
  wireSupabaseAuth,
} from '../../../cooking/telemetry';

import { StickyCookingHeader } from '../../../components/cooking/StickyCookingHeader';
import {
  ScrollableRecipe,
  type ScrollableRecipeHandle,
} from '../../../components/cooking/ScrollableRecipe';
import StepNavButtons from '../../../components/cooking/StepNavButtons';
import { CommandToast } from '../../../components/cooking/CommandToast';
import AskSheet from '../../../components/cooking/AskSheet';

import { supabase } from '../../../lib/supabase';
import { colors } from '../../../design/tokens';

// ---------------------------------------------------------------------------
// Dark-mode palette — scoped override. Only the cooking screen ever flips
// into this palette (CONTEXT D-03). Mirrors the commented sketch in
// apps/mobile/src/global.css lines 46-66.
// ---------------------------------------------------------------------------
const DARK_PALETTE = {
  bg: '#141210',
  surface: '#1E1B18',
  textPrimary: '#F5F0E8',
  textSecondary: '#C4B7A4',
  border: '#40372D',
} as const;

// Base URL resolver — mirrors askAssistant.ts so streamAsk gets the same
// endpoint. Defined locally to keep the Ask flow in a single file.
const getApiBaseUrl = (): string =>
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function CookScreen() {
  // Keep the screen awake for the duration of a cooking session. Using the
  // hook form (not the imperative API) per Phase 9 convention + Pitfall 5.
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
    ingredientChecks,
    darkMode,
    lastCommandToast,
    enter,
    exit,
    next,
    back,
    repeat,
    addTimer,
    removeTimer,
    toggleIngredient,
    showCommandToast,
    clearCommandToast,
  } = cooking;

  // ------------------------------------------------------------------- Ask UI
  const [askSheetVisible, setAskSheetVisible] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  // ----------------------------------------------------------- TTS / Speaker
  // Drives ttsSpeaking state in the sticky header (for StopTTSButton
  // visibility). The useStepSpeaker hook handles automatic TTS on stepIndex
  // change; the `stepSpeaker.stop` handle is wired into StopTTSButton.
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ------------------------------------------------------------------ Recipe
  const currentStepText = recipe?.steps?.[stepIndex];
  const totalSteps = recipe?.steps?.length ?? 0;

  // ScrollableRecipe imperative handle — voice "show ingredients" scrolls
  // the list to its INGREDIENTS section by calling
  // recipeRef.current?.scrollToIngredients(). Final piece of the locked
  // CONTEXT "voice 'show ingredients' scrolls to the section" contract.
  const recipeRef = useRef<ScrollableRecipeHandle>(null);

  // --------------------------------------------------- Auth wiring (once)
  // Wire the telemetry batcher's supabase-backed token getter so queued
  // events actually ship. Safe to call multiple times — later calls
  // override earlier ones.
  useEffect(() => {
    wireSupabaseAuth(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });
  }, []);

  // --------------------------------------------------- Recipe load / enter
  useEffect(() => {
    if (!recipe) {
      void fetchRecipes();
    }
  }, [recipe, fetchRecipes]);

  useEffect(() => {
    if (recipe) {
      enter(recipe);
    }
    return () => {
      // Flush telemetry THEN exit so logCookingEvent calls during unmount
      // still have a live session_id. flushTelemetry() is fire-and-forget
      // here — if the network call hangs, we don't block navigation.
      void flushTelemetry();
      exit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);

  // --------------------------------------------------- Step TTS + handle
  const stepSpeaker = useStepSpeaker(currentStepText, ttsEnabled && !!recipe);

  // Track whether TTS is currently active to drive StopTTSButton visibility.
  // We can't observe expo-speech state directly, so we poll isSpeakingAsync
  // on a light 500ms cadence only while cooking is active. Stops when the
  // recipe unmounts.
  useEffect(() => {
    if (!recipe) return;
    let cancelled = false;
    const iv = setInterval(() => {
      // Dynamic import avoids a direct expo-speech import at module top-level
      // (keeps this file's dep graph focused on the new Phase 16 surfaces).
      import('expo-speech').then((Speech) => {
        Speech.isSpeakingAsync().then((speaking) => {
          if (!cancelled) setIsSpeaking(speaking);
        });
      });
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [recipe?.id]);

  // --------------------------------------------------- Voice-recognition
  const hints = useMemo<string[]>(() => {
    if (!recipe) {
      return ['next step', 'go back', 'repeat', 'timer', 'pause', 'show ingredients'];
    }
    return [
      'next step',
      'go back',
      'repeat',
      'timer',
      'pause',
      'show ingredients',
      ...recipe.ingredients.map((i) => i.name),
    ];
  }, [recipe?.id]);

  // --------------------------------------------------- Ask flow (SSE primary)
  const handleAsk = useCallback(
    async (question: string) => {
      if (!recipe) return;

      setAskSheetVisible(true);
      setAskQuestion(question);
      setAskAnswer(null);
      setAskLoading(true);
      setAskError(null);

      const sessionId = useCookingStore.getState().currentSessionId;
      const askStart = Date.now();
      let firstChunkMs: number | null = null;

      if (sessionId) {
        logCookingEvent({
          name: 'ask_start',
          session_id: sessionId,
          recipe_id: recipe.id,
          step_index: stepIndex,
          payload: {},
        });
      }

      // Fallback closure — invoked on NO_STREAM_BODY / NO_AUTH so we degrade
      // to the non-streaming askAssistant() path without user-visible churn.
      const runFallback = async () => {
        try {
          const answer = await askAssistant(recipe.id, stepIndex, question);
          setAskAnswer(answer);
          setAskLoading(false);
          stepSpeaker.speak(answer);
          if (sessionId) {
            logCookingEvent({
              name: 'ask_complete',
              session_id: sessionId,
              recipe_id: recipe.id,
              step_index: stepIndex,
              payload: sanitizePayload({
                total_ms: Date.now() - askStart,
                answer_length: answer.length,
              }),
            });
          }
        } catch (err) {
          const code = err instanceof Error ? err.message : 'ASK_FAILED';
          setAskError(code);
          setAskLoading(false);
        }
      };

      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token ?? '';

        if (!accessToken) {
          // No auth → fallback won't help (same auth requirement), so surface
          // an error. This is a rare state — user session expired mid-cook.
          setAskError('NO_AUTH');
          setAskLoading(false);
          return;
        }

        await streamAsk(
          {
            baseUrl: getApiBaseUrl(),
            accessToken,
            recipeId: recipe.id,
            currentStepIndex: stepIndex,
            question,
          },
          {
            onChunk: (chunk) => {
              if (firstChunkMs === null) {
                firstChunkMs = Date.now() - askStart;
                if (sessionId) {
                  logCookingEvent({
                    name: 'ask_first_chunk',
                    session_id: sessionId,
                    recipe_id: recipe.id,
                    step_index: stepIndex,
                    payload: sanitizePayload({ first_chunk_ms: firstChunkMs }),
                  });
                }
              }
              setAskAnswer((prev) => (prev ?? '') + chunk);
              setAskLoading(false);
            },
            onDone: (full) => {
              setAskAnswer(full);
              setAskLoading(false);
              // Speak the full answer in one shot (simple TTS contract —
              // incremental sentence chunking can be a follow-up if UAT
              // surfaces a perceivable delay).
              stepSpeaker.speak(full);
              if (sessionId) {
                logCookingEvent({
                  name: 'ask_complete',
                  session_id: sessionId,
                  recipe_id: recipe.id,
                  step_index: stepIndex,
                  payload: sanitizePayload({
                    total_ms: Date.now() - askStart,
                    answer_length: full.length,
                  }),
                });
              }
            },
            onError: async (code) => {
              if (code === 'NO_STREAM_BODY' || code === 'NO_AUTH') {
                // Pitfall 1 — RN 0.83 fetch may not expose ReadableStream.
                // Degrade to the non-streaming endpoint.
                await runFallback();
              } else {
                setAskError(code);
                setAskLoading(false);
              }
            },
          },
        );
      } catch (err) {
        const code = err instanceof Error ? err.message : 'ASK_FAILED';
        setAskError(code);
        setAskLoading(false);
      }
    },
    [recipe, stepIndex, stepSpeaker],
  );

  const onTranscript = useCallback(
    (transcript: string) => {
      void (async () => {
        const intent = await handleTranscript(transcript, {
          stopSpeech: () => stepSpeaker.stop(),
          next,
          back,
          repeat,
          addTimer,
          speak: (text) => stepSpeaker.speak(text),
          onAsk: handleAsk,
          onCommandToast: showCommandToast,
          onCommandHaptic: () => {
            void fireCommandHaptic();
          },
          onShowIngredients: () => {
            recipeRef.current?.scrollToIngredients();
          },
        });

        // Telemetry — one event per routed intent. Length is sanitized; the
        // raw transcript never leaves the device.
        const sid = useCookingStore.getState().currentSessionId;
        if (sid) {
          logCookingEvent({
            name: 'intent_routed',
            session_id: sid,
            recipe_id: recipe?.id ?? null,
            step_index: stepIndex,
            payload: sanitizePayload({
              intent_type: intent.type,
              length: transcript.length,
            }),
          });
        }
      })();
    },
    [
      next,
      back,
      repeat,
      addTimer,
      handleAsk,
      showCommandToast,
      stepSpeaker,
      recipe?.id,
      stepIndex,
    ],
  );

  useVoiceListener(onTranscript, voiceEnabled && !!recipe, hints);

  // --------------------------------------------------- Contextual tip (Phase 10)
  // Preserved from Phase 10 — fetches a Haiku-backed tip for the current
  // step. Surfaced inside the scrollable recipe area via a TIP banner.
  const fetchTip = useProgressionStore((s) => s.fetchTip);
  const [stepTip, setStepTip] = useState<string>('');
  const tipCacheRef = useRef<Map<string, string>>(new Map());

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

  // --------------------------------------------------- Timer tick + haptics
  // Once-per-second pulse updates remainingMs, fires Light warning haptic
  // the first time a timer crosses the 10s threshold, and fires Success
  // haptic + "X timer done" TTS at T-0.
  const prevRemainingRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (timers.length === 0) {
      prevRemainingRef.current.clear();
      return;
    }
    const iv = setInterval(() => {
      const now = Date.now();
      const current = useCookingStore.getState().timers;
      for (const t of current) {
        const remaining = t.endsAt - now;
        const prev = prevRemainingRef.current.get(t.id);

        // T-10s crossing — fire Light warning haptic ONCE per timer.
        if (
          prev !== undefined &&
          prev >= 10_000 &&
          remaining < 10_000 &&
          remaining > 0
        ) {
          void fireTimerWarnHaptic();
        }

        prevRemainingRef.current.set(t.id, remaining);

        if (remaining <= 0) {
          removeTimer(t.id);
          prevRemainingRef.current.delete(t.id);
          void fireTimerExpireHaptic();
          stepSpeaker.speak(`${t.label} timer done.`);
        } else {
          // Minimal-churn update to remainingMs (preserves existing Phase 9
          // pattern — readers of timer.remainingMs see fresh values).
          useCookingStore.setState({
            timers: useCookingStore
              .getState()
              .timers.map((x) =>
                x.id === t.id ? { ...x, remainingMs: remaining } : x,
              ),
          });
        }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [timers.length, removeTimer, stepSpeaker]);

  // --------------------------------------------------- Exit flow
  const handleExit = useCallback(() => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'End cooking session?',
        message: "Your place in the recipe won't be saved.",
        options: ['End cooking session', 'Keep cooking'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (idx) => {
        if (idx === 0) {
          void fireExitConfirmHaptic();
          stepSpeaker.stop();
          void flushTelemetry();
          exit();
          router.back();
        }
      },
    );
  }, [exit, stepSpeaker]);

  // --------------------------------------------------- Dark-mode palette
  // Scoped override — applied inline to the root SafeAreaView + to the
  // ScrollableRecipe wrapper. NativeWind className colors (bg-bg, bg-surface,
  // text-text-primary) still resolve via the light palette; the inline
  // overrides win for everything we hand a `style` to. This is the simplest
  // cookping-scope dark-mode approach per CONTEXT D-03 (vs. a theme
  // provider or NativeWind variant toggle).
  const rootStyle = darkMode
    ? { backgroundColor: DARK_PALETTE.bg }
    : { backgroundColor: colors.bg };

  const scrollOverrideStyle = darkMode
    ? { backgroundColor: DARK_PALETTE.bg }
    : undefined;

  // --------------------------------------------------- Loading state
  if (!recipe) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={rootStyle}
        edges={['top', 'bottom']}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Text
          className="text-body text-text-secondary"
          style={darkMode ? { color: DARK_PALETTE.textSecondary } : undefined}
        >
          Loading recipe…
        </Text>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------- Render
  return (
    <SafeAreaView
      className="flex-1"
      style={rootStyle}
      edges={['top', 'bottom']}
    >
      <Stack.Screen
        options={{ headerShown: false, gestureEnabled: false }}
      />

      <StickyCookingHeader
        recipe={recipe}
        timers={timers}
        voiceEnabled={voiceEnabled}
        listening={listening}
        ttsSpeaking={isSpeaking}
        onExit={handleExit}
        onToggleVoice={() =>
          useCookingStore.setState({ voiceEnabled: !voiceEnabled })
        }
        onStopTTS={() => {
          // StopTTSButton already fires its own fireStopTTSHaptic() on press;
          // we only need to halt TTS here.
          stepSpeaker.stop();
        }}
        onCancelTimer={removeTimer}
      />

      {/* Command toast overlays the content. The 1.5s auto-dismiss lives
          inside the component (it calls onClear via setTimeout). */}
      <CommandToast
        message={lastCommandToast?.message ?? null}
        id={lastCommandToast?.id}
        onClear={clearCommandToast}
      />

      {/* Scrollable Claude.ai-artifact recipe layout. The imperative ref
          exposes scrollToIngredients() for the voice show_ingredients
          intent (see onTranscript dep above). */}
      <View className="flex-1" style={scrollOverrideStyle}>
        <ScrollableRecipe
          ref={recipeRef}
          recipe={recipe}
          currentStepIndex={stepIndex}
          ingredientChecks={ingredientChecks}
          onToggleIngredient={toggleIngredient}
        />

        {/* Contextual tip banner (Phase 10). Retokenized from the old
            amber-* classes per UI-SPEC §Component Inventory "tip block". */}
        {stepTip.length > 0 ? (
          <View
            testID="cooking-tip"
            className="mx-4 mb-2 px-4 py-3 rounded-2xl bg-warning/10 border border-warning"
          >
            <Text className="text-label text-warning mb-1">TIP</Text>
            <Text className="text-body text-text-primary">{stepTip}</Text>
          </View>
        ) : null}
      </View>

      <StepNavButtons
        onBack={() => {
          void fireCommandHaptic();
          stepSpeaker.stop();
          back();
        }}
        onRepeat={() => {
          void fireCommandHaptic();
          stepSpeaker.stop();
          repeat();
          if (currentStepText) stepSpeaker.speak(currentStepText);
        }}
        onNext={() => {
          void fireCommandHaptic();
          stepSpeaker.stop();
          next();
        }}
        disableBack={stepIndex === 0}
        disableNext={stepIndex >= totalSteps - 1}
      />

      <AskSheet
        visible={askSheetVisible}
        question={askQuestion}
        answer={askAnswer}
        loading={askLoading}
        error={askError}
        onClose={() => {
          setAskSheetVisible(false);
          setAskQuestion('');
          setAskAnswer(null);
          setAskError(null);
          stepSpeaker.stop();
        }}
      />
    </SafeAreaView>
  );
}
