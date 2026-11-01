# Hafeza landing page: Cloudflare Pages + order + tracking

## Included in this package

- Direct browser GA4, Meta Pixel and TikTok Pixel. `trackingMode: 'direct'` keeps GTM unloaded to avoid duplicate tags. `trackingMode: 'gtm'` is available only when all tags/events are actually configured and published in that container.
- Same-origin `POST /api/order` through Cloudflare Pages `_worker.js`; the Worker forwards to the existing Muslim Abaya Apps Script. The order must return `Success|<id>` before the Thank You page shows or browser Lead fires.
- Optional Meta Conversions API `Lead` and TikTok Events API `SubmitForm` after successful order. Both use exactly the browser Lead event ID and event name/pixel ID required for deduplication. No server-side Purchase is fired here: the existing shop backend has a separate confirmed-order Purchase path.
- A first-party `ma_vid` cookie (90-day Max-Age request; browsers may shorten it) for hashed server-side external ID, plus `_fbp`, `_fbc`, phone, IP and user agent where available. Sensitive values are not logged by `_worker.js`.
- The browser sends the first-party cookie on the same-origin order request, so the Worker can derive the hashed external ID. Cross-origin Apps Script fallback omits browser credentials.
- Cloudflare Worker logs one `lead_delivery` result. An optional D1 binding enables `tracking-status.html`: 24-hour per-site Lead counts and recent Meta/TikTok server delivery statuses, refreshed every 15 seconds.

## Cloudflare Pages deployment

Upload the CONTENTS of `client_builder_pro` to a separate Pages project; `_worker.js` must be at its output root next to `index.html`. Dashboard drag-and-drop and Git deployment both support `_worker.js`. Do not place the landing project in the existing `luxury-dress-bd` store project. Add `hafeza.muslimabaya.com` under the new project's Custom domains.

In Pages project → Settings → Variables and Secrets, add **production** values before the next deployment:

| Variable | Kind | Purpose |
| --- | --- | --- |
| `ORDER_API_URL` | Text | Current `site-api-config.js` Apps Script `/exec` URL. A public fallback matching the reviewed repository is in `_worker.js`, but an explicit value is safer when redeployed. |
| `META_PIXEL_ID` | Text | ID of the same Pixel as `config.js` → `marketing.metaPixelId`. |
| `META_CAPI_TOKEN` | Encrypted secret | Meta Events Manager Conversions API access token. |
| `TIKTOK_PIXEL_ID` | Text | Same Pixel Code as `config.js` → `marketing.tiktokPixelId`. |
| `TIKTOK_ACCESS_TOKEN` | Encrypted secret | TikTok Events API access token. |
| `TRACKING_DASHBOARD_TOKEN` | Encrypted secret | A long random password for the private status API. |

To activate the optional dashboard, create a Cloudflare D1 database, run the SQL below in its console, then add a Pages D1 binding named `TRACKING_DB` for production. The binding name must match exactly. The dashboard is at `/tracking-status.html` and asks for `TRACKING_DASHBOARD_TOKEN` each visit. Do not publish that token or use an ad account token for it. Without D1 the worker still writes status to Cloudflare logs.

```sql
CREATE TABLE IF NOT EXISTS tracking_events (
  event_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, site TEXT NOT NULL,
  value REAL NOT NULL, meta_status TEXT NOT NULL, tiktok_status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tracking_events_time ON tracking_events(created_at);
```

Never put tokens into `config.js`, GitHub or a public ZIP. Missing token/ID disables only that CAPI destination; orders still submit. After saving variables, deploy again so the Worker receives them. Browser GA4 ID, Meta Pixel ID and TikTok Pixel ID still require verification in their respective accounts.

## Controlled verification after deploy

1. Open the Pages preview and `hafeza.muslimabaya.com`; verify site and `ma_vid` cookie. Confirm the correct domain is attached to the separate Pages project.
2. Check browser pixel PageView, ViewContent, AddToCart and InitiateCheckout in each provider's test/debug tools. Direct mode must not load GTM.
3. Place one controlled order only after checking whether the Apps Script auto-courier mode is enabled. Confirm `Online Order` sheet, Admin Dashboard, and Thank You order ID agree.
4. Check browser Meta Lead / TikTok SubmitForm and Cloudflare Workers logs `lead_delivery`. Check Meta/TikTok server Test Events and deduplication with matching event ID. The Worker logs statuses, not tokens or contact details. If D1 is configured, open the protected tracking status page and confirm the new event appears.
5. Verify GA4 `generate_lead` in DebugView and the Measurement ID in the intended web data stream.

## Still dependent on account setup

The package cannot create Meta/TikTok access tokens, verify Pixel ownership, publish GTM container tags, provision a server-side GTM tagging URL, or activate the included dashboard without a D1 binding and dashboard secret. The 90-day first-party cookie does not extend Meta/TikTok cookies. Server-side catalog price/stock validation is not in the existing Apps Script and remains necessary before automated payment/fulfillment.
