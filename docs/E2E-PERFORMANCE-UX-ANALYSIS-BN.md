# E2E রিপোর্ট: পারফরম্যান্স ও UX review

## রিপোর্টের ফল

সর্বশেষ local Chromium run-এ **৭/৭টি test pass** হয়েছে। Suite-এর মোট সময় ছিল **৩২.৩ সেকেন্ড**। আগের run ছিল ৪২.১ সেকেন্ড; তার মধ্যে `required checkout details, Terms acceptance, and payment reference block submission` test-টি ১৫.৪ সেকেন্ড নিয়েছিল। তিনটি fixed ৩.১-সেকেন্ড sleep সরানোর পর একই scenario ৭.৪ সেকেন্ডে নেমেছে। মোট suite runtime প্রায় ২৩% কমেছে। এটি test-suite/CI runtime improvement—production page latency-র উন্নতি বলে গণ্য করা যাবে না।

## শনাক্ত UX সমস্যা ও সমাধান

Checkout-এর `MaSecurity.guardSubmit('checkout-order', 3000)` আগে field/Terms/payment-reference validation-এর আগেই চালু হতো। প্রথমবার অসম্পূর্ণ form submit করলে guard-এর ৩-সেকেন্ড window শুরু হয়ে যেত। Customer দ্রুত ভুল তথ্য ঠিক করে আবার submit করলে “Please wait a moment and try again.” পেতেন, যদিও আগের request backend-এ যায়নি। E2E validation test-এ তাই তিনবার ৩.১-সেকেন্ড অপেক্ষা ছিল।

Guard-টি এখন field, district/thana, Terms, payment reference ও API URL validation-এর পরে—valid order request শুরু হওয়ার ঠিক আগে চলে। `orderSubmitting` এবং disabled submit button pending network request-এর সময় double-submit রোধ করে। E2E test এখন invalid input ঠিক করে, Terms গ্রহণ করে, payment reference যোগ করে সঙ্গে সঙ্গে আবার submit করে; কোনো fixed cooldown sleep লাগে না।

## Test durations কী বোঝায়

সর্বশেষ run-এ সবচেয়ে দীর্ঘ test ছিল ওই validation/payment journey (৭.৪ সেকেন্ড)। Cart/delivery (৫.০), successful mocked order (৫.৮), backend-rejection/recovery (৫.৩) এবং mobile overflow (৪.৪) test-গুলো browser setup, page load, dropdown readiness, UI waits ও assertion মিলিয়ে সময় নিয়েছে। এগুলো **TTFB, LCP, INP বা user-perceived load time নয়**। Suite একটি local static server-এ চলে এবং Google Apps Script calls mock করে; production network, Apps Script quota/latency, Google Sheets write, courier, CDN cache miss বা real mobile device-কে মাপে না।

একটি আগের run-এ browser navigation-এর সময় local Python server-এ `BrokenPipeError` দেখা গিয়েছিল, কিন্তু test pass করেছিল এবং পরের full run-এ warningটি পুনরায় দেখা যায়নি। এটি client connection আগেভাগে বন্ধ হওয়ার test-server log noise বলে মনে হচ্ছে; production server outage বা storefront failure-এর প্রমাণ নয়।

## পরবর্তী performance verification

- Deploy হওয়া canonical domain থেকে mobile/desktop Lighthouse বা WebPageTest চালান; run-এ GTM/Meta/TikTok load state আলাদা করে লিখুন। পুরোনো `PERFORMANCE-REPORT.md`-এর local score-কে বর্তমান live baseline ধরে নেবেন না।
- RUM/field data-তে checkout navigation এবং `begin_checkout` থেকে API response পর্যন্ত p50/p75/p95 সংগ্রহ করুন; consent ও privacy policy অনুসরণ করুন। কোনো PII বা order payload instrumentation-এ রাখবেন না।
- API GET health probe, Apps Script execution latency এবং persisted-order reconciliation আলাদা metric রাখুন। E2E mock test backend persistence-এর বিকল্প নয়।
- Staging-এ throttled mobile, slow network, fail/retry ও page reload-এর UX পরীক্ষা করুন। Order POST automatic retry করবেন না যতক্ষণ server-side idempotency key ও reconciliation নিশ্চিত না।
- ৩২.৩ সেকেন্ডের local suite-টি একটি নির্দিষ্ট sandbox run; CI runtime runner load, browser version ও parallelism অনুযায়ী বদলাতে পারে। Trend দেখতে CI history-তে median/p95 job duration পর্যবেক্ষণ করুন।

## পরিবর্তনের সঙ্গে যুক্ত ফাইল

- Checkout validation/cooldown ordering: [`checkout.html`](../checkout.html)
- Immediate correction/retry assertion: [`tests/e2e/luxury-dress-bd.spec.cjs`](../tests/e2e/luxury-dress-bd.spec.cjs)
- আগের performance audit এবং সীমাবদ্ধতা: [`PERFORMANCE-REPORT.md`](../PERFORMANCE-REPORT.md)
