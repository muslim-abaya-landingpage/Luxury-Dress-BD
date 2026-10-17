# Production Deployment-এর পর Monitoring ও Alarm Guide

**সিস্টেম:** Luxury Dress BD / Muslim Abaya (`muslimabaya.com`)
**প্রস্তুতির ভিত্তি:** নির্বাচিত repository-তে দেখা static HTML/CSS/JS storefront; Google Apps Script Web App; Google Sheets-এ `Online Order`, `Customers`, `Admins`, `Sessions`, `Subscribe` ও stock data; storefront-এর cart/checkout; Apps Script-ভিত্তিক admin; optional courier, Meta CAPI, GTM/Meta/TikTok tracking।
**গুরুত্বপূর্ণ:** এই গাইড একটি rollout plan। এখানে Cloudflare/Netlify/GitHub Pages, Google Cloud alert, uptime probe বা alarm আগে থেকেই configure আছে—এমন দাবি করা হচ্ছে না। ব্যবহৃত hosting ও account অনুযায়ী ধাপগুলো বাস্তবে চালু করুন।

## 1. পর্যবেক্ষণের লক্ষ্য ও প্রথম মাসের SLO

প্রথম ২–৪ সপ্তাহ baseline সংগ্রহ করুন; নিচের threshold-গুলো শুরুর প্রস্তাব, বাস্তব traffic/latency দেখে বদলাতে হবে।

| ক্ষেত্র | প্রাথমিক লক্ষ্য | সতর্কতা | জরুরি অ্যালার্ম |
|---|---:|---:|---:|
| Public storefront availability | মাসে ≥99.9% | 5 মিনিটে ≥2 probe fail | 5 মিনিটে ≥3 region/probe fail অথবা checkout route down |
| Checkout page TTFB | p95 <1.0 s (পরিমাপের baseline পরে ঠিক করুন) | 5 মিনিট p95 >2 s | 10 মিনিট p95 >4 s |
| Order API/schema GET | p95 <5 s, success ≥99% | 5 মিনিটে error >2% বা p95 >8 s | 5 মিনিটে error >5%, schema mismatch, বা ধারাবাহিক timeout |
| Order completion | funnel baseline থেকে পর্যবেক্ষণ | 15 মিনিটে order-submit success baseline-এর 50%-এর নিচে | 15 মিনিটে 0 success, অথচ checkout attempt আছে |
| Order data integrity | Order ID, status, total ও timestamp বৈধ | 15 মিনিটে anomaly >1% | duplicate ID, order accepted but no row, stock/order mismatch |
| Browser errors | baseline + release comparison | 5 মিনিট JS error rate >1% session | checkout-critical JS errors বেড়ে conversion বন্ধ |
| Admin access | guest-এর কাছে PII নেই | auth/network anomaly | unauthenticated order data exposure — সর্বোচ্চ অগ্রাধিকার |

**SLO-কে বিক্রির সাফল্যের সমার্থক ভাববেন না।** Checkout submit success rate, order sheet-এ row উপস্থিতি, conversion, courier handoff—এগুলো আলাদা পরিমাপ। কেবল frontend “Success” দেখানো backend row integrity প্রমাণ করে না।

## 2. Monitoring-এর স্তর ও কী মাপবেন

### A. বাইরের synthetic uptime probe

UptimeRobot, Better Stack, Pingdom, Cloudflare Health Check, অথবা সমতুল্য probe-এ HTTPS GET-গুলো 1–5 মিনিট অন্তর যোগ করুন:

- `https://muslimabaya.com/` — 200, title/brand string উপস্থিত।
- `https://muslimabaya.com/checkout` অথবা deploy-এর canonical checkout URL — 200, HTML-এ `orderForm`/`submitBtn` উপস্থিত।
- `https://muslimabaya.com/site-api-config.js` — 200; response-এ API URL থাকা উচিত কিন্তু কোনো secret নয়।
- Apps Script Web App URL-এর root — প্রত্যাশিত text `Muslim Abaya API OK`।
- একই URL-এ `?RecordType=OrderSchema` — JSON `ok:true`; `columns.size=8`, `total=9`, `orderId=10`, `status=11`। এই endpoint repository-র `api-setup.html`-এর schema check-এর সঙ্গে মেলে।
- ঐচ্ছিক `?RecordType=StockStatus` — response shape/latency যাচাই করুন; inventory পরিবর্তনকারী endpoint নয়।

Probe যেন **GET-only** হয়। Monitor থেকে কখনো production-এ `RecordType=Order`, signup, subscribe বা admin mutation POST করবেন না। Synthetic POST দরকার হলে আলাদা Apps Script deployment + আলাদা test Sheet + test customer ব্যবহার করুন; test শেষে cleanup এবং test data চিহ্নিত করুন।

দুইটি ভিন্ন network/region থেকে probe চালান, যাতে এক probe provider failure-কে production outage ধরে না নেওয়া হয়। Recovery confirmation-এর আগে অন্তত 2–3 consecutive success চাই।

### B. Browser RUM ও user journey

Google Tag Manager/analytics থাকলে, privacy policy ও consent settings অনুসরণ করে, প্রতি পেজে performance এবং checkout funnel event-গুলো instrument করুন:

1. `view_item` / product view
2. `add_to_cart`
3. `begin_checkout`
4. district/upazila নির্বাচন সফল
5. `add_payment_info` (যদি checkout flow-তে প্রযোজ্য)
6. `order_submit_attempt`
7. API success/error class (যেমন timeout, network, backend validation) — **কোনো নাম, ফোন, ঠিকানা, email, payment transaction ID বা পূর্ণ request body নয়**
8. thank-you page load + order ID presence (ID-কে PII/credential ধরে নেবেন না; analytics-এ raw order ID না পাঠানোই ভালো)

Desktop/mobile, browser, page version, status bucket ও latency-তে ভাগ করুন। Funnel numerator/denominator একই session ও time window থেকে নিন। Ad pixels-এর reported Purchase-কে Google Sheet-এ persisted order-এর বিকল্প মনে করবেন না।

### C. Apps Script ও Google Sheets

Google Apps Script editor-এর **Executions**-এ failed/timed-out executions, function, runtime ও deployment version দেখুন। Google Workspace/Cloud Monitoring export বা Apps Script quota alerts account-এ available থাকলে সীমা 70% (warning) / 85% (critical) ব্যবহার করুন; quota unavailable হলে দৈনিক manual check ও spike alarm রাখুন। Alerts-এ script project/deployment version উল্লেখ করুন।

Sheets-এ সীমিত admin-only reconciliation চালু করুন (দৈনিক বা প্রতি 15 মিনিটে, volume/quotas অনুযায়ী):

- `Online Order` row count-এ unexplained drop/plateau;
- `Order ID` ফাঁকা/duplicate;
- `Total` non-numeric/negative, `Quantity` 1-এর কম, ভবিষ্যৎ/অস্বাভাবিক timestamp;
- online accepted order-এর পর নির্ধারিত সময়ে row না আসা;
- order row ও cart JSON item quantity/stock reserve mismatch;
- stock ledger-এ reserve/release/sold transition অসম্পূর্ণ;
- `Customers`/`Admins`/`Sessions`-এ অস্বাভাবিক authentication failures/rate-limit;
- courier submit failure/duplicate dispatch; courier provider-এ success, sheet-এ status update fail.

**Reconciliation data-তে customer details log বা alert text-এ কপি করবেন না।** Dashboard-এ masked identifier, row reference/hashed correlation ID, error class, timestamp, deployment ID, count-গুলো ব্যবহার করুন। Raw PII বা session token error tracker, URL query, screenshot, trace/video attachment-এ পাঠাবেন না।

### D. Frontend/asset ও security

Host/edge analytics থেকে 4xx/5xx, HTML/JS/CSS/image 404, cache status, TLS expiry, DNS resolution ও deploy commit/version মাপুন। GitHub Pages বনাম Cloudflare Pages/Netlify কোনটি live origin—একবার DNS ও hosting dashboard দিয়ে নিশ্চিত করুন; `_headers` ফাইল GitHub Pages-এ কার্যকর নয় বলে repository performance notes সতর্ক করে। Deploy-এর পরে cache purge/asset versioning plan ঠিক করুন।

Sentry/সমতুল্য RUM-এ JavaScript exceptions ও failed fetch class সংগ্রহ করা যেতে পারে, তবে request/DOM data scrub করুন। CSP/security header, admin login redirect, `robots` exclusion এবং Firestore rules—যদি Firebase project এখনও ব্যবহৃত হয়—আলাদা security check। Repository-র `firestore.rules` অনুযায়ী Firestore prototype/live checkout-এর order backend নয়; প্রকৃত checkout source Apps Script + Sheets। Repository-র বাইরে live Firebase rules ও deployment state যাচাই করুন।

## 3. Alert routing ও deduplication

কমপক্ষে তিনটি alert class ও owner নির্ধারণ করুন:

- **P1 — On-call/owner অবিলম্বে:** storefront/checkout down; production order create ব্যর্থ; accepted order row অনুপস্থিত; PII exposure; stock/order corruption। SMS/phone push + incident channel; 24/7 coverage না থাকলে business-hour escalation fallback লিখুন।
- **P2 — 30 মিনিটে triage:** API error/latency threshold, Apps Script quota/failed executions, tracking বা courier integration fail, asset deployment errors। Email/chat channel।
- **P3 — পরের business day:** non-critical image/CSS 404, SEO/reporting drift, low-volume data-quality warning। Ticket/email digest।

Alert-এ থাকবে: service/route, first/last failure, region, deployment commit/version, error ratio + denominator, request correlation ID, dashboard link, runbook action। **Alert body-তে customer PII/token/order payload থাকবে না।** একই incident-এর alert 15 মিনিট deduplicate, recovery alert পাঠান এবং threshold recovery-এর পর 15 মিনিট stable না হলে auto-close করবেন না।

Prometheus/Blackbox/Grafana-এর starter config এবং Slack/Email receiver wiring-এর জন্য [monitoring setup guide](../monitoring/README.md) ও [Alertmanager practical guide](ALERTMANAGER-SLACK-EMAIL-GUIDE-BN.md) দেখুন। Receiver-এর secret বা customer identifier repository/alert body-তে দেবেন না।

## 4. Release ও প্রথম 30 মিনিটের checklist

### Deploy-এর আগে

- `npm ci` (lockfile commit হলে), `npm run test:e2e`; CI-তে browser install/dependency step নিশ্চিত করুন।
- E2E suite production API request mock করে—CI log-এ request assertion review করুন।
- branch/commit, affected HTML/JS/CSS, rollback commit, deployment owner, release time record করুন।
- Google Apps Script বদলালে `Deploy → Manage deployments → Edit → New version → Deploy`; `api-setup.html` বা `OrderSchema` GET দিয়ে live version ও schema যাচাই করুন। Frontend deploy হলেই Apps Script auto-update হয় না।
- Production order-এর আগে stage/test copy-তে real backend integration test; live API mutation test কেবল ব্যবসায়িকভাবে অনুমোদিত, পৃথক test customer/test sheet ও cleanup-সহ।

### Deploy-এর পর

- T+0: homepage, category/product asset, checkout ও static security/admin route smoke check।
- T+2 min: Apps Script root GET + `OrderSchema` GET + latency/error dashboard।
- T+5 min: mobile/desktop checkout form render, API configuration runtime-এ populated, location dropdown populate, 550+Dhaka shipping total UI যাচাই—কিন্তু production order submit নয়।
- T+10 min: Apps Script executions, Google Sheet row count, error/404, browser exception ও API synthetic GET দেখুন।
- T+30 min: error budget/checkout funnel এবং release পূর্ববর্তী 30 মিনিটের সঙ্গে তুলনা; release annotation দিন।
- পরবর্তী 24 ঘণ্টা: অস্বাভাবিক order drop, stock reservation/rollback, courier status ও analytics divergence পর্যবেক্ষণ।

## 5. Incident runbook

| লক্ষণ | প্রথম যাচাই | পদক্ষেপ |
|---|---|---|
| Home/checkout 5xx/timeout | আলাদা region probe; DNS/TLS; host status; deploy timestamp | host/CDN incident হলে status অনুসরণ; সদ্য deploy হলে last-known-good frontend rollback; API থেকে আলাদা issue হিসেবে log |
| Site চলে, API root/OrderSchema ব্যর্থ | Apps Script URL ও deployment, Who has access, execution errors, quota | Apps Script `New version` deploy ও schema check; frontend-এ API URL বদলাবেন না যতক্ষণ পর্যন্ত canonical URL নিশ্চিত না; backend rollback/repair আলাদা |
| API GET ঠিক, অর্ডার Sheet-এ নেই | Apps Script executions; `Online Order` header/schema; order response | Website synthetic POST করবেন না; authorized stage test; incident window-এর order attempt-গুলো customer support-এর মাধ্যমে শনাক্ত; duplicate submit এড়াতে reconciliation ছাড়া পুনঃsubmit নয় |
| Customer বলে সফল, sheet-এ row নেই | confirmation timestamp/মাস্কড contact দিয়ে authorized search; event/error log | পূর্ণ order payload chat-এ শেয়ার নয়; merchant-এর নিরাপদ channel-এ verify; একই idempotency/correlation key থাকলে আগে সেটি যাচাই |
| Stock negative/oversold | stock ledger-এর reserve/release/sold transitions ও সংশ্লিষ্ট order IDs | ওই SKU/variant-এর বিক্রি সাময়িক থামানো/stock sync যাচাই—owner অনুমোদনে; sheet cell সরাসরি বদলানোর আগে audit snapshot; reconciliation পরে reopen |
| Admin orders page guest-এ তথ্য দেখায় | private/incognito browser, API permission, admin guard ও Apps Script token validation | P1 security incident; exposure বন্ধ করুন, session/token revoke/rotate owner-এর অনুমোদনে; logs সংরক্ষণ কিন্তু PII কপি সীমিত; code/deploy rollback ও access review |
| Courier/Meta/TikTok failure | provider status/quota/token expiry; order submission independently works? | order গ্রহণ বন্ধ করবেন না যদি core order safe থাকে; failed handoff queue/manual reconciliation; secrets শুধুমাত্র provider console/script properties-এ rotate |

### Incident close-out

Start/end, detection delay, affected orders count (PII ছাড়া), root cause, customer resolution channel, fix commit/deploy ID, data reconciliation ও follow-up owner লিখুন। Root cause নিশ্চিত না হলে “unknown” বলুন—অনুমানকে fact করবেন না।

## 6. Dashboard-এ প্রস্তাবিত panels

1. **Availability:** `/`, `/checkout`, API root, `OrderSchema`, region-wise uptime.
2. **Checkout funnel:** visit → cart → checkout → submit attempt → backend accepted → sheet row → thank-you.
3. **Latency/error:** frontend p50/p95/p99; Apps Script execution duration/errors; 4xx/5xx/timeouts.
4. **Order integrity:** accepted vs persisted rows, duplicate/missing ID, invalid totals/status, stock ledger state.
5. **Capacity/operations:** Apps Script quotas, Sheets row/size limits, courier/API failures, rate-limit spikes.
6. **Security/privacy:** guest admin access tests, auth failure rates, unexpected access anomalies, secret exposure scan.
7. **Release annotation:** Git commit, static-host deploy id, Apps Script deployment version (দুটি আলাদা version field)।

## 7. Ownership / handover template

- Store/hosting owner: `________________`
- Apps Script + Sheets owner: `________________`
- On-call/escalation channel: `________________`
- Hosting provider ও deployed domain/DNS: `________________`
- Apps Script canonical URL ও deployment ID (secret নয়): `________________`
- Order sheet backup/restore owner ও tested recovery date: `________________`
- P1 acknowledgment target / business-hours fallback: `________________`
- Last successful production-safe synthetic GET: `________________`
- Last isolated stage order test + cleanup confirmation: `________________`

**Go-live gate:** public + checkout probe green; schema GET expected columns; last deployment/version recorded; test suite pass; alert route acknowledged; no PII in observability; rollback owner present; production order write test বাদ।
