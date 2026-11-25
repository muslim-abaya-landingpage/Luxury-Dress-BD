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
