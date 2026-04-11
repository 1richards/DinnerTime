---
phase: 01-project-setup-auth
plan: 01
subsystem: infra
tags: [pnpm, monorepo, expo, hono, supabase, vitest, nativewind, typescript]

# Dependency graph
requires: []
provides:
  - pnpm monorepo workspace with apps/mobile and packages/server
  - Expo SDK 55 mobile app with expo-router file-based routing
  - Hono API server with health check and 7 route stubs
  - Auth middleware for Bearer token verification via Supabase
  - Supabase profiles migration with RLS and auto-create trigger
  - Vitest configured in both mobile and server workspaces
affects: [01-project-setup-auth, 02-pantry-management, 03-ai-recognition]

# Tech tracking
tech-stack:
  added: [expo@55, hono@4, supabase-js@2, zustand@5, tanstack-react-query@5, nativewind@4, tailwindcss@3, vitest@4, tsx@4, zod@3]
  patterns: [pnpm-monorepo, hono-route-mounting, supabase-rls, env-validation]

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - apps/mobile/package.json
    - apps/mobile/src/app/_layout.tsx
    - packages/server/src/index.ts
    - packages/server/src/middleware/auth.ts
    - packages/server/src/config/supabase.ts
    - supabase/migrations/00001_profiles.sql
  modified: []

key-decisions:
  - "Used hoisted node-linker for React Native/Metro bundler compatibility"
  - "Server conditionally starts (skips in NODE_ENV=test) for clean Hono test client usage"
  - "Profiles trigger extracts display_name from user metadata on signup"

patterns-established:
  - "Route stubs: each route is a separate Hono() instance exported and mounted via app.route()"
  - "Auth middleware: extracts Bearer token, creates user-scoped Supabase client, sets on context"
  - "Env config: lazy getters with requireEnv() for fail-fast on missing vars"
  - "Vitest: environment vars set in vitest.config.ts for test isolation"

requirements-completed: [FOUN-06]

# Metrics
duration: 5min
completed: 2026-04-10
---

# Phase 1 Plan 1: Project Scaffold Summary

**pnpm monorepo with Expo SDK 55 mobile app, Hono API server with 7 route stubs, and Supabase profiles migration with RLS**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-11T02:59:30Z
- **Completed:** 2026-04-11T03:05:00Z
- **Tasks:** 2
- **Files modified:** 38

## Accomplishments
- Full pnpm monorepo with apps/mobile and packages/server workspaces, pnpm install resolves cleanly
- Hono API server with health check (tested), logger, CORS, and all 7 route stubs returning 501
- Supabase profiles migration with RLS policies (select/update/insert own row) and auto-create trigger on auth.users insert
- Vitest configured and passing in both workspaces

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold monorepo and Expo mobile app** - `d8204aa` (feat)
2. **Task 2: Create Hono server with route stubs and Supabase migration** - `b4052ff` (feat)

## Files Created/Modified
- `package.json` - Workspace root with pnpm scripts
- `pnpm-workspace.yaml` - Workspace definitions (apps/*, packages/*)
- `.npmrc` - Hoisted node-linker for React Native compatibility
- `.env.example` - Environment variable template
- `.gitignore` - Standard ignores for monorepo
- `apps/mobile/package.json` - Expo SDK 55 app with all dependencies
- `apps/mobile/src/app/_layout.tsx` - Root layout with Slot
- `apps/mobile/src/app/index.tsx` - Placeholder home screen
- `apps/mobile/tailwind.config.js` - NativeWind/Tailwind config
- `apps/mobile/vitest.config.ts` - Vitest for pure logic tests
- `packages/server/src/index.ts` - Hono server entry, mounts all routes
- `packages/server/src/config/env.ts` - Validated env vars with lazy getters
- `packages/server/src/config/supabase.ts` - Admin and user-scoped Supabase clients
- `packages/server/src/middleware/auth.ts` - JWT Bearer token verification
- `packages/server/src/routes/auth.ts` - signup/login/logout stubs (unprotected)
- `packages/server/src/routes/recipes.ts` - GET/POST stubs (protected)
- `packages/server/src/routes/pantry.ts` - GET/POST stubs (protected)
- `packages/server/src/routes/meal-plans.ts` - GET/POST stubs (protected)
- `packages/server/src/routes/shopping.ts` - GET/POST stubs (protected)
- `packages/server/src/routes/ai.ts` - POST /suggest stub (protected)
- `packages/server/src/routes/voice.ts` - POST /transcribe stub (protected)
- `packages/server/__tests__/health.test.ts` - Health check test (passing)
- `supabase/config.toml` - Local dev configuration
- `supabase/migrations/00001_profiles.sql` - Profiles table with RLS and triggers
- `supabase/seed.sql` - Empty seed placeholder

## Decisions Made
- Used hoisted node-linker (.npmrc) because pnpm's default isolated mode breaks Metro bundler for React Native
- Server entry conditionally starts HTTP server (skips when NODE_ENV=test) to allow clean Hono test client usage
- Profiles trigger extracts display_name from raw_user_meta_data (full_name or name) on signup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed Expo template boilerplate**
- **Found during:** Task 1
- **Issue:** Expo SDK 55 default template includes components/, constants/, hooks/ directories with complex demo code that would conflict with our minimal layout
- **Fix:** Removed template boilerplate (explore.tsx, components/, constants/, hooks/, scripts/) and replaced _layout.tsx and index.tsx with minimal implementations
- **Files modified:** apps/mobile/src/app/_layout.tsx, apps/mobile/src/app/index.tsx
- **Verification:** pnpm install succeeds, vitest loads
- **Committed in:** d8204aa (Task 1 commit)

**2. [Rule 1 - Bug] Added --passWithNoTests to mobile test script**
- **Found during:** Task 1 verification
- **Issue:** vitest run exits with code 1 when no test files exist, causing verification to fail
- **Fix:** Added --passWithNoTests flag to mobile test script in package.json
- **Files modified:** apps/mobile/package.json
- **Committed in:** d8204aa (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for clean scaffold. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monorepo structure ready for auth implementation (Plan 02)
- Supabase profiles migration ready for `supabase start` and `supabase db reset`
- All route stubs ready to be implemented in subsequent phases
- NativeWind configured and ready for UI development

## Self-Check: PASSED

All 13 key files verified present. Both task commits (d8204aa, b4052ff) confirmed in git log.

---
*Phase: 01-project-setup-auth*
*Completed: 2026-04-10*
