# v8.3 — দাম আপডেট (১ নভেম্বর ২০২৬)
- ফুল হাফেজা সেট: ৳2400 → ৳2385 (variant Black-সহ)
- শুধু হিজাব ও নিকাব: ৳1400 → ৳1200
- `node build-seo.cjs` চালানো হয়েছে: index.html-এর দাম/schema আর _worker.js-এর দাম-যাচাই তালিকা নতুন দামে।
- tests/regression.cjs নতুন দামে আপডেট; ১৯/১৯ টেস্ট পাস।
- ভিত্তি: shop-muslimabaya-cloudflare-v8.2 (লাইভে এখন যে পুরোনো build চলছে তার চেয়ে নতুন — thank-you Lead ট্র্যাকিং, draft restore আর সার্ভারে দাম-যাচাইয়ের ফিক্স আছে)।
ডিপ্লয়: ড্যাশবোর্ডে টেনে এনে আপলোড নয় — GitHub → Actions → Landing Deploy (docs/LANDING-DEPLOY.md), অথবা `npx wrangler pages deploy . --project-name muslimabaya-shop-landing --branch main`।
