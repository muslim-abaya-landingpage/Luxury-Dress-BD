# Muslim Abaya — Laravel 13 API

Laravel 13 / PHP 8.3+ foundation for the staged storefront migration. This app is isolated from production and must not be connected to live databases or deployed until staging reconciliation and approval.

## Local setup

From this directory:

```bash
cp .env.example .env
mkdir -p database
touch database/database.sqlite
composer update
php artisan key:generate
php artisan serve
```

Health check: `GET http://127.0.0.1:8000/api/health`\n\nRead-only fixture catalog:\n\n- `GET /api/v1/catalog/products` — paginated synthetic products; supports `category`, `page`, and `per_page`.\n- `GET /api/v1/catalog/products/{productId}` — published synthetic product detail.\n\nBoth catalog endpoints return `data_source: fixture`. They are intentionally disconnected from Google Sheets, Cloudflare D1, Supabase, R2 and all production credentials. Fixture records are not real products and must not be exposed as the live storefront catalog.

Run tests:

```bash
composer test
```

Composer includes Laravel Sanctum. Authentication routes, token issuance, database migrations and role policies remain deliberately inactive until the identity model and authorization matrix are reviewed. Do not migrate active passwords or sessions.

## Initial API contract

- `GET /api/health` — safe liveness response.
- `GET /api/v1/catalog/products` — public, paginated product read.
- `GET /api/v1/catalog/products/{productId}` — public product detail.
- `POST /api/v1/orders` — validated order creation with idempotency key.
- `GET /api/v1/orders/{orderId}` — customer-authorized order tracking.
- `GET /api/v1/admin/orders` — staff/owner authorization required.
- `PATCH /api/v1/admin/orders/{orderId}` — explicit status transition and audit event.
- `POST /api/v1/admin/catalog/import` — owner-only import; exact SKU/Product ID matching only.

## Exact product identity validation\n\n`App\\Support\\ExactProductIdentity` is a pure, fixture-tested resolver for future import work. It permits only exact immutable Product ID or exact normalized SKU matching (trimmed and case-insensitive). If both identities point to different products, or an identity is duplicated, it returns `conflict`; if neither matches, it returns `create`. This resolver is not wired to a write endpoint and does not update any product.\n\n## Non-negotiable domain rules

1. Product update is permitted only when the exact SKU or immutable Product ID matches. A different or missing match creates a separate product; no fuzzy matching.
2. Order creation must be idempotent. A repeated request with the same idempotency key returns the original order.
3. Price, discount, coupon, delivery charge and stock are recalculated/validated server-side.
4. Stock reservation and order creation must be transactional; cancellation/delivery transitions must preserve the existing stock lifecycle.
5. Every privileged action records actor, before/after values, timestamp and reason.
6. Customers can only access their own orders. Staff permissions remain least-privilege; owner-only operations stay owner-only.
7. Never commit `.env`, service-role keys, Google service-account JSON, or courier/Meta tokens.

## Existing data-source boundary

The current order master is the Google Sheets `Online Order` tab. The live product catalog is the GitHub catalog with the Cloudflare D1 live-catalog overlay. D1 also holds size settings and operational queues. Supabase currently holds support-chat records and a separate product projection. Keep those systems read-only from the new API until the staging reconciliation plan is complete.

Do not run migrations against the existing Supabase project yet. First compare its PostgreSQL schema and RLS rules with the target transactional model, verify backup/restore, and choose one authoritative write database. Do not create a paid database or hosting service without approval.
