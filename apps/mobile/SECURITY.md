# Mobile Security Invariants

**Last audited:** 2026-04-22 (Phase 23-07, NFR-22 / NFR-23 / NFR-24 / NFR-25)

This file documents the security-relevant configuration in `app.json` and
`src/` so future changes are reviewed against a written bar. Do not relax
any of these without a new security audit.

## NFR-22 — Keychain storage for sensitive tokens

**Status:** compliant.

All Supabase auth tokens (access + refresh) flow through
`apps/mobile/src/lib/supabase.ts` via the `LargeSecureStore` adapter, which
reads/writes `expo-secure-store` (backed by iOS Keychain). The simulator
gracefully falls back to AsyncStorage when Keychain isn't available — this
is expected and documented in CLAUDE.md.

No other sensitive tokens exist in the app:

- **Anthropic API key** — backend-only (`packages/server/.env`), never
  transits the mobile app.
- **Google Gemini API key** — backend-only.
- **Instacart** — anonymous link-based flow, no tokens stored on device.
- **Sentry DSN** — public by design (write-only ingestion URL).

## NFR-23 — HTTPS-only network policy

**Status:** compliant.

`app.json`'s `ios.infoPlist.NSAppTransportSecurity` block sets:

- `NSAllowsArbitraryLoads` — **ABSENT** (default `false`). iOS enforces
  HTTPS-only for every outbound request.
- `NSAllowsLocalNetworking` — **`true`**. Allows Metro dev bundler on
  `http://localhost:8081` and local backend on `http://localhost:3000` in
  dev builds only. Does NOT weaken HTTPS enforcement for any other host.
- `NSExceptionDomains` — empty object. No per-domain HTTP exceptions.

**Invariant:** never add `NSAllowsArbitraryLoads: true`. If a specific
production host requires an exception (it shouldn't), add a narrow
`NSExceptionDomains` entry with justification in this file.

## NFR-24 — Deep-link allowlist

**Status:** compliant — enforced at runtime in `_layout.tsx`.

`apps/mobile/src/lib/deepLinkAllowlist.ts` gates every incoming URL.
Allowed paths: `/recipes/*`, `/scan/*`, `/auth/reset-password/*`,
`/plan/*`, `/settings/*`, and root `/`. Everything else — arbitrary paths,
`javascript:` URIs, `..` path-traversal attempts — is rejected silently
with a Sentry breadcrumb.

Both warm-foreground (`Linking.addEventListener('url')`) and cold-boot
(`Linking.getInitialURL`) paths consult the allowlist.

## NFR-25 — PII hygiene in logs

**Status:** compliant (2026-04-22 audit).

- All `console.log` calls in `apps/mobile/src` are wrapped in `if (__DEV__)`
  so they compile out of production bundles.
- Server-side logs (`packages/server`) emit IDs and counts only — no
  emails, passwords, tokens, transcripts, prompts, or display names.
  Request-logging middleware shipped in 23-06 already enforces this.
- Sentry events go through `beforeSend` in `apps/mobile/src/lib/sentry.ts`
  which strips `email|password|token|transcript|raw_query|prompt|
  display_name|name` keys (case-insensitive substring match) from extras
  and contexts before transmission.

**Grep invariant:**

```bash
grep -rn 'console\.log' apps/mobile/src --include='*.ts' --include='*.tsx' \
  | grep -v '__DEV__' \
  | grep -v '// eslint-disable'
```

Should return at most one match (the multi-line `sse-smoke.ts` false
positive where `if (__DEV__)` is on the preceding line).

## Universal-link associated domains

`app.json`'s `ios.associatedDomains: ["applinks:dinnertime.app"]` is
declared but the apex-domain AASA (Apple App Site Association) file is
deferred to Phase 25 launch prep. Until then, universal-link behaviour
falls back to the custom `dinnertime://` scheme.
