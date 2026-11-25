# Order Lifecycle ও Stock Reservation Contract (Migration Draft)

## উদ্দেশ্য ও সীমা

এটি Laravel 13-এর ভবিষ্যৎ adapter contract; production integration নয়। কোনো production order, customer, stock, Google Sheet, Apps Script, D1 বা Supabase-এ read/write করা হয়নি। কোনো order API route বা stock mutation endpoint চালু করা হয়নি।

## যাচাইকৃত production source

- Canonical order master: Google Sheets-এর `Online Order` tab।
- Checkout retry lookup: Apps Script `orderIdempotencyKey_` EventID-কে `^[A-Za-z0-9_.:-]{6,100}$` দিয়ে validate করে; phone normalize করে; তারপর script cache-এ ৬ ঘণ্টার জন্য Order ID রাখে। এটি permanent durable idempotency store নয়।
- Phone normalization: non-digits বাদ; 880 দিয়ে শুরু ও কমপক্ষে 12 digits হলে 0 + 880 বাদে অবশিষ্ট; 10-digit 1-prefixed হলে সামনে 0 যোগ।
- New website order: order script lock-এর মধ্যে stock reserve করে; row-তে CartJSON এবং StockStage একসাথে লেখে। Tracked reservation থাকলে `RESERVED`, অন্যথায় `NEW`।
- Status vocabulary: `Pending`, `Confirmed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`, `Fake`; return/refund/cancel বাংলা বা ইংরেজি keywords-ও release branch-এ যায়।
- `Confirmed` → `RESERVED`; `Processing`/`Shipped` stock stage অপরিবর্তিত; `Delivered` → `SOLD`।
- `Cancelled`/`Fake`/Return/Refund এবং `Pending` যখন stage RESERVED, তখন reservation release হয়।
- `SOLD` অবস্থায় cancel/return হলে automatic restock হয় না; `RETURN_REVIEW_NEEDED` ledger note হয়।
- `NEW` অবস্থায় Delivered হলে direct sale; `RELEASED` থেকে Delivered হলে review note দিয়ে direct sale চেষ্টা হয়।
- Legacy blank/LEGACY_SKIPPED stage-এ status action এলে automatic stock mutation এড়িয়ে `LEGACY_SKIPPED` হয়।
- একই target stage পুনরায় এলে stock operation পুনরাবৃত্তি হয় না।
- Apps Script stock helper-গুলো variants ও legacy product-total stock দুই ধরনের inventory-ই পরিচালনা করে।

## Laravel pure contract

`OrderLifecycleContract` কেবল planning/normalization দেয়; stock mutate করে না। `stockStagePlan()` stage-aware action ফেরত দেয়:

- `reserve`, `release`, `finalize_reserved_sale`, `sell_direct`
- `stage_only`, `no_transition`, `unchanged`
- `return_review_no_auto_restock`, `review_then_sell_direct`, `review_needed_no_reserve`
- `legacy_skipped`, `unknown_stage` review

গুরুত্বপূর্ণ সতর্কতা: production Apps Script-এর SOLD → Confirmed branch `REVIEW_NEEDED` ledger note লিখে, তবুও StockStage `RESERVED` করে দেয়—কিন্তু reserve operation করে না। Laravel adapter-এ এই transition কখনো স্বয়ংক্রিয়ভাবে অনুকরণ করা যাবে না; manual review ছাড়া block করতে হবে।

## ভবিষ্যৎ write integration-এর বাধ্যতামূলক শর্ত

1. Canonical order write অবশ্যই Google Sheets `Online Order` adapter-এর সাথে reconcile করতে হবে; D1 operational intake/abuse queue order master নয়।
2. Apps Script checkout idempotency বর্তমানে ৬ ঘণ্টার script cache-এ; Laravel-এ durable unique idempotency record ও recovery/reconciliation না থাকলে write route প্রকাশ করা যাবে না।
3. Admin/manual order-এর জন্য আলাদা idempotency key এবং server-side uniqueness লাগবে।
4. Stock reservation/release/sold একই authoritative Apps Script/Sheets stock ledger-এর serialized operation হতে হবে। দ্বিতীয় independent Laravel/D1 stock counter নয়।
5. Order append এবং stock mutation-এর partial failure-এ compensation/reconciliation দরকার। Stock ledger append বর্তমানে best-effort (failure swallow করে); তাই migration adapter-এ ledger durability gate আলাদা করে সমাধান করতে হবে।
6. Product variant identity, qty, global attributes, tracked/untracked, legacy product-total stock mapping যাচাই ছাড়া reservation enable করা যাবে না।
7. Legacy order stage blank হলে Laravel কখনো অনুমান করে release/sell করবে না।
8. Delivered/SOLD return-এ stock ফেরত দিতে হলে explicit audited manual adjustment workflow লাগবে।

## পরবর্তী gate

- Synthetic PHPUnit tests চালানো এবং CI result যাচাই।
- Stock ledger best-effort write, rollback semantics ও Apps Script lock boundaries আলাদা audit করা।
- তারপর read-only adapter design; write route ও production rollout আলাদা অনুমোদন এবং QA ছাড়া নয়.


## Stock failure / recovery audit (Apps Script source)

| Failure point | Current production behavior | Laravel migration requirement |
|---|---|---|
| One variant reserve fails after earlier variants changed | Reverse rollback is attempted in reverse order; rollback errors are swallowed | Persist each mutation in a durable operation log; mark partial rollback for reconciliation |
| Legacy product-total reserve fails after variant reserves | Legacy and variant rollback are attempted independently; rollback errors are swallowed | One serialized operation with a recoverable saga/compensation record |
| Online Order row append fails after stock reserve | Checkout clears the partial row and attempts release; release failure is swallowed | Do not return success; durable retry/reconciliation must detect reserved stock with no order row |
| Admin order row write fails after reserve | Admin path clears the row and attempts release; release failure is swallowed | Same reconciliation requirement as checkout |
| Stock ledger append fails | `appendStockLedger_` catches and ignores the error; inventory mutation can succeed without a ledger row | Ledger/outbox durability must be part of the transaction boundary, not best-effort |
| Status lifecycle operation fails while admin creates an order | Admin creation keeps status Pending and records a stock note | Preserve the safe Pending fallback and surface an actionable reconciliation alert |

### Lock and atomicity findings

- Checkout acquires the Apps Script global script lock before unique Order ID selection, stock reservation, Online Order row append and metadata/StockStage write.
- Admin order creation also acquires the script lock before reserve and row append.
- Status lifecycle wrapper acquires the same script lock before reading/updating StockStage and invoking reserve/release/sell helpers.
- `reserveStockForOrderItems_`, `releaseStockForOrderItems_` and `mutateStockVariant_` do not acquire their own nested lock; they rely on the caller already holding the lock. Future adapters must preserve one outer serialization boundary and must not introduce nested lock acquisition.
- Google Sheets row writes, variant rows, legacy product-total rows and ledger append are not one database transaction. Current rollback is best-effort, not atomic.
- Checkout EventID retry record is written to Script Cache only after order/stock work succeeds; cache is temporary (six hours) and not a durable uniqueness constraint.

### Required migration safety controls

1. Durable operation ID per order + lifecycle action, with unique constraint to prevent duplicate reserve/release/sell.
2. Transactional outbox or equivalent durable ledger write before acknowledging success.
3. Reconciliation scanner for (a) stock reserved without an Online Order row, (b) order row with stale StockStage, (c) missing ledger entry, and (d) partial compensation.
4. Explicit `pending_reconciliation` state when compensation cannot be confirmed; never silently report success.
5. Failure injection tests at each mutation boundary, including ledger write failure, row append failure, and rollback failure.
6. Single lock/transaction coordinator; lower-level mutation helpers must not independently acquire nested locks.


## Synthetic Order–Stock Reconciliation Engine

Laravel migration branch-এ `OrderStockReconciliation` নামে একটি pure, read-only analyzer যোগ হয়েছে। এটি শুধু সরবরাহ করা snapshot পরীক্ষা করে; কোনো Google Sheet, Apps Script, D1 বা stock service-এ সংযোগ/পরিবর্তন করে না।

### শনাক্ত করা anomaly

- `orphaned_reservation`: Order row নেই, কিন্তু applied reserve operation আছে।
- `stale_order_stock_stage`: Order row-এর StockStage এবং সর্বশেষ applied stock operation-এর resulting stage মেলে না।
- `missing_ledger_entry`: applied stock operation-এর ledger record নেই।
- `partial_compensation`: operation pending, failed বা compensation_failed অবস্থায় আছে।
- `missing_stock_operation`: non-legacy/non-NEW stage আছে, কিন্তু তার applied operation পাওয়া যায়নি।
- duplicate/invalid order বা operation identity এবং unknown operation state।

ফলাফল `in_sync` অথবা `review_required`, সঙ্গে issue count ও reference list।

### সীমাবদ্ধতা

- এটি production reconciliation চালায় না এবং কোনো stock repair করে না।
- Stock snapshot, operation log ও ledger data-এর canonical read adapter এখনো তৈরি হয়নি।
- Operation ordering-এ timestamp/sequence contract যোগ না হওয়া পর্যন্ত input order-কে latest operation-এর ক্রম হিসেবে ধরা হয়। Production adapter-এর আগে monotonic sequence বা trusted timestamp বাধ্যতামূলক।
- False positive এড়াতে blank/NEW/LEGACY_SKIPPED StockStage-এ missing operation alert তৈরি করা হয় না।

### Synthetic tests

Clean snapshot, orphaned reservation, missing ledger, stage mismatch, pending/failed compensation, duplicate operation ID, legacy/new exclusions, invalid identity এবং read-only behavior-এর test যোগ করা হয়েছে। CI ফলাফল আলাদাভাবে যাচাই করতে হবে।


## Read-only Google Sheets Order Adapter Contract

পরবর্তী ধাপে Laravel-এর জন্য `OrderSnapshotSource` read-only interface যোগ হয়েছে। এটি Google Sheets-এর `Online Order` master-এর ভবিষ্যৎ adapter-এর সীমা নির্ধারণ করে; এখনো Google API client, credentials, network call বা production binding নেই।

### Canonical snapshot fields

- `order_id`: স্থায়ী Order ID
- `status`: বর্তমান order status
- `stock_stage`: StockStage; legacy হলে null/LEGACY_SKIPPED থাকতে পারে
- `source_updated_at`: source timestamp থাকলে ISO-8601, নইলে null

Interface-এ কোনো create/update/delete method নেই। Fixture implementation-এ synthetic rows এবং 1–5000 row limit validation রয়েছে। Customer name, phone, address, payment data বা অন্য PII snapshot contract-এ রাখা হয়নি।

### ভবিষ্যৎ Google Sheets adapter-এর বাধ্যতামূলক শর্ত

1. শুধু অনুমোদিত spreadsheet ID এবং নির্দিষ্ট `Online Order` tab পড়বে; spreadsheet ID/credentials environment secret-এ থাকবে।
2. Header name দিয়ে column map করবে; column position অনুমান করবে না।
3. Order ID trim করে blank/duplicate ID reject বা quarantine করবে; row number-কে Order ID হিসেবে ব্যবহার করবে না।
4. Source timestamp অনুপস্থিত হলে ingestion time-কে source update time বলে চালাবে না।
5. Bounded read, pagination/batch read, timeout এবং retry/backoff থাকবে।
6. Read scope ছাড়া কোনো OAuth scope বা write permission চাইবে না।
7. Raw row/log-এ customer PII ছাপাবে না; শুধু reconciliation-এর প্রয়োজনীয় fields রাখবে।
8. Snapshot import-কে read-only রাখতে হবে; কোনো repair, stock adjustment বা status write নয়।
9. Adapter চালুর আগে Google Sheet header mapping এবং synthetic fixture-এর বিরুদ্ধে contract tests বাধ্যতামূলক।

`FixtureOrderSnapshotSource` এখন একমাত্র test implementation। Production service container-এ এটি bind করা হয়নি; API route-ও যোগ হয়নি।
