<!-- GSD:project-start source:PROJECT.md -->
## Project

**DinnerTime**

DinnerTime is an AI-powered iOS meal planning app that eliminates the cognitive load of deciding what to cook and buying groceries. Users snap photos of their fridge/pantry, and the app suggests dinners based on what's available, plans the week, and generates Instacart grocery orders — with hands-free conversational voice guidance while cooking.

**Core Value:** Open the fridge, take a photo, get dinner ideas — zero mental effort from "what do we have?" to "what should we cook?"

### Constraints

- **Platform**: iOS-first (Expo/React Native for future cross-platform)
- **AI Provider**: Claude API for all AI features (vision, planning, voice understanding, suggestions)
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
| Hono | ~4.x | API framework | 4x faster than Express, built-in TypeScript, built-in CORS/logging/auth middleware, runs on Node.js/Cloudflare Workers/Bun. Perfect for a proxy layer between mobile and Claude/Instacart APIs. Less boilerplate than Express, growing ecosystem (2.8M weekly downloads). | HIGH |
| Node.js | 22 LTS | Runtime | Current LTS. Required by @supabase/supabase-js (20+) and @anthropic-ai/sdk. | HIGH |
### AI / Intelligence
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @anthropic-ai/sdk | ~0.82 | Claude API client | Official TypeScript SDK. Supports vision (base64 images), streaming responses, tool use. All AI calls go through backend -- never expose API keys in mobile app. | HIGH |
| Claude Sonnet 4 | latest | Primary AI model | Best cost/performance ratio for food recognition, meal planning, recipe parsing. Use for all standard requests. | HIGH |
| Claude Haiku 4 | latest | Fast/cheap AI tasks | Quick tasks: ingredient extraction from short text, simple categorization, search query generation. ~10x cheaper than Sonnet. | MEDIUM |
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
| expo-speech | (bundled) | Text-to-speech | Built-in TTS for Claude's responses during cooking mode. Uses iOS system voices. Simple API. | HIGH |
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
| AI provider | Claude (Anthropic) | OpenAI GPT-4o | Claude's vision is excellent for food recognition. Single provider simplifies architecture. Project decision already made. |
## What NOT to Use
| Technology | Why Not |
|------------|---------|
| Expo Go | Cannot run native modules like expo-speech-recognition. Use EAS dev client builds from the start. |
| expo-av | Deprecated in SDK 52+. Use expo-audio for recording and expo-video for playback. |
| Legacy Architecture | Dropped entirely in SDK 55. New Architecture is the only option. |
| Firebase | Project decision: Supabase. SQL is better for structured recipe/ingredient data. |
| OpenAI Realtime API | Adds a second AI provider. Claude handles all AI needs. Voice pipeline (STT -> Claude -> TTS) is cleaner. |
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
- [Claude Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision)
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

**Adding flows.** Copy an existing `.yaml` in `apps/mobile/.maestro/`. Take screenshots liberally — they're free debugging gold and Claude can `Read` them directly. See `apps/mobile/.maestro/README.md` for the full inventory.

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
