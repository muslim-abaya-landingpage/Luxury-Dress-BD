# Next.js + Laravel Migration — Technical Audit & Safe Rollout

Audit started: 2026-11-25  
Repository: `muslim-abaya-landingpage/Luxury-Dress-BD`  
Working branch: `migration/nextjs-laravel-foundation`

## 1. Current architecture verified

- Production storefront is a multi-page static site with custom HTML/CSS/JavaScript.
- The repository also contains a Vite + React 19 + TypeScript tool/app surface, but the root `package.json` build command is `vite build`; the documented Cloudflare production pipeline instead runs `node scripts/build-cloudflare.mjs` and publishes the repository root.
- Cloudflare Pages project is documented as `luxury-dress-bd`, connected to GitHub `main`.
- Cloudflare Pages Functions provide server-side routes/middleware. The live catalog path uses a D1 binding named `STOCK_DB` and table `live_catalog`; uploaded product images use R2 according to the implementation comments in `functions/_lib/live-catalog.js`.
- Supabase project is PostgreSQL 17 (region `ap-northeast-1`), currently `ACTIVE_HEALTHY`. Existing schema includes product/order placeholders and active support chat/review features.

## 2. Supabase observations (read-only)

- `public.products` and `public.orders` exist with RLS enabled, but each reported 0 rows at audit time.
- Support chat tables contain existing records (5 conversations, 3 messages, 4 events reported). These are real data and must be preserved.
- Reviews table exists; no rows were reported at audit time.
- Eleven Supabase migrations are recorded through `20261124225353 create_reviews_system`.
- Security advisor reports:
  - RLS enabled but no policies on `public.orders`, `public.telegram_support_notification_deliveries`, `public.telegram_support_sessions`, and `public.telegram_support_updates`.
  - Publicly executable SECURITY DEFINER functions include `get_review_stats()`; signed-in executable functions also include support helper functions. These require code-path/permission review before any change.
  - Leaked-password protection is disabled.
  - Anonymous-role policy warnings exist for support tables; determine whether anonymous visitors are intentionally using anonymous Auth sessions before changing.
- Performance advisor reports six foreign-key indexes missing. Unused-index notices are informational and should not trigger blind deletion.

No Supabase schema, data, auth settings, policies, or production services were changed during this audit.

## 3. Migration constraints

- Do not replace the live production site in one cutover.
- Keep existing URLs, SEO metadata, product identifiers/SKUs, product images, order history, customer records, admin permissions, stock/size/variation rules, delivery calculation, Meta/Google feeds, courier hooks, support chat, reviews, and tracking events.
- Product import/update must match only exact SKU/Product ID. A non-matching SKU must create a separate product; never overwrite a different product.
- Do not make Supabase and a new Laravel database competing sources of truth. Decide one authoritative database after tracing current production data paths.
- Do not put Supabase service-role keys, Laravel secrets, or admin credentials in browser code or Git.
- Cloudflare Pages does not run a conventional PHP Laravel application directly. Keep the storefront on Cloudflare and place Laravel API on a PHP-capable host only after cost/limits are reviewed and approved.

## 4. Proposed target architecture (subject to implementation validation)

- Next.js + TypeScript storefront/admin UI.
- Laravel API with Laravel Sanctum (or another reviewed session strategy) for server-side authentication/authorization.
- PostgreSQL as the authoritative transactional database, reusing the existing Supabase project only if its current data model, policies, connectivity, and plan limits are suitable.
- Cloudflare DNS/CDN/WAF in front of public domains; R2 for media if existing integration is confirmed.
- GitHub Actions CI gates; API tests plus Playwright storefront/admin E2E.

## 5. Safe rollout plan

1. Inventory all production data sources and write paths (Cloudflare D1, Supabase, Google Sheets/Apps Script, R2, Firebase/other services). Confirm where actual live products, orders, customers, admin users, and stock are stored.
2. Build a data dictionary and mapping for every existing feature; capture baseline counts and export/backup strategy before any migration.
3. Create an isolated Next.js frontend prototype and Laravel API skeleton on this branch; no production secrets or data copies in Git.
4. Add read-only API integration and contract tests; verify exact-SKU behavior and role/permission boundaries with synthetic fixtures.
5. Add staged data migration tooling with dry-run, reconciliation counts, idempotency, rollback plan, and explicit backup/restore verification.
6. Run visual, responsive, accessibility, security, API, and E2E tests against staging.
7. Deploy staging first. Production cutover requires a separate explicit approval after cost, DNS, hosting, backups, and rollback are confirmed.

## 6. Immediate next audit tasks

- Trace D1 tables and Cloudflare bindings from repository migrations/configuration.
- Identify actual production catalog/order source and admin API authentication.
- Map current product upload, exact-SKU matching, order lifecycle, delivery rules, feeds, chat, reviews, and external integrations.
- Verify Cloudflare Pages deployment settings and current branch/build configuration.
- Review Supabase RLS policies and SECURITY DEFINER function call sites; remediate only after confirming intended public/agent access.

## 7. Change boundary

This branch contains planning/audit documentation only. No production deployment, DNS change, database migration, subscription, or paid service was initiated.
