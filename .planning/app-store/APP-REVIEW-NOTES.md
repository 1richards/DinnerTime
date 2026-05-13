# App Review Notes — DinnerTime v1.0

**Audience:** Apple App Review team.
**Purpose:** Everything the reviewer needs to verify the app on the first attempt without back-and-forth.
**Last updated:** 2026-05-12 (build #13).

> **For the reviewer:** thank you for taking the time to evaluate DinnerTime. This document is structured so you can verify the app end-to-end in ~10 minutes using the demo account below. If anything is unclear or you can't get past a step, please reach out to the contact at the bottom of this document and we'll respond within the same business day.

---

## 1. What DinnerTime does (60-second overview)

DinnerTime is an AI-powered iOS meal-planning app for households. Users:

1. **Snap a photo of their fridge or pantry.** The AI identifies the ingredients and recommends 3 dinner ideas that match what's available *and* the user's stated dietary preferences, household size, and cooking skill.
2. **Plan the week** — tap a suggestion to pin it to a calendar day. The week view surfaces protein rotation, cuisine variety, and repeated meals.
3. **Cook with guidance** — recipe detail view includes step-by-step instructions, scalable serving sizes, built-in timers, and the ability to ask follow-up questions about technique.
4. **Build a shopping list** — missing ingredients can be exported via the iOS share sheet to Notes, Reminders, or any other app the user prefers.

All AI processing runs through our backend proxy, which calls Anthropic Claude for vision and reasoning and Google Gemini for recipe image generation. No API keys ship with the mobile binary.

---

## 2. Demo account credentials

**Email:** `uat@dinnertime.test`
**Password:** `UATovernight2026`

This account is pre-seeded with:
- ~15 pantry items (produce, protein, pantry staples)
- A meal plan for the current week with 2-3 planned dinners
- 4 saved recipes in the recipe library, including 1 favorited
- An empty shopping list (auto-populates when a meal is planned that needs ingredients)
- Completed onboarding — you will land directly on the **Kitchen** tab on sign-in.

**Note:** This account is a shared test account. If state appears different from this document (extra/missing pantry items, etc.), it's because another reviewer's session left modifications. The core flows still work in any state — the document below tells you what to expect for each.

If the demo account fails for any reason, you can also use **Sign in with Apple** to create a fresh account; the onboarding wizard (3 short steps) will set up a sensible default state.

---

## 3. Five-minute reviewer walkthrough

This is the fastest path to verify the four core promises of the app. Each numbered step should produce the described outcome within seconds.

### Step 1: Sign in (≈10 sec)
- Launch the app → tap **Sign In** on the auth landing screen
- Enter `uat@dinnertime.test` / `UATovernight2026` → **Sign In**
- **Expected:** you land on the **Kitchen** tab with a "Hey, Jessi!" greeting and 3 dinner suggestion cards titled under "Cook Tonight" or "Something New". Cards show a cuisine badge, time-to-cook, and pantry-match count.

### Step 2: Open a suggestion (≈10 sec)
- Tap any of the suggestion cards
- **Expected:** a preview sheet slides up showing the dish title, hero image, ingredients used vs. needed, estimated time, and four action icons (Save / Save+Favorite / Remix / Cook Now).
- Tap **Cook Now** → full recipe detail screen opens with steps, ingredients with scalable servings, and a Cook button.

### Step 3: Test the camera flow (≈30 sec) — *requires camera permission*
- Tab to **Pantry** (basket icon, second tab)
- Tap the **Scan** floating action button (camera icon in the bottom right)
- **Expected:** iOS camera permission prompt appears. **Allow.** Camera viewfinder opens.
- Tap the shutter button → AI analyzes the photo → review screen lists detected ingredients with quantities.
- **No need to actually be in front of a real fridge** — pointing at any object will return a (possibly weird) AI guess, which is fine for verifying the flow. To avoid the AI processing cost and simulator-only photo issue, you can also tap **Cancel** at the camera prompt; the app handles permission-denied gracefully.

### Step 4: View the plan (≈10 sec)
- Tab to **Plan** (calendar icon)
- **Expected:** week view with the current week visible, 2-3 days populated with planned dinners (cards showing dish name + cuisine + time). Tap any day to see details or swap the meal.

### Step 5: View the shopping list + share (≈15 sec)
- Tab to **Shopping** (cart icon)
- **Expected:** categorized shopping list, or an empty state with "Plan a meal to start your shopping list."
- If populated, tap **Share Shopping List** → iOS share sheet appears with formatted text suitable for pasting into Notes or sending via Messages.

### Step 6: Sign out (≈10 sec)
- Tab to **Settings** (gear icon)
- Scroll to **Account** → tap **Sign Out** → back to the auth landing.

**Total elapsed: ~85 seconds.** All four core flows (kitchen suggestions, camera scan, weekly plan, shopping list) verified.

---

## 4. Permission justifications

DinnerTime requests the following iOS permissions. Each has a custom usage-description string in `Info.plist` and is requested only at the moment it's needed, never at app launch.

| Permission | When triggered | Usage-description string | Functionality if denied |
|---|---|---|---|
| **Camera** | First tap of the pantry-scan or receipt-scan or recipe-photo-import buttons | Default Expo string (see Risk 1 below) | All scan flows offer a fallback: the user can import from Photo Library or skip and add pantry items manually |
| **Photo Library** | Same triggers as Camera if the user picks "Photo Library" instead of "Take Photo" | Default Expo string (see Risk 1 below) | Same fallback — manual entry |
| **Microphone** | Cook mode "Ask a question" feature (user holds the mic button to speak) | "DinnerTime uses the microphone for hands-free cooking." | Voice features unavailable; all UI is fully usable via touch |
| **Speech Recognition** | Same as Microphone (transcribes voice into a question for the AI) | "DinnerTime uses speech recognition to understand cooking commands." | Same fallback — users can type questions |
| **Face ID** | After initial Settings → Security → Enable Face ID toggle (opt-in, OFF by default) | "DinnerTime uses Face ID to unlock your recipes and plan without re-entering your password." | Feature is opt-in and entirely optional |

We do not request: location, contacts, calendar, notifications (v1.0), motion data, HealthKit, or any other permission.

---

## 5. Third-party services and data flow

| Service | Purpose | What we send | What stays on device |
|---|---|---|---|
| **Supabase** (backend) | Authentication (email/password, Apple Sign-In), database, file storage | Email, user ID, recipe content, pantry items, meal plans, shopping lists | Supabase auth tokens (encrypted in iOS Keychain) |
| **Anthropic Claude** | Vision (pantry scan), recipe reasoning, cooking Q&A | Pantry photo (transient, never stored), text-based recipe queries | All AI keys live server-side; mobile binary contains zero AI credentials |
| **Google Gemini** | Recipe imagery generation (when a saved recipe has no source image) | Recipe title + ingredient list | Same — all keys server-side |
| **Apple Sign-In** | Optional sign-in path | Apple-issued ID token only — name/email are anonymized through Apple's relay if the user opts to hide their email | Apple's standard private-email relay handling |
| **Sentry** | Crash and error telemetry, PII-scrubbed before send | Error stack traces with email/password/token fields stripped | User content (recipes, photos, plans) is never sent to Sentry |

All network calls from the iOS app go to our backend (`https://dinnertime-api.fly.dev`) over HTTPS. The backend then proxies to Anthropic / Google / Supabase using server-side credentials. The mobile binary contains no third-party API keys.

---

## 6. AI content safety

Generated content in DinnerTime is limited to recipe text and recipe imagery. The constraints:

- **Recipe text** is generated by Anthropic Claude with a system prompt that scopes output to "dinner recipes given these ingredients." Output is structured (title, ingredient list, step list) — not free-form text — which sharply limits the surface for inappropriate content.
- **Recipe images** are generated by Google Gemini with a prompt template that always includes the recipe title and produces only photo-realistic food imagery. Gemini's content safety filters block any policy-violating prompt before generation.
- **User-generated content moderation:** users can only enter text for recipe titles, descriptions, and pantry item names. There is no public sharing, no commenting, no DMs, and no other UGC surface. All user-entered text is private to the user's account.

DinnerTime is rated **4+** in App Store Connect.

---

## 7. Account deletion (GDPR / Apple guideline 5.1.1(v))

Users can delete their account from inside the app:

**Path:** Settings (gear icon, fifth tab) → Account → **Delete Account**

The flow:
1. User confirms intent on a dedicated screen with a typed confirmation
2. Optional free-text "why are you leaving?" field
3. Backend POST `/account/delete` audit-logs the request and schedules cascade deletion (auth user, profile, pantry, recipes, meal plans, shopping lists, recipe favorites — all rows tied to the user)
4. 30-day retention window allows reversal by emailing support; after 30 days, all data is permanently purged
5. User is signed out and returned to the auth landing screen

This conforms to Apple's account-deletion requirement and Supabase's standard deletion cascade.

---

## 8. Encryption and export compliance

`ITSAppUsesNonExemptEncryption: false` is declared in `Info.plist`. DinnerTime uses only:
- Standard HTTPS/TLS for all network transport (uses iOS-provided implementation, exempt)
- Apple Keychain via `expo-secure-store` for auth token storage (uses iOS-provided implementation, exempt)
- AES-256 via `aes-js` for encrypting the Supabase session blob before writing it to AsyncStorage (cipher-mode-CTR; this is a standard library used purely for protecting a local cache and falls under the App Store Connect "Standards 5" exemption)

We have selected **"No"** in App Store Connect → App Information → Export Compliance.

---

## 9. In-app purchases / subscriptions

**None in v1.0.** DinnerTime is fully free for the entire feature set as listed in the App Store description. Future paid features (if any) will be released in a subsequent version with the appropriate StoreKit integrations and disclosure.

---

## 10. Known limitations / out of scope for v1.0

These are intentional v1.0 scope decisions, not bugs:

- **Single-user account.** Multi-user households (one shared kitchen, multiple sign-ins) are planned for v1.1.
- **No web app.** iOS-only for v1.0; no Sign in with Apple from a browser, no marketing site beyond the privacy and support URLs in App Information.
- **English only.** Localization is post-v1.0.
- **No push notifications.** v1.0 is fully session-based; users open the app when they want to plan a meal.
- **No offline AI.** Pantry scan, recipe suggestions, and cooking Q&A all require an internet connection. Saved recipes are viewable offline once cached.

---

## 11. Contact for review questions

**Reviewer support:** patrickrrichards@gmail.com
**Response SLA:** same business day (typically within 4 hours, PT business hours)

If you encounter:
- A crash that prevents you from reaching one of the verification steps in Section 3
- Demo-account credentials that aren't working
- Any flow that doesn't match the expected outcome described in this document

...please email with the device model, iOS version, and which step failed. We will respond promptly with either a fix in a re-uploaded build or written clarification.

---

## Appendix A — Build trace

| Field | Value |
|---|---|
| Bundle ID | `com.dinnertime.app` |
| Version | 1.0.0 |
| Build number | (latest TestFlight; see ASC for current — submitted via EAS Submit) |
| Minimum iOS | iOS 15+ (per Expo SDK 55 default) |
| Backend | `https://dinnertime-api.fly.dev` (Fly.io, sjc region) |
| Auth provider | Supabase (project `rsgxnyiltmagvwhyvakp`) + Apple Sign-In |
| AI providers | Anthropic Claude (primary), Google Gemini (imagery) |

## Appendix B — Privacy nutrition label answers

The data-collection answers for the App Privacy form in App Store Connect are pre-drafted in [`privacy-manifest.json`](./privacy-manifest.json) — that file mirrors what is selected in ASC. Summary:

- **Data linked to user:** email, user ID, photos, user-entered content (recipes/pantry items), product interaction
- **Data not linked to user:** none
- **Data used for tracking:** none
- **Purposes:** App Functionality (everything except diagnostics); Analytics (diagnostics + product interaction)
