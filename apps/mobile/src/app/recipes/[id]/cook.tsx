/**
 * cook.tsx — Phase 16 Wave 3 (16-06) cook-screen integration.
 *
 * End-to-end composition of every Phase 16 primitive shipped in Waves 2.
 * This is where the UI-SPEC §Layout structure ("Claude.ai artifact recipe")
 * lands on the user's screen. All the groundwork from 16-01..16-05 flows
 * through this file.
 *
 * Composition (UI-SPEC §Layout structure):
 *   - Root wrapper SafeAreaView with no theme override — light palette only.
 *   - StickyCookingHeader (exit + title + timer band + StopTTSButton).
 *   - ScrollableRecipe attached via a forwardRef handle so voice
 *     "show ingredients" can imperatively scroll the list.
 *   - StepNavButtons (72pt deviation, per UI-SPEC §Spacing §Exceptions).
 *   - CommandToast (renders when cookingStore.lastCommandToast != null).
 *   - AskSheet (visible during / after Ask flow).
 *
 * Voice pipeline (TTS only as of quick-task 9 pre-launch cleanup):
 *   - useStepSpeaker reads the current step aloud via the ElevenLabs proxy
 *     (with expo-speech fallback). On-device STT (useVoiceListener) was
 *     unwired pre-launch; the scaffolding files stay on disk for backlog
 *     999.1 but cooking mode never instantiates them.
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
 * Phase 9 components StepDisplay + VoiceStatusBadge were deleted in 16-07
 * after being superseded by ScrollableRecipe + StepCard and VoiceWaveform.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActionSheetIOS } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';

import { useCookingStore } from '../../../stores/cookingStore';
import { useRecipeStore } from '../../../stores/recipeStore';
import { useProgressionStore } from '../../../stores/progressionStore';

import { useStepSpeaker } from '../../../cooking/useStepSpeaker';
import { askAssistant } from '../../../cooking/askAssistant';
import { streamAsk } from '../../../cooking/streamingAsk';
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
import { CookingDoneOverlay } from '../../../components/cooking/CookingDoneOverlay';

import { supabase } from '../../../lib/supabase';
import { useMealPlanStore } from '../../../stores/mealPlanStore';

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
    ttsEnabled,
    ingredientChecks,
    lastCommandToast,
    userNavigated,
    enter,
    exit,
    start,
    next,
    back,
    jumpToStep,
    repeat,
    removeTimer,
    toggleIngredient,
    clearCommandToast,
  } = cooking;

  // Cooking-mode finale overlay state. Shown after the user taps Done
  // on the last step; auto-dismisses after ~1.5s and routes to Plan.
  const [doneVisible, setDoneVisible] = useState(false);

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
  // Gate auto-speak on userNavigated so the first step is silent on
  // initial mount, matching the auto-scroll gate. Otherwise the user
  // would see the ingredients section but hear step 1 read aloud — a
  // confusing mismatch. Once the user taps Back/Next/jumpToStep, both
  // gates flip and the active step gets the standard speak-on-change.
  const stepSpeaker = useStepSpeaker(
    currentStepText,
    ttsEnabled && !!recipe && userNavigated,
  );

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
  // Tap-to-exit — no confirmation. Pre-launch UX simplification: the
  // confirmation sheet was a friction point users dismissed on every
  // exit, and the "lost progress" risk it warned about is minor (cook
  // session resets on re-entry, but the recipe is still saved).
  const handleExit = useCallback(() => {
    void fireExitConfirmHaptic();
    stepSpeaker.stop();
    void flushTelemetry();
    exit();
    router.back();
  }, [exit, stepSpeaker]);

  // --------------------------------------------------- Loading state
  if (!recipe) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-bg"
        edges={['top', 'bottom']}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-body text-text-secondary">Loading recipe…</Text>
      </SafeAreaView>
    );
  }

  // --------------------------------------------------- Render
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <Stack.Screen
        options={{ headerShown: false, gestureEnabled: false }}
      />

      <StickyCookingHeader
        recipe={recipe}
        timers={timers}
        ttsSpeaking={isSpeaking}
        onExit={handleExit}
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

      {/* Scrollable Claude.ai-artifact recipe layout. */}
      <View className="flex-1">
        <ScrollableRecipe
          ref={recipeRef}
          recipe={recipe}
          // Pre-Start: -1 keeps NO step highlighted so the user reads
          // ingredients first. Once Start is tapped (userNavigated → true),
          // step 0 becomes active and the standard active-step highlight +
          // auto-scroll kick in.
          currentStepIndex={userNavigated ? stepIndex : -1}
          ingredientChecks={ingredientChecks}
          onToggleIngredient={toggleIngredient}
          autoScrollEnabled={userNavigated}
          onStepTap={(i) => {
            void fireCommandHaptic();
            stepSpeaker.stop();
            jumpToStep(i);
            if (recipe.steps[i]) stepSpeaker.speak(recipe.steps[i]);
          }}
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
          // Pre-Start: first tap "lands" on step 1 (stepIndex stays 0)
          // and flips userNavigated. The useStepSpeaker effect deps are
          // [text, enabled] — when enabled flips false→true on the next
          // render, the effect re-runs and auto-speaks step 1. Don't
          // double-speak here; one path owns it.
          if (!userNavigated) {
            start();
            return;
          }
          next();
        }}
        disableBack={!userNavigated || stepIndex === 0}
        disableNext={userNavigated && stepIndex >= totalSteps - 1}
        nextLabel={userNavigated ? undefined : 'Start'}
        nextIcon={userNavigated ? undefined : 'play.fill'}
        primaryNext={!userNavigated}
        onDone={() => {
          void fireCommandHaptic();
          stepSpeaker.stop();
          // Mark the day as cooked if this recipe is on the current
          // plan. Lookup is best-effort — if the user opened cook from
          // somewhere outside a plan context (Recipe Box detail), no
          // plan entry exists and we just play the celebration.
          const { currentPlan, markCooked } = useMealPlanStore.getState();
          const entry = currentPlan?.entries.find(
            (e) => e.recipe_id === recipe?.id,
          );
          if (entry) {
            void markCooked(entry.day_of_week);
          }
          setDoneVisible(true);
        }}
      />

      <CookingDoneOverlay
        visible={doneVisible}
        onComplete={() => {
          setDoneVisible(false);
          // Replace so the back button doesn't return to a stale
          // cooking surface that's already been "completed".
          void flushTelemetry();
          exit();
          router.replace('/(tabs)/plan');
        }}
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
