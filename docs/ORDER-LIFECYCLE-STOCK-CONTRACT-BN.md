# Order Lifecycle ও Stock Reservation Contract (Migration Draft)

## উদ্দেশ্য ও সীমা

এই নথি Laravel 13 API-এর ভবিষ্যৎ order adapter-এর contract নির্ধারণ করে। এটি **production integration নয়**। এই ধাপে কোনো production order, customer, stock, Google Sheet, Apps Script, D1 বা Supabase-এ read/write করা হয়নি। কোনো order API route বা stock mutation endpoint চালু করা হয়নি।

## যাচাইকৃত production source

- Canonical order master: Google Sheets-এর `Online Order` tab।
- Website checkout একই `EventID + normalized phone` পুনরায় পাঠালে আগের Order ID ফেরত দেয়; attempt lookup stock/duplicate check-এর আগে হয়। EventID না থাকলে/অবৈধ হলে সেটি idempotency key হিসেবে সংরক্ষণ করা হয় না।
- Order intake একটি script lock-এর মধ্যে unique Order ID তৈরি করে, stock availability যাচাই করে, stock reserve করে এবং Online Order row append করে।
- Admin order create-ও Online Order-এ লেখে এবং stock reserve করার চেষ্টা করে।
- Production status vocabulary: `Pending`, `Confirmed`, `Processing`, `Shipped`, `Delivered`, `Cancelled`, `Fake`।
- Existing backend test নিশ্চিত করে `Processing` status-এ stock অপরিবর্তিত থাকে।
- Stock variants/ledger এবং order stock-stage fields Apps Script-এ পরিচালিত হয়। D1 `ma-orders` এই master-এর বিকল্প নয়।

## Laravel contract

`OrderLifecycleContract` কেবল pure validation/planning দেয়:

- পরিচিত status canonical case-এ normalize করে; অজানা status reject করে।
- Checkout idempotency key: EventID + Bangladesh mobile number normalize করে SHA-256 তৈরি করে।
- একই status পুনরায় সেট করলে `unchanged`।
- `Processing`-এ পরিবর্তন stock mutation ছাড়াই হয়।
- অন্য status transition stock mutation অনুমান করে না; `adapter_required` ফেরত দেয়, যাতে ভবিষ্যতে বিদ্যমান Apps Script stock lifecycle adapter ব্যবহার করা যায়।

## ভবিষ্যৎ write integration-এর বাধ্যতামূলক শর্ত

1. Order create এবং status update প্রথমে Google Sheets `Online Order` canonical write adapter-এর সাথে reconcile করতে হবে; D1 operational intake/abuse queue-কে order master করা যাবে না।
2. Website checkout retry-এর একই EventID + normalized phone-এ একই Order ID ফেরত দিতে হবে। Laravel adapter-এ persistent idempotency store না থাকলে write route প্রকাশ করা যাবে না।
3. Manual admin order-এর জন্য আলাদা client-generated idempotency key এবং server-side uniqueness/transaction boundary লাগবে।
4. Stock reservation/release/sold transition অবশ্যই একই authoritative Apps Script/Sheets stock ledger-এর serialized operation হতে হবে। Laravel/D1-এ দ্বিতীয় independent stock counter বানানো যাবে না।
5. Order row append এবং stock reservation-এর মধ্যে partial failure হলে reconciliation/compensation workflow থাকতে হবে; success response কেবল উভয় operation-এর durable result নিশ্চিত হওয়ার পর।
6. Duplicate retry কখনো দ্বিতীয়বার reserve করবে না। Cancelled/Delivered/Fake/other status-এর stock effect production lifecycle adapter থেকে নির্ধারণ করতে হবে; Laravel-এ অনুমান করে release/sold করা যাবে না।
7. Product variant identity, quantity, size এবং tracked/untracked rules existing stock manager-এর সাথে যাচাই না করে stock reservation enable করা যাবে না।

## পরবর্তী gate

- Synthetic PHPUnit tests চালানো।
- Google Sheets adapter contract ও failure/retry matrix review করা।
- Apps Script stock-stage function-এর পূর্ণ transition semantics নথিভুক্ত করা।
- তারপরই read-only adapter design; write route ও production rollout আলাদা অনুমোদন এবং QA ছাড়া নয়.
