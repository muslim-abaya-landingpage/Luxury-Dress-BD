# Muslim Abaya — stock sync, tab polling ও cache headers

## কী পরিবর্তন হয়েছে

- `stock-sync.js`-এর synchronous XHR সরিয়ে asynchronous request করা হয়েছে। Apps Script stock endpoint-এর আগের measured response প্রায় **5.9 সেকেন্ড TTFB** ও **6.2 সেকেন্ড total** ছিল; নতুন flow এই অপেক্ষায় browser main thread আটকে রাখে না।
- ১৫ সেকেন্ডের short-lived browser snapshot থাকলে catalog normalization-এর আগে প্রয়োগ হয়; এরপর live response stock data পুনরায় মেলায়। Request ১২ সেকেন্ডে timeout হয় এবং API failure-এ catalog fallback অক্ষত থাকে।
- Stock response এলে homepage, category card ও product detail-এর badge/order controls update হয়; বর্তমান filter/sort state অযথা reset হয় না। Variant data normalization-এ সংরক্ষিত থাকে। Product Manager-এর explicit `inStock: false` override অগ্রাধিকার পায়।
- Storefront tab দৃশ্যমান থাকলে ৬০ সেকেন্ড পরপর stock status poll হয়। Hidden tab-এ API call হয় না; tab visible/focus/online হলে দ্রুত refresh চেষ্টা হয়।
- `_headers`-এ নির্দিষ্ট public storefront HTML path-এ `max-age=0, s-maxage=60` দেওয়া হয়েছে; admin, checkout, sign-in ও order path allowlist-এ নেই। এটি কার্যকর edge cache করতে Cloudflare Cache Rule-এ ওই public paths-এর জন্য cache eligibility চালু এবং origin header respect করা প্রয়োজন।
- `stock-sync.js` immutable cache header-এ চলে, তাই নতুন script browser-এ পুরোনো version দিয়ে আটকে না থাকার জন্য stock-sync URL version-টি storefront HTML references-এ bump করা হয়েছে।

## যাচাই

- `node --check` দিয়ে সংশ্লিষ্ট JavaScript যাচাই করা হয়েছে। Stock, stock-variant UI ও admin-speed suites-এ **১৭টি test pass** করেছে।
- নির্ধারিত Cloudflare build command `node scripts/build-cloudflare.mjs` সফল হয়েছে: catalog validation, product SEO generation এবং operations/catalog/gallery tests pass করেছে। Build command deploy output-এ generated product pages ও content-version URLs তৈরি করে; generated build artifacts source change হিসেবে আলাদাভাবে commit করা হয়নি।
- `git diff --check`-এ whitespace error পাওয়া যায়নি।

## প্রকাশ ও operational সীমা

- Changes `feat/async-live-stock-sync` branch-এ আছে। Cloudflare Pages preview/production deployment GitHub branch integration-এর build status দিয়ে যাচাই করতে হবে; `main`-এ merge-ই production deploy trigger করবে।
- Product Manager stock toggle বর্তমান atomic publisher দিয়ে GitHub `main`-এ commit করে; production branch `main` হলে সেটি সরাসরি live deploy শুরু করতে পারে। Preview test-এর সময় এই production toggle-কে test data দিয়ে ব্যবহার করবেন না।
- Stock Analytics থেকে Available `0` save করলে Apps Script-এর `AdminStockVariantSave` ledger mutation এবং public `StockStatus` endpoint এই polling-এর data source। Apps Script source বা deployment বদলানো হয়নি।
- Polling ৬০ সেকেন্ডে সীমিত রাখা হয়েছে, কারণ endpoint Google Sheets stock ranges পড়ে। Traffic বেশি হলে server-side short-lived cache ও stock-write invalidation যোগ করার আগে Apps Script quota/latency মাপুন।
- Cloudflare Dashboard-এর Cache Rule আলাদা account-side setting; approved public-route allowlist, `Eligible for cache`, Edge TTL `respect origin`/header না থাকলে bypass, এবং Browser TTL `Respect origin` দিয়ে সেট করতে হবে। Free plan-এর Edge TTL override minimum ২ ঘণ্টা হওয়ায় override TTL ব্যবহার করা হয়নি।
