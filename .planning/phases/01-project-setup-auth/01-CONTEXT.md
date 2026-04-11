# Phase 1: Project Setup & Auth - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Scaffold the full monorepo (mobile app + backend server + Supabase config), set up user authentication (email + Apple + Google), and deliver a working app shell with all 5 tabs as placeholders. Users can create an account, go through onboarding, log in, and have their session persist across restarts. Data syncs to Supabase.

</domain>

<decisions>
## Implementation Decisions

### Project scaffolding
- Full monorepo structure from PLAN.md: apps/mobile, packages/server, supabase/
- pnpm workspaces for monorepo management
- All 5 tabs scaffolded with placeholder screens (Home, Recipes, Pantry, Shopping, Cook)
- Minimal dev tooling: TypeScript only, no linter/formatter for now
- Vitest configured for both mobile and server from the start

### Backend framework
- Hono (not Fastify from the original PLAN.md) — this is the resolved decision
- Node.js 22 LTS as the runtime (not Bun)
- Full route skeleton scaffolded as stubs: recipes, pantry, meal-plans, shopping, ai, voice endpoints
- Auth middleware and Supabase client setup included

### Supabase setup
- Local CLI for development (supabase init + supabase start)
- User already has a Supabase account — no account creation steps needed
- Only the profiles table created in Phase 1 (other tables added in their respective phases)
- Row Level Security enabled from day one on profiles (users can only read/update their own profile)

### Auth flow & screens
- Three login methods: email/password + Apple Sign In + Google Sign In
- Post-signup onboarding wizard: 2-3 screens collecting display name, household size, and basic preferences
- Auth tokens stored with expo-secure-store (iOS Keychain, encrypted) — requires dev client build, no Expo Go
- Warm and inviting visual design: food-themed imagery or illustration, warm colors (orange/amber), friendly copy

### Claude's Discretion
- Exact onboarding wizard screen count and layout
- Specific warm color palette choices
- Error state messaging and design
- Auth screen illustration/imagery selection
- Tab placeholder screen content
- Route stub implementation details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- PLAN.md provides a detailed project structure, data model, and API endpoint reference to follow
- CLAUDE.md contains validated tech stack research with version numbers and rationale

### Integration Points
- expo-router file-based routing for navigation (app/ directory)
- Supabase Auth for user management
- expo-secure-store for token persistence
- Hono server proxies all external API calls

</code_context>

<specifics>
## Specific Ideas

- Visual tone should feel like a kitchen/cooking app from the very first screen — warm and inviting, not sterile
- Onboarding should capture enough info (name, household size, basic preferences) to personalize the experience before the user even sees the home screen
- The app shell with all 5 tabs gives a sense of the full product vision even in Phase 1

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-project-setup-auth*
*Context gathered: 2026-04-10*
