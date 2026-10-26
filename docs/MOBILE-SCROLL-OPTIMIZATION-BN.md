# মুসলিমআবায়া.কম: মোবাইল স্ক্রল অপ্টিমাইজেশন

**তারিখ:** ২৬ অক্টোবর ২০২৬
**পরিধি:** হোমপেজের মোবাইল স্ক্রল/রেন্ডারিং; পরিবর্তনগুলো প্রস্তুত, কিন্তু এখনো লাইভে প্রকাশ করা হয়নি।

## কী সমস্যা পাওয়া গেছে

কোড পর্যালোচনায় shared header বা bottom navigation-এ প্রতি scroll frame-এ চলা JavaScript scroll handler পাওয়া যায়নি। তাই কোনো একটি listener-কে নিশ্চিত মূল কারণ বলা যাবে না। তবে মোবাইল হোমপেজে viewport-এর বাইরের category/product section-গুলোও সক্রিয়ভাবে render হচ্ছিল, সব section একই সময়ে entrance animation পেত, এবং hero carousel মোবাইলে স্বয়ংক্রিয়ভাবে slide বদলাত। এগুলো লম্বা ক্যাটালগ ও সীমিত ক্ষমতার ফোনে অপ্রয়োজনীয় layout/paint/composite কাজ বাড়াতে পারে। এ সিদ্ধান্তগুলো কোড অডিটভিত্তিক সম্ভাব্য কারণ—বাস্তব ফোনের frame-time trace নয়।

## কী পরিবর্তন করা হয়েছে

1. `index-home-muslim-abaya.css` ও বিতরণকৃত `index-home-muslim-abaya.min.css`-এ প্রথম product section ছাড়া নিচের section-গুলোর জন্য mobile/touch viewport-এ `content-visibility: auto` এবং `contain-intrinsic-size: auto 520px` যোগ হয়েছে। এতে দূরের section viewport-এর কাছে না আসা পর্যন্ত render/layout কাজ এড়িয়ে যেতে পারে। পুরোনো browser-এ নিয়মটি উপেক্ষিত হবে, তাই সাধারণ rendering-ই থাকবে।
2. `home-glass.css`-এ mobile/touch visitor-এর জন্য সব homepage section-এর entrance animation বন্ধ হয়েছে; visual design এবং desktop animation অক্ষত।
3. `index-home-muslim-abaya.js` এবং rebuilt `home-render.min.js`-এ coarse pointer বা 900px-এর মধ্যে hero auto-rotation বন্ধ হয়েছে। Hero-র next/previous ও dot control সচল, desktop autoplay আগের মতো, এবং reduced-motion পছন্দ মানা হয়। Product-row-এর touch autoplay আগে থেকেই বন্ধ ছিল; সেটি বদলানো হয়নি।
4. `index.html`-এ সংশ্লিষ্ট CSS/JS asset cache key আপডেট হয়েছে।
5. `npm run test:scroll` command যোগ করে `.github/workflows/e2e.yml`-এ যুক্ত হয়েছে, যাতে নতুন autoplay/containment আচরণ ভবিষ্যৎ পরিবর্তনে regression না করে।

## যাচাই

- `npm run test:scroll`: **১৮/১৮ পাস**।
- `npm run test:backend`: **১৩০/১৩০ পাস**।
- `npm run test:order-flow`: সব অন্তর্ভুক্ত validation ও workflow পরীক্ষা পাস।
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: **১০৫/১০৫ পাস**, responsive viewport checks-সহ।
- `npm run build`: build **সফলভাবে সম্পন্ন**। Vite-এ classic HTML script-গুলো module না হওয়ায় warning এসেছে; build শেষ হয়েছে, warning-গুলো এই পরিবর্তনের কারণে নয়।
- `git diff --check`: পাস।

## কী এখনো প্রমাণিত নয়

এগুলোই নির্দিষ্ট ডিভাইসে অনুভূত আটকে যাওয়ার একমাত্র কারণ—এ দাবি করছি না। CI browser এবং code-level test বাস্তব কমক্ষমতার Android ফোনের বিকল্প নয়। কোনো production Lighthouse score, FPS/frame time বা Core Web Vitals উন্নতির সংখ্যা এই কাজ থেকে দাবি করা হয়নি। `content-visibility`-এর আনুমানিক section height scroll anchoring-এ প্রভাব ফেলছে কি না, ধীর ফোনে হাতে ধরে যাচাই করা উচিত।

কোনো optimization-ই ভবিষ্যতে সব ধরনের সমস্যা অসম্ভব করতে পারে না: browser/OS, নেটওয়ার্ক, third-party scripts, নতুন পণ্য/ছবি, এবং Cloudflare/GitHub Pages configuration বদলালে নতুন সমস্যা হতে পারে। Cloudflare account-এ কোনো পরিবর্তন করা হয়নি।

## প্রকাশের নিরাপদ ধাপ

1. Patch-টি repository branch-এ review করে merge করুন; আগে preview/staging-এ publish করুন।
2. কমপক্ষে একটি কমক্ষমতার Android ফোন ও Chrome-এ একই homepage scroll path তুলনা করুন: hero → category row → footer; hero control, section height, anchor/category navigation এবং reduced-motion-ও যাচাই করুন।
3. DevTools Performance trace-এ dropped frames এবং Layout/Paint/Composite সময় তুলনা করুন। Lighthouse run-কে আলাদা করে নথিবদ্ধ করুন; সেটি একাই scroll FPS প্রমাণ করে না।
4. regression/visual issue দেখা গেলে `home-render.min.js`, `index-home-muslim-abaya.min.css`, source stylesheet/script, এবং `index.html`-এর cache-key পরিবর্তনসহ patch revert করুন; আগের bundle/asset key ফিরিয়ে দিন।
5. Production deployment হওয়ার পর fresh cache-এ আবার পরীক্ষা করুন। এখনো push, merge, Cloudflare পরিবর্তন বা production deployment করা হয়নি।
