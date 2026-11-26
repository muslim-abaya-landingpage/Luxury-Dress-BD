# Phase 1 — Advanced Inventory Management Foundation

Status: implementation plan / safety gate  
Branch: `feat/phase-1-inventory-foundation`  
Base audited: `0efc8b51e7a59aeab2268e4794bccb374e046980`

## Objective

Strengthen the existing variant-level inventory workflow without replacing its source of truth or changing live stock data during this foundation step.

## Production architecture (preserve)

- Canonical operational stock: Apps Script + Google Sheets `StockVariants`, with legacy product-total stock retained for compatibility.
- Stock history: Google Sheets `StockLedger`.
- Order master: `Online Order` sheet; order lifecycle and stock reservation are coordinated by Apps Script under the global Script Lock.
- Cloudflare Pages `/api/admin-read` is a read-only fast path; it is not the stock writer.
- Supabase currently has no verified dedicated purchase, supplier, or stock-ledger schema. Do not create a competing inventory counter there.
- D1 live-stock toggle is a separate publish/visibility control; it does not replace Available/Reserved quantities.

## Existing capabilities confirmed in source

- Product + variant rows with tracked, available, reserved, threshold, updatedAt and updatedBy fields.
- Manual stock set, quick adjustment, CSV batch import, ledger read and low-stock notification queue.
- Checkout/order lifecycle reserve, release and sold transitions.
- Product/variant stock analytics and untracked-product visibility.
- Legacy product-total stock remains in use for some products.

## Phase 1 work packages

### P1.1 — Stock integrity and audit reliability (first implementation target)

- Trace every stock mutation path: admin manual set, quick adjustment, CSV import, checkout reserve, order status release/finalize, rollback and legacy product-total mutation.
- Define one normalized stock event contract with operation ID, product ID, exact variant key, available/reserved before and after, signed delta, event type, reason, order ID, actor, timestamp and outcome.
- Replace silent/best-effort ledger failure handling only after a recoverable operation/outbox strategy is implemented. A naive change from swallowed errors to thrown errors is unsafe because current stock writes may already have happened.
- Add idempotency protection for replayed admin/CSV/order events.
- Add reconciliation reporting for stock changes missing a ledger event, orphan reservations, stale order stock stages and incomplete rollback.
- Preserve the single outer Apps Script Lock boundary; do not introduce nested lock acquisition.

### P1.2 — Variant stock operations

- Explicit Stock In, Stock Out, Adjustment and Transfer operations with mandatory reason and actor.
- Reject negative available/reserved balances and invalid quantities; never silently clamp invalid business transitions.
- Keep legacy product-total rows supported until an approved migration and reconciliation exists.
- Make CSV preview non-mutating; commit must revalidate under the lock and report row-level outcomes.

### P1.3 — Admin inventory experience

- Variant-level Available / Reserved / On hand display with clear definitions.
- Search, category, tracked/untracked, low/out-of-stock filters.
- Stock movement history with actor, reason, order reference and date.
- Low-stock threshold configuration and reliable alert status.
- Bulk import/export with duplicate-key and stale-preview protection.

### P1.4 — Order and return integration

- Verify Pending → Confirmed → Shipped → Delivered / Cancelled transitions against reserve/release/sold events.
- No automatic restock for sold returns without an explicit inspected/resalable stock action.
- Every return restock must be a separately authorized, audited stock movement.
- Add failure-injection tests for partial reserve, ledger failure, order-row failure and failed compensation.

## Required acceptance gates

1. No production stock mutation or data migration during development tests.
2. Existing product IDs, variant keys, StockVariants headers and legacy stock behavior remain backward compatible.
3. All stock mutation paths are serialized by the existing outer lock.
4. Replayed operation IDs do not duplicate quantity changes.
5. Every successful mutation has a durable, queryable audit event; if durability cannot be guaranteed, the operation remains visibly pending reconciliation and is not reported as clean success.
6. CSV preview never writes; commit revalidates against current stock while locked.
7. Order cancellation/release is idempotent; delivered/sold returns require explicit inspection and stock action.
8. Unit, backend contract, Apps Script parity/syntax and Playwright regression tests pass.
9. Apps Script deployment and Cloudflare production deployment are separate release gates. Do not claim the new Apps Script backend is live until its existing Web App deployment is updated and verified.

## Known risks to address before implementation

- `appendStockLedger_` currently catches and ignores all errors. Inventory may mutate successfully without a ledger row.
- `mutateStockVariant_` writes the stock row before appending the ledger.
- Multi-variant reserve rollback is best-effort; rollback errors are swallowed.
- StockVariants and legacy product-total stock are separate sheets and cannot be updated in one database transaction.
- The existing StockLedger schema has no durable unique operation ID, so replay detection is not yet guaranteed.
- Product Manager's manual quantity set and quick-adjust paths use separate code paths and must be normalized without breaking current API payloads.

## Explicitly out of scope for Phase 1

- Purchase orders, supplier directory, supplier payments/due balances and purchase returns (Phase 2).
- Replacing Apps Script/Sheets with Supabase or D1.
- Enabling a new D1 stock counter or dual-writing stock.
- Automatic restock of sold customer returns.
- Production deployment before Apps Script, checkout and admin regression gates pass.
