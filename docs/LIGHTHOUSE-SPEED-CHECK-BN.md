# মোবাইল পেজস্পিড চেক (Lighthouse) — প্রতিটি PR-এ

**কী করে:** প্রতিটি PR-এ GitHub Actions-এর "Page Speed" চেক সাইটটা Cloudflare Pages-এর মতো করেই build করে
(`scripts/build-cloudflare.mjs`), লোকালি চালায়, তারপর মোবাইল মোডে Lighthouse ৫ বার চালিয়ে মাঝের (median) মান নেয়।
একবারের এলোমেলো খারাপ রানে PR ফেল হয় না।

**কখন ফেল হবে (`scripts/lighthouse-check.mjs`-এর `PAGES`):**

| পেজ | Performance কমপক্ষে | LCP সর্বোচ্চ | TBT সর্বোচ্চ | CLS সর্বোচ্চ |
| --- | --- | --- | --- | --- |
| হোম `/` | 90 | 3.5 s | 600 ms | 0.1 |
| ক্যাটাগরি `/abaya` | 70 | 7.5 s | 600 ms | 0.1 |

এছাড়া পেজ যদি আমাদের নিজের কোনো ফাইল (ছবি, CSS, JS) চায় যেটা নেই (404), তাহলেও ফেল হবে।

**চেক যোগ করার দিন main-এ মাপা মান (৫ রানের median, লোকাল build):** হোম 96, LCP 2.72 s;
`/abaya` 78, LCP 5.88 s। সীমাগুলো এর চেয়ে কিছুটা নিচে রাখা হয়েছে যাতে স্বাভাবিক ওঠানামায় PR ফেল না হয়।

**PageSpeed Insights-এর সাথে পার্থক্য:** এই চেক লোকাল সার্ভারে চলে (HTTP/1.1, Cloudflare CDN নেই) এবং
GTM, Facebook, TikTok, YouTube, Apps Script API ব্লক রাখে। তাই সংখ্যা লাইভ সাইটের PageSpeed-এর কাছাকাছি, হুবহু এক নয়।
এটা "আগের চেয়ে খারাপ হলো কি না" ধরার জন্য, লাইভ স্কোর মাপার জন্য নয়।

**ফেল হলে:** Actions রানের Summary-তে টেবিল থাকে, আর `lighthouse-reports` artifact-এ প্রতিটি রানের পূর্ণ HTML রিপোর্ট।

**লোকালি চালাতে:**

```bash
node scripts/build-cloudflare.mjs        # এটা ফাইল বদলায়; আলাদা কপিতে চালান
HOST=127.0.0.1 PORT=43147 python3 scripts/serve-gzip.py &
node scripts/lighthouse-check.mjs --base http://127.0.0.1:43147 --runs 5
```

**সাইট দ্রুত হলে** সীমাগুলো বাড়িয়ে দিন। কারণ না লিখে শুধু PR পাস করানোর জন্য সীমা কমাবেন না।
