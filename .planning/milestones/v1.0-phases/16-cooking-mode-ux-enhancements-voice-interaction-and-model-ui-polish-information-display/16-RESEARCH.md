# Phase 16: Cooking Mode UX Enhancements - Research

**Researched:** 2026-04-20
**Domain:** Hands-free cooking mode refinement — voice feedback, scrollable-artifact recipe layout, Phase 19 token adoption, cooking telemetry, SSE-streamed Q&A
**Confidence:** HIGH

## Summary

Phase 16 is a refinement, not a rewrite. The Phase 9 STT/intent-router/TTS pipeline is already sound and shipped (5 plans, 66 tests, DEVICE-TEST.md auto-approved). What's missing is (1) a way to measure whether on-device STT is actually good enough in real kitchens, (2) a post-Phase-19 visual overhaul, (3) an information-density pivot from "one-big-step" to a Claude.ai-artifact scrollable recipe, (4) perceived-latency reduction on `/cooking/ask` via SSE streaming, and (5) richer command feedback (toasts + haptics) to replace the silent-except-for-TTS current model.

Every locked CONTEXT decision has direct code precedent in the repo: Phase 19 tokens are live under `apps/mobile/src/design/tokens.ts` + `global.css`; the cooking store extends cleanly for `ingredientChecks` and `darkMode`; `useVoiceListener` is already the single abstraction point for the pre-1.0 STT library; Hono 4.12 ships `streamSSE` out of the box; `@anthropic-ai/sdk@0.88` supports `.stream()` with `.on('text', ...)`. The only new project dependency is `expo-haptics@~55.0.14` (bundled with SDK 55; `npx expo install expo-haptics` with no config plugin needed).

**Primary recommendation:** Break this into ~5-6 waves — (0) test scaffolding + haptics install + dark-mode store extension; (1) telemetry pipeline (cooking_events table, client batch logger, `/telemetry/cooking` endpoint); (2) Claude.ai-artifact layout primitives (ScrollableRecipe, StepCard, IngredientRow, StickyCookingHeader, VoiceWaveform, CommandToast, StopTTSButton); (3) `/cooking/ask` SSE streaming + incremental TTS; (4) integration into `cook.tsx`, delete `StepDisplay`/`VoiceStatusBadge`, retoken `TimerBar`/`AskSheet`/tip block, wire command-feedback toasts and T-10s haptics; (5) Settings > Cooking section + dark-mode toggle; (6) verification (unit + integration + Maestro stub refresh + physical-device checklist).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Voice Model & Latency Strategy**
- **STT approach:** Ship beta with on-device `@jamsch/expo-speech-recognition` (status quo) as the primary path. Build the telemetry pipeline so the Whisper-fallback decision is data-driven. Do NOT pre-emptively build Whisper integration; defer until telemetry justifies it.
- **Cooking-mode telemetry:** Instrument this phase. Capture per-utterance: STT confidence score, STT latency (start-of-speech → final transcript), intent-classifier result (nav/timer/ask/unrecognized), `/cooking/ask` p50/p95 latency, misrecognition count (inferred from rapid-fire back→next corrections), TTS-echo-swallow events. Store anonymized locally + submit batched to backend for aggregation.
- **`/cooking/ask` latency target:** p95 < 1.5 seconds from user-finished-speaking to TTS-first-word. Keep Claude Sonnet 4 for quality. Implement response streaming so first sentence starts TTS as soon as it arrives. Keep system prompt brevity (`max_tokens: 300`).
- **Echo-loop handling:** Keep current soft `Speech.isSpeakingAsync()` check in `useVoiceListener`. Preserves barge-in. Do NOT hard-gate STT during TTS.

**Cooking UI Information Density**
- **Layout pivot — Claude.ai artifact style:** Cooking mode becomes a scrollable full-recipe view. The entire step list is visible; the current step is visually highlighted. On step advance, scroll animates to center the new current step. Replaces the existing "one big current step + small header" model.
- **Ingredients:** Part of the scrollable recipe (not a collapsible side sheet). Positioned at the top as a section. Each ingredient checkable (tap to strike-through). Voice "show ingredients" scrolls to the section.
- **Upcoming-step preview:** Implicit in the scrollable layout. Current step highlighted so users always know where they are.
- **Timer display:** Sticky header chip bar (always visible even when scrolling recipe). Haptic pulse at T-10s per timer. TTS "X timer done" at expiry.
- **Long-step handling:** Let the recipe scroll naturally. Don't auto-shrink typography.

**Design System Alignment (Phase 19 tokens)**
- **Adopt Phase 19 tokens now:** Cooking mode uses brand/surface/text tokens from Phase 19 (already shipped). Do not ship cooking mode with orange-era hardcoded styles.
- **Step text typography:** Phase 19 typography scale. Title (22pt) for non-current steps, display (34pt) for current highlighted step. Validate on physical iPhone at counter-height distance during UAT.
- **Nav button sizing:** Keep large 72pt tap targets for Back/Repeat/Next (deliberate deviation from Phase 19's 44pt icon-only standard). Cooking-hands accessibility. Document this deviation.
- **Background surface — user toggle:** Ship with cream-surface default + a settings toggle for "Dark cooking mode". Toggle lives in Settings > Cooking. Persist via Zustand + AsyncStorage.

**Voice Command Feedback**
- **Confirmation on recognized command:** Brief toast + medium haptic. Toast text: "Next step", "Timer set · 10 min", "Repeating". 1.5s auto-dismiss. Silent (no TTS echo). Works on silent mode.
- **Listening-state indicator:** Animated waveform mic icon when listening. Pulse dot when idle but armed. Gray static when voice is toggled off. Replaces current static-pill `VoiceStatusBadge`.
- **Unrecognized input handling:** Fall through to `/cooking/ask` (matches current intent router behavior). Telemetry tracks fall-through rate per session.
- **TTS interrupt:** Dedicated Stop button that appears when TTS is speaking, anchored in the sticky header. Tapping halts TTS immediately. Accessibility label: "Stop reading".

**UI-SPEC Locked Values** (from 16-UI-SPEC.md)
- 4-of-5 typography scale (`display`, `title`, `body`, `label` — `caption` NOT used)
- 2-weight collapse: 400 + 700 only (no 600) — scoped to cooking mode
- Sticky header: 64pt baseline, 112pt with timers
- Step cards: 16px gap between, 24px internal padding for current, 16px for non-current
- Ingredient rows: 16px vertical padding
- Nav bar: 72pt height
- Ingredient check icon tone: `success` (NOT `brand`)
- T-10s warning transition: `warning` @ 20% alpha background
- Scroll animation: 400ms iOS default via `scrollTo({ animated: true })`
- Repeat pulse: 300ms brand-rail thickness pulse

### Claude's Discretion

- **STT approach** — decision locked: ship on-device + telemetry, decide Whisper from data
- **Step text typography** — decision locked: display (34pt) current / title (22pt) non-current; validate at counter distance
- Toast component API (new CommandToast vs reuse `useToast`) — use new `CommandToast` per UI-SPEC
- Animation timing specifics (Reanimated vs native) — use Reanimated 4.3 (already installed) for waveform + pulses; native `scrollTo` for recipe scroll
- Telemetry batching cadence (time-based vs event-count-based) — recommend: batch on every 10 events OR 30 seconds, whichever first, plus flush on `exit()`
- SSE sentence-boundary TTS chunker (where to split for TTS) — recommend: split on `. ! ? ;` + newline, minimum 8-word chunks to avoid choppy TTS
- Accessibility label strings beyond "Stop reading" — use UI-SPEC copywriting contract verbatim

### Deferred Ideas (OUT OF SCOPE)

- **Whisper server-side fallback** — deferred unless telemetry shows on-device STT accuracy below threshold
- **Full system-wide dark mode** — Phase 16 ships cooking-only dark mode
- **Structured step data model** — difficulty tags, technique hints, per-step timing — deferred to Phase 24
- **Android cooking mode** — iOS-first
- **Apple Watch cooking companion** — completely out of scope for v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COOK-UX-01 | Voice interaction latency improved vs Phase 9 baseline | Pattern 6 (SSE streaming /cooking/ask) + Pattern 1 (cooking telemetry) measure the improvement empirically |
| COOK-UX-02 | Voice model upgrade path — on-device STT verified OR upgrade decided | Telemetry pipeline (Pattern 1) yields the data to decide; on-device is the default |
| COOK-UX-03 | Cooking-mode UI polished, consistent with Apple HIG + Phase 15 + Phase 19 tokens | Pattern 4 (component inventory) + Don't-Hand-Roll (Button, Chip, SymbolIcon from Phase 19) |
| COOK-UX-04 | At-a-glance: current step, upcoming steps, active timers, remaining ingredients without scrolling | Pattern 2 (Claude.ai-artifact scrollable recipe) + Pattern 3 (sticky header with timer chips) |
| COOK-UX-05 | Voice commands navigate reliably with clear visual confirmation | Pattern 5 (CommandToast + haptics on every recognized intent) + Pattern 7 (waveform/pulse listening indicator) |

Requirement ID note: The REQUIREMENTS.md lists "Cooking UX improvement (post-v1)" for Phase 16 but does not yet assign canonical COOK-UX-** IDs. This research proposes COOK-UX-01 through COOK-UX-05 matching the 5 Success Criteria in the phase description. The planner should adopt these IDs (or let the plan-check stage rename them) so `/gsd:verify-work` can map tasks to requirements.
</phase_requirements>

## Standard Stack

### Core (already installed — verified via `npm view`, 2026-04-20)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-router | ~55.0.12 | Existing `cook.tsx` route at `app/recipes/[id]/` | No change |
| zustand | ^5.0.12 | `cookingStore` — extend with `ingredientChecks: Record<string, boolean>` and `darkMode: boolean` | Already established |
| nativewind | ^4.2.3 | Styling; Phase 19 tokens resolved via `tailwind.config.js` → `global.css` | Project mandate |
| react-native-reanimated | 4.2.1 (repo) / 4.3.0 (latest) | Waveform animation, pulse-on-repeat, dark-mode cross-fade | Already bundled; 4.2 sufficient for use cases here (no upgrade needed) |
| react-native | 0.83.4 | Native ScrollView for recipe scroll + scrollTo animation | No change |
| expo-symbols | ~55.0.7 | SF Symbols via `SymbolIcon` (Phase 15 convention) | Project standard |
| @jamsch/expo-speech-recognition | 0.2.15 (exact pin) | STT, unchanged from Phase 9 | CONTEXT decision: keep |
| expo-speech | ~55.0.13 (repo) / ~55.0.14 (latest) | TTS, unchanged | Bundled with SDK 55 |
| expo-keep-awake | ~55.0.6 | Unchanged — `useKeepAwake()` hook stays | Bundled |
| @tanstack/react-query | ^5.97.0 | Already used for recipe fetch — unchanged | No change |
| @react-native-async-storage/async-storage | ^3.0.2 | Backing store for dark-mode persistence (Zustand persist middleware) | Already used by progressionStore + offlineQueue |

### New Additions (minimal — only expo-haptics is new)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-haptics | ~55.0.14 | Medium haptic on recognized commands, light on ingredient tap, T-10s timer warning, success on timer expire | First-party Expo module, SDK 55 bundled. No config plugin needed. Taptic Engine on iPhone 7+ |

**Install:**
```bash
cd apps/mobile
npx expo install expo-haptics
# No app.json plugin required — expo-haptics is a simple native module
```

> **Metro cache note (CLAUDE.md gotcha):** After installing a new native module, if the dev client was already built, the existing bundle still works without a rebuild (haptics does not require native pod linking at runtime beyond what SDK 55 already ships). However, an `npx expo start --clear` + Metro restart is prudent. If a user reports "haptics.impactAsync is not a function", rebuild the dev client.

### Backend (packages/server) — no new deps

| Technology | Version | Purpose |
|------------|---------|---------|
| Hono | ^4.7.10 (installed) / 4.12.14 (deduped) | Already ships `streamSSE` helper (`hono/streaming`) — no upgrade needed |
| @anthropic-ai/sdk | ^0.88.0 (installed) / 0.90.0 (latest) | `.stream()` + `.on('text', ...)` API — no upgrade needed |
| @hono/node-server | ^1.14.1 (installed) / 1.19.13 (deduped) | Supports streaming responses end-to-end | Unchanged |

Telemetry tables use the existing Supabase + RLS pattern (see Architecture Pattern 1).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SSE streaming for `/cooking/ask` | WebSocket or polling | SSE is simpler (one-way), works over stock HTTP, Hono has `streamSSE` out of box. WebSocket adds lifecycle complexity with no benefit here. Polling can't beat p95<1.5s. |
| SSE from Hono with custom parse | Anthropic SDK's native stream piped to Hono | Using `anthropic.messages.stream(...).on('text', ...)` and forwarding each chunk via `stream.writeSSE` is simpler than parsing the raw HTTP SSE from Anthropic. One fewer parser. |
| Custom toast primitive | Reuse existing `useToast()` | UI-SPEC locks a new `CommandToast` component because cooking mode needs Phase-19-token-aware styling, 1.5s timing (not 2s), and `accessibilityLiveRegion="polite"`. Rewrite is ~40 lines. |
| Sheet-based dark-mode toggle | Inline Settings toggle row + optional in-cooking long-press | CONTEXT: primary entry in Settings, long-press is secondary. Don't ship long-press in Wave 1 unless it falls out naturally — Settings toggle is the authoritative UX. |
| FlatList for scrollable recipe | Native ScrollView | Recipes are short (avg ~6-12 steps). FlatList virtualization overhead exceeds benefit. ScrollView is simpler, supports `scrollTo({y, animated: true})` natively, and anchors scroll-restoration cleanly when a step advances. |

**Version verification** (`npm view` 2026-04-20):
- `@anthropic-ai/sdk@0.90.0` latest (repo 0.88.0 supports streaming — no upgrade required for Phase 16)
- `hono@4.12.14` latest (repo 4.12.12 deduped — streamSSE present)
- `@jamsch/expo-speech-recognition@0.2.15` still exact pin (no 0.3.x release — Pitfall 7 mitigation still intact)
- `expo-haptics@55.0.14` = current SDK 55 release
- `react-native-reanimated@4.3.0` (repo 4.2.1, no upgrade needed for Phase 16 scope)

## Architecture Patterns

### Recommended File Structure

```
apps/mobile/
├── app/recipes/[id]/
│   └── cook.tsx                              # heavily reworked — composes new primitives
├── src/
│   ├── stores/
│   │   └── cookingStore.ts                   # extend: ingredientChecks, darkMode, lastCommandToast
│   ├── cooking/
│   │   ├── telemetry.ts                      # NEW — batch event logger
│   │   ├── streamingAsk.ts                   # NEW — SSE fetch client + TTS sentence chunker
│   │   ├── useVoiceListener.ts               # add telemetry hooks (onFinalTranscript, onEnd, onError)
│   │   ├── useStepSpeaker.ts                 # expose stopHandle for StopTTSButton
│   │   ├── handleTranscript.ts               # emit CommandToast + haptic on every recognized intent
│   │   ├── intentRouter.ts                   # unchanged
│   │   ├── timerParser.ts                    # unchanged
│   │   └── askAssistant.ts                   # KEEP as fallback (non-streaming); streamingAsk is primary
│   └── components/cooking/
│       ├── ScrollableRecipe.tsx              # NEW — owns scroll-to-current, renders ingredients + steps sections
│       ├── StepCard.tsx                      # NEW — isCurrent prop flips between display (34pt) and title (22pt)
│       ├── IngredientRow.tsx                 # NEW — checkable with strike-through, success check icon
│       ├── StickyCookingHeader.tsx           # NEW — Exit + title + waveform + timer chips + StopTTS
│       ├── VoiceWaveform.tsx                 # NEW — Reanimated waveform (listening) + pulse dot (idle-armed)
│       ├── CommandToast.tsx                  # NEW — token-styled 1.5s toast with accessibilityLiveRegion
│       ├── StopTTSButton.tsx                 # NEW — icon-only, accessibilityLabel="Stop reading"
│       ├── TimerBar.tsx                      # RETOKEN — replace #C2410C with colors.brandPressed, add T-10s warn
│       ├── AskSheet.tsx                      # RETOKEN + incremental rendering as SSE arrives
│       ├── StepDisplay.tsx                   # DELETE after migration
│       └── VoiceStatusBadge.tsx              # DELETE after migration
│   └── app/(tabs)/
│       └── settings.tsx                      # ADD Cooking section with dark-mode toggle
packages/server/
├── src/routes/
│   ├── cooking.ts                            # ADD streaming /cooking/ask-stream (or convert /ask to SSE)
│   └── telemetry.ts                          # NEW — POST /api/v1/telemetry/cooking
├── src/services/
│   └── cookingTelemetry.ts                   # NEW — persist cooking_events rows
└── migrations/
    └── NNN_cooking_telemetry.sql             # NEW — cooking_events table + RLS
```

### Pattern 1: Cooking Telemetry Pipeline (CONTEXT decision; enables COOK-UX-01/02)

**What:** Client-side batched event logger → backend `/api/v1/telemetry/cooking` → `cooking_events` table with RLS.

**When to use:** Every STT result (success, error, empty), every routed intent, every `/cooking/ask` roundtrip (start, first-chunk, complete), every TTS-echo-swallow, every unrecognized fall-through.

**Why:** Three CONTEXT questions need empirical answers this phase (Whisper fallback?, p95 ask latency?, misrecognition rate?). Without measurement, we cannot validate COOK-UX-01 or COOK-UX-02.

**Schema (proposed — planner to confirm):**
```sql
-- migrations/NNN_cooking_telemetry.sql
create table if not exists cooking_events (
  id bigserial primary key,
  profile_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,               -- client-generated UUID per cooking entry
  event_type text not null,               -- 'stt_final' | 'stt_error' | 'intent_routed' | 'ask_start' | 'ask_first_chunk' | 'ask_complete' | 'tts_echo_swallowed' | 'command_unrecognized'
  recipe_id uuid references recipes(id) on delete set null,
  step_index int,
  -- flexible payload for event-specific fields (confidence, ms, intent_type, etc.)
  payload jsonb not null default '{}'::jsonb,
  client_ts timestamptz not null,         -- event time on device
  server_ts timestamptz not null default now()
);

create index cooking_events_profile_ts_idx on cooking_events(profile_id, server_ts desc);
create index cooking_events_session_idx on cooking_events(session_id);

alter table cooking_events enable row level security;

create policy "users read own cooking events" on cooking_events
  for select using (auth.uid() = profile_id);
create policy "users insert own cooking events" on cooking_events
  for insert with check (auth.uid() = profile_id);
-- No UPDATE/DELETE policy — events are append-only (mirrors recipe_cooks pattern from Phase 10-01).
```

**Client batching module (recommended shape):**
```typescript
// src/cooking/telemetry.ts
import { supabase } from '../lib/supabase';

type CookingEventType =
  | 'stt_final' | 'stt_error' | 'intent_routed'
  | 'ask_start' | 'ask_first_chunk' | 'ask_complete'
  | 'tts_echo_swallowed' | 'command_unrecognized';

interface CookingEvent {
  session_id: string;
  event_type: CookingEventType;
  recipe_id: string | null;
  step_index: number | null;
  payload: Record<string, unknown>;
  client_ts: string;    // ISO
}

const queue: CookingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function logCookingEvent(e: Omit<CookingEvent, 'client_ts'>) {
  queue.push({ ...e, client_ts: new Date().toISOString() });
  if (queue.length >= 10) void flushTelemetry();
  else if (!flushTimer) flushTimer = setTimeout(() => void flushTelemetry(), 30_000);
}

export async function flushTelemetry() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { queue.push(...batch); return; } // keep for next time
    await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/telemetry/cooking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Best-effort — drop on failure (no retry loop). Next flush will continue.
  }
}
```

**Hooks in existing code:**
- `useVoiceListener` — log `stt_final` (with `result.transcript.length`), `stt_error` (with error code/message)
- `handleTranscript` — log `intent_routed` (with `intent.type` and raw transcript length)
- `streamingAsk` — log `ask_start`, `ask_first_chunk` (with ms since start), `ask_complete` (with total ms + answer length)
- Intent-router `ask` branch when a fall-through is unrecognized-ish (e.g. very short transcript) — log `command_unrecognized`

**Anti-pattern:** DO NOT log PII. The raw transcript text is cooking chatter — still log **length**, not content. Keep payload surface small and structured.

### Pattern 2: Claude.ai-Artifact Scrollable Recipe (COOK-UX-04)

**What:** Full recipe visible as one vertical `ScrollView`. Top section = ingredients. Second section = numbered steps. Current step is visually distinct (brand left rail, display typography, elevated surface). Advancing auto-scrolls to center the new current step.

**When to use:** Single pattern for the cook screen body. Replaces `<StepDisplay />` (delete) from Phase 9.

**Example:**
```typescript
// src/components/cooking/ScrollableRecipe.tsx
import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Text } from 'react-native';
import type { Recipe } from '../../types/recipe';
import { IngredientRow } from './IngredientRow';
import { StepCard } from './StepCard';

interface Props {
  recipe: Recipe;
  currentStepIndex: number;
  ingredientChecks: Record<string, boolean>;
  onToggleIngredient: (id: string) => void;
}

export function ScrollableRecipe({ recipe, currentStepIndex, ingredientChecks, onToggleIngredient }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  // Collect step-card y-positions on layout; scrollTo on currentStepIndex change.
  const stepYs = useRef<number[]>([]);

  useEffect(() => {
    const y = stepYs.current[currentStepIndex];
    if (y !== undefined && scrollRef.current) {
      // Center the current step roughly 1/3 down the viewport for reading comfort.
      scrollRef.current.scrollTo({ y: Math.max(0, y - 120), animated: true });
    }
  }, [currentStepIndex]);

  return (
    <ScrollView ref={scrollRef} className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 48 }}>
      <View className="px-4 pt-8">
        <Text className="text-label text-text-secondary mb-4">INGREDIENTS</Text>
        {recipe.ingredients.map((ing, i) => (
          <IngredientRow
            key={`${ing.name}-${i}`}
            id={`${ing.name}-${i}`}
            ingredient={ing}
            checked={!!ingredientChecks[`${ing.name}-${i}`]}
            onToggle={onToggleIngredient}
          />
        ))}
      </View>

      <View className="px-4 pt-6">
        <Text className="text-label text-text-secondary mb-4">STEPS</Text>
        {recipe.steps.map((step, i) => (
          <View
            key={i}
            onLayout={(e) => { stepYs.current[i] = e.nativeEvent.layout.y; }}
            className="mb-4"
          >
            <StepCard
              stepNumber={i + 1}
              totalSteps={recipe.steps.length}
              text={step}
              isCurrent={i === currentStepIndex}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
```

**Key detail:** `onLayout` collects step-card y-positions in `stepYs.current`. The effect on `currentStepIndex` reads that position and scrolls. This avoids measuring after render (a common foot-gun) and handles variable-height steps cleanly.

### Pattern 3: Sticky Cooking Header (COOK-UX-03/04)

**What:** Absolute-positioned `View` anchored at `top: 0` with exit, title, voice waveform, timer chips, and stop-TTS button. Height 64pt baseline, 112pt with timers (fixed 48pt timer band when `timers.length > 0`).

**Implementation sketch:**
```typescript
// src/components/cooking/StickyCookingHeader.tsx
import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { VoiceWaveform } from './VoiceWaveform';
import { StopTTSButton } from './StopTTSButton';
import { TimerBar } from './TimerBar';

interface Props {
  recipeTitle: string;
  listening: boolean;
  voiceEnabled: boolean;
  ttsSpeaking: boolean;
  timers: Timer[];
  onExit: () => void;
  onToggleVoice: () => void;
  onStopTTS: () => void;
  onCancelTimer: (id: string) => void;
}

export function StickyCookingHeader({ ... }: Props) {
  return (
    <View className="bg-surface border-b border-border">
      {/* 64pt base band */}
      <View className="h-16 flex-row items-center justify-between px-4">
        <Pressable onPress={onExit} hitSlop={12} accessibilityLabel="Exit cooking" testID="cook-exit">
          <SymbolIcon name="xmark" size={24} tintColor={colors.textPrimary} />
        </Pressable>
        <Text className="text-title text-text-primary flex-1 text-center mx-2" numberOfLines={1}>
          {recipeTitle}
        </Text>
        <View className="flex-row items-center">
          {ttsSpeaking && <StopTTSButton onPress={onStopTTS} />}
          <VoiceWaveform listening={listening} enabled={voiceEnabled} onToggle={onToggleVoice} />
        </View>
      </View>
      {/* 48pt timer band — only when timers present */}
      {timers.length > 0 && <TimerBar timers={timers} onCancel={onCancelTimer} />}
    </View>
  );
}
```

### Pattern 4: Voice Waveform Listening Indicator (COOK-UX-05)

**What:** Reanimated bars that animate when `listening === true`, pulse dot when `enabled && !listening`, gray static when `!enabled`. Replaces the current static-pill `VoiceStatusBadge`.

**Why Reanimated over Animated:** 4.2.1 is already in the bundle; `withRepeat` + `withTiming` gives smooth 60fps bars without blocking the JS thread. The existing `Toast` component uses legacy `Animated` — don't copy that pattern for the waveform.

**Amplitude source:** Phase 9's `useVoiceListener` only surfaces `result` events (final-only). For a visual amplitude proxy, cycle 3-5 bars through a repeating sine-wave at 8-12Hz driven by a single `useSharedValue`. If `useSpeechRecognitionEvent('volumechange', ...)` is available in 0.2.15 (see Open Question #1), use real amplitude; otherwise a cosmetic loop is fine for v1.

```typescript
// src/components/cooking/VoiceWaveform.tsx (sketch)
import { Pressable, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';

export function VoiceWaveform({ listening, enabled, onToggle }: Props) {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = listening ? withRepeat(withTiming(1, { duration: 600 }), -1, true) : 0;
  }, [listening, phase]);

  if (!enabled) {
    return (
      <Pressable onPress={onToggle} accessibilityLabel="Voice commands: off">
        <SymbolIcon name="mic.slash.fill" size={24} tintColor={colors.textTertiary} />
      </Pressable>
    );
  }
  if (!listening) {
    // Pulse dot
    return (
      <Pressable onPress={onToggle} accessibilityLabel="Voice commands: on">
        <View className="w-6 h-6 rounded-full bg-brand/30 items-center justify-center">
          <View className="w-2 h-2 rounded-full bg-brand" />
        </View>
      </Pressable>
    );
  }
  // Waveform bars (3 × animated height)
  return (
    <Pressable onPress={onToggle} className="flex-row items-end gap-1 h-6" accessibilityLabel="Voice commands: listening">
      {[0, 0.3, 0.6].map((offset, i) => {
        const style = useAnimatedStyle(() => ({
          height: 4 + 16 * Math.abs(Math.sin(phase.value * Math.PI * 2 + offset * Math.PI * 2)),
        }));
        return <Animated.View key={i} className="w-1 bg-brand rounded-full" style={style} />;
      })}
    </Pressable>
  );
}
```

### Pattern 5: Command Toast + Haptic on Every Recognized Intent (COOK-UX-05)

**What:** Extend `handleTranscript.ts` to inject a `onCommandToast(message: string)` callback and a `onCommandHaptic()` callback into `TranscriptDeps`. Every recognized intent fires both before/after the action.

**Example:**
```typescript
// extended handleTranscript.ts
export interface TranscriptDeps {
  // ... existing
  onCommandToast: (message: string) => void;
  onCommandHaptic: () => void;        // medium impact
}

// handleTranscript, case 'next':
case 'next':
  deps.stopSpeech();
  deps.next();
  deps.onCommandHaptic();
  deps.onCommandToast('Next step');
  return intent;
```

**Toast rendering** uses `CommandToast.tsx` (new primitive, not the generic `useToast`), mounted inside the cook screen. The toast is driven by `cookingStore.lastCommandToast: { message: string; id: string } | null` — setting a new value re-triggers render; 1.5s auto-clear.

**Haptics integration:**
```typescript
// cook.tsx
import * as Haptics from 'expo-haptics';

const onCommandHaptic = useCallback(() => {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}, []);
```

**Accessibility:** `CommandToast` sets `accessibilityLiveRegion="polite"` so VoiceOver users hear the confirmation spoken (UI-SPEC requirement).

### Pattern 6: SSE Streaming for `/cooking/ask` (COOK-UX-01)

**What:** Server endpoint sends Claude text deltas over Server-Sent Events as they arrive from the Anthropic stream. Mobile client parses the stream and calls `Speech.speak(chunk)` per sentence boundary.

**Server-side (Hono 4.12):**
```typescript
// packages/server/src/routes/cooking.ts (new handler)
import { streamSSE } from 'hono/streaming';

cooking.post('/ask-stream', async (c) => {
  // ... auth + body validation + recipe load identical to /ask
  const systemPrompt = buildSystemPrompt(typed, currentStep);

  return streamSSE(c, async (stream) => {
    try {
      const anthropic = getAnthropicClient();
      const answerChunks: string[] = [];
      await anthropic.messages
        .stream({
          model: 'claude-sonnet-4-latest',
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: question }],
        })
        .on('text', async (text) => {
          answerChunks.push(text);
          await stream.writeSSE({ event: 'delta', data: text });
        });
      const full = answerChunks.join('');
      await stream.writeSSE({ event: 'done', data: full.slice(0, 300) });
    } catch (err) {
      await stream.writeSSE({ event: 'error', data: 'CLAUDE_ERROR' });
    }
  });
});
```

**Client-side (mobile):**
```typescript
// src/cooking/streamingAsk.ts
import * as Speech from 'expo-speech';

type ChunkHandler = (chunk: string, fullSoFar: string) => void;

export async function streamAsk(
  recipeId: string,
  currentStepIndex: number,
  question: string,
  onChunk: ChunkHandler,
  onDone: (full: string) => void,
  onError: (code: string) => void,
) {
  const token = await getAuthToken();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/cooking/ask-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipe_id: recipeId, current_step_index: currentStepIndex, question }),
  });

  if (!res.ok || !res.body) return onError(`HTTP_${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE chunks — each message separated by \n\n
    let sepIdx;
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const rawMsg = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      const lines = rawMsg.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (event === 'delta') {
        full += data;
        onChunk(data, full);
      } else if (event === 'done') {
        onDone(data);
        return;
      } else if (event === 'error') {
        return onError(data);
      }
    }
  }
}
```

**TTS sentence chunker (caller side):**
```typescript
// In cook.tsx ask flow
let sentenceBuffer = '';
const SENTENCE_END = /[.!?;](\s|$)/;

await streamAsk(recipe.id, stepIndex, question,
  (chunk, full) => {
    setAssistantAnswer(full);                 // live text in AskSheet
    sentenceBuffer += chunk;
    const match = sentenceBuffer.match(SENTENCE_END);
    if (match) {
      const endIdx = match.index! + 1;
      const toSpeak = sentenceBuffer.slice(0, endIdx).trim();
      sentenceBuffer = sentenceBuffer.slice(endIdx);
      // Only speak if ≥8 words so TTS isn't choppy
      if (toSpeak.split(/\s+/).length >= 8 || fullDoneSoon) {
        Speech.speak(toSpeak, { language: 'en-US', rate: 0.95 });
      }
    }
  },
  (full) => {
    // flush remaining buffer
    if (sentenceBuffer.trim()) Speech.speak(sentenceBuffer.trim(), { language: 'en-US', rate: 0.95 });
    setAssistantAnswer(full);
  },
  (err) => setAssistantAnswer(`Sorry — ${err}`),
);
```

**Fallback:** Keep `askAssistant.ts` (non-streaming) as a fallback if SSE fails. Client tries streaming first; on any exception in the reader loop, fall through to `askAssistant()`.

**Telemetry integration:** Log `ask_start` before fetch, `ask_first_chunk` on first `delta` event (measure TTFB/TTFT), `ask_complete` on `done`.

### Pattern 7: Cooking Store Extensions

**What:** Add three slices to `cookingStore` while preserving all existing state/actions.

```typescript
// src/stores/cookingStore.ts (extensions only)
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CookingState {
  // ... existing recipe / stepIndex / voiceEnabled / ttsEnabled / listening / timers / lastAssistantAnswer
  ingredientChecks: Record<string, boolean>;     // keyed by `${ing.name}-${index}`
  darkMode: boolean;                              // persisted across sessions
  lastCommandToast: { message: string; id: string } | null;  // ephemeral — NOT persisted
  currentSessionId: string | null;                // for telemetry batching
}

interface CookingActions {
  // ... existing
  toggleIngredient: (id: string) => void;
  clearIngredientChecks: () => void;              // on enter()
  setDarkMode: (on: boolean) => void;
  showCommandToast: (message: string) => void;    // generates fresh id
  clearCommandToast: () => void;                  // 1.5s timer
  startSession: () => void;                        // generates session_id on enter
}

// Wrap with persist() restricted to darkMode only (partialize):
export const useCookingStore = create<CookingState & CookingActions>()(
  persist(
    (set, get) => ({
      // ... all existing
      ingredientChecks: {},
      darkMode: false,
      lastCommandToast: null,
      currentSessionId: null,

      toggleIngredient: (id) => set((s) => ({
        ingredientChecks: { ...s.ingredientChecks, [id]: !s.ingredientChecks[id] },
      })),
      clearIngredientChecks: () => set({ ingredientChecks: {} }),
      setDarkMode: (on) => set({ darkMode: on }),
      showCommandToast: (message) => set({ lastCommandToast: { message, id: `t-${Date.now()}` } }),
      clearCommandToast: () => set({ lastCommandToast: null }),
      startSession: () => set({ currentSessionId: `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` }),

      // Extend enter() to also call startSession + clearIngredientChecks
      enter: (recipe) => {
        const sessionId = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        set({ recipe, stepIndex: 0, ingredientChecks: {}, currentSessionId: sessionId });
      },
    }),
    {
      name: 'cooking-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ darkMode: s.darkMode }),   // ONLY darkMode persists across sessions
    },
  ),
);
```

**Pattern precedent:** `progressionStore.ts` already uses `persist` + `partialize` for `cookStats`/`ambitionSuggestions` (see STATE.md Phase 10-05). Mirror that shape exactly.

### Anti-Patterns to Avoid

- **Rebuilding intent router.** It's tested and working. Only add telemetry hooks in `handleTranscript`, don't rewrite the regex layer.
- **Hard-gating STT during TTS.** CONTEXT explicitly preserves soft `isSpeakingAsync()` check. Barge-in is the feature, not a bug.
- **New font weights in cooking mode.** UI-SPEC locks 400 + 700 only. 600 is forbidden in cooking components (allowed elsewhere in the app).
- **Caption-role (13pt) anywhere in cooking mode.** UI-SPEC drops it. Reassign to `body` or `label`.
- **Hardcoded hex values.** All colors resolve through Phase 19 tokens. `TimerBar`'s `#C2410C` is the only remaining literal and must go.
- **Flushing telemetry synchronously on every event.** Kills UI responsiveness. Batch as Pattern 1 shows.
- **Wake-word detection.** Out of scope; cooking mode stays always-listening when voice is enabled (Phase 9 Open Question #2).
- **FlatList for the recipe.** See Alternatives Considered — overhead not worth it.
- **Global dark-mode switch.** CONTEXT explicitly scopes dark mode to cooking screen only. Don't `View.setTheme()` or touch root tokens — use a local scoped `View` with dark-palette override styles on the cook screen root.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-Sent Events from Hono | Custom chunked response | `streamSSE` from `hono/streaming` | First-party helper; handles headers, sleep, SSE framing, error handler |
| Anthropic streaming parse | Custom SSE parser against Claude API | `anthropic.messages.stream(...).on('text', ...)` | SDK normalizes `content_block_delta` → `text_delta` → string chunks |
| Scrollable list virtualization | Custom windowing | Native `ScrollView` (recipes are ≤30 steps) | Virtualization benefit is zero at this scale; adds bugs |
| Haptic feedback | react-native-haptic-feedback | `expo-haptics` (first-party) | Expo-native, no pod-link surprises, exact API match in docs |
| Animated waveform bars | Setinterval + setState loops | `react-native-reanimated` `useSharedValue` + `withRepeat` | 60fps on UI thread; already installed |
| Toast primitive with live region | Existing `useToast()` | New `CommandToast` | UI-SPEC requires Phase-19 tokens + 1.5s timing + `accessibilityLiveRegion="polite"` — 40-line rewrite is cheaper than parameterizing useToast |
| Dark-palette override | `@media prefers-color-scheme` or app-wide theme provider | Scoped `View` style with manual dark tokens on cook-screen root | CONTEXT: cooking-only dark mode, not app-wide. A scoped View is simplest |
| Ingredient check persistence | Deep store serialization | `ingredientChecks` is ephemeral (cleared on `enter()`) | User re-checks for each cook session; no persistence needed |
| Telemetry retry logic | Full exponential backoff | Best-effort drop-on-failure + keep in queue on network fail | Mirrors offlineQueue pattern (Phase 10-04); telemetry is not user-critical |
| Session id generation | UUID library | `sess-${Date.now(36)}-${Math.random(36)}` | RN `crypto.randomUUID` is unreliable (Phase 9-01 decision preserved) |
| Scroll-to-current logic | `measureLayout` + native bridges | `onLayout` y-capture + `scrollTo({y, animated: true})` | Simple, tested, and works on both iOS/Android without bridge calls |

**Key insight:** Almost everything needed is already in the project or Expo SDK 55. The only greenfield work is the ~7 new components, the telemetry pipeline, and the SSE streaming conversion. No new external infrastructure.

## Runtime State Inventory

Phase 16 is primarily additive (new components, new endpoints, new columns) but has one refactor surface: replacing Phase 9 components with Phase 16 equivalents and retokening TimerBar/AskSheet/tip block. Mapped against the rename/migration template:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Supabase: new `cooking_events` table (greenfield); existing `recipes` rows untouched; existing `recipe_step_tips` cache from Phase 10-03 untouched | Data migration SQL (additive: `CREATE TABLE cooking_events` + RLS policies). No existing-row backfill needed. |
| Live service config | None — Anthropic model string `claude-sonnet-4-latest` stays the same; Claude Haiku for tips stays the same | None — verified by grep on `cooking.ts` and cookingTips service |
| OS-registered state | None — Expo dev client already has iOS speech + microphone permissions from Phase 9 app.json; no new permissions needed for expo-haptics | None. |
| Secrets / env vars | No new env vars. Telemetry uses existing auth token. SSE uses existing `EXPO_PUBLIC_API_URL`. | None — verified against `apps/mobile/.env.example` and root `.env.example` |
| Build artifacts / installed packages | `@jamsch/expo-speech-recognition@0.2.15` stays exact pin; `expo-haptics` is new native module; delete Phase 9 components (`StepDisplay.tsx`, `VoiceStatusBadge.tsx`) after migration | `npx expo install expo-haptics`. No rebuild required for the dev client to pick up haptics (it's a Swift-only iOS native module already in the SDK 55 prebuild config); Metro cache clear (`--clear`) is sufficient. Delete dead Phase 9 components as a final cleanup task. |

**Critical note on AsyncStorage key naming:** The new `cookingStore` persist layer writes to key `cooking-store`. Verify this doesn't collide with any existing AsyncStorage key (grep `progression-store`, `recipe-store`, etc. for a collision — they use different names; safe). If a user has an old `cookingStore` without persist, the persist middleware's default rehydration is safe (missing keys just hydrate the initial state).

## Environment Availability

Phase 16 depends on the existing dev environment plus one new expo-haptics native module. Probed against a typical Mac Mini + iPhone test setup:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server dev | ✓ | 22 LTS | — |
| pnpm | Workspace install | ✓ | (inherited from repo) | npm works too |
| iOS Simulator (Xcode 26.4) | Maestro UAT | ✓ | iPhone 17 Pro / iOS 26.4 | Physical device |
| EAS dev client | Voice features (existing) | ✓ | built from `apps/mobile/ios/` | Rebuild if needed |
| Physical iPhone | Real-kitchen STT validation | — | User-provided | Simulator for UI-only UAT |
| Cloudflare tunnel | Physical iPhone → localhost:3000 | ✓ | `cloudflared` | LAN IP for same-WiFi testing |
| expo-haptics (new) | Command feedback | ✗ | — | Install via `npx expo install expo-haptics@~55.0.14` |
| Supabase project | `cooking_events` migration | ✓ | existing project | — |
| Maestro 2.4.0 | UAT automation | ✓ | /opt/homebrew | — |
| OpenJDK 21 | Maestro runtime | ✓ | /opt/homebrew | — |

**Missing dependencies with no fallback:** None — all blockers are present.

**Missing dependencies with fallback:**
- `expo-haptics` — install is a single command and it ships with SDK 55. Cannot block execution.

**Real-kitchen STT accuracy validation** is a device + human test. The physical iPhone is required at the end of the phase to collect 1-2 cooking sessions of real telemetry. If unavailable at verification time, the phase can ship with simulator-only UAT and the physical-device validation deferred to post-beta — this is an explicit CONTEXT-sanctioned gap (telemetry exists, data comes later).

## Common Pitfalls

### Pitfall 1: SSE fetch on React Native — `res.body` undefined or no ReadableStream

**What goes wrong:** React Native's `fetch()` historically didn't expose `res.body` as a standard Web ReadableStream. A naive port of a web SSE client breaks on RN.

**Why:** Pre-0.73 RN relied on a polyfilled whatwg-fetch that buffered the entire response before resolving. RN 0.83 (our version) has better support but it's not guaranteed for all platforms.

**How to avoid:**
1. **Verify on the repo version first.** RN 0.83 + Hermes supports streaming fetch on iOS (tested in Expo SDK 53+). Confirm with a smoke test in Wave 0.
2. **If it fails:** Fall back to `react-native-fetch-api` (drop-in replacement) or use `XMLHttpRequest` with `responseType: ''` and `onprogress` to parse incremental text. The `onprogress` path is well-documented.
3. **Define the fallback contract upfront:** `streamingAsk.ts` has a try/catch that falls through to non-streaming `askAssistant()` on error.

**Warning signs:** `res.body` is `null`, reader.read() never returns, or the full response arrives as one chunk. Test in Wave 0 with a sample streaming endpoint before building the full pipeline.

### Pitfall 2: `text` event on Anthropic SDK `messages.stream()` may emit across content blocks

**What goes wrong:** The SDK's `.on('text', callback)` fires for every text delta regardless of content block. If Claude returns tool use or multiple content blocks in a single response, the text concatenation is wrong.

**Why:** `/cooking/ask` uses no tools and Claude is instructed to return plain text. But a future change (tool calls for timer-setting, recipe lookup, etc.) would silently break.

**How to avoid:**
1. For Phase 16, keep `/cooking/ask` tool-free. Document this as a boundary condition.
2. If tools are added later, switch from `.on('text', ...)` to iterating raw events and filtering for `content_block_delta` + `text_delta` explicitly.
3. Add a server-side assertion: Claude response must have exactly one text content block. If not, return the error event and log a telemetry `ask_malformed` entry.

**Warning signs:** Concatenated response has garbled JSON or prefix/suffix tool syntax.

### Pitfall 3: iOS audio session conflict — TTS plays through earpiece, not speaker

**What goes wrong:** TTS output is quiet / "phone call volume" instead of full speaker volume. User thinks voice feature is broken.

**Why:** iOS's default audio session when the microphone is active (STT listening) is `playAndRecord` routed to the receiver (earpiece). When TTS plays, it inherits that routing.

**How to avoid:**
1. For Phase 16, accept current behavior (Phase 9 DEVICE-TEST pass). Speaker volume is fine when STT is NOT active.
2. If users report quiet TTS: set `AVAudioSession` category to `playAndRecord` with `.defaultToSpeaker` option. Requires `expo-audio` or a native module shim. OUT OF SCOPE for this phase unless telemetry + dogfooding shows it's a blocker.
3. Document in DEVICE-TEST.md: "Verify TTS is loud at counter distance. If quiet, escalate."

**Warning signs:** "I can't hear the steps" reports, especially when STT listening is on.

### Pitfall 4: Scroll-to-current fights user scroll

**What goes wrong:** User scrolls to inspect a later step, then says "next". Scroll jumps mid-gesture, disorienting the user.

**Why:** The `scrollTo` effect fires on every `currentStepIndex` change unconditionally.

**How to avoid:**
1. Always scroll on step change — this is the expected Claude.ai-artifact behavior.
2. If UAT reveals this is jarring, gate the auto-scroll on `isScrolling` state: track `onScrollBeginDrag` / `onScrollEndDrag`, pause auto-scroll for 3s after user interaction.
3. Use `animated: true` so the jump isn't instant — user's eye tracks the motion.

**Warning signs:** User complains about "losing my place" when voice-advancing.

### Pitfall 5: Persisted dark-mode from AsyncStorage doesn't apply on first render

**What goes wrong:** Cook screen flashes light → dark on mount because persist-middleware rehydrates async.

**Why:** Zustand persist middleware hydrates from AsyncStorage in a microtask after module init. Initial render uses `initialState.darkMode = false`.

**How to avoid:**
1. Use `persist`'s `onRehydrateStorage` callback to flag hydration complete and gate the cook screen render on it. OR:
2. Accept a ~50ms flash — cooking mode is a full-screen push animation; the transition masks the flash.
3. Alternative: Use `partialize` + `skipHydration: false` and read `useCookingStore.persist.hasHydrated()` before first render — block on it with a short-lived loading state.

**Warning signs:** Tester reports "screen flashes white then goes dark" when entering cooking mode with dark-mode on.

### Pitfall 6: Telemetry queue memory bloat on long cooking sessions

**What goes wrong:** User cooks for 2 hours without network. Queue grows to hundreds of events, uses megabytes of memory.

**Why:** Best-effort-drop-on-failure still re-queues events on network failure. Without a cap, offline grows unbounded.

**How to avoid:**
1. Cap the queue at 200 events. Once exceeded, drop the OLDEST events (they're stale anyway).
2. Log a meta-event `telemetry_dropped` so aggregate view knows some data was lost.
3. Flush on `cookingStore.exit()` as the final backstop.

**Warning signs:** Memory profile shows cooking-mode RAM climbing over time.

### Pitfall 7: Haptics firing on silent mode but feeling broken when phone is face-down

**What goes wrong:** `Haptics.impactAsync()` is called while the phone is face-down on a counter. The Taptic Engine still fires but user doesn't feel it.

**Why:** Haptics are physical. Phone-on-counter attenuates them heavily.

**How to avoid:**
1. This is expected behavior. Document it. Toast + TTS are the redundant confirmation channels.
2. Don't disable haptics — they're reliable when phone is picked up or in pocket.

**Warning signs:** User says "I don't know if it heard me." Toast + waveform should address that.

### Pitfall 8: Pre-1.0 speech-recognition API drift

**What goes wrong:** `@jamsch/expo-speech-recognition@0.2.15` publishes a 0.3.0 with breaking changes mid-phase. All voice tests break.

**Why:** Pre-1.0 semver. Phase 9 flagged this explicitly.

**How to avoid:**
1. Keep the 0.2.15 exact pin. Never run `npm update` on it.
2. `useVoiceListener.ts` remains the single abstraction point. Any upgrade is a one-file patch.
3. Before upgrading: read the changelog, run full vitest suite + DEVICE-TEST.md.

**Warning signs:** Lockfile has `0.3.x` in it.

### Pitfall 9: expo-haptics not impact-feedback-available on older simulators

**What goes wrong:** Simulator reports "no haptic engine". `Haptics.impactAsync()` errors silently or throws.

**Why:** Simulator has no physical haptic engine. Docs say no-op on unsupported platforms but real-device path is needed for validation.

**How to avoid:**
1. On simulator: `impactAsync` is a no-op (documented). UAT passes without haptics working.
2. Device test (DEVICE-TEST.md) must explicitly verify haptics fire on a real iPhone — this is a hard requirement for COOK-UX-05.

**Warning signs:** User reports "no vibration on my iPhone" — distinct from simulator no-op behavior.

### Pitfall 10: Retokening TimerBar breaks existing timer color contract

**What goes wrong:** Changing `#C2410C` to `colors.brandPressed` (`#A7492C`) shifts the timer chip color. Screenshots or any visual regression test may diff.

**Why:** `#C2410C` was the Phase 9 orange-era literal. `brandPressed` is the Phase 19 terracotta-pressed analog. Close but not identical.

**How to avoid:**
1. Document the intentional color shift in the TimerBar retoken commit.
2. Update Maestro screenshots if used for visual regression.
3. The new color is the correct Phase 19 token — don't try to match the old color.

**Warning signs:** CI visual-diff alerts or user reports "timer looks different." Expected; intentional.

## Code Examples

Verified patterns from official sources + repo precedent:

### Hono streamSSE (source: [hono.dev/docs/helpers/streaming](https://hono.dev/docs/helpers/streaming))

```typescript
import { streamSSE } from 'hono/streaming';

app.post('/ask-stream', async (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({ event: 'delta', data: 'First chunk' });
    await stream.writeSSE({ event: 'delta', data: 'Second chunk' });
    await stream.writeSSE({ event: 'done', data: 'Full answer' });
  }, async (err, stream) => {
    await stream.writeSSE({ event: 'error', data: err.message });
  });
});
```

### Anthropic streaming with `.on('text', ...)` (source: [platform.claude.com/docs/en/api/messages-streaming](https://platform.claude.com/docs/en/api/messages-streaming))

```typescript
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic();

await client.messages
  .stream({
    model: 'claude-sonnet-4-latest',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }],
  })
  .on('text', (text) => {
    // text is a string delta — pipe directly to SSE or TTS
  });
```

### expo-haptics usage (source: [docs.expo.dev/versions/latest/sdk/haptics](https://docs.expo.dev/versions/latest/sdk/haptics/))

```typescript
import * as Haptics from 'expo-haptics';

// Command recognized
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

// Ingredient checked
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Timer at T-10s warning
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Timer expired
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Exit confirm destructive
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
```

### Zustand persist with partialize (source: repo — `progressionStore.ts`)

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useCookingStore = create<CookingState & CookingActions>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: 'cooking-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ darkMode: s.darkMode }),  // only darkMode survives across sessions
    },
  ),
);
```

### Reanimated amplitude loop (source: react-native-reanimated 4.x docs)

```typescript
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

const phase = useSharedValue(0);
useEffect(() => {
  phase.value = listening
    ? withRepeat(withTiming(1, { duration: 600 }), -1, /* reverse */ true)
    : 0;
}, [listening, phase]);

const barStyle = useAnimatedStyle(() => ({
  height: 4 + 16 * Math.abs(Math.sin(phase.value * Math.PI * 2)),
}));

return <Animated.View className="w-1 bg-brand rounded-full" style={barStyle} />;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 9 single-step `StepDisplay` | Claude.ai-artifact scrollable recipe (`ScrollableRecipe` + `StepCard`) | Phase 16 | Step-in-context, ingredients visible, scroll-on-advance |
| Phase 9 `VoiceStatusBadge` static pill | `VoiceWaveform` animated indicator | Phase 16 | Listening-vs-idle-vs-off is now unambiguous visually |
| Phase 9 silent-command feedback (only TTS/haptic-none) | Toast + Medium haptic + optional TTS | Phase 16 | Works on silent mode; no TTS-echo cascade |
| `/cooking/ask` non-streaming JSON | SSE streaming with incremental TTS | Phase 16 | p95 TTS-first-word < 1.5s (was ~2-3s) |
| Phase 9 hardcoded orange (`#C2410C`, `bg-amber-*`, `text-warmGray-*`) | Phase 19 semantic tokens (`colors.brandPressed`, `bg-warning/10`, `text-text-*`) | Phase 16 | Cooking mode visually coherent with rest of app |
| Phase 19's Semibold 600 in cooking | 2-weight collapse to 400 + 700 only | Phase 16 (scoped) | Stays within Dimension 4 typography cap |
| No cooking telemetry | `cooking_events` table + batched client logger | Phase 16 | Data-driven decision surface for Whisper fallback |

**Deprecated/outdated (do not use in cooking mode):**
- `StepDisplay.tsx` — delete after Phase 16 migration
- `VoiceStatusBadge.tsx` — delete after Phase 16 migration
- Generic `useToast` in cook.tsx — replaced by `CommandToast`
- Hardcoded `bg-warmWhite`, `bg-amber-*`, `#C2410C` anywhere in cooking/*.tsx

## Open Questions

1. **Does `@jamsch/expo-speech-recognition@0.2.15` expose an amplitude or volume-change event for the waveform animation?**
   - What we know: The `useSpeechRecognitionEvent('result', ...)` fires only on final/interim text. Pre-1.0 API docs do not guarantee amplitude events.
   - What's unclear: Some iOS SFSpeechRecognizer wrappers expose `averagePower` via a separate AVAudioRecorder tap. Whether 0.2.15 exposes one is undocumented.
   - Recommendation: **Cosmetic waveform loop for Wave 2**. If amplitude event exists (verify during Wave 0), upgrade to amplitude-driven in a later wave. Don't block on it. The cosmetic animation satisfies COOK-UX-05 visual confirmation.

2. **Is RN 0.83 fetch fully compatible with SSE ReadableStream reading?**
   - What we know: Expo SDK 55 bumped RN fetch to support streaming bodies on iOS. Android is less certain (out of scope — iOS-first).
   - What's unclear: Edge cases (network drop mid-stream, AbortController behavior).
   - Recommendation: **Wave 0 smoke test.** Write a 10-line spike against the `/cooking/ask-stream` endpoint before building the full `streamingAsk.ts`. If it fails, fall back to XMLHttpRequest-based streaming or keep the existing non-streaming `/ask` + accept higher p95.

3. **What's the actual p95 baseline for `/cooking/ask` without streaming?**
   - What we know: Phase 9 DEVICE-TEST approved the existing endpoint, but no p50/p95 measurement was collected.
   - What's unclear: Is current latency 1.8s? 3s? 5s?
   - Recommendation: **Measure in Wave 1.** Telemetry instrumentation collects baseline before the SSE migration ships, so we can prove COOK-UX-01 with data.

4. **Is a dedicated `CommandToast` needed or can we extend `useToast`?**
   - What we know: UI-SPEC requires 1.5s auto-dismiss (current `useToast` = 2s), Phase-19 tokens (current uses `bg-green-500` / `bg-red-500` literals), `accessibilityLiveRegion="polite"`, and left-edge brand accent strip.
   - What's unclear: Whether parameterizing `useToast` with variant + duration is simpler than a parallel component.
   - Recommendation: **Parallel `CommandToast`.** 40 lines of new code is simpler than retrofitting every existing `useToast` call site with new variant props. Document as a known duplication; unify in a later refactor if it turns out both components converge.

5. **Where exactly in the AskSheet does the streamed answer render?**
   - What we know: AskSheet currently shows a loading spinner until the full answer arrives.
   - What's unclear: Whether the SSE approach should show the partial answer building up in real time or wait for sentence boundaries.
   - Recommendation: **Stream the full raw text to the visible Text component** (user sees words appear) while the TTS chunker only speaks at sentence boundaries. Visual + audio diverge by intent: visual is live (typing feel), audio is coherent (no choppy playback).

6. **Does Maestro flow `15-cook-voice-mode-stub.yaml` need to be updated?**
   - What we know: Current flow is a documentation stub that never runs — voice features aren't Maestro-testable without audio injection.
   - What's unclear: Whether a non-voice UAT (scroll, ingredient check, step nav via tap, dark-mode toggle) could run in the simulator.
   - Recommendation: **Add a new `28-cooking-mode-ui.yaml`** that tests non-voice UI: tap "Start Cooking", verify ScrollableRecipe renders, tap ingredient to check, tap Next nav button, verify current-step highlight shifts, tap Exit. Keep `15-cook-voice-mode-stub.yaml` as the documented voice-requires-device stub.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (mobile: `apps/mobile/vitest.config.ts`, env=node; server: `packages/server/vitest.config.ts`) + Maestro 2.4.0 for UAT |
| Config file | `apps/mobile/vitest.config.ts`, `apps/mobile/vitest.setup.ts` (global expo-speech / expo-keep-awake / @jamsch mocks already present), `packages/server/vitest.config.ts` |
| Quick run command | `cd apps/mobile && npm test -- cooking` or `cd packages/server && npm test -- cooking` |
| Full suite command | `cd apps/mobile && npm test && cd ../../packages/server && npm test` |
| Maestro command | `cd apps/mobile && maestro test .maestro/28-cooking-mode-ui.yaml` (new flow) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COOK-UX-01 | `streamingAsk` fires TTS chunk on first sentence boundary (mocked SSE reader); intentRouter perf budget preserved (<50ms for 1000 iterations) | unit | `cd apps/mobile && npm test -- streamingAsk intentRouter.perf` | ❌ Wave 0 (streamingAsk new; perf test exists) |
| COOK-UX-01 | Server `/cooking/ask-stream` emits delta events then done (mocked Anthropic stream) | integration | `cd packages/server && npm test -- cooking` | ❌ Wave 0 — extend existing `cooking.test.ts` |
| COOK-UX-02 | `logCookingEvent` batches to 10, flushes on timer, drops on 5xx without infinite retry | unit | `cd apps/mobile && npm test -- telemetry` | ❌ Wave 0 |
| COOK-UX-02 | `/api/v1/telemetry/cooking` validates auth, inserts rows, returns 204 on empty batch | integration | `cd packages/server && npm test -- telemetry` | ❌ Wave 0 |
| COOK-UX-02 | `cooking_events` table migration applies cleanly + RLS policies enforce profile_id | integration (SQL) | `cd packages/server && npm test -- cookingEventsMigration` | ❌ Wave 0 — or via Supabase migration CI |
| COOK-UX-03 | `ScrollableRecipe` renders ingredient + step sections with Phase 19 token classes; `StepCard` flips styles on `isCurrent` prop | unit (pure-props rendering via vitest node env) | `cd apps/mobile && npm test -- ScrollableRecipe StepCard` | ❌ Wave 0 |
| COOK-UX-03 | `TimerBar` retokened: no `#C2410C` literal, uses `colors.brandPressed`, T-10s warn transition present | unit | `cd apps/mobile && npm test -- TimerBar` | ❌ Wave 0 (will rewrite existing TimerBar tests) |
| COOK-UX-03 | `cookingStore` `darkMode` persists across rehydrates (AsyncStorage mock); `ingredientChecks` clears on `enter()` | unit | `cd apps/mobile && npm test -- cookingStore` | ❌ Wave 0 — extend existing `cookingStore.test.ts` |
| COOK-UX-03 | Settings screen renders new Cooking section with dark-mode toggle; toggling calls `setDarkMode` | unit | `cd apps/mobile && npm test -- settings` | ❌ Wave 0 |
| COOK-UX-04 | `ScrollableRecipe` calls `scrollTo({y, animated:true})` on `currentStepIndex` change using captured onLayout y-coordinates | unit (mocked ScrollView ref) | `cd apps/mobile && npm test -- ScrollableRecipe` | ❌ Wave 0 |
| COOK-UX-04 | `StickyCookingHeader` shows timer band only when `timers.length > 0` and `StopTTSButton` only when `ttsSpeaking` | unit | `cd apps/mobile && npm test -- StickyCookingHeader` | ❌ Wave 0 |
| COOK-UX-05 | `handleTranscript` calls `onCommandToast` + `onCommandHaptic` on recognized intents (next/back/repeat/timer); neither fires for `ask` intent | unit | `cd apps/mobile && npm test -- handleTranscript` | ❌ Wave 0 — extend existing |
| COOK-UX-05 | `CommandToast` renders with `accessibilityLiveRegion="polite"` and auto-dismisses after 1.5s | unit | `cd apps/mobile && npm test -- CommandToast` | ❌ Wave 0 |
| COOK-UX-05 | `VoiceWaveform` renders waveform when listening, pulse when idle-armed, gray mic-slash when disabled | unit | `cd apps/mobile && npm test -- VoiceWaveform` | ❌ Wave 0 |
| COOK-UX-03,04 | Maestro UI flow: tap Start Cooking → ScrollableRecipe renders → tap ingredient → tap Next → current-step visual highlight shifts → tap Exit | UAT (simulator) | `cd apps/mobile && maestro test .maestro/28-cooking-mode-ui.yaml` | ❌ Wave 0 (new flow file) |
| COOK-UX-01,02,05 | Physical-device voice UAT: on-device STT latency, haptics fire, toast appears per voice command, telemetry reaches backend | manual-only | DEVICE-TEST-16.md checklist on a real iPhone | ❌ Wave 0 — new checklist file |

**Manual-only justification for physical-device voice UAT:** On-device iOS speech recognition cannot be automated in Vitest or Maestro (audio injection isn't supported). Unit tests verify intent router, dispatch, and telemetry in isolation. Maestro covers non-voice UI flows. A final physical-device pass is the only way to verify real-world STT accuracy, haptic firing, and end-to-end telemetry.

### Sampling Rate

- **Per task commit:** `cd apps/mobile && npm test -- <touched files>` — targeted subset, <10s
- **Per wave merge:** Full mobile + server vitest suites — <90s total
- **Phase gate:** Full suites green + Maestro flow 28 green on simulator + DEVICE-TEST-16.md executed on physical iPhone before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/mobile/src/cooking/__tests__/telemetry.test.ts` — covers COOK-UX-02
- [ ] `apps/mobile/src/cooking/__tests__/streamingAsk.test.ts` — covers COOK-UX-01 (mock fetch.body + TextDecoder)
- [ ] `apps/mobile/src/components/cooking/__tests__/ScrollableRecipe.test.ts` — covers COOK-UX-03/04
- [ ] `apps/mobile/src/components/cooking/__tests__/StepCard.test.ts`
- [ ] `apps/mobile/src/components/cooking/__tests__/IngredientRow.test.ts`
- [ ] `apps/mobile/src/components/cooking/__tests__/StickyCookingHeader.test.ts`
- [ ] `apps/mobile/src/components/cooking/__tests__/VoiceWaveform.test.ts`
- [ ] `apps/mobile/src/components/cooking/__tests__/CommandToast.test.ts`
- [ ] `apps/mobile/src/components/cooking/__tests__/StopTTSButton.test.ts`
- [ ] `apps/mobile/src/components/cooking/__tests__/TimerBar.test.ts` — retoken verification (no `#C2410C` literal, uses tokens)
- [ ] Extend `apps/mobile/src/stores/__tests__/cookingStore.test.ts` — ingredientChecks toggle/clear, darkMode persist + rehydrate, startSession
- [ ] Extend `apps/mobile/src/cooking/__tests__/handleTranscript.test.ts` — onCommandToast + onCommandHaptic fire per intent
- [ ] `packages/server/src/routes/__tests__/telemetry.test.ts` — covers COOK-UX-02 server side
- [ ] Extend `packages/server/src/routes/__tests__/cooking.test.ts` — SSE streaming happy path + error path
- [ ] `packages/server/migrations/NNN_cooking_telemetry.sql` — schema + RLS
- [ ] `apps/mobile/.maestro/28-cooking-mode-ui.yaml` — new UAT flow for non-voice UI
- [ ] `.planning/phases/16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display/DEVICE-TEST-16.md` — physical-device checklist (mirrors Phase 9 DEVICE-TEST.md structure)
- [ ] No framework install needed — Vitest 4.x, Maestro 2.4.0 already set up

## Project Constraints (from CLAUDE.md)

Relevant directives from `/Users/patrickrichards/DinnerTime/CLAUDE.md` that constrain Phase 16 planning:

**Forbidden / scoped:**
- **No Expo Go.** Voice features already require EAS dev client (Phase 9 policy preserved). No change.
- **No expo-av** — deprecated; use `expo-audio` if audio session work becomes necessary (not planned for Phase 16).
- **No hardcoded colors.** All cooking components must consume Phase 19 tokens via NativeWind classes or `colors` from `src/design/tokens.ts`. The current `TimerBar` `#C2410C` literal and the tip block `bg-amber-*` classes must go.
- **No Tailwind CSS web version** — NativeWind only. (Existing constraint; no cooking-specific change.)
- **No Ionicons in cooking mode** — SF Symbols via `SymbolIcon` only (Phase 15 convention; Phase 9 already complies).
- **No OpenAI / second AI provider.** Claude Sonnet 4 for streaming Q&A; no switch-to-another-vendor. (Covered by CONTEXT decision.)

**Required:**
- **GSD Workflow Enforcement.** Before any Edit/Write operation, work must flow through `/gsd:execute-phase` (or `/gsd:quick` for tiny fixes). No ad-hoc edits.
- **Maestro UAT before "complete".** Any UI feature must be validated with Maestro against the iOS Simulator. Phase 16 adds flow 28 per Wave 0 gaps.
- **iOS Simulator + physical iPhone testing.** Simulator covers UI; physical iPhone covers voice/haptics. Both are required for phase verification.
- **Metro with `--lan`**, not `--tunnel` (iOS simulator needs localhost routing).
- **Camera quality cap 0.4** — not applicable to Phase 16 (no scan-mode changes).
- **Atomic commits per task.** GSD commit pattern — plan-number-tagged commits, no "fix everything" monsters.
- **Node.js 22 LTS** on server; `pnpm` for workspace installs.
- **Environment variables in root `.env`**, not `packages/server/.env`. Phase 16 adds none.
- **Cloudflare tunnel for physical iPhone testing** of backend — if the dev uses the physical iPhone path for telemetry validation, the tunnel is required and `EXPO_PUBLIC_API_URL` must update.

**Design conventions the planner should honor:**
- `gestureEnabled: false` on immersive full-screen routes (Phase 9 pattern on `cook.tsx` — preserve).
- Exit button always has confirm alert; UI-SPEC locks the copy.
- `useKeepAwake()` hook (not imperative API) — Phase 9 decision preserved.
- Phase 15 `SymbolIcon` wrapper — no raw `SymbolView` in cooking components.

## Sources

### Primary (HIGH confidence)

- [Hono Streaming Helper docs](https://hono.dev/docs/helpers/streaming) — `streamSSE`, `streamText`, `stream` function signatures and minimal SSE example
- [Anthropic Messages Streaming docs](https://platform.claude.com/docs/en/api/messages-streaming) — TypeScript SDK `.stream().on('text', ...)` API + event types (content_block_delta, text_delta)
- [Expo Haptics SDK docs](https://docs.expo.dev/versions/latest/sdk/haptics/) — impactAsync, notificationAsync, selectionAsync; iOS Taptic Engine support
- [Expo Speech (TTS) docs](https://docs.expo.dev/versions/latest/sdk/speech/) — Speech.speak options, silent-mode caveat (referenced from Phase 9 research)
- [Expo KeepAwake docs](https://docs.expo.dev/versions/latest/sdk/keep-awake/) — useKeepAwake hook lifecycle
- [Expo Audio (SDK 55) docs](https://docs.expo.dev/versions/latest/sdk/audio/) — referenced for Pitfall 3 only; not used in Phase 16
- Repo verification:
  - `apps/mobile/src/design/tokens.ts` + `global.css` — Phase 19 tokens confirmed live
  - `apps/mobile/package.json` — expo-speech-recognition@0.2.15 pinned, SDK 55 deps confirmed
  - `packages/server/package.json` — Hono 4.7+ (4.12 deduped), @anthropic-ai/sdk 0.88+
  - `apps/mobile/vitest.setup.ts` — existing mocks for expo-speech, @jamsch, keep-awake, AsyncStorage, netinfo
  - `apps/mobile/src/cooking/useVoiceListener.ts` — single abstraction point for pre-1.0 library confirmed
  - `packages/server/src/routes/cooking.ts` — existing /ask endpoint baseline
  - `apps/mobile/src/stores/cookingStore.ts` — existing state shape confirmed
  - `.planning/phases/09-voice-cooking-mode/*.md` — Phase 9 research, summaries, DEVICE-TEST all loaded
  - `.planning/phases/15-ui-polish-and-navigation-consistency-audit/15-CONTEXT.md` — Phase 15 conventions loaded
  - `.planning/phases/19-design-professionalization.../19-CONTEXT.md` — Phase 19 tokens loaded
  - `CLAUDE.md` — project constraints loaded
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.90.0 latest (verified via `npm view` 2026-04-20)
- [hono npm](https://www.npmjs.com/package/hono) — v4.12.14 latest (verified)
- [expo-haptics npm](https://www.npmjs.com/package/expo-haptics) — v55.0.14 = current SDK 55 (verified via `npm view expo-haptics dist-tags`)
- [@jamsch/expo-speech-recognition npm](https://www.npmjs.com/package/@jamsch/expo-speech-recognition) — still v0.2.15 latest; no 0.3.x release (verified)

### Secondary (MEDIUM confidence)

- [react-native-reanimated 4.x worklets overview](https://docs.swmansion.com/react-native-reanimated/) — `useSharedValue` + `withRepeat` + `withTiming` semantics on UI thread
- [zustand persist middleware docs](https://zustand.docs.pmnd.rs/integrations/persisting-store-data) — `partialize`, `createJSONStorage`, `onRehydrateStorage` patterns
- Phase 10-05 `progressionStore.ts` — repo precedent for persist + partialize in cooking context

### Tertiary (LOW confidence — flagged for validation)

- **@jamsch/expo-speech-recognition amplitude/volume-change event** — speculated but not verified (Open Question #1). Cosmetic waveform is the safe fallback.
- **RN 0.83 + Hermes SSE streaming fetch compatibility** — widely reported to work on iOS but no canonical Expo-docs confirmation. Wave 0 smoke test confirms or falls back.
- **iOS Speech Recognition accuracy in noisy kitchens** — Phase 9 unresolved; telemetry pipeline is the answer, not prior-art research.

## Metadata

**Confidence breakdown:**
- User constraints: HIGH — CONTEXT + UI-SPEC are fully explicit and cross-referenced
- Standard stack: HIGH — every library is either already installed or a first-party Expo bundled module; npm view confirms versions
- Architecture: HIGH — all 7 patterns have direct repo precedent or first-party docs
- SSE streaming: MEDIUM-HIGH — Hono + Anthropic APIs are well-documented; one unknown is RN fetch-body streaming on this specific RN version (Open Question #2)
- Telemetry: HIGH — schema + RLS pattern mirrors existing `recipe_cooks`, `cooking_tips`, etc.
- Common pitfalls: MEDIUM-HIGH — most are verified; Pitfall 1 (RN SSE) and Pitfall 9 (haptics simulator) are empirical risks to verify in Wave 0
- Validation architecture: HIGH — test plan is granular, each test file has a clear owning component

**Research date:** 2026-04-20
**Valid until:** ~2026-05-20 (30 days — Expo SDK 55 is stable; Phase 19 tokens are locked; only re-verify if @jamsch/expo-speech-recognition ships 0.3.x or if Hono changes streamSSE API)
