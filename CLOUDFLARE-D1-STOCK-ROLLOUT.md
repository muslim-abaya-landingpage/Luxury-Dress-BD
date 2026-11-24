# Cloudflare D1 Live Stock — staged rollout

This PR is intentionally **not merged** until the D1 database, Cloudflare Access policy and checkout integration have been tested. No existing products, orders, quantities, or Apps Script sheets are migrated or overwritten.

## Cloudflare setup (once)
1. Create a D1 database named `muslimabaya-live-stock` in Cloudflare.
2. Bind it to the **Cloudflare Pages** project under the binding name `STOCK_DB`, for both production and preview where appropriate.
3. Apply `migrations/0001_live_stock.sql` to the D1 database, initially in a separate test environment.
4. Create a Cloudflare Access application protecting `/api/admin/live-stock`. Allow only explicitly approved owner identities (not every email in a domain).
5. Configure Pages environment variables `ACCESS_TEAM_DOMAIN` (e.g. `yourteam.cloudflareaccess.com`) and `ACCESS_AUD` (Access application's audience tag). Do not put secrets in repository files.
6. Test that unauthenticated POST and GET both return 401, valid Access token succeeds, invalid IDs fail, and audit records appear.
7. Test the public `GET /api/live-stock` returns only manual stock switches.

## Critical integration gate
The D1 API is **not yet wired to Product Manager, catalog listing, checkout, or order reservation**. Existing Product Manager currently uses Apps Script `AdminLiveStockSet`; simply merging this PR will not replace it. The existing Apps Script stock system must remain until the D1 read/write path and checkout enforcement are implemented and verified end-to-end.

The public API intentionally returns only explicit overrides; a missing product ID means use the existing catalog/variant stock logic. Manual In Stock must **never** override a size-level zero-quantity restriction or authorize checkout when inventory is exhausted.

## Migration and rollback
- Back up current product catalog and stock variant sheets; export current live stock overrides before switching.
- Seed D1 with existing manual overrides, verify counts and representative SKUs.
- Switch admin and public reads only after parity checks and checkout safeguards.
- Keep rollback route to existing backend until full production verification.
- Never migrate orders or product media as part of this stock-only change.
