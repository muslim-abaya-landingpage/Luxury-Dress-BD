# v8.2 (2026-10-23)

- **First-party cookie:** Worker এখন নিজের ডোমেইন থেকে `_fbp`, `_fbc` (fbclid থেকে) আর `_ttp` ৯০ দিনের জন্য আবার বসায়। শুধু muslimabaya.com/.co ডোমেইনে কাজ করে, pages.dev-এ নয়।

# v8.1 বাগ ফিক্স (2026-10-22)

1. **Thank-you পেজ ঠিক করা হয়েছে।** Cloudflare Pages `/thank-you.html` থেকে `/thank-you`-তে redirect করে। আগে এই অবস্থায় ভুল কোড লোড হতো, ফলে browser-এর Lead ইভেন্ট আর অর্ডার আইডি কোনোটাই কাজ করত না। এখন দুটো URL-ই চেনে (`site-router.js`, `tracking.js`, `app.js`, `index.html`)।
2. **Draft restore:** রিফ্রেশ করলে বাছাই করা পণ্য আর হারায় না (`app.js`)।
3. **Quick-buy-এর দাম** এখন variant-এর দাম দেখায় (`app.js`)।
4. **Server-side দাম যাচাই:** Worker এখন catalog থেকে total আবার হিসাব করে মিলিয়ে দেখে। না মিললে অর্ডার বাদ দেয় না। অর্ডার Sheet-এ যায়, সাথে `SpecialNotes`-এ "⚠ PRICE CHECK FAILED" আর `PriceCheck=FAILED` লেখা থাকে। Server-side Lead ইভেন্টে যাচাই করা দাম পাঠানো হয় (`_worker.js`)।
5. **TikTok Events API:** server ইভেন্টে `ttclid` আর `ttp` যোগ করা হয়েছে, এতে match quality ভালো হয়।
6. **SEO data:** `build-seo.cjs` আবার চালানো হয়েছে। Worker-এর data-তে এখন `shop` সাইটও আছে।
7. **লোগো:** 79KB-এর ফাইলের বদলে 7KB-এর ফাইল (`assets/logo-96.png`)।
8. **নতুন টেস্ট:** মোট ১৮টা regression টেস্ট আছে, চালাতে `node tests/regression.cjs`।

config.js বদলানোর পর অবশ্যই `node build-seo.cjs` চালাবেন। এটা SEO data আর runtime bundle দুটোই আবার তৈরি করে।
