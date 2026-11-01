# Speed update — 2 October 2026

## Identified in the uploaded code
The site router awaited five separate script loads after config/router download: site override, theme, SEO, tracking, app. This created a network waterfall before checkout became interactive. Gallery display used full-size files, and the review carousel ran its interval and layout measurements even below the viewport.

## Changes
- Preload a content-hashed runtime bundle from HTML. The router still awaits the site override before running theme → SEO → tracking → app, preserving configuration and tracking order. Two awaited loads replace five; bytes can arrive before execution is needed. Thank-you has its own smaller bundle.
- Only content-hashed runtime files receive long immutable caching. Editable files retain revalidation.
- Added 768px WebP display versions of the eight built-in gallery images: 986,820 bytes combined originals → 684,526 bytes display versions (30.6% reduction). The first image is 137,358 → 94,832 bytes. This is an image-byte reduction, NOT a measured page-load-time reduction.
- Gallery preload and initial image use the same smaller URL to avoid downloading two sizes on first paint. Built-in product-card images also reuse display versions. Zoom/lightbox retains full original images. Custom images keep their original paths.
- Gallery/review autoplay pauses outside the viewport and resumes when visible. No autoplay setting is disabled. Browsers without IntersectionObserver keep the original behavior.

## Preserved
Config.js, styles.css and tracking.js are byte-for-byte unchanged from the supplied ZIP. All original files remain. 3D, autoplay, side previews, thumbnail navigation, swipe, zoom, reviews, builder, order mode, prices, tracking IDs and API behavior remain configured as supplied.

## Deployment
Upload/commit all updated files including images/display, generated runtime-*.js, index.html, thank-you.html, site-router.js, _worker.js and _headers. Replace the old project contents as a complete release. No npm install is needed for this ZIP.

After future edits to JS source or config/site settings, run `node build-seo.cjs` and commit the generated HTML, Worker and runtime files together. It also invokes build-runtime.cjs. Do not manually edit generated runtime files. Previously named runtime files are regenerated as source changes.

## Verification / limits
13 existing/updated regression checks pass, including delayed site configuration, builder/thank-you loading, bundle source order, static SEO, checkout validation, duplicate-submit protection and mocked upstream success/failure. JavaScript syntax checks pass. Original file inventory and unchanged design/config/tracking were checked.

This is a source-level optimization, not a live Lighthouse result. No browser visual/mobile benchmark or production TTFB, network trace, Apps Script response timing, analytics delivery or real order was tested. Live URL and deployed version are needed to determine whether any remaining delay is page loading, animation, network or order-backend response. No guaranteed PageSpeed score or load time is claimed.

## Final merge — 2 October 2026 (additions)
- `_routes.json` (new): images/CSS/JS are served by Cloudflare directly and no longer pass through the Worker. The Worker runs only for `/`, `/index.html`, `/api/*`, robots/sitemap, admin, tracking-status and thank-you.
- `styles.css`: a `SPEED` block at the end disables backdrop-blur and the large decorative glow on phones (<=820px / touch). Delete that block to restore the original look.
- Images (`/assets`, `/images`, `/reviews`): cache 1 day -> 7 days with background refresh (`_headers` and `_worker.js`). Use a NEW file name when replacing an image.
- Unchanged: tracking.js (pixels load as in the supplied version), config.js, JS source, runtime bundles (hashes identical), 13 regression tests pass.
- Not tested here: real browser rendering, Lighthouse, live orders. After deploy check phone view, order form and the Google Sheet entry.

## Logo size — 2 October 2026
- `styles.css` (end of file, `LOGO` block): header logo 40px -> 56px (50px on phones); footer logo 46-56px -> 112px (96px on phones) with a soft shadow. Checked in a browser at 1280px and 390px widths: no horizontal scroll, layout intact. Delete the `LOGO` block to restore the old sizes.
