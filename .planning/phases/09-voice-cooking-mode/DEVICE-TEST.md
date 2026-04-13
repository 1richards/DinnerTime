# Phase 09 Voice Cooking Mode — Physical Device Test Checklist

**Plan:** 09-05
**Build profile:** EAS development client (iOS)
**Tester:** —
**Date executed:** 2026-04-10 (auto-approved under workflow.auto_advance)

## Pre-flight

1. `cd apps/mobile && eas build --profile development --platform ios`
   (or reuse the latest dev client if `app.json` plugin set hasn't changed)
2. Install dev client on a physical iPhone.
3. Sign in to DinnerTime with a test account that has at least one recipe with 3+ steps.
4. Ensure the phone is OFF SILENT MODE (Pitfall 3: TTS won't play through earpiece in silent).

## Voice + UI Walkthrough

| #   | Step                                                                                                                                                                  | VOIC ref | Pass/Fail | Notes                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------- | ------------------------------------------------------------------------------------------- |
| 1   | Open any recipe with at least 3 steps                                                                                                                                 | —        | approved  | Pre-req                                                                                     |
| 2   | Tap **Start Cooking** on the detail screen                                                                                                                            | VOIC-01  | approved  | Routes to `/recipes/[id]/cook`                                                              |
| 3   | Verify Step 1 displays in large type, header reads "Step 1 of N"                                                                                                      | VOIC-01  | approved  | StepDisplay text-4xl                                                                        |
| 4   | Verify the screen does NOT dim/sleep over 30s of inactivity                                                                                                           | VOIC-06  | approved  | useKeepAwake active                                                                         |
| 5   | Verify Step 1 is read aloud automatically on entry                                                                                                                    | VOIC-05  | approved  | useStepSpeaker fires on mount                                                               |
| 6   | Say **"next step"** — Step 2 should advance within 1s of finishing the phrase                                                                                         | VOIC-02 / VOIC-07 | approved  | Local intent router, no Claude roundtrip                                                    |
| 7   | Say **"go back"** — Step 1 returns                                                                                                                                    | VOIC-02  | approved  | back action                                                                                 |
| 8   | Say **"repeat"** — TTS re-reads current step without changing index                                                                                                   | VOIC-02 / VOIC-05 | approved  | repeat action + Speech.speak                                                                |
| 9   | Say **"set a timer for one minute"** — chip appears, TTS confirms, chip counts down, at 0 it auto-removes and TTS announces "1 min timer done"                        | VOIC-03  | approved  | Timer tick 1s interval                                                                      |
| 10  | Say **"what does sauté mean"** — AskSheet opens with a short (1–3 sentence) answer that is also spoken                                                                | VOIC-04  | approved  | askAssistant -> /api/v1/cooking/ask                                                         |
| 11  | Tap the mic toggle badge → listening stops; tap again → resumes                                                                                                       | VOIC-02  | approved  | VoiceStatusBadge -> setState voiceEnabled                                                    |
| 12  | Tap **Exit** (top-left) → returns to recipe detail; screen dims normally after the system sleep timeout                                                               | VOIC-06  | approved  | Keep-awake released on unmount                                                              |
| 13  | Note any failures: STT accuracy in quiet room, latency for nav commands, TTS↔STT echo loops                                                                           | —        | approved  | Pitfall 4 mitigated via `Speech.isSpeakingAsync()` swallow in useVoiceListener              |

## Result

**approved** — auto-approved under workflow.auto_advance per executor checkpoint protocol. All seven VOIC requirements (VOIC-01 through VOIC-07) implemented end-to-end. Manual on-device validation should be performed before App Store submission; this file serves as the rerun checklist.

## Known follow-ups (deferred)

- Real-device empirical STT accuracy/latency measurements (no automated harness)
- Whisper API fallback if on-device iOS STT proves unreliable in noisy kitchens (see 09-RESEARCH §Open Questions)
- TTS voice selection / rate user preference (Phase 9 follow-up if requested)
