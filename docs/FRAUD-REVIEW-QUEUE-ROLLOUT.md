# Fraud Review Queue — Phase 1 rollout

## Scope
- Persist a separate review record only after the corresponding order has been saved successfully.
- Keep review state and append-only review events independent of the 30-day `order_inbox` cleanup.
- Owner-only API; Staff access is denied until granular server-side permissions are implemented.
- Clearing/rejecting a fraud review does not confirm/cancel an order or change stock, payment or courier state.

## Data handling
- The review tables store order ID, event ID, score, risk level/action, bounded reasons and an allowlisted set of numeric/boolean signal summaries.
- Raw IP, phone, email, user-agent, device fingerprint and the full order payload must never be copied to the review tables.
- History is append-only through the application API.

## Migration
1. Export the live D1 database before migration and retain the export artifact.
2. Apply `cloudflare-worker/schema-fraud-review.sql` to D1 database `ma-orders`.
3. Verify both tables and all indexes exist; verify existing table counts are unchanged.
4. Deploy Worker code and Pages Functions.
5. Verify owner-only list/detail/decision actions using a non-production test review record; never create a fake production order.
6. Enable the UI after the API and regression tests pass.

## Rollback
- Disable the fraud review UI/API route or feature flag.
- Do not drop either review table; preserve the audit history.
- Existing order submission, retry, stock lifecycle, IP blocking and OTP flows remain unchanged.
