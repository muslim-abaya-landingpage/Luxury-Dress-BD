# ল্যান্ডিং পেজ (shop.muslimabaya.com) — দাম/লেখা বদলানো ও ডিপ্লয়

ল্যান্ডিং পেজের সব ফাইল এখন এই রিপোর `landing-shop/` ফোল্ডারে। `main`-এ বদলালে
`.github/workflows/landing-deploy.yml` টেস্ট চালিয়ে Cloudflare Pages প্রজেক্ট `muslimabaya-shop-landing`-এ
নিজে থেকে ডিপ্লয় করে (অর্ডার নেওয়ার `_worker.js` সহ)।

## নাম/দাম নিজে বদলাতে (ফোন বা কম্পিউটার থেকে)
1. GitHub → রিপো → `landing-shop/config.js` → ✏️ (Edit)।
2. `products` অংশে `name`, `details`, `price` বদলান। রঙ (variants) থাকলে তার `price`-ও একই করুন।
3. **Commit changes** চাপুন। বাকিটা নিজে হয়: টেস্ট → দাম/SEO আপডেট → লাইভ (২–৩ মিনিট)।
4. GitHub → Actions → Landing Deploy-এ সবুজ টিক দেখুন। লাল হলে কিছু লাইভ হয়নি, আগের পেজই চলছে।

## ড্যাশবোর্ডে ফোল্ডার টেনে এনে আপলোড করবেন না
তাতে `_worker.js` (অর্ডার `/api/order`) বাদ পড়তে পারে, অর্ডার আসা বন্ধ হয়ে যায়।

## একবারের সেটআপ: টোকেনে Pages অনুমতি
Worker অটো-ডিপ্লয়ের যে `CLOUDFLARE_API_TOKEN` আছে, তাতে **Account → Cloudflare Pages → Edit** অনুমতি যোগ করুন:
Cloudflare → My Profile → API Tokens → `github-worker-deploy` → Edit → Add more → Account / Cloudflare Pages / Edit →
Continue → Update token। (টোকেনের মান বদলায় না, GitHub-এ কিছু করতে হয় না।)
টোকেন কাউকে (Claude-সহ) চ্যাটে পাঠাবেন না।
