# Laravel Google Sheets Read-only Adapter Plan (Bangla)

## সিদ্ধান্ত ও বর্তমান অবস্থা

এই নথি বাস্তবায়নের নকশা; এটি কোনো Google API call, credential setup, production binding, route বা deployment চালু করে না। বর্তমান canonical order source Google Sheets-এর `Online Order` tab। Laravel-এর `OrderSnapshotSource` interface এবং `OrderSnapshotMapper` এখনো synthetic/fixture পর্যায়ে আছে।

## বর্তমান repository-তে যাচাইকৃত reusable pattern

- Cloudflare Pages-এর `functions/_lib/google-auth.js` service-account JWT bearer flow ব্যবহার করে এবং OAuth scope `https://www.googleapis.com/auth/spreadsheets.readonly` নির্দিষ্ট করে।
- `functions/_lib/sheet-snapshot.js` Google Sheets API metadata ও `values:batchGet` read করে।
- `functions/api/admin-read.js` কেবল অনুমোদিত read operation-এ ওই reader ব্যবহার করে; অপ্রত্যাশিত/unsupported operation Apps Script-এ fallback করে।
- Cloudflare Pages-এর `GOOGLE_SA_JSON` secret-এর service account-কে Sheet-এ Viewer access দেওয়ার documented pattern আছে।
- এই Cloudflare implementation Laravel adapter নয়; Laravel-এ secret, token বা network client এখনো bind করা হয়নি।

## প্রস্তাবিত Laravel adapter boundary

1. `OrderSnapshotSource`-ই একমাত্র public contract থাকবে; এতে create/update/delete বা stock mutation method যোগ করা যাবে না।
2. Production implementation হবে `GoogleSheetsOrderSnapshotSource`; fixture implementation tests/local development-এর জন্য থাকবে।
3. Service-account credential Laravel host-এর secret manager/environment secret-এ থাকবে; source code, GitHub Actions artifact, exception, log বা API response-এ নয়।
4. Credential-এর Sheet permission হবে Viewer এবং OAuth scope হবে কেবল `spreadsheets.readonly`। Drive-wide scope বা edit scope নয়।
5. Spreadsheet ID configuration/secret থেকে আসবে; request parameter বা user input থেকে কখনো নয়। Tab name fixed allowlist `Online Order`।
6. Production binding feature flag/configuration ছাড়া সক্রিয় হবে না; missing/invalid configuration হলে fixture বা production read silently mix করা যাবে না—explicit unavailable error দিতে হবে।

## PII-minimized read algorithm

1. Spreadsheet metadata থেকে `Online Order` tab আছে কি না যাচাই।
2. শুধু header row পড়া; verified canonical header mapping:
   - `অর্ডার আইডি` / `Order ID` → `order_id`
   - `স্ট্যাটাস` / `Status` → `status`
   - `StockStage` → `stock_stage`
   - `Updated At` optional → `source_updated_at`
3. Header থেকে column positions resolve করে কেবল ওই 3–4টি column range পড়া; customer name, phone, address, payment, CartJSON বা অন্য PII columns request-ই করা হবে না।
4. Rows bounded chunks-এ পড়া; page size configurable কিন্তু সর্বোচ্চ 5000। Pagination cursor/row offset contract interface-এ যোগ না হওয়া পর্যন্ত এক call-এ 5000-এর বেশি snapshot silently truncate করা যাবে না।
5. প্রতিটি chunk `OrderSnapshotMapper` দিয়ে validate; duplicate Order ID cross-page-ও detect করতে হবে। Missing/duplicate required headers, malformed timestamp, invalid row বা duplicate ID হলে পুরো snapshot reject/quarantine; partial snapshot success নয়।
6. Sheet-এ dedicated `Updated At` না থাকলে `source_updated_at = null`; ingestion time-কে source update time হিসেবে দেখানো যাবে না।
7. API timeout, bounded retry with jitter/backoff, 429/5xx handling, response-size cap এবং no-store caching policy থাকতে হবে। Retry শুধু read request-এ।
8. Snapshot response/log-এ শুধু Order ID, Status, StockStage ও source timestamp থাকবে; raw row, token, email, phone বা customer data log করা যাবে না।

## Interface change দরকার হবে

বর্তমান `readOrderSnapshots(int $limit = 500): array` interface-এ continuation cursor নেই। তাই adapter implementation-এর আগে contract-কে explicit page model-এ উন্নীত করতে হবে, যেমন:
- `readOrderSnapshotPage(?string $cursor, int $limit): OrderSnapshotPage`
- page payload: canonical rows + opaque next cursor + source snapshot metadata
- maximum page size 5000
- cursor-এ spreadsheet ID, tab identity, row offset এবং snapshot version/fingerprint bind থাকবে; user-editable raw A1 range গ্রহণ করা হবে না।

Cursor-সহ cross-page duplicate validation এবং snapshot consistency নিশ্চিত না হওয়া পর্যন্ত reconciliation engine-এ partial pages পাঠানো যাবে না।

## Security ও rollout gates

- [ ] Laravel hosting/runtime এবং secret storage নির্ধারিত; নতুন paid service অনুমোদিত নয়।
- [ ] Dedicated read-only service account বা বিদ্যমান service-account credential reuse—কোনটি হবে তা credential owner অনুমোদন করবেন; private key কপি/rotate করা হবে না নীরব সম্মতি ধরে।
- [ ] Google Sheet Viewer permission যাচাই।
- [ ] API scope test: readonly scope ছাড়া token গ্রহণ নয়।
- [ ] PII exclusion test: Google API request-এ শুধু mapped columns।
- [ ] Pagination, duplicate IDs across pages, timeout, 429, 5xx, malformed rows, stale cursor ও oversized response failure tests।
- [ ] Production data sample export-এর আগে owner approval; প্রথম run শুধু dry-run, read-only এবং count/hash reconciliation।
- [ ] D1, Sheets, Apps Script, stock বা order status-এ কোনো write নেই।
- [ ] Production service binding/API route আলাদা review ও approval ছাড়া নয়।

## স্পষ্ট non-goals

এই ধাপে OAuth credential তৈরি/আপলোড, Sheet share permission পরিবর্তন, live order read, data import, order write, stock mutation, database migration, production deployment বা billing change করা হবে না।
