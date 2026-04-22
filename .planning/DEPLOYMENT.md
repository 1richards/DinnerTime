# DEPLOYMENT.md — Backend Production Runbook

**Audience:** Patrick (human executor).
**Purpose:** One-time migration of the DinnerTime backend from local-dev (`packages/server` on laptop + Cloudflare tunnel) to a production Fly.io-hosted HTTPS service at `api.dinnertime.app`.
**Cross-links:** [RELEASE.md](./RELEASE.md) (mobile release flow), [BETA-PLAYBOOK.md](./BETA-PLAYBOOK.md) (beta user tracking).
**Addresses:** BETA-17, BETA-22, BETA-23.

---

## 1. Why Fly.io

Fly.io is the recommended host for DinnerTime's backend:

| Dimension | Fly.io | Railway (alternative) |
|---|---|---|
| Cost at our scale | $5–10/mo (`shared-cpu-1x`, 256MB) | $5/mo base + metered |
| Global edge | Yes — 30+ regions | No — single region per deploy |
| HTTPS | Automatic cert via Let's Encrypt | Automatic |
| Custom domain | `fly certs create api.dinnertime.app` | UI-clicked CNAME |
| Node 22 support | Native | Native |
| Container model | Dockerfile (explicit, portable) | Nixpacks / Dockerfile |
| Secrets UX | `fly secrets set` CLI | Dashboard UI |
| Deploy triggering | `fly deploy` from laptop | Git push |
| DinnerTime fit | Strong — stateless proxy, regions matter for latency to Claude + Instacart | Also fine for MVP; simpler UI if you hate Docker |

**Recommendation: Fly.io.** The rest of this doc uses Fly.io commands. The env-var list in § 6 applies identically to Railway — only the CLI commands differ.

---

## 2. Prereqs (one-time)

Run each step once per laptop:

```bash
# Install flyctl
brew install flyctl

# Create account + billing (requires card on file; Fly.io's "Hobby" plan is pay-as-you-go)
fly auth signup
# OR if you already have an account:
fly auth login

# Create the Fly app (empty shell; first deploy populates it)
fly apps create dinnertime-api
```

**Decide domain now:**
- **Default:** `https://dinnertime-api.fly.dev` — works out of the box, no DNS setup.
- **Custom:** `https://api.dinnertime.app` — see § 9 below. Required before shipping a production mobile build (mobile app's EAS production profile has `EXPO_PUBLIC_API_URL=https://api.dinnertime.app` bundle-inlined).

For first deploy you can use the default and flip DNS later — but every mobile build between flips will talk to the wrong host. Prefer to set up the custom domain **before** Mobile's first TestFlight cut.

---

## 3. Server prep (verify before deploy)

Run these three grep commands to confirm the server is deployable. Each should print a match.

```bash
# Health check endpoint exists (required for fly.toml http_check)
grep -n "'/api/v1/health'" /Users/patrickrichards/DinnerTime/packages/server/src/index.ts

# CORS middleware is mounted (required so mobile app from a different origin can call)
grep -n "cors(" /Users/patrickrichards/DinnerTime/packages/server/src/index.ts

# Server respects PORT env var (fly.toml exposes port 3000 → internal_port 3000; server must bind it)
grep -rn "process.env.PORT\|env.PORT" /Users/patrickrichards/DinnerTime/packages/server/src/index.ts
```

If any of these miss, patch them (trivial) before continuing. The Hono app factory already supports all three — the only risk is a regression.

---

## 4. Dockerfile

Create `packages/server/Dockerfile` with this exact content:

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --filter @dinnertime/server...

FROM base AS build
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm --filter @dinnertime/server build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/packages/server/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Caveat for Patrick:** `packages/server` is `tsx`-only in dev — it may not have a `build` script yet. If `pnpm --filter @dinnertime/server build` fails with "script not found", first add a build script to `packages/server/package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  }
}
```

Ensure `packages/server/tsconfig.json` has `"outDir": "./dist"` and emits. Run `pnpm --filter @dinnertime/server build` locally once to confirm `dist/index.js` is produced before the first Fly deploy.

---

## 5. fly.toml

Create `packages/server/fly.toml` with this exact content:

```toml
app = "dinnertime-api"
primary_region = "sea"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"
  NODE_ENV = "production"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.http_checks]]
    interval = "30s"
    timeout = "5s"
    method = "get"
    path = "/api/v1/health"
```

`primary_region = "sea"` (Seattle) is close to Patrick's Mac Mini host and has low Anthropic API latency. Change to `lhr`/`iad`/etc. if you move — see § 12 Open questions.

---

## 6. Env var migration (BETA-23)

The backend reads all secrets from the root `.env`. Production needs them in Fly.io's secret store. Some keys must be **rotated** (dev stays on laptop, prod gets a fresh key); others can be reused.

| Env var | Source | prod-rotate | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | yes | Issue a new key labeled `dinnertime-prod`. Dev key stays on laptop. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | aistudio.google.com → Get API key | yes | Only if Gemini is in use (Phase 11 hybrid AI client). Fresh key for prod. |
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API | no | Same project as dev — single Supabase DB. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API | yes | Re-issue via "Reset service_role key" in dashboard. Update laptop `.env` with the new key afterward. |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API | no | Public by design (the mobile app bundles this). |
| `INSTACART_API_KEY` | developer.instacart.com → Dashboard | yes | Prod key, not sandbox. Sandbox stays on laptop. |
| `SENTRY_DSN` | sentry.io → Project Settings → Client Keys | no | Same project; set `SENTRY_ENVIRONMENT=production` (see below) to tag events per env. |
| `ADMIN_EMAILS` | hand-rolled | n/a | `patrickrrichards@gmail.com` — controls `/admin/*` route allowlist. |

After gathering the prod values, paste them one at a time:

```bash
cd /Users/patrickrichards/DinnerTime/packages/server

fly secrets set ANTHROPIC_API_KEY="sk-ant-<prod-key>"
fly secrets set GOOGLE_GENERATIVE_AI_API_KEY="<prod-google-key>"
fly secrets set SUPABASE_URL="https://<project>.supabase.co"
fly secrets set SUPABASE_SERVICE_ROLE_KEY="<prod-service-role>"
fly secrets set SUPABASE_ANON_KEY="<anon-key>"
fly secrets set INSTACART_API_KEY="<prod-instacart-key>"
fly secrets set SENTRY_DSN="https://<public>@<org>.ingest.sentry.io/<project>"
fly secrets set SENTRY_ENVIRONMENT="production"
fly secrets set ADMIN_EMAILS="patrickrrichards@gmail.com"
```

**Setting secrets before the first deploy is fine** — Fly.io stores them immediately; they're injected into the container on first start. Verify with:

```bash
fly secrets list
# Should show 9 entries with digests (actual values hidden)
```

---

## 7. Database migrations

DinnerTime uses a shared Supabase project — **no prod-only migration run**. But before the first deploy, make sure every migration on `main` has been applied to the linked Supabase project:

```bash
cd /Users/patrickrichards/DinnerTime

# Apply any pending migrations
supabase db push --linked

# Confirm zero diff
supabase db diff --linked
# Expected: "No changes detected"
```

**Critical for Phase 25:** migrations `00029_beta_invites.sql` and `00030_feedback_submissions.sql` (shipped in 25-00) must be applied before the first prod deploy, or the BETA-PLAYBOOK.md SQL queries will fail against a table that doesn't exist yet.

---

## 8. Deploy

First-time deploy:

```bash
cd /Users/patrickrichards/DinnerTime/packages/server
fly deploy
```

Expected output: ~3–5 min build + push + machine start. Watch for `v0 deployed successfully`.

Verify:

```bash
# App status — should show 1 machine in "started" state
fly status

# Health check — should return {"status":"ok"}
curl https://dinnertime-api.fly.dev/api/v1/health
```

Streaming logs while you verify:

```bash
fly logs
```

Expect a startup banner, then CORS + Hono readiness messages. Any `Missing required environment variable` error means a `fly secrets set` step from § 6 was missed — fix and re-run `fly deploy`.

---

## 9. Custom domain (optional but recommended)

Only required if you want `https://api.dinnertime.app` instead of `https://dinnertime-api.fly.dev`. Required for production mobile builds (the EAS production profile points at `api.dinnertime.app`).

```bash
# Issue a cert (Fly.io uses Let's Encrypt)
fly certs create api.dinnertime.app

# Fly prints a CNAME target. Example:
# "Add this CNAME: api.dinnertime.app -> dinnertime-api.fly.dev"
```

Add the CNAME at your DNS provider (Cloudflare / Namecheap / wherever `dinnertime.app` is registered):

```
api.dinnertime.app  CNAME  dinnertime-api.fly.dev
```

Wait 1–5 min for DNS propagation + cert issuance, then:

```bash
# Cert status should say "Ready"
fly certs show api.dinnertime.app

# Final smoke
curl https://api.dinnertime.app/api/v1/health
```

**Hosting PRIVACY.md + TERMS.md (ASC requirement):** While you're at DNS, set up static hosting for the legal pages at `https://dinnertime.app/privacy` and `https://dinnertime.app/terms` — see [RELEASE.md](./RELEASE.md) § 9 Open questions. Cheapest approach: GitHub Pages on a marketing repo, or Cloudflare Pages pointing at `apps/mobile/PRIVACY.md` + `TERMS.md` rendered as HTML.

---

## 10. Post-deploy smoke

From your physical iPhone with a production dev-client install (see [RELEASE.md](./RELEASE.md) § 5):

1. Launch DinnerTime.
2. Sign in (or sign up — this is a good moment to test fresh onboarding).
3. Take a pantry photo via `/scan` → confirm items populate (exercises Supabase Storage + Claude vision + backend proxy).
4. Open `/suggest` → generate suggestions (exercises Anthropic + prompts).
5. Open `/plan` → add a recipe to a day (exercises mealPlans router).
6. Open `/shopping` → generate list → confirm Instacart handoff opens (exercises Instacart router).
7. Open Settings → Send feedback → submit test feedback.
8. Back on laptop:
   ```sql
   select id, profile_id, length(message) as msg_len, created_at
   from public.feedback_submissions
   order by created_at desc
   limit 5;
   ```
   Confirm the test feedback row exists and `profile_id` is your auth.users ID (NOT anon).
9. Check Sentry → `DinnerTime-server` project → confirm zero unhandled exceptions for today's release.

All 9 steps green = prod backend is live.

---

## 11. Rollback

**Fast path (secret typo or one-line bug):** `fly secrets set KEY=VALUE` + `fly deploy` re-runs in ~30s — usually faster than a formal rollback.

**Formal rollback (bad code in a deploy):**

```bash
# List recent releases
fly releases list

# Output shows:
#   VERSION  STATUS    DEPLOYED   DESCRIPTION
#   v5       complete  2m ago     deploy
#   v4       complete  1h ago     deploy
#   v3       complete  3h ago     deploy

# Roll back to the prior known-good version
fly releases rollback v4
```

Fly.io boots a new machine from the v4 image. Same command can roll forward again if needed.

**Note on DB migrations:** Rolling back the Fly app does NOT roll back Supabase migrations. If a migration is the problem, create a new migration that reverses it and apply via `supabase db push --linked`. Do not `supabase db reset` against prod.

---

## 12. Open questions (Patrick decides at execution)

- [ ] **Fly.io region** — default `sea` (Seattle). Alternatives: `iad` (Virginia, closer to most US testers), `lhr` (London, if European testers join later). Multi-region is out of scope for MVP — pick one and ship. See `fly platform regions`.
- [ ] **Custom domain vs .fly.dev** — recommend custom (`api.dinnertime.app`) before first production TestFlight, since EAS production profile bakes this URL into the bundle and changing it means a new mobile release.
- [ ] **Backup / DR** — Supabase handles DB backups (daily in Pro tier; free tier has 7-day recovery window). The Fly app is stateless (no volumes), so app-level rollback is enough. If you move beyond beta, enable Supabase Point-in-Time Recovery.
- [ ] **Autoscaling** — default is 1 machine. Fine for private beta. If a tester cluster pushes concurrent usage, `fly scale count 2` spins up a second machine in the same region.
- [ ] **Log retention** — `fly logs` is streaming-only. For persistent logs, ship to Sentry breadcrumbs (already wired via `@sentry/node` in 23-06) or wire to Axiom/Logtail later.

---

**Last updated:** 2026-04-22 (Phase 25 Plan 25-02).
**Owner:** Patrick.
**Next review:** After first successful production deploy.
**See also:** [RELEASE.md](./RELEASE.md) for the mobile release flow that points at the backend deployed here.
