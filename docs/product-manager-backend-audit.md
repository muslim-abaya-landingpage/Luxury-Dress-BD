# Product Manager Backend Audit

Date: 2026-11-19
Audited ref: main at 6c7d95160fb9948cd4ef6a88e4751519299c1114

## Executive finding

The current Product Manager is a custom static-site administration application with WooCommerce-inspired UI and product fields. It is **not a verified native WooCommerce / WordPress installation**. Repository inspection found no `wp-json` references through GitHub code search and no demonstrated WooCommerce REST API client or WordPress database integration. A `woocommerce` search mainly finds UI styles, tests and WooCommerce-like terminology.

Do not describe this system as WooCommerce-connected until a live WordPress/WooCommerce endpoint and authenticated API round-trip have been verified.

## Current data flow (verified from source)

1. Product catalogue editor loads static catalogue sources including `product-config.js`, `category-products.js`, `product-links-data.js`, and catalogue sync/section helpers.
2. Product publish flow validates catalogue content in the browser and sends catalogue files to Cloudflare Pages Functions.
3. `functions/api/catalog-save.js` validates owner authorization, request id, base SHAs and the required catalogue files; it writes a GitHub commit to the repository's `main` ref using a non-forced ref update to detect conflicts.
4. Live catalogue state is written to Cloudflare D1 via `functions/api/live-publish.js` / `writeLiveState`, allowing the storefront to use the latest catalogue while a deployment catches up.
5. Product images are uploaded separately through `/api/image-upload` to object storage (R2 flow is referenced in the publisher and API contract).
6. Inventory counts and order-side stock tracking use the existing Admin API / Google Sheets-backed logic (for example `AdminStockVariantSave` and `AdminLiveStockList`), not WooCommerce stock endpoints.
7. `functions/api/admin-read.js` explicitly documents its role as a read-only fast path over Google Sheets; Apps Script remains the source of truth and writer for supported admin records.

## What is already present

- Product list/editor with product statuses, search/filter, pagination and selection.
- Category list and category editing.
- CSV import/export and bulk upload modules.
- Product descriptions with Visual/Code editor.
- Product image upload, gallery and R2 upload flow.
- SKU, inventory tab, stock quantity and stock synchronization hooks.
- Product variations and WooCommerce-like product data fields.
- Draft/Trash visibility rules and publish validation tests.
- Conflict-aware GitHub catalogue saves and live-catalog fallback.

## Gaps / risks

- Native WooCommerce connection is not established. WooCommerce-specific labels and styles can mislead operators about where data is actually stored.
- Product data is split across static GitHub catalogue files, D1 live state, R2 assets and Google Sheets-backed stock/order operations. This is a custom architecture and needs a clear source-of-truth map.
- Several legacy and overlapping stylesheets are loaded by `product-manager.html`; the page has accumulated multiple visual layers, increasing cascade/regression risk.
- The current editor's layout should be simplified around a stable product list and predictable editor sections; visual changes must preserve existing field selectors and publisher hooks.
- Category hierarchy, global reusable attributes/terms, and a consistent brand taxonomy need a dedicated data model before they can safely be presented as fully supported WooCommerce features.
- Do not migrate product/order/stock data or switch storage backends as part of a visual redesign.

## Recommended implementation sequence

### Phase A — audit and stabilize (this phase)
- Document the actual architecture and sources of truth.
- Preserve the current GitHub/D1/R2/Sheets publishing and stock flows.
- Add/retain tests around product editor layout and SKU/Inventory behavior.

### Phase B — Product Manager redesign
- Use a clean WooCommerce-inspired product list: title, SKU, stock, price, categories, type, status and date.
- Keep search, filters, bulk actions, pagination and add-product action in predictable locations.
- Use a two-column product editor on desktop and a single-column responsive layout on mobile.
- Group editor fields into General, Inventory, Shipping, Linked Products, Attributes, Variations and Advanced only where the underlying fields/actions are actually supported.
- Clearly label custom integrations; do not imply native WooCommerce synchronization.

### Phase C — feature work
- Build category hierarchy and reusable attributes/terms with explicit storage contracts.
- Add/complete brand management, safe bulk editing and stock history/alerts.
- Add order, shipping, coupon and tax integrations only after their data source and business rules are defined.

## Safety constraints

- No existing product, image, order or stock data should be deleted or rewritten by audit/redesign work.
- Do not introduce a second source of truth for stock.
- Do not claim WooCommerce parity for a feature unless its data model, persistence, validation and end-to-end tests exist.
- Keep changes backward-compatible with the current catalogue publisher until a separately planned migration is approved.
