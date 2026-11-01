# shop.muslimabaya.com — Cloudflare Pages deployment

## Safe deployment
1. Create a NEW Cloudflare Pages project, e.g. `muslimabaya-shop-landing` (do not replace `luxury-dress-bd`).
2. Deploy the contents of this folder as static assets with `_worker.js` at root. If Direct Upload rejects advanced-mode Worker, use Wrangler `pages deploy` or Git integration; do not silently omit `_worker.js`.
3. Pages → Custom domains → Set up `shop.muslimabaya.com`. Follow Cloudflare DNS prompts. Do not edit apex/root DNS or wildcard DNS.
4. Verify `https://shop.muslimabaya.com/` loads all images and `https://shop.muslimabaya.com/api/order` is routed to the Worker (GET should not submit an order).
5. Test a real low-risk order and confirm it appears in the intended backend BEFORE promoting ads or accepting customer orders.

## Orders and stock caveats
- Existing config has `order.mode = apps-script`, posting to `/api/order`. `_worker.js` proxies to an existing Apps Script endpoint (`ORDER_FALLBACK`), or an `ORDER_API_URL` secret/variable. This endpoint has NOT been verified and may point to a different order workflow.
- This ZIP does NOT automatically connect to your separate D1 Live Stock database. Product availability is currently defined in config.js; do not claim it syncs with live stock.
- Do not bind the production STOCK_DB or modify existing orders until integration and authentication are reviewed.
- The Cloudflare Zero Trust Access application for `/api/admin/live-stock` belongs to the existing stock API, NOT to this public shop landing page. Do not protect the whole shop domain.

## Local test
`python -m http.server 8000` from this directory tests the static page only; it does not emulate Cloudflare Workers/API.
