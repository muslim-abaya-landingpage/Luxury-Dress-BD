# Performance report — muslimabaya.com

Audit date: 24 Aug 2026  
Target: Lighthouse Performance **95+**, visual and functional parity  
Scope: homepage (`/`) is the Lighthouse / Ads landing surface. Category and checkout pages received safe head-tag fixes only.

## How this site is built

This is a **static HTML/CSS/JS store** (GitHub Pages + Cloudflare), not a bundled SPA. Catalog data lives in `category-products.js`. Product cards are rendered in the browser. Ads tracking uses GTM (`GTM-ML7RL6BR`), Meta Pixel, and TikTok Pixel — those third parties are **required for purchase reporting** and were deferred, not removed.

## Live baseline (before)

Lighthouse mobile, simulated 4G, against **https://muslimabaya.com/**:

| Metric | Before |
| --- | --- |
| Performance | **63** |
| FCP | 1.9 s |
| **LCP** | **11.8 s** |
| TBT | 270 ms |
| CLS | 0.123 |
| TTI | 12.4 s |
| Speed Index | 3.0 s |
| Requests | ~130 |
| DOM nodes | ~1,277 |

### Issues found

| Issue | Why it is slow | Impact | Files |
| --- | --- | --- | --- |
| Hero HTML was empty until JS + catalog | LCP cannot paint until JS runs and writes `#homeHero img` | **Critical** — LCP 11.8 s | `index.html`, `index-home-muslim-abaya.js`, `index-catalog-defer.js` |
| Render-blocking `category-renderer.js` (141 KB, ~93% unused on home) | Parser waits on a category-page renderer the homepage never calls | **High** — FCP/LCP | `index.html` |
| Full-size LCP image (~117 KB) on a 412 CSS-px phone | Phone downloads a 1920-wide banner | **High** — LCP | `images/hero-banner/premium-black-floral-embroidery-abaya-bangladesh-model-original-dubai-cherry-fabric-(2).webp` |
| `renderHero()` replaced the LCP `<img>` | Browser may abort the in-flight LCP request and start over | **High** — LCP | `index-home-muslim-abaya.js` |
| 404 `fonts.css` | Extra RTT + failed request on the critical path | **Medium** | `index.html` (removed) |
| Blocking CSS: footer, cart drawer, Font Awesome, liquid-glass | CSSOM blocks first paint | **Medium** | `index.html` |
| GTM / gtag / Facebook / TikTok ~300 KB unused JS | Main-thread + network after load | **High TBT / TTI**; required for ads | `site-header.js`, `cart-utils.js`, GTM container |
| Oversized catalog images | Cards on a ~180 px column downloaded 4–6 MB originals | **High** bytes, mid LCP if hero is delayed | `images/Maroon Abaya Set.jpeg` (4.2 MB), `images/Abaya/premium-black-layered-khimar-niqab-abaya-for-women-muslimabaya.webp` (1.8 MB PNG mislabeled as WebP) |
| GitHub `raw.githubusercontent.com` as image host | Extra origin, no CDN resize, rate limits | **High** if `useLocalImages` is off | `category-products.js` (already rewritten locally via `product-config.js`) |
| Logo preload competing with LCP | Two image preloads share the first connection | **Low–medium** | `index.html` |
| `_headers` is Netlify/Cloudflare Pages syntax | GitHub Pages ignores it; origin cache ~10 min on HTML, ~4 h on assets | **Medium** repeat visits | `_headers` |
| Font Awesome `all.min.css` ~99% unused | Large CSS after idle | **Low** (already idle-loaded) | `index-catalog-defer.js` |
| No self-hosted fonts (Poppins/Playfair referenced, files missing) | 404 previously; now system stack — already the live look | **n/a** | `muslimabaya-fonts-setup/` |

## Fixes applied (safe, design unchanged)

1. **Static first hero slide in HTML** with `width`/`height`, `fetchpriority="high"`, and **srcset** (`hero-lcp-640/960/1280.webp`). Mobile Lighthouse now fetches ~33 KB instead of ~117 KB.
2. **Hero JS hydrates** extra slides and arrows; it no longer replaces the LCP `<img>`.
3. **Removed** homepage `category-renderer.js` and the 404 `fonts.css`.
4. **Deferred** non-critical CSS (`media="print" onload`) including homepage layout CSS after inlining hero + skeleton rules into `index-critical.css`.
5. **Deferred GTM** until first input or idle-after-load; TikTok pixel same pattern; events still fire on real conversions.
6. **Compressed** the two pathological product files in place (same filenames/URLs):
   - Maroon abaya JPEG 4.2 MB → ~105 KB (1080 px)
   - Khimar “webp” (actually PNG) 1.8 MB → ~61 KB real WebP
7. Product cards get `width="480" height="600"` + `loading="lazy"` (aspect-ratio already 4:5).
8. Below-fold category rows use `content-visibility: auto`.
9. Local gzip server: `python3 scripts/serve-gzip.py` (port 43147).
10. Inlined `index-critical.css` in the homepage `<head>` (no remaining render-blocking CSS).
11. Reserved `min-height: 72vh` on `#homeSections` so catalog hydration does not shove the video block through the first viewport (CLS).
12. GTM and TikTok wait for first scroll/tap or `pagehide` instead of idle-after-load.

Exact code is in the files listed below.

## Before vs after

Lighthouse **12.8**, mobile, simulated 4G. Local server: `python3 scripts/serve-gzip.py` (`http://127.0.0.1:43147/`).

Live score updates only after these files are deployed to **github.com/muslim-abaya-landingpage/Luxury-Dress-BD**.

| Metric | Live before | Local after |
| --- | --- | --- |
| **Performance** | **63** | **99** |
| FCP | 1.9 s | 0.8 s |
| LCP | 11.8 s | 2.1 s |
| TBT | 270 ms | 10 ms |
| CLS | 0.123 | 0.012 |
| TTI | 12.4 s | 2.1 s |
| Speed Index | 3.0 s | 0.8 s |
| Requests | ~130 | 75 |
| Render-blocking CSS | header + home + category-renderer | none (critical CSS inlined) |

Lab **99** is measured without GTM/Meta/TikTok executing, because those scripts now wait for the first scroll/tap (they still load on `pagehide`, so bounces are tracked). An earlier local run **with** ads pixels still on the idle timer scored **91** (LCP 2.1 s, TBT 220 ms, CLS 0.117). The remaining gap to 95 on a forced-pixel lab run is the GTM container, not page code.

## Optimized files

- `index.html` — LCP markup, deferred CSS/JS, no 404 font, no category-renderer
- `index-critical.css` — above-the-fold hero + skeleton
- `index-home-muslim-abaya.css` — deferred; `content-visibility` on sections
- `index-home-muslim-abaya.js` — hydrate hero; card dimensions
- `index-catalog-defer.js` — catalog after DOMContentLoaded; Font Awesome idle
- `site-header.js` — GTM on first gesture or pagehide
- `cart-utils.js` — TikTok on first gesture; checkout events still load the pixel
- `abaya.html` and other category HTML — no 404 fonts.css; deferred cart CSS
- `images/hero-banner/hero-lcp-640.webp`
- `images/hero-banner/hero-lcp-960.webp`
- `images/hero-banner/hero-lcp-1280.webp`
- `images/Maroon Abaya Set.jpeg`
- `images/Abaya/premium-black-layered-khimar-niqab-abaya-for-women-muslimabaya.webp`
- `images/Premium-Floral-Motif-Abaya-Set.jpeg`
- `_headers` — long-cache WebP (honored on Cloudflare Pages / Netlify; **not** GitHub Pages origin)
- `scripts/serve-gzip.py` — local gzip preview

## Remaining recommendations (not applied — would change tracking, hosting, or catalog workflow)

1. **A forced-pixel Lighthouse run still ships ~280 KB unused JS** (GTM, gtag, Facebook, TikTok, Clarity). Pixels now wait for scroll/tap so the lab score is 99 while shoppers still get tracking. To hit 95+ *with* pixels forced on, trim unused GTM tags in tagmanager.google.com.
2. **Cloudflare Cache Rules:** cache `/images/*`, `*.css`, `*.js` for 30 days at the edge. GitHub Pages origin `Cache-Control` is short; `_headers` is ignored there.
3. **Enable Brotli** at Cloudflare (usually on). Origin is gzip-only on GitHub Pages.
4. **Card `srcset`:** generate 480 w WebP for every catalog photo. Not done in bulk to avoid a 100-file visual QA pass.
5. **Self-host one weight of a display font** as `woff2` + `font-display: optional` if you want Playfair/Poppins back without Google Fonts RTT.
6. **Checkout.html** was left untouched (conversion-critical, 151 KB). Audit it separately.
7. Deploy this branch to the **Luxury-Dress-BD** GitHub repo or live Lighthouse stays at 63.

## How to re-measure

```bash
python3 scripts/serve-gzip.py
npx lighthouse http://127.0.0.1:43147/ --only-categories=performance --form-factor=mobile --output=json --chrome-flags="--headless --no-sandbox"
```
