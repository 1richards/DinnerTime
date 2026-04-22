# Phase 9: Voice Cooking Mode - Research

**Researched:** 2026-04-10
**Domain:** Hands-free cooking UI (STT + TTS + conversational AI) on Expo/React Native
**Confidence:** MEDIUM-HIGH (stack is verified; speech-recognition library is pre-1.0)

## Summary

Phase 9 delivers a hands-free cooking mode: a large-text, always-on step display that responds to voice commands (next/back/repeat/timer) and answers conversational cooking questions via Claude. The architecture is a classic STT → intent router → (local action | Claude API) → TTS pipeline, already endorsed by the project roadmap ("Voice cooking uses STT -> Claude API -> TTS pipeline").

The stack is mostly project-standard Expo SDK 55 components. Only one dependency is new and carries risk: `@jamsch/expo-speech-recognition` (pre-1.0, listed as a STATE.md blocker). The design MUST make voice optional — every voice action needs an equivalent visible tap control so the phase ships even if voice recognition is flaky. This also handles the "user is in a noisy kitchen" case gracefully.

**Primary recommendation:** Build the cooking-mode UI first as a touch-driven big-button step navigator with `expo-keep-awake` and `expo-speech` TTS. Layer `@jamsch/expo-speech-recognition` on top as a progressive enhancement with a clear fallback UI. Route transcripts through a deterministic local intent classifier first (regex on "next", "back", "repeat", "timer N minutes") to hit the <1s latency requirement (VOIC-07), and only fall through to Claude for free-form questions (VOIC-04).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOIC-01 | User can enter cooking mode for any recipe with step-by-step display | Standard Stack → expo-router route `app/recipes/[id]/cook.tsx`; Architecture Pattern 1 (CookingModeScreen) |
| VOIC-02 | User can navigate steps hands-free with voice ("next step," "go back," "repeat") | Pattern 3 (local intent router) + `@jamsch/expo-speech-recognition` continuous mode with `contextualStrings` hint |
| VOIC-03 | User can set timers with voice ("set a timer for 10 minutes") | Pattern 4 (timer parser regex + Zustand timers slice); no new library required |
| VOIC-04 | User can ask conversational questions while cooking (substitutions, techniques) | Pattern 5 (Claude passthrough with recipe context); backend `/cooking/ask` endpoint (Hono) |
| VOIC-05 | App reads recipe steps aloud via text-to-speech | `expo-speech` Speech.speak with onDone callback; auto-speak on step change |
| VOIC-06 | Screen stays awake during cooking mode with large readable text | `expo-keep-awake` useKeepAwake hook scoped to CookingModeScreen; NativeWind text-4xl+ sizing |
| VOIC-07 | Basic voice commands respond in under 1s | Local regex intent router bypasses Claude entirely for next/back/repeat/timer (Pattern 3) |
</phase_requirements>

## Standard Stack

### Core (already installed — verify versions in apps/mobile/package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-router | ~55.0.12 | New `cook.tsx` screen under `app/recipes/[id]/` | Project convention (Phase 6 nested routes) |
| zustand | ^5.0.12 | cookingStore (active recipe, step index, timers, transcript) | Project standard; mirrors mealPlanStore/shoppingStore patterns |
| nativewind | ^4.2.3 | Large-text cooking UI | Project standard |
| react-native-reanimated | 4.2.1 | Step transition animations | Bundled, already used |

### New Additions
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-speech | bundled with SDK 55 | TTS for step read-aloud (VOIC-05) | First-party Expo module, iOS system voices, simple API (`Speech.speak(text, opts)`) |
| expo-keep-awake | bundled with SDK 55 | Screen stays awake during cooking (VOIC-06) | First-party; `useKeepAwake()` hook scopes wake lock to component lifecycle |
| @jamsch/expo-speech-recognition | ~0.2.15 | On-device STT for voice commands (VOIC-02/03/04) | Only viable on-device STT for Expo in 2026. Pre-1.0 — treat as optional enhancement |

### Backend (packages/server)
| Technology | Purpose |
|------------|---------|
| Hono route `POST /api/v1/cooking/ask` | Conversational Q&A passthrough to Claude with recipe context (VOIC-04) |
| @anthropic-ai/sdk (Claude Sonnet 4) | Answer cooking questions with recipe + current step in system prompt |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @jamsch/expo-speech-recognition | Whisper API (server Haiku or OpenAI Whisper) | Server roundtrip = >1s latency, blows VOIC-07 budget; requires audio upload. Keep as fallback for VOIC-04 only if on-device quality is poor. |
| expo-speech (system TTS) | ElevenLabs / Claude-generated audio | Way more natural, but adds latency + cost + network dependency in a kitchen. System TTS is "good enough" and instant. |
| Claude for every command | Local regex intent classifier | Claude roundtrip adds 500ms-2s — cannot meet VOIC-07 for simple commands. Use Claude ONLY for VOIC-04 questions. |
| Bottom sheet overlay | Full-screen dedicated route | Cooking mode is immersive (keep-awake, huge text, voice). Must be a full route that locks orientation and hides tabs. |

**Installation:**
```bash
cd apps/mobile
npx expo install expo-speech expo-keep-awake
npm install @jamsch/expo-speech-recognition
# app.json plugin config required — see Pitfall 1
```

> ⚠️ `@jamsch/expo-speech-recognition` is a native module. Requires a new EAS dev client build after install. Not compatible with Expo Go (already project policy).

## Architecture Patterns

### Recommended File Structure
```
apps/mobile/
├── app/recipes/[id]/
│   └── cook.tsx                    # Full-screen cooking route (VOIC-01/06)
├── src/
│   ├── stores/
│   │   └── cookingStore.ts         # Zustand: recipe, stepIndex, timers, voiceState
│   ├── cooking/
│   │   ├── intentRouter.ts         # Local regex → action (VOIC-02/03/07)
│   │   ├── timerParser.ts          # "10 minutes" → { ms: 600000 }
│   │   ├── useVoiceListener.ts     # Thin wrapper over expo-speech-recognition
│   │   ├── useStepSpeaker.ts       # Thin wrapper over expo-speech
│   │   └── askAssistant.ts         # POST /api/v1/cooking/ask
│   └── components/cooking/
│       ├── StepDisplay.tsx         # Large-text step card
│       ├── StepNavButtons.tsx      # Tap fallback (prev/next/repeat)
│       ├── TimerBar.tsx            # Active timer display
│       ├── VoiceStatusBadge.tsx    # listening / muted / error
│       └── AskSheet.tsx            # Modal for assistant responses

packages/server/src/routes/
└── cooking.ts                      # POST /cooking/ask → Claude Sonnet 4
```

### Pattern 1: CookingModeScreen (VOIC-01, VOIC-06)
**What:** Dedicated full-screen route that auto-activates keep-awake on mount.
**When:** Entry from recipe detail via "Start Cooking" button.

```typescript
// apps/mobile/app/recipes/[id]/cook.tsx
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, Stack } from 'expo-router';

export default function CookingModeScreen() {
  useKeepAwake(); // scoped to this screen's lifecycle — auto-releases on unmount
  const { id } = useLocalSearchParams<{ id: string }>();
  // ... load recipe, initialize cookingStore

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      {/* big-text step UI, nav buttons, timer bar, voice badge */}
    </>
  );
}
```

### Pattern 2: TTS step speaker (VOIC-05)
```typescript
// useStepSpeaker.ts
import * as Speech from 'expo-speech';
import { useEffect } from 'react';

export function useStepSpeaker(text: string | undefined, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !text) return;
    Speech.speak(text, {
      language: 'en-US',
      rate: 0.95,           // slightly slower for cooking clarity
      pitch: 1.0,
      onError: (e) => console.warn('[tts]', e),
    });
    return () => { Speech.stop(); };   // interrupt on unmount or step change
  }, [text, enabled]);
}
```

### Pattern 3: Local intent router — THE critical latency pattern (VOIC-02, VOIC-07)
**What:** Deterministic regex classifier that runs on every final transcript BEFORE considering a Claude roundtrip.
**Why:** A Claude API call is 500-2000ms. A regex match is <5ms. VOIC-07 requires <1s end-to-end — the only way to hit it reliably is to not call the network for basic commands.

```typescript
// intentRouter.ts
export type CookingIntent =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'repeat' }
  | { type: 'timer'; ms: number }
  | { type: 'pause' }    // pause TTS
  | { type: 'resume' }
  | { type: 'ask'; question: string };  // fallthrough to Claude

const NEXT = /\b(next( step)?|continue|move on|go on)\b/i;
const BACK = /\b(back|previous|go back|last step)\b/i;
const REPEAT = /\b(repeat|again|say( that)? again|what('s| is) the step)\b/i;
const PAUSE = /\b(pause|stop|wait)\b/i;
const RESUME = /\b(resume|go|continue)\b/i;

export function routeIntent(transcript: string): CookingIntent {
  const t = transcript.trim().toLowerCase();
  const timer = parseTimerPhrase(t);
  if (timer) return { type: 'timer', ms: timer };
  if (NEXT.test(t)) return { type: 'next' };
  if (BACK.test(t)) return { type: 'back' };
  if (REPEAT.test(t)) return { type: 'repeat' };
  if (PAUSE.test(t)) return { type: 'pause' };
  if (RESUME.test(t)) return { type: 'resume' };
  return { type: 'ask', question: transcript };  // free-form → Claude
}
```

### Pattern 4: Timer phrase parser (VOIC-03)
```typescript
// timerParser.ts — handles "set a timer for 10 minutes", "timer 5 min", "2 and a half minutes"
const UNIT_MS: Record<string, number> = {
  second: 1000, seconds: 1000, sec: 1000, secs: 1000, s: 1000,
  minute: 60_000, minutes: 60_000, min: 60_000, mins: 60_000, m: 60_000,
  hour: 3_600_000, hours: 3_600_000, hr: 3_600_000, hrs: 3_600_000, h: 3_600_000,
};
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60, half: 0.5,
};

export function parseTimerPhrase(t: string): number | null {
  if (!/\btimer\b|\bremind\b|\bset\b.*\b(minute|second|hour|min|sec|hr)/i.test(t)) return null;
  const m = t.match(/(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|half)\s*(?:and a half\s*)?(second|seconds|sec|secs|minute|minutes|min|mins|hour|hours|hr|hrs)/i);
  if (!m) return null;
  const n = WORDS[m[1].toLowerCase()] ?? Number(m[1]);
  const unit = UNIT_MS[m[2].toLowerCase()];
  const half = /and a half/i.test(t) ? unit / 2 : 0;
  return n * unit + half;
}
```

### Pattern 5: Claude passthrough for Q&A (VOIC-04)
```typescript
// packages/server/src/routes/cooking.ts
import { Hono } from 'hono';
import Anthropic from '@anthropic-ai/sdk';

const cooking = new Hono();

cooking.post('/ask', async (c) => {
  const { question, recipe_id, current_step_index } = await c.req.json();
  // Load recipe from Supabase via req auth token (same pattern as shopping.ts)
  const recipe = await loadRecipe(recipe_id, c.get('userId'));

  const system = `You are helping someone cook "${recipe.title}". They are hands-free,
so answers MUST be short (1-3 sentences), conversational, and spoken aloud.
Never use markdown, bullet lists, or code. No preamble like "Great question!".
Current step (${current_step_index + 1}/${recipe.steps.length}): ${recipe.steps[current_step_index]}
Full ingredients: ${recipe.ingredients.map(i => i.name).join(', ')}`;

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-latest',
    max_tokens: 200,              // hard cap — spoken answers stay short
    system,
    messages: [{ role: 'user', content: question }],
  });
  return c.json({ answer: extractText(res) });
});
```

### Pattern 6: Voice listener lifecycle (VOIC-02)
```typescript
// useVoiceListener.ts
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent }
  from '@jamsch/expo-speech-recognition';

export function useVoiceListener(onIntent: (t: string) => void, enabled: boolean, hints: string[]) {
  useSpeechRecognitionEvent('result', (e) => {
    const r = e.results[0];
    if (!r?.isFinal) return;              // ignore interim to avoid mid-word matches
    onIntent(r.transcript);
  });
  useSpeechRecognitionEvent('error', (e) => console.warn('[stt]', e.error, e.message));
  useSpeechRecognitionEvent('end', () => {
    // Auto-restart for continuous cooking-mode listening (iOS stops after ~1 min silence)
    if (enabled) setTimeout(() => startListening(hints), 250);
  });

  // caller triggers via start/stop buttons + mount
}

async function startListening(contextualStrings: string[]) {
  const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!granted) return;
  ExpoSpeechRecognitionModule.start({
    lang: 'en-US',
    continuous: true,
    interimResults: false,
    iosTaskHint: 'confirmation',   // optimized for short commands
    contextualStrings,             // e.g. ['next step','repeat','timer', ingredient names]
  });
}
```

### Anti-Patterns to Avoid
- **Routing every transcript through Claude.** Kills VOIC-07 (<1s). Local regex first, Claude only for Pattern 3 `ask` intent.
- **Blocking step advancement on TTS completion.** User says "next" while TTS still speaking — always `Speech.stop()` then act.
- **Global keep-awake.** Use `useKeepAwake()` hook scoped to the cooking screen so sleep resumes automatically on exit.
- **Speaking interim results.** Intent router MUST only act on `result.isFinal === true` — interim "next time" would trigger "next" prematurely.
- **Modal overlay instead of route.** Prevents proper header hiding and makes back-navigation semantics fuzzy; use a full expo-router screen.
- **Voice-only commands with no tap fallback.** See Don't Hand-Roll below.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screen-awake management | `setKeepAwakeAsync` raw calls + manual cleanup | `useKeepAwake()` hook from expo-keep-awake | Hook auto-releases on unmount; handles React StrictMode double-effect |
| TTS queue management | Custom Queue + setTimeout chain | `Speech.speak(text, { onDone })` | expo-speech already handles sequential playback via onDone callback |
| STT continuous restart | Custom audio buffering loop | expo-speech-recognition `continuous: true` + `end` event auto-restart | iOS SFSpeechRecognizer has a ~1min cap; the library exposes the end event for restart |
| Wake word detection | Custom audio processing | N/A — use an explicit mic-toggle button | Wake-word is a huge rabbit hole; "tap to listen" or "always listening while in cook mode" are both acceptable |
| Natural language number parsing | Full number-words parser | Small map ("one"..."thirty") + digit regex | 95% of cooking timer phrases fit 1-60 minutes — don't build a full parser |
| Conversational context management | Custom dialogue state machine | Stateless Claude call with current step in system prompt | Each Q&A is independent; no need for multi-turn state in v1 |
| Recipe scaling for cooking mode | Re-implementing serving math | Reuse Phase 6 recipe scaling (`formatQuantity`, ingredients already pre-scaled) | Already shipped in recipe library; pass scaled recipe into cookingStore |

**Key insight:** Voice UX fails catastrophically when every piece is homemade. Lean on `expo-speech` + `expo-speech-recognition` + `expo-keep-awake` and spend effort on the *intent router* and *tap fallback* — those are load-bearing and domain-specific.

## Common Pitfalls

### Pitfall 1: Missing permission strings → silent failure on real devices
**What goes wrong:** App runs fine in simulator but STT never fires on a real iPhone. No error, just nothing.
**Why:** iOS requires `NSMicrophoneUsageDescription` AND `NSSpeechRecognitionUsageDescription` in Info.plist. The expo-speech-recognition config plugin injects them but only if configured in app.json.
**How to avoid:** Add to `apps/mobile/app.json`:
```json
"plugins": [
  ["@jamsch/expo-speech-recognition", {
    "microphonePermission": "DinnerTime uses the microphone for hands-free cooking.",
    "speechRecognitionPermission": "DinnerTime uses speech recognition to understand cooking commands."
  }]
]
```
Then rebuild EAS dev client. Also call `requestPermissionsAsync()` before `start()` every session.
**Warning signs:** STT works in simulator, fails silently on device. Always test on a physical iPhone before closing the phase.

### Pitfall 2: Interim transcripts triggering false commands
**What goes wrong:** User says "what's next after this" — mid-utterance interim result "next" fires a step advance.
**Why:** `interimResults: true` emits partial hypotheses; the recognizer has no sentence-boundary intelligence.
**How to avoid:** In `useVoiceListener`, check `result.isFinal === true` and only route final results. Use `interimResults: false` unless you need a live transcript overlay.
**Warning signs:** Steps jump unexpectedly during longer utterances.

### Pitfall 3: Silent-mode suppresses TTS on iOS
**What goes wrong:** TTS produces no sound because the user has silent mode on.
**Why:** expo-speech uses the iOS AVSpeechSynthesizer which respects silent mode.
**How to avoid:** Document it in the cooking-mode entry UX ("Turn off silent mode to hear steps aloud"). If critical, we can use `expo-audio` to set the audio session to `playAndRecord` with `mixWithOthers` + `duckOthers`, which bypasses the ringer switch — but that's out of scope for v1. Just warn the user.
**Warning signs:** Users report "no sound" on physical device.

### Pitfall 4: STT and TTS fighting each other
**What goes wrong:** Recognizer picks up its own TTS output and interprets it as a command, creating a loop.
**Why:** Microphone is hot while speaker is playing.
**How to avoid:** Either (a) pause STT during TTS: `Speech.speak(text, { onStart: pauseListening, onDone: resumeListening })`, or (b) accept that iOS echo cancellation on device speakers is decent and rely on `contextualStrings` + explicit wake phrase. Recommended: option (a) for MVP.
**Warning signs:** Step advances spuriously during step read-aloud.

### Pitfall 5: Keep-awake leaking across navigation
**What goes wrong:** User exits cooking mode, screen stays on forever, battery drains.
**Why:** Manual `activateKeepAwakeAsync()` without a matching `deactivate` on unmount / back.
**How to avoid:** Use the `useKeepAwake()` hook, which ties the wake lock to the component mount lifecycle. Don't use the imperative API unless you need conditional activation.
**Warning signs:** Phone never sleeps after closing the cooking screen.

### Pitfall 6: Claude responses too long for TTS
**What goes wrong:** User asks "what's a substitute for buttermilk" and gets a 4-paragraph answer that takes 45 seconds to speak.
**Why:** No prompt-level constraint on answer length.
**How to avoid:** `max_tokens: 200` in the Anthropic call AND an explicit system prompt rule ("answers MUST be 1-3 sentences, spoken conversationally, no markdown"). Also truncate to first 300 chars before TTS as a belt-and-suspenders check.
**Warning signs:** Assistant answers drone on; user can't interrupt.

### Pitfall 7: Pre-1.0 library version drift
**What goes wrong:** `@jamsch/expo-speech-recognition` releases a breaking change, breaks the cooking screen.
**Why:** Pre-1.0 semver allows minor-version breaking changes. STATE.md flags this explicitly.
**How to avoid:** Pin exact version (`"@jamsch/expo-speech-recognition": "0.2.15"` — no caret). Abstract all library calls behind `useVoiceListener` so an API change touches one file. Keep the UI fully functional without voice.
**Warning signs:** `npm install` without lockfile upgrades the package.

### Pitfall 8: Timer phrases that don't match ("a dozen minutes", "quarter hour")
**What goes wrong:** User phrasing doesn't match regex, timer silently fails.
**Why:** Natural language is infinite; regex is finite.
**How to avoid:** (a) Log every `timer` intent that fails to parse, (b) fall through to Claude with a constrained tool call `{tool: "set_timer", ms: number}` as a graceful degradation, (c) always confirm with TTS: "Timer set for 10 minutes" — so user hears failures.
**Warning signs:** User says "timer for a dozen" and nothing happens silently.

## Code Examples

### cookingStore shape
```typescript
// src/stores/cookingStore.ts
import { create } from 'zustand';
import type { Recipe } from '@/types/recipe';

type Timer = { id: string; label: string; endsAt: number; remainingMs: number };

interface CookingState {
  recipe: Recipe | null;
  stepIndex: number;
  voiceEnabled: boolean;
  ttsEnabled: boolean;
  listening: boolean;
  timers: Timer[];
  lastAssistantAnswer: string | null;

  enter: (recipe: Recipe) => void;
  exit: () => void;
  next: () => void;
  back: () => void;
  repeat: () => void;     // re-triggers TTS on current step (no index change)
  addTimer: (ms: number) => void;
  removeTimer: (id: string) => void;
  setListening: (v: boolean) => void;
  setAssistantAnswer: (s: string | null) => void;
}

export const useCookingStore = create<CookingState>((set, get) => ({
  recipe: null, stepIndex: 0, voiceEnabled: true, ttsEnabled: true,
  listening: false, timers: [], lastAssistantAnswer: null,

  enter: (recipe) => set({ recipe, stepIndex: 0 }),
  exit: () => set({ recipe: null, stepIndex: 0, timers: [], listening: false }),
  next: () => set((s) => ({
    stepIndex: Math.min(s.stepIndex + 1, (s.recipe?.steps.length ?? 1) - 1)
  })),
  back: () => set((s) => ({ stepIndex: Math.max(s.stepIndex - 1, 0) })),
  repeat: () => set((s) => ({ stepIndex: s.stepIndex })),  // triggers re-read via key
  addTimer: (ms) => set((s) => ({
    timers: [...s.timers, {
      id: crypto.randomUUID(), label: `${Math.round(ms/60000)} min`,
      endsAt: Date.now() + ms, remainingMs: ms,
    }],
  })),
  removeTimer: (id) => set((s) => ({ timers: s.timers.filter(t => t.id !== id) })),
  setListening: (v) => set({ listening: v }),
  setAssistantAnswer: (s) => set({ lastAssistantAnswer: s }),
}));
```

### Dispatch loop tying it together
```typescript
// apps/mobile/app/recipes/[id]/cook.tsx (excerpt)
const store = useCookingStore();
const { recipe, stepIndex, voiceEnabled, ttsEnabled, listening } = store;

const handleTranscript = useCallback(async (transcript: string) => {
  const intent = routeIntent(transcript);
  switch (intent.type) {
    case 'next':    Speech.stop(); store.next(); break;
    case 'back':    Speech.stop(); store.back(); break;
    case 'repeat':  Speech.stop(); store.repeat(); break;
    case 'timer':   store.addTimer(intent.ms);
                    Speech.speak(`Timer set for ${Math.round(intent.ms/60000)} minutes.`);
                    break;
    case 'pause':   Speech.stop(); break;
    case 'ask': {
      const answer = await askAssistant(recipe!.id, stepIndex, intent.question);
      store.setAssistantAnswer(answer);
      Speech.speak(answer);
      break;
    }
  }
}, [recipe, stepIndex]);

useStepSpeaker(recipe?.steps[stepIndex], ttsEnabled);
useVoiceListener(handleTranscript, voiceEnabled, [
  'next step', 'go back', 'repeat', 'timer',
  ...(recipe?.ingredients.map(i => i.name) ?? []),
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| expo-av for audio | expo-audio (bundled SDK 55) | SDK 52+ | Don't use expo-av; not needed here anyway |
| OpenAI Realtime API for voice | STT → LLM → TTS pipeline | Project decision (roadmap) | Simpler, single-provider (Claude), cheaper |
| Third-party `react-native-tts` | `expo-speech` | Expo added TTS years ago | First-party, bundled, simpler |
| React Navigation | expo-router | SDK 50+ | Project standard |
| Imperative `activateKeepAwake` | `useKeepAwake()` hook | expo-keep-awake 12+ | Auto-cleanup on unmount |

**Deprecated/outdated:**
- `expo-av` for audio — replaced by `expo-audio`. Not needed for this phase anyway.
- Expo Go for voice features — impossible; requires EAS dev client (already project policy).

## Open Questions

1. **Is on-device STT quality good enough in a noisy kitchen?**
   - What we know: iOS SFSpeechRecognizer with `iosTaskHint: confirmation` + contextualStrings performs well for short commands.
   - What's unclear: Real-world accuracy with background noise (sizzling, vent hood).
   - Recommendation: Wave 0 test — have a teammate run the feature while cooking actual food. If accuracy is <80%, add Whisper server-side fallback for `ask` intent only (not nav commands — that kills VOIC-07).

2. **Wake-word vs. always-listening UX?**
   - Options: (a) Always listening while in cook mode (simplest), (b) tap-to-talk button, (c) wake phrase "Hey Chef".
   - Recommendation: (a) always-listening when voice is enabled, with a visible mic toggle in the header. Wake-word detection is a rabbit hole and not needed.

3. **Should timers fire notifications or just in-app alerts?**
   - Options: Local notification via `expo-notifications` vs. foreground TTS + sound.
   - Recommendation: Foreground TTS + a sound effect for v1. Notifications add a permissions flow and backgrounding complexity out of scope for this phase. Document as possible follow-up.

4. **Do we pre-scale recipes on cook-mode entry?**
   - What we know: Phase 6 already supports serving scaling; current step content is a string that contains the original quantities.
   - Recommendation: Pass the Recipe in whatever scaled form the recipe detail screen already shows. No re-scaling in cook mode.

5. **Pre-1.0 library acceptance?**
   - STATE.md Blocker: "expo-speech-recognition is pre-1.0 -- may need Whisper fallback".
   - Recommendation: Ship with it, pin exact version, keep the touch fallback as first-class so the phase is not gated on voice quality.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (already configured in apps/mobile and packages/server) |
| Config file | `apps/mobile/vitest.config.ts`, `packages/server/vitest.config.ts` |
| Quick run command | `cd apps/mobile && npm test -- intentRouter timerParser` |
| Full suite command | `cd apps/mobile && npm test && cd ../../packages/server && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOIC-01 | Cooking screen mounts and displays step 0 | unit (component) | `cd apps/mobile && npm test -- cook.test.tsx` | ❌ Wave 0 |
| VOIC-02 | Intent router maps "next"/"back"/"repeat" variants to actions | unit | `cd apps/mobile && npm test -- intentRouter.test.ts` | ❌ Wave 0 |
| VOIC-03 | Timer parser extracts ms from natural phrases | unit | `cd apps/mobile && npm test -- timerParser.test.ts` | ❌ Wave 0 |
| VOIC-04 | `/cooking/ask` returns short answer with recipe context (Claude mocked) | integration | `cd packages/server && npm test -- cooking.test.ts` | ❌ Wave 0 |
| VOIC-05 | useStepSpeaker calls Speech.speak on step change (mocked) | unit | `cd apps/mobile && npm test -- useStepSpeaker.test.ts` | ❌ Wave 0 |
| VOIC-06 | Cooking screen invokes useKeepAwake on mount (mocked module) | unit | `cd apps/mobile && npm test -- cook.test.tsx` | ❌ Wave 0 |
| VOIC-07 | intentRouter next/back/repeat/timer complete in <50ms for 1000 iterations | unit (perf sanity) | `cd apps/mobile && npm test -- intentRouter.perf.test.ts` | ❌ Wave 0 |
| VOIC-02/07 | End-to-end voice command on physical iPhone (real microphone) | manual-only | Manual test script in Wave 6 | manual |

**Manual-only justification for VOIC-02/07 E2E:** On-device iOS speech recognition cannot be automated in Vitest. Unit tests verify the intent router and dispatch loop in isolation; a manual acceptance test on a real device covers the microphone integration.

### Sampling Rate
- **Per task commit:** `cd apps/mobile && npm test -- <changed file>`
- **Per wave merge:** Full mobile + server test suites
- **Phase gate:** Full suites green + manual device smoke test before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/mobile/src/cooking/__tests__/intentRouter.test.ts` — covers VOIC-02/07
- [ ] `apps/mobile/src/cooking/__tests__/timerParser.test.ts` — covers VOIC-03
- [ ] `apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts` — mocks expo-speech, covers VOIC-05
- [ ] `apps/mobile/app/recipes/[id]/__tests__/cook.test.tsx` — covers VOIC-01/06 (mocks expo-keep-awake + expo-speech-recognition)
- [ ] `packages/server/src/routes/__tests__/cooking.test.ts` — covers VOIC-04 with mocked @anthropic-ai/sdk (follow recipeDiscovery/shopping mock pattern)
- [ ] Module mocks for `expo-speech`, `expo-keep-awake`, `@jamsch/expo-speech-recognition` in `apps/mobile/vitest.setup.ts` (likely extending existing setup)
- [ ] Manual device test checklist file at `.planning/phases/09-voice-cooking-mode/DEVICE-TEST.md` — tracked in Wave 6

## Sources

### Primary (HIGH confidence)
- [Expo Speech (TTS) docs](https://docs.expo.dev/versions/latest/sdk/speech/) — Speech.speak options, iOS silent-mode caveat
- [Expo KeepAwake docs](https://docs.expo.dev/versions/latest/sdk/keep-awake/) — useKeepAwake hook lifecycle
- [@jamsch/expo-speech-recognition README](https://github.com/jamsch/expo-speech-recognition/blob/main/README.md) — SDK 55 support, contextualStrings, iosTaskHint, continuous mode, permissions plugin config
- [@jamsch/expo-speech-recognition npm](https://www.npmjs.com/package/@jamsch/expo-speech-recognition) — v0.2.15 pre-1.0 status
- Project STACK (CLAUDE.md) — project-endorsed Expo SDK 55 stack and voice library choice
- Project STATE.md — pre-1.0 blocker and voice-pipeline decision

### Secondary (MEDIUM confidence)
- [How to build keepAwake into your React Native app (LogRocket 2024)](https://blog.logrocket.com/build-keepawake-react-native-app/) — useEffect patterns
- [Text-to-Speech Conversion using React Native Expo (Medium)](https://medium.com/nerd-for-tech/text-to-speech-conversion-using-react-native-expo-android-ios-f68f3e3ac5d9) — options object shape
- [expo-speech-recognition issue #72](https://github.com/jamsch/expo-speech-recognition/issues/72) — interaction with audio modules

### Tertiary (LOW confidence — flagged for validation)
- Real-world on-device STT accuracy in a noisy kitchen — UNVERIFIED; must be confirmed via manual device test (Open Question #1).
- iOS `iosTaskHint: confirmation` latency characteristics — inferred from documentation, not empirically benchmarked.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all libraries are either already in the project or first-party Expo SDK 55 modules.
- Architecture: HIGH — STT→router→(local|Claude)→TTS pipeline is explicitly endorsed by the project roadmap.
- Pitfalls: MEDIUM-HIGH — permission/silent-mode/interim-result pitfalls verified from docs; STT/TTS echo loop is a well-known voice-UX issue but not empirically tested for this app.
- Speech recognition library: MEDIUM — pre-1.0, API verified but stability over the phase timeline is an accepted risk with the fallback UI mitigation.

**Research date:** 2026-04-10
**Valid until:** ~2026-05-10 (30 days — Expo SDK is stable; re-verify if @jamsch/expo-speech-recognition publishes a 0.3.x release before phase start)
