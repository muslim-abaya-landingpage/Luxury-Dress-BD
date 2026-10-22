# Live Stock API — staged, NOT deployed

This change deliberately remains in a pull request until the Apps Script web app is deployed and storefront/order QA passes.

## Architecture
- Product catalog (names, prices, images) stays in GitHub.
- Admin Product Manager uses authenticated `AdminLiveStockSet` to update the `LiveStockOverrides` Google Sheet without GitHub publishing.
- `AdminLiveStockList` reads switches for the admin; public `StockStatus` includes `manualOverride` and the storefront `stock-sync.js` applies it.
- Existing variant quantities and reservations are **not** modified by the switch.

## Deployment and safety checks
1. Copy `apps-script/LiveStock.gs` and the changed `apps-script/Code.gs` into the correct existing Apps Script project; deploy a **new version**.
2. Verify `AdminLiveStockList` is token protected and `AdminLiveStockSet` rejects unauthenticated and invalid requests.
3. Verify public `StockStatus` responds with `manualOverride` for a test product.
4. Verify order placement and stock reservation reject orders for manually disabled products. A guard has been added to both paths but **has not been deployed or tested**. Do not enable live stock in production until checkout tests pass.
5. Verify all product listing pages, product detail, cart, checkout, search, and categories honor the override after refresh.
6. Confirm no existing stock quantities or product metadata changed.
7. Only then merge the frontend and deploy Cloudflare. Roll back the frontend if QA fails.

## Limitations
- Apps Script and Google Sheets still incur network latency; the UI can respond immediately, but durable save is not guaranteed instant.
- The public stock polling interval is 60 seconds; customer tabs already open may not update until the next poll.
- Explicit override must not silently bypass size-level inventory validation.
