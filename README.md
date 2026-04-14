# DinnerTime

AI-powered iOS meal planning app that eliminates the cognitive load of deciding what to cook and buying groceries.

Open the fridge, take a photo, get dinner ideas -- zero mental effort from "what do we have?" to "what should we cook?"

## What It Does

- **Pantry scanning** -- Snap a photo of your fridge, pantry, or freezer. AI identifies what you have.
- **Dinner suggestions** -- Get personalized meal ideas based on what's actually in your kitchen.
- **Recipe import** -- Bring in recipes from URLs, cookbook photos, or manual entry.
- **Weekly meal planning** -- AI generates balanced dinner plans for the whole week.
- **Shopping lists + Instacart** -- Auto-generated grocery lists with one-tap Instacart ordering.
- **Voice cooking mode** -- Hands-free AI assistant that walks you through recipes step by step.
- **Skill progression** -- Gently nudges you toward more adventurous cooking as your confidence grows.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Expo (React Native) SDK 55, TypeScript |
| Navigation | expo-router (file-based) |
| State | Zustand + TanStack Query |
| Backend | Hono + Node.js 22 LTS |
| Database | Supabase (PostgreSQL + pgvector + Auth + Storage) |
| AI | Claude API (Anthropic) -- vision, planning, voice, suggestions |
| Voice | expo-speech-recognition (STT) + expo-speech (TTS) |
| Grocery | Instacart Developer Platform API |
| Monorepo | pnpm workspaces |

## Project Structure

```
DinnerTime/
├── apps/
│   └── mobile/          # Expo app (iOS-first)
├── packages/
│   └── server/          # Hono backend (API proxy for AI + external services)
├── supabase/            # Database config, migrations, seeds
└── .planning/           # Project planning artifacts
```

## Status

Early development -- planning and scaffolding phase. See `.planning/` for the full roadmap and project context.

## End-to-end testing (UAT)

UI flows are validated with [Maestro](https://maestro.mobile.dev) against the iOS Simulator. See [`apps/mobile/.maestro/README.md`](apps/mobile/.maestro/README.md) for setup and the flow inventory.

```
cd apps/mobile
.maestro/scripts/uat.sh boot      # boot iPhone 17 Pro sim
.maestro/scripts/uat.sh smoke     # run the smoke flow
.maestro/scripts/uat.sh all       # run every flow
```

## License

MIT -- see [LICENSE](LICENSE) for details.
