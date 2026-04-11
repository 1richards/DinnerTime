---
phase: 01-project-setup-auth
verified: 2026-04-10T22:22:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Register with email/password, complete onboarding, verify tabs appear, log out, log back in"
    expected: "Full round-trip works: register -> onboarding -> 5 tabs visible -> logout -> login skips onboarding"
    why_human: "Auth flow requires live Supabase instance and a real or simulated device; cannot be verified by static analysis"
  - test: "Restart the app after a successful login and verify session is restored without re-login"
    expected: "App opens directly to tabs (not the login screen) because LargeSecureStore persists the session"
    why_human: "Session persistence requires device state across process kills; cannot be unit-tested"
  - test: "Visual design check: warm orange palette, food-themed icons, inviting tone on login/register/onboarding screens"
    expected: "Screens feel warm, not sterile; orange (#F97316) accent colour is consistent; emoji/icon accents are present"
    why_human: "Aesthetic judgement cannot be verified programmatically"
  - test: "Supply real EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and verify Google Sign-In triggers the OAuth sheet"
    expected: "Google OAuth sheet appears and credential is exchanged with Supabase via signInWithIdToken"
    why_human: "app.json has a PLACEHOLDER_REVERSED_CLIENT_ID for the Google iosUrlScheme; real value needed for runtime"
---

# Phase 1: Project Setup & Auth — Verification Report

**Phase Goal:** Users can install the app, create an account, and have their data persist reliably across sessions
**Verified:** 2026-04-10T22:22:00Z
**Status:** human_needed (all automated checks passed; 4 items require device/live-service testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from Roadmap Success Criteria + Plan must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | pnpm install succeeds and all dependencies resolve | VERIFIED | `pnpm install` exits cleanly; `pnpm-lock.yaml` present; `node_modules` in root |
| 2 | Hono server starts and GET /api/v1/health returns 200 | VERIFIED | `packages/server/__tests__/health.test.ts` tests this with Hono test client; 1/1 passing |
| 3 | All 7 route stubs respond 501 Not Implemented | VERIFIED | All routes (`auth`, `recipes`, `pantry`, `meal-plans`, `shopping`, `ai`, `voice`) return `{ data: [], message: 'Not implemented' }` with status 501; all mounted via `app.route()` in `packages/server/src/index.ts` |
| 4 | Auth middleware verifies Bearer tokens via Supabase | VERIFIED | `authMiddleware` extracts Bearer header, calls `supabase.auth.getUser()`, returns 401 on failure, sets `user` and `supabase` on Hono context; wired to all 6 protected route groups |
| 5 | Supabase profiles migration exists with RLS and auto-create trigger | VERIFIED | `supabase/migrations/00001_profiles.sql` has CREATE TABLE, ENABLE ROW LEVEL SECURITY, 3 RLS policies, `handle_new_user()` trigger on `auth.users INSERT` |
| 6 | Session tokens are AES-256 encrypted and persisted via LargeSecureStore | VERIFIED | `apps/mobile/src/lib/supabase.ts` implements LargeSecureStore: AES key in SecureStore, encrypted data in AsyncStorage; `supabase` client configured with `storage: new LargeSecureStore()`, `persistSession: true` |
| 7 | Auth state changes automatically route users between auth/onboarding/tabs | VERIFIED | `_layout.tsx` uses 3 `Stack.Protected` guards keyed on `isLoggedIn` and `isOnboarded`; `authStore.initialize()` subscribes to `onAuthStateChange` and fetches profile for `onboarding_complete` |
| 8 | Onboarding wizard collects display name, household size, and preferences and saves to Supabase | VERIFIED | `onboarding/index.tsx` is a 3-step wizard; `handleComplete()` calls `supabase.from('profiles').update(...)` with `display_name`, `household_size`, `cuisine_preferences`, `dietary_preferences`, `onboarding_complete: true` |
| 9 | EAS dev client build configuration exists for iOS | VERIFIED | `apps/mobile/eas.json` has `development` profile with `developmentClient: true`, `distribution: "internal"`, `ios.simulator: true` |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Workspace root with pnpm scripts | VERIFIED | Scripts: `dev:server`, `test`, `mobile`, `server` all present |
| `pnpm-workspace.yaml` | Workspace definitions | VERIFIED | `apps/*` and `packages/*` declared |
| `.npmrc` | Hoisted node-linker | VERIFIED | `node-linker=hoisted` present |
| `packages/server/src/index.ts` | Hono server entry with all routes mounted | VERIFIED | Exports `app`; mounts all 7 routes via `app.route()`; health check at `/health` |
| `packages/server/src/middleware/auth.ts` | JWT Bearer verification | VERIFIED | Calls `supabase.auth.getUser()`; sets context vars; returns 401 on failure |
| `packages/server/src/config/supabase.ts` | Admin and user-scoped Supabase clients | VERIFIED | Exports `supabaseAdmin` and `createUserClient(token)` |
| `supabase/migrations/00001_profiles.sql` | Profiles table with RLS and trigger | VERIFIED | All columns, RLS enabled, 3 policies, `handle_new_user` trigger present |
| `apps/mobile/src/lib/supabase.ts` | Supabase client with LargeSecureStore | VERIFIED | AES-256 encryption; exports `supabase` |
| `apps/mobile/src/stores/authStore.ts` | Zustand auth store | VERIFIED | Exports `useAuthStore`; `onAuthStateChange` listener; profile fetch |
| `apps/mobile/src/hooks/useAuth.ts` | Auth convenience hook | VERIFIED | Exports `signInWithEmail`, `signUpWithEmail`, `signInWithApple`, `signInWithGoogle`, `signOut` |
| `apps/mobile/src/app/_layout.tsx` | Root layout with Stack.Protected routing | VERIFIED | 3-guard protected routing; `QueryClientProvider`; calls `initialize()` in `useEffect` |
| `apps/mobile/src/app/(auth)/login.tsx` | Login screen | VERIFIED | Email/password fields, Apple native button, Google button, error display, link to register |
| `apps/mobile/src/app/(auth)/register.tsx` | Registration screen | VERIFIED | Email/password/confirm fields, Apple and Google buttons, error display |
| `apps/mobile/src/app/onboarding/index.tsx` | 3-step onboarding wizard | VERIFIED | Step 0: display name; Step 1: household size + kids toggle; Step 2: cuisine + dietary prefs; saves to `profiles` with `onboarding_complete: true` |
| `apps/mobile/src/app/(tabs)/_layout.tsx` | 5-tab layout | VERIFIED | Home, Recipes, Pantry, Shopping, Cook tabs with Ionicons |
| `apps/mobile/eas.json` | EAS build profiles | VERIFIED | `development`, `preview`, `production` profiles present |
| `apps/mobile/app.json` | App config with plugins | VERIFIED | Bundle ID `com.dinnertime.app`; plugins: `expo-secure-store`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`; scheme `dinnertime` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/server/src/index.ts` | `packages/server/src/routes/*.ts` | `app.route()` mounting | WIRED | All 7 routes imported and mounted; `app.route('/auth', auth)` etc. confirmed in file |
| `packages/server/src/middleware/auth.ts` | `@supabase/supabase-js` | `supabase.auth.getUser()` | WIRED | `getUser()` called on user-scoped client constructed from Bearer token |
| `apps/mobile/src/app/_layout.tsx` | `apps/mobile/src/stores/authStore.ts` | `Stack.Protected` guards on `isLoggedIn` and `isOnboarded` | WIRED | Both state fields read from store; guards use them as conditions |
| `apps/mobile/src/stores/authStore.ts` | `apps/mobile/src/lib/supabase.ts` | `onAuthStateChange` listener | WIRED | `supabase.auth.onAuthStateChange(...)` called in `initialize()`; profile fetched via `supabase.from('profiles')` |
| `apps/mobile/src/lib/supabase.ts` | `expo-secure-store` | `LargeSecureStore` class using AES-256 | WIRED | `SecureStore.setItemAsync` / `SecureStore.getItemAsync` / `SecureStore.deleteItemAsync` all present |
| `apps/mobile/src/app/onboarding/index.tsx` | Supabase `profiles` table | `supabase.from('profiles').update(...)` with `onboarding_complete: true` | WIRED | Confirmed in `handleComplete()` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FOUN-01 | 01-02, 01-03 | User can create account with email and password | SATISFIED | `signUpWithEmail` in `useAuth.ts` calls `supabase.auth.signUp()`; register screen wires it to a form; auth store receives session via `onAuthStateChange` |
| FOUN-02 | 01-02, 01-03 | User session persists across app restarts | SATISFIED (runtime needs human) | `LargeSecureStore` encrypts session in AsyncStorage; `supabase` client configured with `persistSession: true`; session restoration requires device test |
| FOUN-06 | 01-01, 01-03 | All user data syncs to cloud storage reliably | SATISFIED (runtime needs human) | Supabase PostgreSQL backend with profiles table; onboarding writes to cloud DB; RLS ensures data isolation; end-to-end sync requires live Supabase test |

No orphaned requirements found — FOUN-01, FOUN-02, and FOUN-06 are all claimed by plans 01-01, 01-02, and 01-03, and REQUIREMENTS.md maps all three to Phase 1.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/mobile/app.json` | 45 | `PLACEHOLDER_REVERSED_CLIENT_ID` as Google `iosUrlScheme` | Warning | Google Sign-In deep-link callback will fail at runtime until replaced with a real reversed client ID. Does not break email/Apple auth or any automated tests. |

No blockers found. The placeholder is a configuration value that requires external credential setup (Google Cloud Console), which is explicitly listed in the Plan 03 `user_setup` section as a prerequisite step for the user.

---

### Human Verification Required

#### 1. Full auth round-trip on device or simulator

**Test:** Start Supabase locally (`supabase start`), populate `.env` with output keys, build the dev client (`eas build --profile development --platform ios` or `expo run:ios`). Register a new account with email/password, complete the 3-step onboarding wizard, confirm 5 tabs appear, sign out, then sign back in.
**Expected:** Registration triggers the onboarding wizard. After completing onboarding, the 5-tab shell is shown. After sign-out, the login screen appears. After sign-in, tabs appear directly (onboarding skipped because `onboarding_complete=true` in the profile).
**Why human:** Requires a live Supabase instance, a built iOS binary, and verifying the `Stack.Protected` routing guard behaviour at runtime.

#### 2. Session persistence across app restart

**Test:** Log in successfully, then kill and reopen the app.
**Expected:** The app opens directly to the tabs screen without showing the login screen, because the AES-256 encrypted session stored via `LargeSecureStore` is restored by the Supabase client on startup.
**Why human:** Session persistence is a runtime behaviour that depends on `expo-secure-store` and `AsyncStorage` on a real device/simulator; it cannot be simulated in Vitest (which mocks both).

#### 3. Visual design acceptance

**Test:** Run the app and navigate through the login screen, register screen, and all 3 onboarding steps.
**Expected:** Orange/amber (#F97316) primary colour throughout. Warm cream/off-white backgrounds. Food-themed emoji accents (fork, flame, basket). Text is warm and conversational in tone. No cold or sterile corporate feel.
**Why human:** Aesthetic acceptance is a subjective judgement.

#### 4. Google Sign-In runtime configuration

**Test:** After adding the real reversed client ID to `app.json` and rebuilding, tap "Continue with Google" on the login screen.
**Expected:** The Google OAuth consent sheet appears and credential exchange with Supabase completes successfully.
**Why human:** The current `iosUrlScheme` in `app.json` is `PLACEHOLDER_REVERSED_CLIENT_ID`. Google Sign-In deep-link callback requires the real Web Client ID from Google Cloud Console.

---

## Gaps Summary

No functional gaps found. All code paths are substantive and fully wired. The four human-verification items are all expected runtime/visual checks that are inherent to a mobile auth flow — none indicate missing or stubbed code.

The `PLACEHOLDER_REVERSED_CLIENT_ID` in `app.json` is a warning, not a blocker: it was anticipated by the plan's `user_setup` section and only affects Google Sign-In at runtime, not the email/Apple auth paths or any automated tests.

---

_Verified: 2026-04-10T22:22:00Z_
_Verifier: Claude (gsd-verifier)_
