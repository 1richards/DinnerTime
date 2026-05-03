# Instacart Integration — Root Cause

**Investigated:** 2026-05-03
**Status:** ✅ root cause identified — no server/mobile code changes needed yet

## TL;DR

**Instacart "doesn't work" because the API key is empty in `.env`.** The integration code is fully built end-to-end; it has just been silently running through the stub path because `process.env.INSTACART_API_KEY === ""` evaluates falsy.

## What's currently happening

1. `.env` has `INSTACART_API_KEY=` (declared, empty value)
2. Server boot: `process.env.INSTACART_API_KEY` is `""`
3. Factory: `services/instacart.ts:66-72`
   ```ts
   if (!apiKey) return new StubInstacartClient();
   ```
   `""` is falsy → `StubInstacartClient` is returned
4. Stub `createShoppingListPage` returns:
   ```
   https://example.com/stub-instacart/<slug>
   ```
5. Mobile cart icon → server returns the example.com URL → `HandoffSheet` calls `WebBrowser.openBrowserAsync(...)` → Safari opens **`example.com`** (the IANA placeholder page), NOT Instacart.

That's the entire bug. Probably manifested to the user as "tap cart, it opens but shows the wrong site" or "shows nothing useful."

## Direct probe evidence

Hit Instacart's API directly with the configured key:

| Base URL | HTTP | Body |
|---|---|---|
| `https://connect.dev.instacart.tools` (sandbox default) | **401** | `{"error":{"message":"Unauthorized"...}}` |
| `https://connect.instacart.com` (prod) | **401** | `{"error":{"message":"Unauthorized"...}}` |

Both return 401 because `Authorization: Bearer ` has no token (empty key).

Inspected `.env` shape (no value leak):
```
Line: INSTACART_API_KEY=...[0 chars after =]
```

## What's NOT broken

- `packages/server/src/services/instacart.ts` — Real client posts to `/idp/v1/products/products_link` with the documented Developer Platform shape (`title`, `link_type: 'shopping_list'`, `expires_in`, `line_items`, optional `landing_page_configuration.partner_linkback_url`). Looks correct vs. https://docs.instacart.com/developer_platform_api/.
- `packages/server/src/routes/shopping.ts` (createOrder handler) — Builds line items with smart spice/condiment quantity suppression, calls factory, surfaces 502 on Instacart errors, persists `shopping_orders` row with the URL.
- Mobile `HandoffSheet` + `openInstacartCart` — Open `WebBrowser.openBrowserAsync(url)` against whatever URL the server returns. Will work as soon as the server returns a real Instacart URL.

## What's needed to make it work

1. **Get an Instacart Developer Platform API key.** Sign up at https://docs.instacart.com/developer_platform_api/. Their free tier is the "Connect" sandbox.
2. **Decide environment:**
   - **Sandbox (recommended for v1 launch)** → `connect.dev.instacart.tools` (current default in code). Instacart's sandbox simulates the cart-creation flow, returns real-looking URLs, and is fine for end-user TestFlight testing because the URL still opens a working Instacart preview page.
   - **Production** → `connect.instacart.com`. Set `INSTACART_BASE_URL` env var, and your key must be a production-issued key (Instacart issues sandbox + prod keys separately).
3. **Put the key in `.env` (root):**
   ```
   INSTACART_API_KEY=<your-key>
   # optional (defaults to sandbox):
   # INSTACART_BASE_URL=https://connect.instacart.com
   ```
4. **Restart server.** Hot-reload via tsx watch picks up env changes on file save, but a full restart is safer.
5. **Re-run the probe** to confirm 200:
   ```bash
   set -a && source .env && set +a && \
   curl -sS -X POST "${INSTACART_BASE_URL:-https://connect.dev.instacart.tools}/idp/v1/products/products_link" \
     -H "Authorization: Bearer $INSTACART_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"title":"DinnerTime smoke","link_type":"shopping_list","expires_in":1,"line_items":[{"name":"yellow onion"}]}'
   ```
   Expect HTTP 200 + a `products_link_url` in the body.
6. **Re-run Maestro flow** `apps/mobile/.maestro/29-shopping-draft-cart-handoff.yaml` to verify the mobile path end-to-end.

## Open questions for downstream investigation (only if step 6 fails)

- Pantry-subtraction over-aggressiveness — `services/shopping.ts:subtractPantry` might zero out items the user actually needs to buy if pantry quantities are stale. (Documented as a hypothesis in HANDOFF-NEXT-SESSION.md.) Re-test after key fix.
- `landing_page_configuration.partner_linkback_url: 'dinnertime://shopping/done'` — verify Instacart doesn't reject the deep-link scheme; their sandbox sometimes only accepts `https://`.
- Universal-link return path (`dinnertime://shopping/done`) is registered in `app.json`'s `associatedDomains` but the actual `/.well-known/apple-app-site-association` file is on the api.dinnertime.app side — Phase 25 deployment work.
