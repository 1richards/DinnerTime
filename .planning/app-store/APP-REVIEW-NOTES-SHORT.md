# App Review Notes (short version)

**Paste this into App Store Connect → App Version → App Review Information → Notes.** Character limit is 4000; this draft is well under. The full reviewer walkthrough is attached as a PDF (`APP-REVIEW-NOTES.pdf`).

---

DinnerTime is an AI-powered meal-planning app. Users snap a photo of their fridge, the AI suggests dinner recipes from what's already there, and the user can plan the week + build a shopping list.

DEMO ACCOUNT
Email: uat@dinnertime.test
Password: UATovernight2026

This account is pre-seeded with ~15 pantry items, a partial weekly meal plan, and 4 saved recipes (1 favorited). On sign-in you'll land on the Kitchen tab with 3 dinner suggestion cards — that's the core promise of the app.

FAST PATH TO VERIFY (≈90 sec)
1. Sign in with the credentials above → land on Kitchen tab with 3 suggestion cards
2. Tap any card → preview sheet → tap Cook Now → recipe detail with steps + ingredients
3. Tab to Pantry (basket icon) → tap Scan FAB → camera permission prompt → take a photo (any object works for testing) → AI returns detected ingredients
4. Tab to Plan (calendar) → see week view with 2-3 planned dinners
5. Tab to Shopping (cart) → list with items → tap Share Shopping List → iOS share sheet appears

PERMISSIONS REQUESTED (only when triggered, never at launch)
- Camera + Photo Library: pantry scan, receipt scan, recipe photo import. Fallback if denied: manual entry of pantry items.
- Microphone + Speech Recognition: voice questions during cook mode. Fallback if denied: type the question.
- Face ID: opt-in re-auth on app foreground. OFF by default. Settings → Security → Enable Face ID.

ACCOUNT DELETION
Settings (gear icon) → Account → Delete Account → typed confirmation. Backend audit-logs and cascades the deletion across all user data (30-day reversible retention, then purge).

THIRD-PARTY SERVICES
- Supabase (auth + DB, hosted)
- Anthropic Claude (AI vision + reasoning)
- Google Gemini (recipe imagery generation)
- Apple Sign-In (optional sign-in path)
- Sentry (PII-scrubbed crash telemetry)

All AI calls go through our backend (https://dinnertime-api.fly.dev). The mobile binary contains zero third-party API keys.

NO IN-APP PURCHASES in v1.0. Fully free.

ENCRYPTION: ITSAppUsesNonExemptEncryption=false declared. Only standard iOS HTTPS/Keychain + an AES-CTR local cache for the Supabase session blob (App Store Connect Standards 5 exemption).

CONTACT FOR REVIEW QUESTIONS
Email: patrickrrichards@gmail.com
Response: same business day (typically within 4 hours)

If anything doesn't match the expected outcome above, please reach out and we'll respond promptly with either a fix in a re-uploaded build or written clarification.
