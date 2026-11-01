# Bug fixes, SEO and optimization — 29 September 2026

## Changes
- Deterministic site configuration loading: the site override finishes before theme, SEO, tracking and checkout initialization. The thank-you page uses the same site configuration.
- Builder previews preserve draft settings, do not load ad pixels and cannot submit real orders.
- In-flight order lock prevents repeat submissions even if form fields change. Conversion items are captured with the submitted order.
- Restored cart quantities are whole numbers; removed/invalid sizes cannot pass checkout validation.
- Forward the actual honeypot and reject invalid basic order fields at the Cloudflare proxy. Longer random event IDs reduce accidental collisions.
- Static product copy, prices and features; matching Product JSON-LD, Twitter cards, canonical URLs, and host-aware robots/sitemap. Cloudflare supplies per-site social metadata before JavaScript runs.
- Added a real 404 page. Preview and utility pages receive noindex signals.
- Removed unconditional third-party preconnects. Existing analytics IDs remain configured for live pages.
- Seven review images use WebP: 440,007 → 293,888 bytes (33.2% smaller combined). Original JPEGs remain for compatibility; current config uses WebP.
- Decorative gallery previews reuse small existing thumbnails. Custom images retain their original URL.
- Removed inline thumbnail error JavaScript; added lightbox keyboard focus wrapping and prevented slideshow playback while it is open.
- Unversioned assets revalidate instead of retaining an immutable one-year logo cache. Worker applies relevant headers directly.
- Purchase tracking now requires an explicit true setting; current false setting is preserved.

## Verification
- 12 automated regression checks: delayed script loading, preview/thank-you initialization, crawlable content/schema, image paths, order input rejection, valid mock order, upstream failure, per-host sitemap/robots, per-site SEO rewrite handlers, redirect, basket totals/size checks, and duplicate-submit lock.
- JavaScript syntax checks passed.
- No real order or advertising conversion was sent.
- Full browser visual/mobile testing and Lighthouse could not run because the Chromium download returned an invalid archive. No PageSpeed score or search ranking is claimed.
- Live Apps Script/Google Sheet delivery and Cloudflare's deployed HTMLRewriter runtime have not been tested. The tests use mocked upstream requests and rewrite handlers.

## Deploy and maintain
1. Upload the ZIP contents to the existing **Cloudflare Pages** project, keeping index.html and _worker.js at the project root. The default /api/order depends on this Worker; this ZIP does not add a Netlify order function.
2. Keep existing ORDER_API_URL and tracking secrets/settings. No credentials were added to client code.
3. After changing config.js or sites/*.js, run `node build-seo.cjs` from this folder. It updates index.html, robots.txt, sitemap.xml and the embedded Worker metadata. No build is needed for this supplied version.
4. Optional reproducible checks: `node tests/regression.cjs` (Node 18+).
5. After deployment, check an actual phone/desktop browser, the order flow and the received Google Sheet entry. Check sitemap.xml and submit the production URL to Search Console.

Limits: the external Apps Script source is not included. Its server-side price/stock validation and retry/idempotency behavior cannot be verified here. The frontend total must not be treated as authoritative by that backend. Unknown subdomains fall back to the default configuration. This is a tested set of fixes, not a guarantee that every possible bug is eliminated.

References used:
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.cloudflare.com/pages/configuration/headers/

## Fake Orders matching update
The latest user-uploaded archive is the baseline. Original glass3d, autoplay and side preview remain enabled. Touch gestures now distinguish horizontal swipes from vertical scrolling; touch targets are at least 44px, and zoom sits below the price badge. See FAKE-ORDERS-INTEGRATION.md for the separate Apps Script file, scheduled reconciliation setup, verification and limits.
