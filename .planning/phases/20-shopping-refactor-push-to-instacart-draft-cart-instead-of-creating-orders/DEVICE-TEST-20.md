---
phase: 20
device_test_version: 1
status: skeleton
created: 2026-04-22
---

# Phase 20 — Physical iPhone UAT Checklist

## Purpose

Simulator-only UAT (Maestro flow 29 in `apps/mobile/.maestro/29-shopping-draft-cart.yaml`, landed in 20-04) covers the sheet-state progression and fallback-to-WebBrowser paths on an iOS Simulator. What it **cannot** verify:

- **Universal-link routing to the real Instacart app** — the Simulator has no App Store and cannot install the Instacart binary, so the "if app installed, app opens; else Safari opens" branch is untestable there.
- **Items actually appearing as a pre-populated draft cart inside Instacart** — requires a real HTTPS round-trip landing on `www.instacart.com` with a logged-in cookie jar.
- **Feature-flag rollback on a live device** — the hidden Settings toggle must round-trip through AsyncStorage + persist rehydration across a real app restart.
- **Telemetry reaching `shopping_events` in production Supabase** — CI unit tests only exercise the client queue + server route; end-to-end data-flow requires the dev-client backend tunnel.

This doc is the manual gate before `/gsd:verify-work` declares the phase done. Pass every row, paste screenshots, then flip `status: passed` in the frontmatter.

## Required Device State

- iPhone 15 or newer, iOS 17+ (App Store supports Expo SDK 55 dev client out-of-the-box)
- Instacart app **installed and logged in** to a real account (sandbox accounts are fine — the `products_link_url` endpoint returns the same hosted page regardless of account tier)
- DinnerTime dev client installed (latest EAS build targeting `com.dinnertime.app`)
- Cloudflare tunnel URL copied into `apps/mobile/.env` as `EXPO_PUBLIC_API_URL=https://<tunnel>.trycloudflare.com` (see CLAUDE.md "Dev Environment Startup")
- Metro running with `--lan --clear` from `apps/mobile/` so the new API URL is picked up at bundle time
- iPhone on the **same WiFi network** as the Mac Mini (`192.168.4.x` range)
- At least one shopping list with 4+ items in DinnerTime (generate from a meal plan or add manually)

## Checklist

| ID            | Behavior                                                                 | Steps                                                                                                                                                                         | Expected                                                                                                                     | Pass? | Notes |
| ------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- | ----- |
| UNIVLINK-01   | Universal link opens Instacart **app** when installed                    | 1. Ensure Instacart app installed + logged in. 2. Open DinnerTime → Shopping tab. 3. Tap "Order on Instacart". 4. Wait for HandoffSheet success state. 5. Tap "Open in Instacart". | Instacart **app** launches (not Safari). Cart view shows the items from the DinnerTime shopping list (quantities + units match). | [ ]   |       |
| UNIVLINK-02   | Safari fallback when Instacart app **not** installed                     | 1. Delete Instacart app from iPhone. 2. Open DinnerTime → Shopping tab. 3. Tap "Order on Instacart". 4. Wait for success state. 5. Tap "Open in Instacart".                      | Safari View Controller (in-app) opens `www.instacart.com` with the shopping-list page populated. Items match.                 | [ ]   |       |
| HANDOFF-01    | Sheet state progression: sending → success                               | 1. Fresh HandoffSheet. 2. Observe spinner + "Sending to Instacart cart…". 3. Wait ~1-3s. 4. Observe success icon + "{N} items ready" with correct count.                         | Progression is smooth, copy matches UI-SPEC, item count matches unchecked list items.                                         | [ ]   |       |
| HANDOFF-02    | Error state: network variant + retry                                     | 1. Enable Airplane Mode. 2. Open DinnerTime → Shopping tab. 3. Tap "Order on Instacart". 4. Observe error state. 5. Tap "Try again".                                            | Error copy matches `network` variant. Retry attempt repeats the fetch (observable in Metro logs on the Mac).                   | [ ]   |       |
| ROLLBACK-01   | Hidden Settings toggle → legacy flow                                     | 1. Open Settings screen. 2. 5-tap the header (or whichever hidden gesture 20-04 wires). 3. Flip `Shopping handoff mode` to `legacy`. 4. Return to Shopping. 5. Tap "Order on Instacart". | **No** HandoffSheet mounts. Phase 8 inline WebBrowser (Safari View Controller) opens directly with the Instacart URL.          | [ ]   |       |
| TELEMETRY-01  | Events land in `shopping_events`                                         | 1. Complete one handoff end-to-end (sheet + Open). 2. Open Supabase SQL editor. 3. Run `SELECT event_type, payload, client_ts FROM shopping_events WHERE profile_id = '<your-uid>' ORDER BY client_ts DESC LIMIT 10;`. | At minimum: `shopping.draft_cart_started`, `shopping.draft_cart_succeeded`, `shopping.handoff_opened_app` (or `_web`). Payloads contain only whitelisted keys (no raw item names, no user names). | [ ]   |       |

## Reporting

Follow the Phase 16 DEVICE-TEST-16.md reporting format:

1. Take one screenshot per row showing the observed end state. Attach or inline them below each row's "Notes" cell.
2. If a row **fails**, paste the Metro log snippet + a plain-English description of the failure mode. Do not try to fix on-device — file a GSD deviation and let the relevant wave's executor pick it up.
3. When every row is `[x]` and screenshots are attached, change the frontmatter `status` from `skeleton` → `passed` and commit with message `docs(20-00): DEVICE-TEST-20 passed on <iPhone model / iOS version>`.
4. Link the device-test commit SHA in the Phase 20 verifier report so `/gsd:verify-work` can see the physical gate is green.

## Known Gotchas

- Tunnel URLs are **ephemeral** (see CLAUDE.md). If UAT starts and the tunnel from last session has rotated, `shopping_events` inserts will silently time out. Restart cloudflared, update `apps/mobile/.env`, and run Metro with `--clear` before trying again.
- The Instacart `products_link_url` has an `expires_in` window (30 days default). If the sheet is opened → dismissed → re-opened more than 30 days apart with the same durable order row, UNIVLINK-01 will 404. This is a Pitfall 5 scenario (see 20-RESEARCH.md); fresh orders always generate a fresh URL so no action needed — just don't debug stale-URL 404s as if they were handoff-code bugs.
- Camera/HEIC + photo-size gotchas from Phase 14 do not apply here (no new camera use).
