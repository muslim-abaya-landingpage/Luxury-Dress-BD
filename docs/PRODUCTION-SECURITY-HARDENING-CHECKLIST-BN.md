# Production security hardening ও rate limiting checklist

এই checklist বর্তমান repository-তে দেখা controls-কে production host/Apps Script/Google Sheets-এ যাচাই করার কাজ থেকে আলাদা করে। কোনো checkbox deployment status প্রমাণ করে না—owner ও evidence লিখে সম্পন্ন করুন।

## বর্তমান কোডে দেখা controls ও production verification

- `_headers`-এ HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` ও সীমিত `Permissions-Policy` আছে। `netlify.toml` Netlify publish configuration দেয়, কিন্তু live DNS/host এবং deployed response headers-কে আলাদাভাবে যাচাই করুন।
- বর্তমান `_headers`-এ **CSP নেই**। GTM, Google APIs, Apps Script, Meta/TikTok এবং inline scripts থাকার কারণে CSP সরাসরি enforce না করে প্রথমে `Content-Security-Policy-Report-Only` report-only rollout, allowlist review, তারপর incremental enforcement করুন। `frame-ancestors 'none'` CSP-তে যোগ করলেও পুরোনো header রাখা যেতে পারে।
- Apps Script order code-এ server-side field validation, honeypot, `SiteTs` age check, per-phone `rateLimitOrder_` default ৬ request/৩০ মিনিট, এবং duplicate signature cache-এর ১০-মিনিট window আছে। General `rateLimit_` limit ১২ request/১০ মিনিট; admin/inbox-এর আলাদা limits আছে। Frontend-এর ৩-সেকেন্ড `guardSubmit` কেবল UX anti-repeat control—এটি backend security rate limit নয়।
- **Repository patch:** `apps-script/Code.gs`-এ hard-coded bypass fallback সরানো হয়েছে; `ORDER_RATE_LIMIT_BYPASS` Script Property স্পষ্টভাবে সেট না থাকলে কোনো bypass হবে না। `npm run test:backend` default-deny ও explicit allowlist behavior পরীক্ষা করে। Production Apps Script project-এ এই property আগে থেকে সেট আছে কি না আলাদাভাবে review করুন; explicit allowlist থাকলে expiry, least privilege ও audit trail রাখুন। Phone value log/report-এ প্রকাশ করবেন না।
- `rateLimit_`/order limiter `CacheService` counter read-then-write pattern ব্যবহার করে। Cache eviction ও concurrent requests-এ threshold কঠোর/atomic থাকে—এমন ধরে নেবেন না। Edge/API gateway throttling, স্থিতিশীল idempotency key, server-side duplicate handling এবং concurrency test যোগ করুন।
- **Repository patch:** `GET RecordType=Subscribe` এখন `METHOD_NOT_ALLOWED` JSON দেয় এবং Sheet-এ লেখে না; footer-এর POST route বজায় আছে। Production-এ নতুন Apps Script version প্রকাশ করে GET-only probe দিয়ে “কোনো row যোগ হয়নি” যাচাই না করা পর্যন্ত live fix সম্পন্ন ধরে নেবেন না। POST mutation staging/test Sheet-এ যাচাই করুন।
- Public static `robots noindex` বা admin URL লুকানো authorization নয়। প্রতিটি admin API handler-এ server-side token/session/role check রাখুন; PII guest session-এ ফেরত না আসে তা API test করুন।

## Go-live / প্রতিটি release-এর আগে

- [ ] **Live origin ও transport:** DNS/provider নিশ্চিত; homepage, checkout, login/admin path-এ HTTPS; certificate, redirect ও HSTS response test। `includeSubDomains` চালু থাকলে সব subdomain-ও HTTPS-ready হতে হবে।
- [ ] **Headers:** production response-এ HSTS, `X-Content-Type-Options`, framing protection, Referrer ও Permissions Policy আছে। Netlify build-এ `scripts/prepare-netlify-headers.mjs` চালিয়ে generated headers যাচাই করুন। Login/admin/checkout-এর HTML-এ প্রয়োজন অনুযায়ী `Cache-Control: no-store` দিন; shared cache-এ user-specific response না রাখুন।
- [ ] **CSP:** Report-Only report-এ checkout, Apps Script, payments/tracking ও admin flow পরীক্ষা; সব third-party origin owner review করেছে; তারপর staged enforcement। CORS-কে authentication/authorization মনে করবেন না।
- [ ] **Secrets:** `AUTH_SECRET`, courier/Meta/SMTP/API tokens শুধু Google Apps Script Script Properties/secret manager-এ; `apps-script-copy.html`, browser JS, URL query, analytics, issue, CI log বা screenshot-এ নেই। Exposure সন্দেহ হলে rotate করুন এবং পুরোনো credential revoke করুন।
- [ ] **Admin/API authorization:** guest admin-orders redirect ছাড়াও backend-এর প্রতিটি privileged read/write role/token যাচাই করে। Token expiry, revoke/logout, staff least privilege, failed login lock/rate control এবং session rotation test করুন। LocalStorage-এ bearer token ব্যবহার হলে XSS/CSP risk বিশেষভাবে পর্যালোচনা করুন।
- [ ] **GET/POST semantics:** health/schema endpoints GET-only ও read-only। `Subscribe` GET patch-এর পর live Apps Script version-এ `METHOD_NOT_ALLOWED` দেয় এবং Sheet row বাড়ায় না—GET-only probe দিয়ে যাচাই করুন। Subscribe mutation POST-এ; order create/admin actions GET দিয়ে সম্ভব নয়। Referrer, browser prefetch, email scanner ও link preview-কে মাথায় রেখে verify করুন।
- [ ] **Input/business validation:** backend client total/price/discount-কে trust না করে server catalog ও delivery rules অনুযায়ী recompute করে; product ID/quantity/variant সীমা, address/name max length, email/phone format, honeypot, coupon expiry এবং stock state validate করে। HTML/Sheets formula injection-ও পরীক্ষা করুন।
- [ ] **Cross-site abuse:** public order endpoint-এ malicious site থেকে simple form POST হতে পারে; CORS policy alone এটি ঠেকায় না। Origin/anti-automation strategy, honeypot/challenge ও server-side throttling staging-এ যাচাই করুন; প্রয়োজন হলে controlled proxy/CSRF token architecture বিবেচনা করুন। Apps Script request header সীমাবদ্ধতা বিবেচনায় implementation যাচাই করুন।
- [ ] **Order integrity:** order request-এ stable idempotency key; duplicate retries-এর ফল একই order; concurrent একই phone/cart submit, Apps Script timeout ও Sheet lock timeout staging-এ test। LockService append safeguards, stock reserve/rollback ও reconciliation evidence রাখুন।
- [ ] **Rate-limit exception:** Apps Script Project Settings-এ `ORDER_RATE_LIMIT_BYPASS` Script Property আছে কি না দেখুন; প্রয়োজন না হলে মুছে দিন। থাকলে explicit, narrowly scoped allowlist, owner approval, review date/expiry ও audit log নিশ্চিত করুন। Test bypass behavior-কে production order data থেকে পৃথক রাখুন।
- [ ] **Monitoring:** rate-limit hit, auth failure, API timeout, repeated 5xx, Apps Script quota এবং Sheets reconciliation alarm আছে; alert label/log-এ phone, email, address, token, payment reference বা full request body নেই।
- [ ] **Backup/recovery:** Google Sheet access least-privilege; backup schedule, restore owner, restore test এবং incident window read-only audit copy বজায় আছে।

## Layered rate limiting plan

1. **Browser layer:** submit button disable + pending state রাখুন। Invalid form submission-কে cooldown দিয়ে শাস্তি দেবেন না; cooldown কেবল valid request শুরু হলে। এটি usability/double-click guard, malicious-client control নয়।
2. **Apps Script layer:** প্রতিটি mutation route-এ per-action counter, account/phone key এবং independent global abuse cap দিন। Cache-based limiter best-effort হিসেবে ধরুন; attacker identity ঘোরালে bypass হতে পারে এবং cache eviction/reset সম্ভব। Error response user-friendly রাখুন, কিন্তু retry/backoff দুর্বোধ্যভাবে লুকাবেন না।
3. **Edge/API gateway:** `muslimabaya.com`-এর CDN rule সরাসরি `script.google.com` request-কে rate limit করতে পারে না, কারণ checkout browser সোজা Apps Script domain-এ POST করে। API traffic edge-এ throttle করতে চাইলে controlled same-origin proxy/API gateway দরকার; তা architecture/deployment change। এর মধ্যে Apps Script server-side limit-ই বাধ্যতামূলক এবং abuse monitoring থাকতে হবে।
4. **Endpoint-specific policy:** login/register-এ account + source IP burst detection; order-এ phone + IP + stable idempotency, কিন্তু shared carrier NAT-এ customer block না হয় এমন threshold; newsletter/review-এ contact/product-key limit; public stock/schema GET-এ moderate endpoint cap। Traffic baseline দেখে warning/challenge/temporary block set করুন, blanket site-wide block নয়।
5. **Concurrency ও retry:** counters atomic না হলে `LockService`/trusted gateway/managed store-এ increment; clients `429`/rate error-এ `Retry-After` বা bounded backoff দেখায়; order POST-এ idempotency না থাকলে automatic retry নিষিদ্ধ। Load test কেবল staging-এর synthetic data-তে করুন।

## Deployment-পরবর্তী verification

- [ ] Anonymous browser-এ admin URL ও direct admin API call; unauthorized response-এ কোনো order/customer data নেই।
- [ ] Rapid login/register/order bursts staging-এ; allowed request, throttled request, response/message এবং recovery window নথিভুক্ত।
- [ ] Repeated identical order, simultaneous duplicate, network timeout-after-commit এবং retry scenario idempotency দিয়ে test।
- [ ] CSP Report-Only violations triage; forced CSP enforce করার আগে checkout/cart/payment/tracking regression test।
- [ ] Prometheus/Alertmanager P1/P2 test alert ও recovery alert পাঠানো; notification receiver owner acknowledge করেছে।
- [ ] Release commit, Apps Script deployment version, host header check, rate-limit policy version, rollback owner ও review date incident/runbook-এ লেখা।
