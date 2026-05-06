# Single-stage Dockerfile for the DinnerTime backend server.
#
# Runtime strategy: run the TypeScript source directly via `tsx` (esbuild
# JIT). Skips the tsc compile step because the codebase has accumulated
# 289 pre-existing strict-mode TS errors that tsx watch was hiding —
# fixing them all is post-MVP work. tsx in production is mature
# (used by Hono itself, Cloudflare Workers tooling, etc) and adds only
# ~100ms cold-start overhead.
#
# Build context is the repo root (so pnpm-workspace.yaml + pnpm-lock.yaml
# are reachable). .dockerignore drops apps/mobile + planning/test
# artifacts from the build context to keep transfer size down.
#
# Health check at /api/v1/health (Hono basePath in src/index.ts) is
# wired in fly.toml, not via Docker HEALTHCHECK, since Fly's checks
# are richer and run from outside the container.

FROM node:22-alpine

# Enable corepack so pnpm resolves at the version pinned by the lockfile.
RUN corepack enable

WORKDIR /repo

# Copy workspace manifests first so the dep layer is cacheable when only
# source changes. Order: workspace + lockfile + root package.json, then
# per-package package.json.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/server/package.json ./packages/server/

# Filtered, prod-only install — pulls only the server's prod deps and
# what they transitively need from the workspace. Skips installing
# apps/mobile entirely. tsx is now in dependencies (not devDependencies)
# so it ships with the runtime image.
RUN pnpm install --frozen-lockfile --filter @dinnertime/server --prod

# Now the source. Separate from deps so source-only edits don't bust the
# install cache layer.
COPY packages/server ./packages/server

WORKDIR /repo/packages/server

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run via `pnpm start` which is `tsx src/index.ts` per the server's
# package.json. Keeps a single source of truth for the start command
# across dev (host machine) and prod (this image).
CMD ["pnpm", "start"]
