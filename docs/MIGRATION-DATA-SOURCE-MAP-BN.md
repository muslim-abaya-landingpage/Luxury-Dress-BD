# Muslim Abaya — Migration Data Source Map (Read-only Audit)

Audit date: 2026-11-25  
Branch: `migration/nextjs-laravel-foundation`  
Scope: GitHub source, Cloudflare Pages/D1 configuration and schema, Supabase PostgreSQL schema/counts, Apps Script order code.  
All database queries in this audit were read-only. No customer PII, order rows, secrets, or message bodies were exported.

## Executive conclusion

There is no single existing database that contains the entire store. The live application is a hybrid system. A safe Laravel migration must reconcile several authoritative sources rather than treating Supabase as a complete replacement database.

## Verified source-of-truth map

| Domain | Current authoritative source found | Evidence / current state | Migration treatment |
|---|---|---|---|
| Storefront product catalog | GitHub catalog files, with a D1 live overlay | D1 `muslimabaya-live-stock.live_catalog` has one `state` row; embedded validation reports 80 products. Code commits four catalog files to GitHub and writes the checked live state to D1. | Import from deployed GitHub catalog plus the latest valid D1 overlay; reconcile by immutable Product ID and exact SKU. |
| Product images | Cloudflare R2 and repository image assets | Production Pages binding is `PRODUCT_IMAGES → muslimabaya-product-images`; code sends newly uploaded product photos to R2. | Preserve public URLs and object keys; verify every referenced object before cutover. |
| Live stock | Google Sheets / Apps Script plus D1 stock features | Apps Script order intake validates live stock and reserves stock under a Script Lock. D1 `live_stock` currently has 0 rows; size configuration is stored separately in D1. | Trace StockVariants/StockLedger sheets and stock lifecycle functions; do not assume D1 live_stock is the complete stock ledger. |
| Size configuration | Production Cloudflare D1 `muslimabaya-live-stock` | 8 templates, 25 fields, 87 options, 1 published version, 0 product overrides. | Migrate templates, options, active version and audit history; retain legacy product size compatibility. |
| Website orders | Google Spreadsheet tab `Online Order` | Apps Script `handleOnlineOrderPost_` writes the order row to `Online Order`; admin read route also reads this tab. The row contains customer/order/payment/shipping/status metadata. | Treat this Sheet as the current order record source until a read-only full row-count/export reconciliation is approved. |
| Order intake / abuse queue | Production D1 `ma-orders` | `order_inbox`: 2 rows; `order_ip_log`: 2 rows; fraud review tables and OTP log: 0 rows at audit. Worker records attempts and forwards valid order payloads to the configured Apps Script target. | Import only durable order records from the Sheet; keep D1 queue, dedupe and abuse logs as separate operational/audit data. |
| Customer accounts / staff | Google Sheets / Apps Script | Apps Script routes register/login/admin sessions; code and read-only edge snapshot use `Customers`, `Sessions`, `Admins` tabs. | Preserve identities and password/session security; never copy password hashes or active session tokens into a new app without a reviewed credential migration plan. |
| Support chat | Supabase PostgreSQL | `support_conversations`: 23 rows; `support_messages`: 12; `support_events`: 33; `support_agents`: 1. Supabase Auth has 5 users. | Preserve all conversation/message/event relationships, attachments and agent roles. |
| Supabase product/order tables | Supabase PostgreSQL | `public.products`: 12 rows; `public.orders`: 0 rows; `public.reviews`: 0 rows. Product schema is a compact product projection, not the 80-product live catalog snapshot. | Treat the 12 rows as a separate projection/legacy integration until code usage is traced. Do not overwrite or merge blindly. |
| Reviews | Supabase PostgreSQL plus website review-photo R2 flow | Supabase reviews table exists and currently has 0 rows; review photo uploads use the Cloudflare R2 binding. | Confirm whether published text reviews are still stored in Apps Script or another source before choosing migration source. |
| Analytics / tracking | Cloudflare Worker + D1, Apps Script, Meta/TikTok | D1 `ma-orders` includes tracking profiles/queue/log and order-attempt risk tables. | Keep analytics/event IDs and conversion deduplication separate from order business records. |

## Cloudflare production configuration verified

- Pages project: `luxury-dress-bd`
- Production branch: `main`
- Build command: `node scripts/build-cloudflare.mjs`
- Output directory: repository root (`.`); this is not the legacy Vite `dist/` build.
- Production D1 bindings:
  - `ORDERS_DB` → `ma-orders`
  - `STOCK_DB` → `muslimabaya-live-stock`
- Production R2 binding:
  - `PRODUCT_IMAGES` → `muslimabaya-product-images`
- Preview bindings point to separate preview databases and an image bucket. Current migration branch is not in the Pages preview branch allowlist; the branch deployment was skipped by branch configuration. No production deployment was triggered by this migration work.

## Supabase security and schema notes

- `public.products` has a public read policy; its 12 rows must not be assumed to represent the full live catalog.
- `public.orders` currently has RLS enabled and no policy. The table is empty, but the policy design must be reviewed before Laravel uses it.
- Supabase security advisor also reports missing policies on several Telegram-support tables and public-executable SECURITY DEFINER functions. Review call sites and intended service-role access before changing any policy.
- Leaked-password protection is currently disabled. Decide the account/auth migration strategy before enabling or changing auth controls.
- Existing support chat policies restrict authenticated visitors to their own conversations and support agents to agent workflows. Preserve these semantics.

## Migration decisions (not yet applied)

1. The initial Laravel API must not make Supabase, D1 and Google Sheets competing write masters.
2. First import a consistent snapshot from the actual current source for each domain, record row/object counts and hashes, then test a one-way staging sync.
3. Order cutover needs a short write-freeze or durable dual-write/outbox plan with idempotency and reconciliation. Do not switch order writes until old and new order IDs reconcile.
4. SKU matching is strict: exact SKU/Product ID only. Existing exact match may be updated; a non-match must create a separate product. Never fuzzy-match or overwrite a different product.
5. Preserve all original product IDs, SKU/variation IDs, order IDs, URLs, image keys, timestamps, status history, customer records, delivery rules, coupon rules, courier tracking, stock reservations, review/support records, Meta/Google feeds, and analytics event IDs.
6. Keep current production Pages and Apps Script operational until staging tests and rollback are proven.

## Next implementation step

Create a Next.js app and Laravel API skeleton in this isolated branch, with no production secrets and no production database writes. First add contract tests and synthetic fixtures for catalog, exact-SKU upsert, order lifecycle, stock reservation, delivery calculation, auth roles, Meta feed and support-chat preservation. Do not create a new paid service or production database as part of this step.
