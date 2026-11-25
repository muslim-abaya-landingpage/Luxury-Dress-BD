# Muslim Abaya — Laravel API foundation

Target: Laravel 13, PHP 8.3+, PostgreSQL, Laravel Sanctum.

This folder documents the isolated API boundary. Do not connect it to production databases or deploy it yet.

## Bootstrap the framework

Use the official Laravel 13 application skeleton, then place the generated framework files in this directory:

```bash
composer create-project laravel/laravel:^13.0 /tmp/muslimabaya-api
```

Copy the generated Laravel application into `apps/api-laravel/` (preserving this README), then install Sanctum using the Laravel 13-compatible release and publish its migrations. Commit the Composer lockfile after the framework install and run the test suite before adding production integration.

## Initial API contract

- `GET /api/health` — liveness only; must not expose secrets or database details.
- `GET /api/v1/catalog/products` — public, paginated product read.
- `GET /api/v1/catalog/products/{productId}` — public product detail.
- `POST /api/v1/orders` — validated order creation with idempotency key.
- `GET /api/v1/orders/{orderId}` — customer-authorized order tracking.
- `GET /api/v1/admin/orders` — staff/owner authorization required.
- `PATCH /api/v1/admin/orders/{orderId}` — explicit status transition and audit event.
- `POST /api/v1/admin/catalog/import` — owner-only import; exact SKU/Product ID matching only.

## Non-negotiable domain rules

1. Product update is permitted only when the exact SKU or immutable Product ID matches. A different or missing match creates a separate product; no fuzzy matching.
2. Order creation must be idempotent. A repeated request with the same idempotency key returns the original order.
3. Price, discount, coupon, delivery charge and stock are recalculated/validated server-side.
4. Stock reservation and order creation must be transactional; cancellation/delivery transitions must preserve the existing stock lifecycle.
5. Every privileged action records actor, before/after values, timestamp and reason.
6. Customers can only access their own orders. Staff permissions remain least-privilege; owner-only operations stay owner-only.
7. Do not migrate active passwords or sessions until the credential strategy has been reviewed.
8. Use environment variables/secrets manager for credentials. Never commit `.env`, service-role keys, Google service-account JSON, or courier/Meta tokens.

## Data-source boundary

The current order master is the Google Sheets `Online Order` tab. The live product catalog is the GitHub catalog with the Cloudflare D1 live-catalog overlay. D1 also holds size settings and operational queues. Supabase currently holds support-chat records and a separate product projection. Keep those systems read-only from the new API until the staging reconciliation plan is complete.

## Database decision gate

Do not run Laravel migrations against the existing Supabase project yet. First compare its PostgreSQL schema and RLS rules with the target transactional model, verify backup/restore, and choose one authoritative write database. Do not create a paid database/hosting service without approval.
