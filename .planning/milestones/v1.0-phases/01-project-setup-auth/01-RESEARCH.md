# Phase 1: Project Setup & Auth - Research

**Researched:** 2026-04-10
**Domain:** Expo React Native monorepo scaffolding, Supabase Auth, Hono API server
**Confidence:** HIGH

## Summary

Phase 1 is a greenfield scaffolding phase that sets up a pnpm monorepo with three workspaces: an Expo SDK 55 mobile app, a Hono API server on Node.js 22, and Supabase local development config. Authentication supports email/password, Apple Sign In, and Google Sign In, all routed through Supabase Auth. Session tokens are persisted using the LargeSecureStore pattern (AES-256 encryption key in expo-secure-store, encrypted session in AsyncStorage) because Supabase sessions exceed expo-secure-store's 2048-byte limit.

The Expo SDK 55 default template now uses a `/src` directory structure (`src/app/` instead of `app/`), requires New Architecture (Legacy Architecture dropped), and requires Xcode 26 for iOS builds. expo-router provides protected routes via `Stack.Protected` and `Tabs.Protected` components for auth gating. NativeWind 4 provides Tailwind CSS styling. The Hono server uses `@hono/node-server` for the Node.js adapter and Zod for request validation.

**Primary recommendation:** Scaffold the monorepo first, then Supabase local dev, then auth flow, then UI shell with tabs -- each as a discrete, testable plan.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full monorepo structure: apps/mobile, packages/server, supabase/
- pnpm workspaces for monorepo management
- All 5 tabs scaffolded with placeholder screens (Home, Recipes, Pantry, Shopping, Cook)
- Minimal dev tooling: TypeScript only, no linter/formatter for now
- Vitest configured for both mobile and server from the start
- Hono (not Fastify) as backend framework
- Node.js 22 LTS as the runtime
- Full route skeleton scaffolded as stubs: recipes, pantry, meal-plans, shopping, ai, voice endpoints
- Auth middleware and Supabase client setup included
- Supabase local CLI for development (supabase init + supabase start)
- User already has a Supabase account -- no account creation steps needed
- Only the profiles table created in Phase 1
- Row Level Security enabled from day one on profiles
- Three login methods: email/password + Apple Sign In + Google Sign In
- Post-signup onboarding wizard: 2-3 screens collecting display name, household size, and basic preferences
- Auth tokens stored with expo-secure-store (iOS Keychain, encrypted) -- requires dev client build, no Expo Go
- Warm and inviting visual design: food-themed imagery or illustration, warm colors (orange/amber), friendly copy

### Claude's Discretion
- Exact onboarding wizard screen count and layout
- Specific warm color palette choices
- Error state messaging and design
- Auth screen illustration/imagery selection
- Tab placeholder screen content
- Route stub implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-01 | User can create account with email and password | Supabase Auth email/password + Apple/Google OAuth via signInWithIdToken. LargeSecureStore for session persistence. expo-router protected routes for auth gating. |
| FOUN-02 | User session persists across app restarts | LargeSecureStore pattern encrypts Supabase session with AES-256 key in SecureStore, stores encrypted session in AsyncStorage. Supabase client configured with autoRefreshToken and persistSession. |
| FOUN-06 | All user data syncs to cloud storage reliably | Supabase PostgreSQL with profiles table, RLS policies. Supabase client reads/writes directly. Server-side Supabase admin client for privileged operations. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Expo SDK | 55 | App framework | Current stable. React Native 0.83, React 19.2, New Architecture mandatory. /src directory structure default. |
| expo-router | (bundled SDK 55) | Navigation/routing | File-based routing. Stack.Protected and Tabs.Protected for auth gating. |
| Hono | ~4.x | API framework | Locked decision. Built-in TypeScript, Zod validation middleware, CORS/logging. |
| @hono/node-server | latest | Node.js adapter | Required to run Hono on Node.js (not Bun/Deno/Workers). |
| @supabase/supabase-js | ~2.x | Supabase client | Isomorphic JS client for both mobile and server. |
| expo-secure-store | (bundled SDK 55) | Secure key storage | Stores AES-256 encryption key for session tokens. Requires dev client build. |
| NativeWind | ~4.x | Styling | Tailwind CSS for React Native. Zero-runtime compilation. |
| Zustand | ~5.0 | Client state | Auth state, UI state management. |
| @tanstack/react-query | ~5.x | Server state | Data fetching, caching, background refetch. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-native-async-storage/async-storage | latest | Encrypted session storage | Used by LargeSecureStore to hold encrypted Supabase session data |
| aes-js | latest | AES-256 encryption | Encrypts/decrypts session data stored in AsyncStorage |
| react-native-get-random-values | latest | Crypto polyfill | Provides crypto.getRandomValues for AES key generation in React Native |
| expo-apple-authentication | (bundled SDK 55) | Apple Sign In | Native Apple authentication flow on iOS |
| @react-native-google-signin/google-signin | latest | Google Sign In | Native Google authentication for iOS/Android |
| zod | ~3.x | Validation | Request validation on Hono server routes |
| tailwindcss | ~3.4.x | CSS framework | Required peer dependency for NativeWind 4 |
| vitest | ~3.x | Testing | Locked decision. For both server and mobile unit tests. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| LargeSecureStore | expo-sqlite/localStorage polyfill | Official quickstart uses localStorage via expo-sqlite, but LargeSecureStore provides encrypted-at-rest storage via iOS Keychain -- locked user decision |
| Vitest (mobile) | Jest + jest-expo | Jest is Expo's officially recommended test runner; Vitest is locked user decision. Works fine for unit tests but needs manual setup for React Native transforms |
| pnpm | yarn/npm | pnpm is locked decision. Requires .npmrc with node-linker=hoisted for React Native compatibility |

**Installation (mobile):**
```bash
# Create Expo project with SDK 55 template
npx create-expo-app@latest apps/mobile --template default@sdk-55

# Auth dependencies
npx expo install expo-secure-store expo-apple-authentication
npm install @supabase/supabase-js @react-native-async-storage/async-storage aes-js react-native-get-random-values @react-native-google-signin/google-signin
npm install --save-dev @types/aes-js

# State management
npm install zustand @tanstack/react-query

# Styling
npm install nativewind react-native-reanimated react-native-safe-area-context
npm install --save-dev tailwindcss@^3.4.17
```

**Installation (server):**
```bash
npm install hono @hono/node-server @supabase/supabase-js zod
npm install --save-dev typescript vitest @types/node tsx
```

## Architecture Patterns

### Recommended Project Structure
```
DinnerTime/
├── package.json                    # pnpm workspace root
├── pnpm-workspace.yaml            # workspace config
├── .npmrc                          # node-linker=hoisted
├── .env.example
├── apps/
│   └── mobile/                     # Expo SDK 55 app
│       ├── package.json
│       ├── app.json / app.config.ts
│       ├── tsconfig.json
│       ├── eas.json
│       ├── metro.config.js
│       ├── tailwind.config.js
│       ├── nativewind-env.d.ts
│       ├── global.css
│       ├── src/
│       │   ├── app/                # expo-router file-based routing
│       │   │   ├── _layout.tsx     # Root layout (providers, auth gate)
│       │   │   ├── index.tsx       # Redirect to tabs or auth
│       │   │   ├── (auth)/
│       │   │   │   ├── _layout.tsx
│       │   │   │   ├── login.tsx
│       │   │   │   └── register.tsx
│       │   │   ├── (tabs)/
│       │   │   │   ├── _layout.tsx # Tab navigator with 5 tabs
│       │   │   │   ├── index.tsx   # Home
│       │   │   │   ├── recipes.tsx
│       │   │   │   ├── pantry.tsx
│       │   │   │   ├── shopping.tsx
│       │   │   │   └── cook.tsx
│       │   │   ├── onboarding/
│       │   │   │   └── index.tsx   # Onboarding wizard
│       │   │   └── settings.tsx
│       │   ├── components/
│       │   │   └── ui/             # Button, Input, Card
│       │   ├── hooks/
│       │   │   └── useAuth.ts
│       │   ├── stores/
│       │   │   └── authStore.ts    # Zustand auth store
│       │   ├── lib/
│       │   │   └── supabase.ts     # Supabase client + LargeSecureStore
│       │   ├── types/
│       │   └── assets/
│       └── __tests__/
├── packages/
│   └── server/                     # Hono API server
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts            # Server entry with @hono/node-server
│       │   ├── config/
│       │   │   ├── env.ts
│       │   │   └── supabase.ts     # Server-side Supabase admin client
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── recipes.ts      # Stub
│       │   │   ├── pantry.ts       # Stub
│       │   │   ├── meal-plans.ts   # Stub
│       │   │   ├── shopping.ts     # Stub
│       │   │   ├── ai.ts           # Stub
│       │   │   └── voice.ts        # Stub
│       │   ├── middleware/
│       │   │   └── auth.ts         # JWT verification middleware
│       │   └── types/
│       └── __tests__/
└── supabase/
    ├── config.toml
    ├── migrations/
    │   └── 00001_profiles.sql      # profiles table + RLS policies
    └── seed.sql
```

### Pattern 1: LargeSecureStore for Auth Token Persistence
**What:** AES-256 encryption key stored in SecureStore, encrypted session stored in AsyncStorage
**When to use:** Always -- Supabase sessions exceed SecureStore's 2048-byte limit
**Example:**
```typescript
// Source: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import * as aesjs from 'aes-js'
import 'react-native-get-random-values'

class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8))
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1))
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value))
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey))
    return aesjs.utils.hex.fromBytes(encryptedBytes)
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key)
    if (!encryptionKeyHex) return encryptionKeyHex
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    )
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value))
    return aesjs.utils.utf8.fromBytes(decryptedBytes)
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key)
    if (!encrypted) return encrypted
    return await this._decrypt(key, encrypted)
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key)
    await SecureStore.deleteItemAsync(key)
  }

  async setItem(key: string, value: string) {
    const encrypted = await this._encrypt(key, value)
    await AsyncStorage.setItem(key, encrypted)
  }
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

### Pattern 2: expo-router Protected Routes for Auth Gating
**What:** Stack.Protected and Tabs.Protected components control route access based on auth state
**When to use:** Root layout to gate (tabs) behind auth, show (auth) screens when logged out
**Example:**
```typescript
// Source: https://docs.expo.dev/router/advanced/protected/
// src/app/_layout.tsx
import { Stack } from 'expo-router'
import { useAuthStore } from '../stores/authStore'

export default function RootLayout() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const isOnboarded = useAuthStore((s) => s.isOnboarded)

  return (
    <Stack>
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={isLoggedIn && !isOnboarded}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={isLoggedIn && isOnboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  )
}
```

### Pattern 3: Supabase Auth Listener + Zustand Store
**What:** Listen for Supabase auth state changes and sync to Zustand
**When to use:** Root layout initialization
**Example:**
```typescript
// stores/authStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  isLoggedIn: boolean
  isOnboarded: boolean
  isLoading: boolean
  initialize: () => () => void  // returns cleanup fn
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoggedIn: false,
  isOnboarded: false,
  isLoading: true,
  initialize: () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        set({
          session,
          user: session?.user ?? null,
          isLoggedIn: !!session,
          isLoading: false,
        })
        // Check profile for onboarding status
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_complete')
            .eq('id', session.user.id)
            .single()
          set({ isOnboarded: profile?.onboarding_complete ?? false })
        }
      }
    )
    return () => subscription.unsubscribe()
  },
}))
```

### Pattern 4: Apple + Google Sign In with signInWithIdToken
**What:** Native OAuth using platform sign-in, exchanged for Supabase session via ID token
**When to use:** Social login buttons on auth screens
**Example:**
```typescript
// Apple Sign In
import * as AppleAuthentication from 'expo-apple-authentication'

async function signInWithApple() {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  })
  if (credential.identityToken) {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    })
    // Apple only returns full name on FIRST sign-in -- save immediately
    if (credential.fullName && data.user) {
      await supabase.auth.updateUser({
        data: {
          full_name: `${credential.fullName.givenName} ${credential.fullName.familyName}`,
        },
      })
    }
  }
}

// Google Sign In
import { GoogleSignin } from '@react-native-google-signin/google-signin'

GoogleSignin.configure({ webClientId: 'YOUR_WEB_CLIENT_ID' })

async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices()
  const response = await GoogleSignin.signIn()
  if (response.data?.idToken) {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.data.idToken,
    })
  }
}
```

### Pattern 5: Hono Server with Auth Middleware
**What:** Hono API server that verifies Supabase JWTs on protected routes
**When to use:** All API routes except health check
**Example:**
```typescript
// Source: https://hono.dev/docs/getting-started/nodejs
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createClient } from '@supabase/supabase-js'

const app = new Hono()
app.use('*', logger())
app.use('*', cors())

// Auth middleware - verify Supabase JWT
app.use('/api/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return c.json({ error: 'Unauthorized' }, 401)

  c.set('user', user)
  await next()
})

// Route stubs
app.get('/api/v1/recipes', (c) => c.json({ data: [], message: 'Not implemented' }))
// ... other route stubs

serve({ fetch: app.fetch, port: 3000 })
```

### Pattern 6: Supabase Migration for Profiles + RLS
**What:** Database migration creating profiles table with Row Level Security
**When to use:** First migration, run during `supabase start`
**Example:**
```sql
-- supabase/migrations/00001_profiles.sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    household_size INTEGER DEFAULT 2,
    dietary_preferences JSONB DEFAULT '[]',
    cuisine_preferences JSONB DEFAULT '[]',
    disliked_ingredients JSONB DEFAULT '[]',
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
```

### Anti-Patterns to Avoid
- **Storing Supabase session directly in SecureStore:** Sessions exceed 2048-byte limit. Use LargeSecureStore pattern.
- **Using Expo Go for development:** expo-secure-store, expo-apple-authentication, and @react-native-google-signin require native modules. Use EAS dev client builds from the start.
- **Calling Supabase Auth from server with user tokens for sign-up:** Auth operations (signUp, signInWithPassword, signInWithIdToken) happen client-side through the Supabase JS client. Server only verifies tokens.
- **Forgetting to handle Apple name data:** Apple only provides the user's full name on the FIRST sign-in ever. If you don't capture it immediately, it's gone forever.
- **Hardcoding Supabase URLs in code:** Use EXPO_PUBLIC_ prefixed env vars for mobile, process.env for server. Never commit .env files.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth token encryption | Custom encryption scheme | LargeSecureStore with aes-js | Proven pattern from Supabase official docs, handles edge cases |
| Route protection | Custom redirect logic in every screen | expo-router Stack.Protected / Tabs.Protected | Built into the framework, handles deep links, re-renders on state change |
| JWT verification | Manual JWT parsing | Supabase client getUser() with token | Handles token refresh, revocation checks, type safety |
| Profile auto-creation | Application-level profile creation after signup | PostgreSQL trigger on auth.users INSERT | Guaranteed to execute, no race conditions, atomic with signup |
| Session refresh | Manual token refresh logic | Supabase client autoRefreshToken: true | Handles background refresh, retry logic, token rotation |
| Monorepo dependency resolution | Custom scripts to link packages | pnpm workspaces with workspace:* protocol | Battle-tested, handles hoisting correctly for React Native |

## Common Pitfalls

### Pitfall 1: pnpm Isolated Dependencies Breaking React Native
**What goes wrong:** React Native expects a flat node_modules structure. pnpm's default isolated mode causes native build failures.
**Why it happens:** pnpm uses symlinks and a content-addressable store by default, which React Native's Metro bundler can't resolve.
**How to avoid:** Add `node-linker=hoisted` to `.npmrc` at workspace root. For SDK 55, also verify Metro can resolve monorepo paths.
**Warning signs:** `Unable to resolve module` errors during Metro bundling, native build failures mentioning missing modules.

### Pitfall 2: SecureStore Size Limit (2048 bytes)
**What goes wrong:** Supabase sessions are larger than 2048 bytes, causing SecureStore to throw errors.
**Why it happens:** expo-secure-store has a hard 2048-byte limit (backed by iOS Keychain item size constraints).
**How to avoid:** Use the LargeSecureStore pattern (AES key in SecureStore, encrypted data in AsyncStorage).
**Warning signs:** Runtime error "Value is larger than 2048 bytes" on login.

### Pitfall 3: Apple Name Data Lost After First Sign-In
**What goes wrong:** User's display name from Apple is empty after initial sign-up.
**Why it happens:** Apple only provides `fullName` on the very first `signInAsync` call. Subsequent calls return null.
**How to avoid:** Capture and persist `credential.fullName` to user metadata immediately during the first sign-in.
**Warning signs:** Users have no display name after Apple Sign In.

### Pitfall 4: Expo SDK 55 Requires Xcode 26
**What goes wrong:** iOS builds fail with obscure errors.
**Why it happens:** SDK 55 / React Native 0.83 dropped Legacy Architecture and requires Xcode 26.
**How to avoid:** Ensure local Xcode is version 26+. EAS Build defaults to Xcode 26.2.
**Warning signs:** Build errors mentioning architecture incompatibility or missing Xcode version.

### Pitfall 5: Missing EXPO_PUBLIC_ Prefix on Environment Variables
**What goes wrong:** Environment variables are undefined in the mobile app at runtime.
**Why it happens:** Expo only exposes env vars prefixed with `EXPO_PUBLIC_` to the client bundle.
**How to avoid:** Name mobile-accessible vars `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Server vars use `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
**Warning signs:** `undefined` values when initializing Supabase client.

### Pitfall 6: Google Sign-In Requires Web Client ID Even for Mobile
**What goes wrong:** Google Sign In fails or returns no idToken.
**Why it happens:** Supabase requires the Web Client ID (not iOS or Android client ID) to validate the OAuth token server-side.
**How to avoid:** Create a Web Application OAuth client in Google Cloud Console. Use that ID in `GoogleSignin.configure()` and in Supabase dashboard Google provider settings.
**Warning signs:** `idToken` is null after Google sign-in.

### Pitfall 7: Vitest Requires Manual Setup for React Native
**What goes wrong:** Tests fail to parse JSX or React Native imports.
**Why it happens:** Vitest doesn't have built-in React Native transform support like jest-expo does.
**How to avoid:** For server tests, Vitest works out of the box. For mobile tests, focus on pure logic (stores, utilities, services) that don't import React Native components. Component tests may require additional transform configuration.
**Warning signs:** `SyntaxError: Unexpected token` or `Cannot find module 'react-native'` in test output.

## Code Examples

### pnpm Workspace Configuration
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```ini
# .npmrc
node-linker=hoisted
```

```json
// Root package.json
{
  "name": "dinnertime",
  "private": true,
  "scripts": {
    "mobile": "pnpm --filter @dinnertime/mobile",
    "server": "pnpm --filter @dinnertime/server",
    "dev:server": "pnpm --filter @dinnertime/server dev",
    "test": "pnpm -r test"
  }
}
```

### Hono Server Entry Point
```typescript
// packages/server/src/index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono().basePath('/api/v1')

app.use('*', logger())
app.use('*', cors())

app.get('/health', (c) => c.json({ status: 'ok' }))

// Mount route stubs
// app.route('/recipes', recipesRouter)
// app.route('/pantry', pantryRouter)
// etc.

const port = parseInt(process.env.PORT || '3000')
console.log(`Server running on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
```

### Tab Layout with 5 Tabs
```typescript
// src/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarLabel: 'Home' }}
      />
      <Tabs.Screen
        name="recipes"
        options={{ title: 'Recipes', tabBarLabel: 'Recipes' }}
      />
      <Tabs.Screen
        name="pantry"
        options={{ title: 'Pantry', tabBarLabel: 'Pantry' }}
      />
      <Tabs.Screen
        name="shopping"
        options={{ title: 'Shopping', tabBarLabel: 'Shopping' }}
      />
      <Tabs.Screen
        name="cook"
        options={{ title: 'Cook', tabBarLabel: 'Cook' }}
      />
    </Tabs>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `app/` directory for routes | `src/app/` directory | SDK 55 (2026) | Default template now uses /src. No config needed for new projects. |
| Custom auth redirect logic | Stack.Protected / Tabs.Protected | expo-router recent | Declarative route protection, handles deep links automatically |
| Direct SecureStore for sessions | LargeSecureStore (AES + AsyncStorage) | Supabase official guide | Handles sessions > 2048 bytes safely |
| Legacy Architecture option | New Architecture only | SDK 55 | Legacy Architecture completely removed. No opt-out. |
| Expo Go for dev | EAS dev client | Required for native modules | expo-secure-store, Apple Auth, Google Sign In all require dev client |
| Separate Supabase project setup | supabase init + supabase start | CLI v1+ | Full local development stack with Docker |

## Open Questions

1. **Vitest + React Native component testing**
   - What we know: Vitest works perfectly for server-side and pure logic tests. React Native component testing typically uses jest-expo.
   - What's unclear: Exact configuration needed to make Vitest work with React Native component transforms.
   - Recommendation: Use Vitest for server and mobile logic tests. If component testing is needed, configure transforms or defer component tests to a later phase.

2. **Google Sign-In on iOS simulator**
   - What we know: @react-native-google-signin requires Google Cloud Console setup and a Web Client ID.
   - What's unclear: Whether Google Sign In works smoothly on iOS simulator or requires physical device testing.
   - Recommendation: Set up the Web Client ID, test on simulator first, fall back to physical device if needed.

3. **EAS Build profile for dev client**
   - What we know: A dev client build is required (no Expo Go) for native modules used in this phase.
   - What's unclear: Exact eas.json configuration needed for the dev client build profile.
   - Recommendation: Configure `eas.json` with a `development` profile using `developmentClient: true`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~3.x (locked decision) |
| Config file | vitest.config.ts (one per workspace -- mobile and server) |
| Quick run command | `pnpm -r test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-01 | User can create account with email/password | integration | `pnpm --filter @dinnertime/server vitest run tests/auth.test.ts` | Wave 0 |
| FOUN-01 | Apple Sign In exchanges idToken for session | unit | `pnpm --filter @dinnertime/mobile vitest run tests/auth.test.ts` | Wave 0 |
| FOUN-01 | Google Sign In exchanges idToken for session | unit | `pnpm --filter @dinnertime/mobile vitest run tests/auth.test.ts` | Wave 0 |
| FOUN-02 | Session persists via LargeSecureStore | unit | `pnpm --filter @dinnertime/mobile vitest run tests/secure-store.test.ts` | Wave 0 |
| FOUN-02 | Auth state listener updates Zustand store | unit | `pnpm --filter @dinnertime/mobile vitest run tests/auth-store.test.ts` | Wave 0 |
| FOUN-06 | Profiles table RLS allows own-row access only | integration | `pnpm --filter @dinnertime/server vitest run tests/rls.test.ts` | Wave 0 |
| FOUN-06 | Profile auto-created on signup via trigger | integration | `pnpm --filter @dinnertime/server vitest run tests/profile-trigger.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm -r test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/mobile/vitest.config.ts` -- Vitest config for mobile workspace
- [ ] `packages/server/vitest.config.ts` -- Vitest config for server workspace
- [ ] `apps/mobile/__tests__/secure-store.test.ts` -- LargeSecureStore encrypt/decrypt
- [ ] `apps/mobile/__tests__/auth-store.test.ts` -- Zustand auth store state transitions
- [ ] `packages/server/__tests__/auth.test.ts` -- Auth middleware JWT verification
- [ ] Framework install: `pnpm add -D vitest` in both workspaces

## Sources

### Primary (HIGH confidence)
- [Supabase Expo React Native tutorial (secure-store variant)](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store) - LargeSecureStore implementation, auth setup
- [Expo Router Protected Routes](https://docs.expo.dev/router/advanced/protected/) - Stack.Protected and Tabs.Protected patterns
- [Supabase Apple Sign In](https://supabase.com/docs/guides/auth/social-login/auth-apple) - signInWithIdToken pattern, bundle ID config
- [Supabase Google Sign In](https://supabase.com/docs/guides/auth/social-login/auth-google) - @react-native-google-signin setup, Web Client ID requirement
- [Hono Node.js Getting Started](https://hono.dev/docs/getting-started/nodejs) - @hono/node-server adapter, serve function
- [Expo Monorepos Guide](https://docs.expo.dev/guides/monorepos/) - pnpm workspace config, Metro auto-config for SDK 52+
- [Expo SDK 55 Changelog](https://expo.dev/changelog/sdk-55) - /src directory default, New Architecture mandatory, Xcode 26

### Secondary (MEDIUM confidence)
- [Expo Create Project](https://docs.expo.dev/get-started/create-a-project/) - create-expo-app with --template default@sdk-55
- [NativeWind Installation](https://www.nativewind.dev/docs/getting-started/installation) - NativeWind 4 setup with Expo
- [Supabase Local Development](https://supabase.com/docs/guides/local-development/overview) - CLI workflow, migrations

### Tertiary (LOW confidence)
- Vitest + React Native integration patterns -- based on community discussions, not official Expo guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs, versions confirmed
- Architecture: HIGH - Patterns from official Supabase and Expo documentation
- Pitfalls: HIGH - Documented in official guides (SecureStore limit, Apple name data, pnpm hoisting)
- Vitest mobile setup: LOW - Not officially supported by Expo, community-driven approaches

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (30 days -- stable ecosystem, SDK 55 is current)
