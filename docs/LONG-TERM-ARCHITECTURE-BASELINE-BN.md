# Muslim Abaya — দীর্ঘমেয়াদি Architecture Baseline

**তারিখ:** 2026-10-25  
**উদ্দেশ্য:** MuslimAbaya-কে বহু বছর একই codebase ও domain-এ নিরাপদে পরিচালনা করার জন্য development-এর আগে একটি স্থায়ী baseline নির্ধারণ করা।

## 1. বর্তমান বাস্তব architecture

বর্তমান repository একটি static/frontend-first storefront, যার সঙ্গে admin/operations layer এবং Google Apps Script API যুক্ত। Product catalog-এর একটি বড় অংশ `category-products.js`-এ `window.CATEGORY_PRODUCTS` হিসেবে রাখা আছে। Admin configuration থেকে Apps Script project/API-এর সঙ্গে সংযোগ করা হয়।

বর্তমান stack-এর গুরুত্বপূর্ণ অংশ:

- Frontend: HTML/CSS/JavaScript + Vite tooling
- Runtime dependencies: React 19, Vite 6, Firebase SDK, Express, Motion, Lucide
- Catalog source: `category-products.js`
- Admin: একাধিক `admin-*.html/js/css` module
- Backend/operations: Google Apps Script API
- CI: GitHub Actions
- E2E: Playwright
- Deployment: Cloudflare-oriented workflows/configuration

## 2. দীর্ঘমেয়াদি লক্ষ্য

পরবর্তী development-এ এই নিয়মগুলো অনুসরণ করতে হবে:

1. **Business data এবং presentation আলাদা থাকবে।**
2. Product/category/order-এর মূল data কোনো নির্দিষ্ট page-এর HTML-এর মধ্যে hard-code করা যাবে না।
3. একই product data একাধিক জায়গায় আলাদা করে copy করা যাবে না।
4. Admin panel হবে business operation-এর primary control surface।
5. Production-এ যাওয়ার আগে automated test gate pass করতে হবে।
6. Core functionality পরিবর্তনের আগে backup/rollback path নিশ্চিত করতে হবে।
7. নতুন feature যোগ করার আগে existing data flow ভাঙছে কি না পরীক্ষা করতে হবে।
8. Permanent delete-এর বদলে যেখানে সম্ভব archive/soft-delete ব্যবহার করতে হবে।
9. Secrets, tokens ও credentials source code-এ রাখা যাবে না।
10. ভবিষ্যৎ developer যেন documentation পড়ে system বুঝতে পারে—এই মান বজায় রাখতে হবে।

## 3. প্রথম বড় architectural risk

বর্তমান catalog source-এ product records সরাসরি `category-products.js`-এ রাখা আছে। এটি ছোট catalog-এর জন্য কার্যকর হলেও দীর্ঘমেয়াদে product সংখ্যা বাড়লে maintenance ও synchronization risk তৈরি করতে পারে।

**তাই এখনই catalog migration শুরু করা হবে না।** আগে বর্তমান product → admin → publish → frontend flow সম্পূর্ণ map ও test করতে হবে। কারণ সরাসরি data source বদলালে বর্তমান production functionality ভেঙে যাওয়ার ঝুঁকি আছে।

## 4. Development order — বাধ্যতামূলক sequence

### Phase 1 — Stability & Baseline
- বর্তমান data flow audit
- automated test failures ঠিক করা
- production-safe backup/rollback যাচাই
- admin/frontend contract স্থির করা

### Phase 2 — Data Architecture
- Product schema একীভূত করা
- Category schema একীভূত করা
- stock/price/variant rules এক জায়গায় আনা
- duplicate data source কমানো

### Phase 3 — Admin as Control Center
- product management
- category management
- inventory
- orders
- customers
- homepage/content controls
- role/permission

### Phase 4 — Reliability
- staging workflow
- release gate
- monitoring
- backup/restore drill
- security hardening

### Phase 5 — Performance & Growth
- image optimization
- caching/CDN
- database/query optimization
- analytics and reporting

## 5. এই baseline-এর পরের কাজ

**পরবর্তী কাজের আগে নতুন design বা নতুন feature যোগ করা হবে না।** প্রথম implementation task হবে বর্তমান automated test suite-এর failing cases audit ও repair করা, কারণ বর্তমানে CI-তে একাধিক functional regression ধরা পড়েছে। Stable test gate ছাড়া architectural migration করা নিরাপদ নয়।

## 6. Completion rule

কোনো phase সম্পন্ন বলা যাবে না যতক্ষণ না:

- code change committed
- automated tests pass
- production impact checked
- rollback path understood
- user-facing behavior verified

এই document ভবিষ্যৎ development-এর reference হিসেবে থাকবে।
