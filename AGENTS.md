<!-- GSD:project-start source:PROJECT.md -->
## Project

**DinnerTime**

DinnerTime is an AI-powered iOS meal planning app that eliminates the cognitive load of deciding what to cook and buying groceries. Users snap photos of their fridge/pantry, and the app suggests dinners based on what's available, plans the week, and generates Instacart grocery orders — with hands-free conversational voice guidance while cooking.

**Core Value:** Open the fridge, take a photo, get dinner ideas — zero mental effort from "what do we have?" to "what should we cook?"

### Constraints

- **Platform**: iOS-first (Expo/React Native for future cross-platform)
- **AI Provider**: Codex API for all AI features (vision, planning, voice understanding, suggestions)
- **Backend**: Node.js/TypeScript backend proxying all AI and external API calls
- **Database**: Supabase (PostgreSQL + pgvector + Auth + Storage)
- **Grocery**: Instacart Developer Platform API (link-based model)
- **Privacy**: All AI calls through backend — no API keys in mobile app
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Expo SDK | ~55 | App framework | Current stable SDK. Includes React Native 0.83, React 19.2, New Architecture by default. File-based routing via expo-router built in. Three releases/year cadence means staying current is manageable. | HIGH |
| React Native | 0.83 (via Expo 55) | Cross-platform UI | Bundled with Expo SDK 55. New Architecture (Fabric + TurboModules) is now mandatory -- Legacy Architecture dropped in SDK 55. | HIGH |
| TypeScript | ~5.6 | Type safety | Required across mobile and backend. Expo 55 ships with TS support out of the box. | HIGH |
| expo-router | (bundled with SDK 55) | Navigation/routing | File-based routing, built into Expo. Includes guarded groups for auth protection, synchronous layouts eliminating tab flicker. No reason to use React Navigation directly anymore. | HIGH |
### Backend / API Layer
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Hono | ~4.x | API framework | 4x faster than Express, built-in TypeScript, built-in CORS/logging/auth middleware, runs on Node.js/Cloudflare Workers/Bun. Perfect for a proxy layer between mobile and Codex/Instacart APIs. Less boilerplate than Express, growing ecosystem (2.8M weekly downloads). | HIGH |
| Node.js | 22 LTS | Runtime | Current LTS. Required by @supabase/supabase-js (20+) and @anthropic-ai/sdk. | HIGH |
### AI / Intelligence
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @anthropic-ai/sdk | ~0.82 | Codex API client | Official TypeScript SDK. Supports vision (base64 images), streaming responses, tool use. All AI calls go through backend -- never expose API keys in mobile app. | HIGH |
| Codex Sonnet 4 | latest | Primary AI model | Best cost/performance ratio for food recognition, meal planning, recipe parsing. Use for all standard requests. | HIGH |
| Codex Haiku 4 | latest | Fast/cheap AI tasks | Quick tasks: ingredient extraction from short text, simple categorization, search query generation. ~10x cheaper than Sonnet. | MEDIUM |
### Database / Backend Services
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase (hosted) | latest | BaaS platform | PostgreSQL + Auth + Storage + Edge Functions + Realtime. First-class Expo/React Native support with official guides. Row Level Security means mobile app can query DB directly for reads. | HIGH |
| @supabase/supabase-js | ~2.101 | Supabase client | Isomorphic JS client. Works in both mobile (with AsyncStorage adapter) and backend. | HIGH |
| pgvector (via Supabase) | built-in | Semantic search | Recipe similarity search, "find recipes like this one," ingredient-based matching. Supabase includes pgvector out of the box. | HIGH |
| expo-secure-store | (bundled) | Auth token storage | Secure storage for Supabase auth tokens on device. Required for proper auth persistence in React Native. | HIGH |
### Grocery Integration
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Instacart Developer Platform API | REST v1 | Grocery ordering | Link-based model: POST recipe/ingredients to API, get back a hosted Instacart page URL. Users tap link, land on Instacart with pre-populated cart. No cart state management needed on our side. Supports UPC matching for better product accuracy. | HIGH |
### Camera / Image
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| expo-image-picker | ~55.x | Photo capture | Simpler API for "take a photo" use case. Handles permissions, camera UI, and returns image data. Preferred over expo-camera for pantry scanning because we need a single photo, not a camera viewfinder. | HIGH |
| expo-camera | ~55.x | Camera viewfinder (if needed) | Only use if we want a custom camera UI with overlays (e.g., "frame your fridge shelf"). For MVP, expo-image-picker is sufficient. | MEDIUM |
| expo-image | ~2.x | Image display/caching | High-performance image component with caching built in. Use instead of React Native's Image component. Supports blurhash placeholders. | HIGH |
### Voice / Audio
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @jamsch/expo-speech-recognition | ~0.2.15 | Speech-to-text | Expo config plugin for on-device speech recognition. Web Speech API-like interface. Uses iOS native speech recognition (no network call for basic transcription). Requires dev client build (no Expo Go). | MEDIUM |
| expo-audio | (bundled with SDK 55) | Audio recording | Replaces deprecated expo-av for audio. Includes voice-optimized recording modes (SpokenAudio on iOS with noise suppression). | HIGH |
| expo-speech | (bundled) | Text-to-speech | Built-in TTS for Codex's responses during cooking mode. Uses iOS system voices. Simple API. | HIGH |
### State Management
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zustand | ~5.0 | Client state | Lightweight, hook-based, no boilerplate. 403k+ weekly downloads. Perfect for UI state, user preferences, offline pantry cache. Works seamlessly with React Native. | HIGH |
| @tanstack/react-query | ~5.x | Server state | Handles all Supabase/API data fetching with caching, background refetch, optimistic updates. Pairs with Zustand (Zustand for UI state, React Query for server state). Excellent React Native support with focus-based refetching. | HIGH |
### Styling / UI
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| NativeWind | ~4.x | Styling | Tailwind CSS for React Native. Zero-runtime (compiles to StyleSheet.create). 403k weekly downloads, industry standard in 2026. Familiar if coming from web Tailwind. | HIGH |
| React Native Reanimated | ~3.x | Animations | Required for smooth gesture interactions and transitions. Bundled with Expo SDK 55. | HIGH |
| React Native Gesture Handler | ~2.x | Touch/gesture | Smooth swipe-to-dismiss, drag interactions. Bundled with Expo SDK 55. | HIGH |
### Dev Tooling
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| EAS Build | latest | Cloud builds | Expo Application Services. Required for dev client builds (needed for expo-speech-recognition native module). Handles iOS provisioning. | HIGH |
| EAS Submit | latest | App Store submission | Streamlined TestFlight and App Store publishing. | HIGH |
| Biome | ~1.x | Linting/formatting | Faster than ESLint + Prettier combined. Single tool for both. Growing adoption in 2026. | MEDIUM |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend framework | Hono | Express 5 | Express is slower, requires more middleware packages, weaker TypeScript inference. Hono is the modern choice. |
| Backend framework | Hono | Fastify | Fastify is good but Hono's Web Standards API means easier migration to edge/serverless later. |
| State management | Zustand | Redux Toolkit | Redux is overkill for this app's state complexity. Zustand achieves the same with 90% less boilerplate. |
| State management | Zustand | Jotai | Jotai is atomic (bottom-up), Zustand is store-based (top-down). Store-based better fits recipe/pantry domain models. |
| Styling | NativeWind | Tamagui | Tamagui's optimizing compiler is powerful but adds complexity. NativeWind is simpler, more widely adopted, and sufficient for our needs. |
| Styling | NativeWind | StyleSheet.create | Raw StyleSheet works but no utility classes, no design system consistency, slower iteration. |
| Database | Supabase | Firebase | SQL better for structured recipe data. pgvector for semantic search. Transparent pricing. Firebase's NoSQL would require denormalization for recipe queries. |
| Database | Supabase | PlanetScale/Neon + custom auth | Supabase bundles auth + storage + DB + realtime. Building this separately is months of extra work for no benefit. |
| Navigation | expo-router | React Navigation | expo-router IS React Navigation underneath, but with file-based routing. No reason to use the lower-level API directly. |
| Image display | expo-image | React Native Image | expo-image has caching, blurhash, better performance. Drop-in replacement. |
| Speech-to-text | @jamsch/expo-speech-recognition | Whisper API (server-side) | On-device is faster (no network roundtrip), free, and works offline. Server-side Whisper is a fallback if on-device quality is insufficient. |
| AI provider | Codex (Anthropic) | OpenAI GPT-4o | Codex's vision is excellent for food recognition. Single provider simplifies architecture. Project decision already made. |
## What NOT to Use
| Technology | Why Not |
|------------|---------|
| Expo Go | Cannot run native modules like expo-speech-recognition. Use EAS dev client builds from the start. |
| expo-av | Deprecated in SDK 52+. Use expo-audio for recording and expo-video for playback. |
| Legacy Architecture | Dropped entirely in SDK 55. New Architecture is the only option. |
| Firebase | Project decision: Supabase. SQL is better for structured recipe/ingredient data. |
| OpenAI Realtime API | Adds a second AI provider. Codex handles all AI needs. Voice pipeline (STT -> Codex -> TTS) is cleaner. |
| Next.js (for backend) | Overkill. We need a thin API proxy, not a full-stack web framework. Hono is purpose-built for this. |
| GraphQL | REST is simpler for this use case. Supabase's PostgREST gives us flexible querying without GraphQL complexity. |
| Redux | Too much boilerplate for app-level state. Zustand + React Query covers all needs with less code. |
| Tailwind CSS (web version) | Use NativeWind instead. Regular Tailwind doesn't work in React Native. |
## Installation
# Create project
# Core dependencies (mobile)
# Speech recognition (requires dev client build)
# Backend (separate directory)
## Version Pinning Strategy
## Sources
- [Expo SDK 55 Changelog](https://expo.dev/changelog/sdk-55)
- [Expo SDK Reference](https://docs.expo.dev/versions/latest/)
- [Supabase Expo React Native Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [@supabase/supabase-js npm](https://www.npmjs.com/package/@supabase/supabase-js) - v2.101.1
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) - v0.82.0
- [Codex Vision Documentation](https://platform.Codex.com/docs/en/build-with-Codex/vision)
- [Instacart Developer Platform - Create Recipe Page](https://docs.instacart.com/developer_platform_api/guide/tutorials/create_a_recipe_page/)
- [Instacart MCP Integration](https://docs.instacart.com/developer_platform_api/guide/tutorials/mcp/)
- [@jamsch/expo-speech-recognition](https://github.com/jamsch/expo-speech-recognition) - v0.2.15
- [Zustand npm](https://www.npmjs.com/package/zustand) - v5.0.12
- [TanStack Query React Native Docs](https://tanstack.com/query/latest/docs/framework/react/react-native)
- [NativeWind vs Tamagui Comparison 2026](https://www.pkgpulse.com/blog/nativewind-vs-tamagui-vs-twrnc-react-native-styling-2026)
- [Hono vs Express 2026](https://dev.to/theawesomeblog/hono-vs-express-2026-which-javascript-framework-ships-faster-apis-85a)
- [Expo Audio Documentation](https://docs.expo.dev/versions/latest/sdk/audio/)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

## UAT (Maestro on iOS Simulator)

Before reporting a UI feature complete, validate it with Maestro against the iOS Simulator on this host. The dev client is prebuilt under `apps/mobile/ios/`.

**Toolchain:** Maestro 2.4.0 + OpenJDK 21 + Xcode (iOS 26.4 runtime). All under `/opt/homebrew`. Java is on `PATH` via `~/.zshrc`.

**Quick loop:**

```
cd apps/mobile
xcrun simctl boot "iPhone 17 Pro" || true
open -a Simulator
xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
npx expo start --dev-client --lan        # NOT --tunnel — sim needs localhost
maestro test .maestro/smoke.yaml
```

Or use the helper: `apps/mobile/.maestro/scripts/uat.sh {boot|smoke|all|shot|log|reset}`.

**Important — Metro mode.** The dev client picks the bundle URL from Metro's manifest. Tunnel mode (`--tunnel`) makes the simulator try `.exp.direct` URLs that fail behind iOS ATS. Use `--lan` for the simulator. Tunnel mode is only for testing on a physical iPhone outside the LAN.

**First-run dev menu.** The Expo dev client shows a one-time "Welcome to dev tools" intro and then a regular dev menu modal. Smoke flow dismisses both with optional `Continue` tap + a `90%,32%` close-button tap. After the first launch these are no-ops.

**Selectors.** Maestro's text matcher treats input as regex. Avoid asserting against text containing `=`, `(`, `?`, etc. — use plain UI labels like `"Sign In"` or `"DinnerTime"` and lean on screenshots for state verification. The sentinel banner in `src/app/_layout.tsx` is the source of truth for hydration state visually, not assertively.

**Adding flows.** Copy an existing `.yaml` in `apps/mobile/.maestro/`. Take screenshots liberally — they're free debugging gold and Codex can `Read` them directly. See `apps/mobile/.maestro/README.md` for the full inventory.

## Dev Environment Startup

Three components: backend server, Metro bundler, and (for physical-iPhone testing) a transport that exposes both to the device. Each session starts from zero — nothing persists across Codex sessions except the Tailscale Serve config (see below).

There are three viable transport setups depending on where the iPhone is:

| Scenario | Transport | API URL | Metro URL |
|----------|-----------|---------|-----------|
| Simulator | none | `http://localhost:3000` | auto (`--lan`) |
| Physical iPhone, same WiFi | LAN | `http://192.168.4.43:3000` | auto (`--lan`) |
| Physical iPhone, away from home | **Tailscale Serve (preferred)** | `https://clawdaddy.taile16aae.ts.net:8443` | `https://clawdaddy.taile16aae.ts.net` |
| Physical iPhone, no Tailscale | Cloudflare tunnel | `https://<random>.trycloudflare.com` | `--tunnel` (ngrok) |

### 1. Start the Server

```bash
cd /Users/patrickrichards/DinnerTime
set -a && source .env && set +a && cd packages/server && pnpm dev
```

Server runs on port 3000. Env vars live in the **root** `.env` (not `packages/server/.env`). The server uses `dotenv` to load `../../.env` automatically, but `tsx watch` hot-reloads can sometimes lose the env — if it crashes with `Missing required environment variable`, source the root `.env` manually as shown above. Server is bound to `0.0.0.0` in `packages/server/src/index.ts` so it's reachable on the Tailscale virtual interface (utun) too.

### 2. Start Metro

For **simulator or physical iPhone on the same WiFi**:
```bash
cd apps/mobile
npx expo start --dev-client --lan
```

For **physical iPhone via Tailscale (away-from-home)**:
```bash
cd apps/mobile
EXPO_PACKAGER_PROXY_URL=https://clawdaddy.taile16aae.ts.net \
REACT_NATIVE_PACKAGER_HOSTNAME=clawdaddy.taile16aae.ts.net \
  npx expo start --dev-client --lan --clear
```
Both env vars are required — `EXPO_PACKAGER_PROXY_URL` makes Metro emit bundle URLs pointing at the public HTTPS proxy; `REACT_NATIVE_PACKAGER_HOSTNAME` puts the same host in the manifest's `hostUri`.

- After changing `apps/mobile/.env`, you MUST clear the Metro cache: `rm -rf .expo && ... --clear`. Expo inlines `EXPO_PUBLIC_*` vars at **bundle time** — a running Metro won't pick up `.env` changes.
- If the app shows stale errors after a URL change, the Zustand persisted state in AsyncStorage may need clearing. Force-close the app or, in extreme cases, delete `RCTAsyncLocalStorage_V1` from the simulator's app container.

### 3. Transport: Tailscale Serve (preferred for away-from-home)

**One-time setup:**
1. Enable Tailscale Serve on the tailnet via the admin console (one click). If `tailscale serve` reports "Serve is not enabled on your tailnet" the first time, follow the URL it prints.
2. Pre-issue the cert (idempotent, instant if already issued):
   ```bash
   tailscale cert clawdaddy.taile16aae.ts.net
   ```

**Each session (Tailscale Serve config persists across reboots — usually you don't redo this):**
```bash
# Metro on the default HTTPS port (443) — port-less URL avoids dev-client URL parser quirks.
tailscale serve --bg --https=443 http://localhost:8081

# API on a non-default HTTPS port (8443) — app fetches via explicit URL with port.
tailscale serve --bg --https=8443 http://localhost:3000

tailscale serve status   # verify both mappings
```

Then in `apps/mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://clawdaddy.taile16aae.ts.net:8443
```

**On the iPhone**, in the Expo dev client → "Enter URL manually":
```
https://clawdaddy.taile16aae.ts.net
```
**Use the `https://` form, NOT `exp://` or `exps://`** — those scheme variants silently fail to connect in some dev-client builds even when the proxy is healthy.

**Why the port arrangement (Metro on 443, API on 8443):**
- Metro on the default HTTPS port lets the dev client use a port-less URL. With a non-default port (e.g. `:8443`) the dev client's URL parser failed to connect even though Safari at the same URL worked.
- The API can live on any port because the mobile app fetches with explicit URLs containing the port; ATS doesn't care about port numbers, only that the host has a valid HTTPS cert.

**Reverting / disabling:**
```bash
tailscale serve --https=443 off
tailscale serve --https=8443 off
```

### 4. Transport: Cloudflare tunnel (fallback when Tailscale isn't an option)

```bash
cloudflared tunnel --url http://localhost:3000
# Outputs a URL like: https://random-words.trycloudflare.com
```
Update `apps/mobile/.env`: `EXPO_PUBLIC_API_URL=https://<tunnel-url>.trycloudflare.com`.

For Metro, run `npx expo start --dev-client --tunnel --clear` (uses Expo's built-in ngrok relay). The dev client's `*.exp.direct` URL is registered with Expo's manifest service — auto-discovers if you're logged into the same Expo account. **Note:** dev-client connections to `*.exp.direct` are flaky in some builds; if it fails the same way the Tailscale URL did, fall back to the simulator.

**Tunnel URLs are ephemeral** — they change every time `cloudflared` restarts. Update `.env` and restart Metro with `--clear` each session.

For **simulator-only** testing, use `EXPO_PUBLIC_API_URL=http://localhost:3000` (no tunnel needed).

### Environment Files

| File | Purpose | Notes |
|------|---------|-------|
| `.env` (root) | Server env vars (Supabase, Anthropic, Google, Instacart keys) | Gitignored. All secrets live here. |
| `apps/mobile/.env` | Mobile env vars (`EXPO_PUBLIC_*`) | Gitignored. Only public keys + API URL. |
| `.env.example` (root) | Template showing required vars | Committed. No real values. |

### Known Gotchas

- **iPhone camera photos exceed Anthropic's 5MB limit** at high quality. `scan/index.tsx` uses `quality: 0.4` to keep images under 5MB. Don't raise this without testing on a real device.
- **`SecureStore unavailable` warning** on simulator is expected — Expo SecureStore requires a real Keychain. Auth falls back to AsyncStorage. Not a bug.
- **Server bind:** `serve()` in `packages/server/src/index.ts` uses `hostname: '0.0.0.0'` so the port is reachable on the Tailscale interface (utun) as well as loopback. Don't change this back to default — it'll silently break Tailscale Serve and physical-iPhone testing.
- **Mac Mini host**: `clawdaddy` on Tailscale (`100.90.230.96`), tailnet `taile16aae.ts.net`, LAN IP typically `192.168.4.43`. MagicDNS resolves `clawdaddy.taile16aae.ts.net` from any tailnet member.
- **Dev client bundle ID**: `com.dinnertime.app` (not `com.patrickrrichards.dinnertime`).
- **Dev client URL scheme:** when entering a URL manually in the dev client, **use `https://...` not `exp://` or `exps://`**. The `exp[s]://` variants fail to connect against Tailscale Serve / Cloudflare tunnel HTTPS proxies even when the same URL works in Safari. Plain `https://` works.
- **Dev client + non-standard ports:** the dev client URL parser is unreliable with non-443 ports. Metro must be exposed on **HTTPS port 443** for the dev client manual-URL path to work; put the API on `:8443` instead. Putting Metro on `:8443` while connecting via `exps://...:8443` silently fails — the request never reaches Metro (zero inbound logs) even though the proxy is healthy.
- **iOS ATS + Tailscale plain HTTP:** `NSAllowsLocalNetworking: true` in `app.json` covers RFC1918 ranges (10.x, 172.16-31.x, 192.168.x) but **NOT** the Tailscale CGNAT range (100.64.0.0/10). Plain HTTP to a `100.x` IP or `*.ts.net` is blocked in native fetches. Always use HTTPS via Tailscale Serve, never plain HTTP to the Tailscale IP. Adding ATS exception domains requires a dev-client rebuild (~15 min).
- **PostgREST schema cache:** after applying a Supabase migration that adds columns, save errors with "Could not find the 'X' column of 'Y' in the schema cache" mean PostgREST hasn't refreshed its cache. Either wait ~30s or in the Supabase SQL editor run `NOTIFY pgrst, 'reload schema';`. Saves should work immediately after.
- **Stale persisted state on cart-add:** Zustand-persisted `currentList` in `shoppingStore` can point at a server-deleted row. The store now self-recovers (refresh-or-create + retry on 404 from `/shopping/items`); same pattern lives in `mealPlanStore`. If you add a new "lazy resource" pattern, replicate the 404-recovery branch.

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-Codex-profile` -- do not edit manually.
<!-- GSD:profile-end -->
