# Checkout API configuration timing bug — technical note

## সংক্ষিপ্তসার

Checkout-এর inline order handler-এ `ORDER_SCRIPT_URL` একটি **top-level `const`** হিসেবে তৈরি হয়। এটি `getSiteApiUrl()` থেকে Apps Script Web App URL পড়ে, অথবা fallback হিসেবে `MA_AUTH_CONFIG.apiUrl` দেখে। কিন্তু `site-api-config.js` তখন `defer` করা ছিল এবং `auth-config.js`-এরও পরে রাখা ছিল। HTML parser inline checkout script-এ পৌঁছালে deferred script তখনও execute না করায় getter/config অনুপস্থিত ছিল। ফলে `ORDER_SCRIPT_URL` শুরুতেই `''` হয়ে স্থির থাকত। পরে config load হলেও `const` নিজে থেকে পুনরায় গণনা হয় না; submit handler তাই “Order API is not configured” দেখিয়ে থেমে যেত।

## কেন `defer`-এ এই race/ordering সমস্যা হয়

- External `<script defer src="…">` download HTML parsing-এর সঙ্গে চলতে পারে, কিন্তু execute করে parsing শেষ হওয়ার পর।
- Inline classic `<script>` parsing-এর সময়ই execute হয়।
- তাই inline handler যদি defer করা script-এর global (`getSiteApiUrl`) পড়ে, inline code আগে চলতে পারে—even যদি defer script tag HTML-এ আগে দেখা যায়।
- এই পৃষ্ঠায় URL একবার `const ORDER_SCRIPT_URL = …`-এ snapshot করা ছিল। Deferred script পরে `window.MA_SITE_API` ও `window.getSiteApiUrl` তৈরি করলেও snapshot blank-ই থাকত।
- `auth-config.js` API getter থেকে URL নিতে পারে, তাই API config-কে auth config-এর আগেও load করা উচিত।

## আগের arrangement (সমস্যাযুক্ত)

```html
<script src="site-api-health.js?v=20260610"></script>
<script src="auth-config.js?v=20261009-inbox"></script>
<!-- ...other blocking scripts... -->
<script defer src="site-api-config.js?v=20261009-inbox"></script>
<script defer src="stock-sync.js?v=20261017-async-stockv1"></script>

<script>
  const ORDER_SCRIPT_URL =
    (typeof getSiteApiUrl === 'function' && getSiteApiUrl()) ||
    (window.MA_AUTH_CONFIG && window.MA_AUTH_CONFIG.apiUrl) ||
    '';
  // Checkout submission handler uses this captured value.
</script>
```

## প্রয়োগ করা patch

```diff
 <script src="site-security.js?v=20260603ord"></script>

+<script src="site-api-config.js?v=20261009-inbox"></script>
 <script src="site-api-health.js?v=20260610"></script>
 <script src="auth-config.js?v=20261009-inbox"></script>
 <script src="auth-api.js"></script>
 ...
-<script defer src="site-api-config.js?v=20261009-inbox"></script>
 <script defer src="stock-sync.js?v=20261017-async-stockv1"></script>
```

এখন parser `site-api-config.js` execute করে `window.MA_SITE_API.url` এবং `window.getSiteApiUrl()` তৈরি করে; এরপর `auth-config.js`, তারপর inline checkout script চলে। অর্থাৎ URL snapshot তৈরির সময় config ready থাকে। Configটি একটি public Apps Script Web App URL; auth secret বা token এতে যোগ করা হয়নি।

## পরীক্ষায় কীভাবে ধরা পড়ে ও কীভাবে যাচাই করা হয়েছে

Playwright test-এ Apps Script network calls interception/mock-এ ধরা থাকে। প্রথম browser run-এ valid checkout submit করার সময় UI “Order API is not configured” দেখায় এবং কোনো POST mock-এ পৌঁছায়নি। Script order ঠিক করার পর helper-এ নিম্নলিখিত readiness assertion যোগ করা হয়:

```js
await expect.poll(
  () => page.evaluate(() => window.getSiteApiUrl?.() || '')
).not.toBe('');
```

এরপর suite-টি mocked API-তে order success, synthetic order ID/thank-you presentation এবং failure/retry যাচাই করে। সর্বশেষ পূর্ণ suite run-এ ৭/৭টি test পাস করেছিল। Live production order/Sheet write এই test-এ হয় না।

## Release verification

1. `site-api-config.js` production hosting-এ HTTP `200` status-এ serve হচ্ছে এবং canonical Apps Script URL রয়েছে কি না নিশ্চিত করুন।
2. `/checkout`-এ API configuration runtime-এ populated কি না browser devtools-এ যাচাই করুন; submit button click করে production order লিখবেন না.
3. CI E2E suite pass এবং Apps Script root + `OrderSchema` GET pass হওয়ার পরে static host deploy করুন.
4. Deploy-পরবর্তী monitor-এ checkout availability/API readiness যাচাই করুন; backend write test দরকার হলে পৃথক staging Apps Script + Sheet ব্যবহার করুন.
