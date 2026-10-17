# Luxury Dress BD — Presentation Speaker Script

**উদ্দেশ্য:** সিস্টেম পরিচিতি, ক্রেতার end-to-end flow, backend integration, test coverage এবং production operations বোঝানো।
**প্রস্তাবিত শ্রোতা:** e-commerce/business owner, operations, developer/QA, support team।
**সময়:** ১২–১৫ মিনিট (প্রশ্নোত্তর বাদে)।
**ব্যবহার:** নিচের প্রতিটি শিরোনাম একটি slide-এর প্রস্তাবিত শিরোনাম; `বক্তৃতা` অংশটি সরাসরি বলা যায়। `দেখাবেন` অংশটি বক্তার cue। এই স্ক্রিপ্ট বর্তমান repository-র দেখা architecture-ভিত্তিক; production-এ কোন hosting provider/API version live আছে তা deployment dashboard দিয়ে নিশ্চিত করতে হবে।

---

## Slide 1 — Luxury Dress BD: অনলাইন স্টোর থেকে অর্ডার অপারেশন পর্যন্ত

**সময়:** ১ মিনিট
**দেখাবেন:** ব্র্যান্ড/স্টোরের screenshot, তারপর চারটি শব্দ: Discover → Choose → Checkout → Fulfil.

**বক্তৃতা:**

“আজ আমরা Luxury Dress BD বা Muslim Abaya-র e-commerce system-টি একসঙ্গে দেখব—শুধু storefront নয়, product discovery থেকে order intake এবং পরবর্তী operational handoff পর্যন্ত। Repository-তে এটি React single-page app নয়; মূল customer site হলো static HTML, CSS ও JavaScript পৃষ্ঠা। সেই পৃষ্ঠাগুলো একটি shared cart ও checkout flow ব্যবহার করে। অর্ডার জমা হয় Google Apps Script Web App-এ, আর Apps Script Google Sheets-কে order ও operational record হিসেবে ব্যবহার করে।

এই স্থাপত্যের ভালো দিক হলো storefront সহজে deploy করা যায় এবং content দ্রুত প্রকাশ করা যায়। একই সঙ্গে front-end deployment এবং backend deployment আলাদা—তাই release ও monitoring-এ এই দুইটি boundary মনে রাখা জরুরি। আজকের আলোচনার শেষে কীভাবে এই flow পরীক্ষা করব, production-এ কী দেখব, এবং সমস্যা হলে কীভাবে নিরাপদে সাড়া দেব—সেগুলোও পরিষ্কার হবে।”

---

## Slide 2 — System map: browser, static site, Apps Script, Sheets

**সময়:** ১.৫ মিনিট
**দেখাবেন:** Browser → HTML/JS storefront → Apps Script Web App → Google Sheets diagram; পাশেই optional courier, auth, analytics connectors.

**বক্তৃতা:**

“এই diagram-এ browser হলো customer-facing অংশ। Homepage, category, product, cart drawer এবং checkout—এসব static assets দিয়ে render হয়। Cart browser storage-এ রাখা হয় এবং product, category, checkout page একই cart utility ব্যবহার করে; তাই page navigation-এর পর cart হারিয়ে যাওয়া বা quantity দ্বিগুণ হওয়া গুরুত্বপূর্ণ integration risk।

Checkout-এ customer ও delivery details validation-এর পরে `RecordType=Order` সহ Apps Script-এ পাঠানো হয়। Repository-তে success response-এর `Success|<Order ID>` রূপ দেখা যায়; error response হলে customer-কে error/WhatsApp fallback দেখানো হয় এবং cart রেখে দেওয়া হয়। Backend-এর canonical order record `Online Order` Sheet-এ লেখা হয়। Signup/login, admin, stock, order tracking, coupon, reviews ও newsletter-ও বিভিন্ন API route ব্যবহার করে।

ঐচ্ছিক downstream integration—যেমন courier বা Meta conversion API—মূল order intake থেকে আলাদা monitor করতে হবে। একটি tracking pixel fail করলেই order হারিয়েছে ধরে নেওয়া যাবে না; আবার browser-এ success দেখালেই Sheet row আছে, সেটিও ধরে নেওয়া যাবে না।”

---

## Slide 3 — Customer journey: আবিষ্কার থেকে order confirmation

**সময়:** ১.৫ মিনিট
**দেখাবেন:** Homepage → category/product → cart → checkout → thank-you; responsive mobile screenshots.

**বক্তৃতা:**

“Customer প্রথমে homepage বা category থেকে item খুঁজে পায়, product detail-এ size/color/quantity নির্বাচন করে এবং cart-এ যোগ করে। Checkout-এ নির্বাচিত item, size, quantity, price ও delivery location আবার review করা যায়। District ও thana/upazila নির্বাচন করা হয়; তারপর payment method, terms এবং contact information দেওয়া হয়।

Flow-এর শেষে order API-তে submit হয়। Success response এলে cart clear করা হয় এবং thank-you page-এ order ID দেখানো হয়। Backend error এলে cart clear হওয়া উচিত নয়—এটি recovery-র জন্য খুব গুরুত্বপূর্ণ। WhatsApp বিকল্পটি শুধু message পাঠানোর সুবিধা; repository-র checkout text স্পষ্ট করে যে WhatsApp message নিজে থেকে Sheet-এ order save করে না। তাই customer support-কে ‘message পাঠানো’ আর ‘order গ্রহণ হয়েছে’—এই দুইটি আলাদা করে বলতে হবে।”

---

## Slide 4 — Pricing, delivery ও validation-এর গুরুত্বপূর্ণ নিয়ম

**সময়:** ১.৫ মিনিট
**দেখাবেন:** একটি উদাহরণ cart: ৫৫০ টাকা item + ৮০ টাকা Dhaka delivery = ৬৩০; পাশে ৩+ item হলে free delivery. Payment options.

**বক্তৃতা:**

“Checkout total তিনটি প্রধান অংশে তৈরি হয়: নির্বাচিত item-এর subtotal, district অনুযায়ী delivery charge এবং প্রয়োগ করা coupon discount। Repository-র checkout code-এ Dhaka rate ৮০ টাকা, অন্য district ১৫০ টাকা এবং ৩ বা তার বেশি quantity-তে delivery free—এই নিয়ম hard-coded দেখা যায়। উদাহরণে ৫৫০ টাকার একটি product Dhaka-তে নিলে মোট ৬৩০ টাকা হওয়ার কথা। এই সংখ্যাগুলো site configuration ও Apps Script-এর live pricing logic-এর সঙ্গে deploy-এর আগে মিলিয়ে নিতে হবে; পুরোনো generic `config.js`-এর charge আলাদা থাকতে পারে, তাই UI-কে একমাত্র source of truth ধরা ঠিক নয়।

Name, Bangladesh mobile format, address, district, thana/upazila এবং terms acceptance checkout-এর gate। bKash, Nagad বা Bank transfer বেছে নিলে transaction/reference field validation প্রযোজ্য। Automated test-এ প্রতিটি gate একবার করে verify করব, যাতে ভুল তথ্য backend-এ না যায়।”

---

## Slide 5 — Backend record, stock ও admin boundary

**সময়:** ১.৫ মিনিট
**দেখাবেন:** Order request → `Online Order` row → status/stock ledger → admin dashboard; guest redirect cue.

**বক্তৃতা:**

“Order request শুধু নাম ও total নয়; এটি cart JSON, item/variant, district, thana, payment method এবং event metadata-ও বহন করে। Backend order schema-তে size, total, order ID ও status-এর column position গুরুত্বপূর্ণ—বর্তমান repository `api-setup.html`-এ schema endpoint-এ GET করে H=Size, I=Total, J=Order ID, K=Status যাচাই করে। Google Sheet-এর header বা Apps Script version drift করলে customer UI স্বাভাবিক দেখালেও operations-এ ভুল data জমতে পারে।

Admin panel customer-facing route নয়। Guest visitor-কে admin login-এ redirect করতে হবে এবং API-তেও token/role verify করতে হবে; শুধু menu থেকে link লুকানো নিরাপত্তা নয়। Orders, phone বা address observability dashboard-এ কপি করা হবে না। Stock reserve, release, sold ledger এবং order status transition-ও audit trail-সহ পরীক্ষা করা দরকার।”

---

## Slide 6 — Integration/E2E test strategy

**সময়:** ১.৫ মিনিট
**দেখাবেন:** Test pyramid: page smoke → cart/checkout logic → mocked API → isolated stage backend.

**বক্তৃতা:**

“আমাদের E2E suite বাস্তব browser-এ critical user journey চালায়, তবে production order endpoint-এ write করে না। Playwright test server repository-র static server চালায়। Apps Script URL-কে test route interception দিয়ে mock করা হয়, তাই test order ID synthetic এবং Google Sheet-এ customer test row তৈরি হয় না।

এই test suite-এ critical page smoke check, localStorage cart hydrate ও selected-line গণনা, Dhaka delivery এবং free delivery calculation, field/terms/payment-reference validation, mock backend success হলে thank-you page/order ID/cart clearing, mock backend error হলে modal/retry/cart persistence, এবং unauthenticated admin orders redirect আছে। Mobile viewport overflow-ও একটি quick regression check। Test run-এ checkout startup-এর একটি config timing issue ধরা পড়ে: API config defer থাকায় inline order handler সেটি পড়ার আগেই চলছিল; load order ঠিক করে suite-এ API readiness assertion যোগ করা হয়েছে। Production integration-এর জন্য আলাদা Apps Script deployment এবং আলাদা Sheet ব্যবহার করা উচিত। Production-এ বাস্তব order দিয়ে smoke test চালালে sales data, stock এবং support workflow দূষিত হতে পারে—তাই তা এই suite-এ নেই।”

---

## Slide 7 — Production monitoring: শুধু website up কিনা নয়

**সময়:** ১.৫ মিনিট
**দেখাবেন:** Dashboard mockup: storefront uptime, checkout funnel, API latency, persisted order reconciliation, Apps Script errors.

**বক্তৃতা:**

“Production monitoring-এ একটিমাত্র green uptime badge যথেষ্ট নয়। আলাদা আলাদা করে দেখতে হবে: homepage ও checkout HTTP availability; Apps Script root ও `OrderSchema` health GET; browser errors; Apps Script execution latency/failures; এবং customer-কে accepted বলা order-এর সঙ্গে Sheet-এ আসা order-এর মিল। Funnel-এ visit, cart, checkout, submit attempt, backend accepted এবং Sheet row—প্রতিটি ধাপ আলাদা।

শুরুর alert threshold হিসেবে storefront ৫ মিনিটে একাধিক probe fail, API error rate পাঁচ মিনিটে পাঁচ শতাংশের বেশি, ধারাবাহিক API timeout, accepted order কিন্তু Sheet row নেই, duplicate order ID, বা admin PII leak জরুরি signal। এগুলো proposed starting point—traffic ও baseline মেপে নির্ধারণ করতে হবে। Alert-এ error class, time window, affected route ও deploy ID থাকবে; কখনো customer phone, address, session token বা payment reference থাকবে না।”

---

## Slide 8 — Alert, on-call এবং incident response

**সময়:** ১.৫ মিনিট
**দেখাবেন:** P1/P2/P3 triage ladder; symptom → verify → mitigate → reconcile → close.

**বক্তৃতা:**

“P1-এ storefront বা checkout সম্পূর্ণ unavailable, order intake failure, data corruption অথবা guest-এ order data প্রকাশ পড়ে। P1 alert on-call বা owner-কে তাৎক্ষণিক পৌঁছাবে। P2-তে API latency, Apps Script quota বা courier integration degradation থাকবে। P3-তে non-critical image 404, analytics discrepancy বা পরের business day-এ দেখা যেতে পারে এমন warning থাকবে।

Checkout down হলে প্রথমে একাধিক region থেকে probe চালিয়ে DNS/host incident আর application release আলাদা করি। API GET ব্যর্থ হলে Apps Script Executions, URL/deployment version, access setting এবং schema check দেখি। Customer success বললেও Sheet row নেই—তখন customer-এর তথ্য public chat-এ না নিয়ে authorized support channel-এ যাচাই করি। Double submit বা duplicate order তৈরি না করতে আগে reconciliation করি। Stock mismatch হলে ledger snapshot ও order state দেখে owner অনুমোদনে affected SKU সাময়িক hold করা যায়। Admin data leak হলে এটি security P1; access বন্ধ, session/token review এবং preservation procedure জরুরি।”

---

## Slide 9 — Release, rollback ও version control

**সময়:** ১ মিনিট
**দেখাবেন:** Release checklist: tests green, frontend commit, Apps Script version, health checks, rollback owner.

**বক্তৃতা:**

“Static frontend আর Apps Script backend আলাদা deploy হয়। Frontend commit push করলেই Apps Script নতুন version হয়ে যায় না। Release record-এ দুটো version—hosted commit ও Apps Script deployment version—লিখতে হবে। Apps Script পরিবর্তনের পরে New version deploy, root GET ও `OrderSchema` GET verify করতে হবে. Frontend deploy-এর পরে product/checkout assets, location dropdown, mobile layout এবং public API configuration health check করব.

Rollback plan deploy-এর আগে owner-এর সঙ্গে ঠিক করতে হবে। Latest static release regression হলে known-good commit rollback করা যায়; Apps Script error হলে Apps Script deployment history থেকে version restore করতে হবে—দুটো একসঙ্গে rollback করা সবসময় সঠিক নয়। Release-পরবর্তী ৩০ মিনিট dashboard ও executions পর্যবেক্ষণ, তারপর ২৪ ঘণ্টা order reconciliation এবং stock/courier state দেখা হবে।”

---

## Slide 10 — সিদ্ধান্ত, ownership ও পরবর্তী কাজ

**সময়:** ১ মিনিট
**দেখাবেন:** Go-live checklist: monitored routes, alert owner, stage test, privacy, backup/recovery, release record.

**বক্তৃতা:**

“সংক্ষেপে, এই store-এর reliability তিনটি জায়গায় নির্ভর করে: browser-এ সঠিক cart ও validation; Apps Script/Sheets-এ order ঠিকভাবে গ্রহণ ও সংরক্ষণ; এবং operations team-এর সময়মতো detection ও reconciliation। পরবর্তী কাজ হলো Playwright suite CI-তে চালানো, staging Apps Script + test Sheet তৈরি করা, uptime/schema GET monitor ও alert channel configure করা, order integrity dashboard/owner নির্ধারণ করা এবং Sheet backup/restore বাস্তবে test করা।

Go-live-এর আগে আমরা নিশ্চিত করব public এবং checkout probe green, schema version সঠিক, guest admin redirect কার্যকর, PII observability থেকে বাদ, alert owner acknowledge করেছে এবং rollback owner প্রস্তুত। এই শর্তগুলো থাকলে system শুধু deploy করা নয়—পর্যবেক্ষণযোগ্য এবং incident থেকে পুনরুদ্ধারযোগ্যও হবে। ধন্যবাদ।”

---

## Q&A-এর জন্য speaker notes

- **“একটা test order live-এ দিয়ে দেখা যাবে?”** — এই suite production write করে না। Production-এর বদলে পৃথক staging Apps Script ও test Sheet ব্যবহার করতে হবে।
- **“Apps Script healthy দেখায়, order কেন নেই?”** — root GET কেবল web app response প্রমাণ করে; OrderSchema schema GET ও নিরাপদ staging POST আলাদাভাবে যাচাই করুন; তারপর Sheet reconciliation।
- **“WhatsApp order কি order sheet-এ জমা?”** — checkout-এ WhatsApp হলো customer message fallback; সেটি নিজে থেকে order sheet-এ save হয় না।
- **“Firewall/Cloudflare monitor কি আগে থেকে আছে?”** — এই guide proposed setup; actual DNS/host/account settings validate না করা পর্যন্ত configured বলা যাবে না।
- **“Firebase কি order database?”** — repository-তে Firestore rules একটি unused prototype-কে চিহ্নিত করে; live checkout/orders Apps Script + Google Sheets-এ চলে বলে source note। Firebase project-এর live state আলাদাভাবে যাচাই করতে হবে।
