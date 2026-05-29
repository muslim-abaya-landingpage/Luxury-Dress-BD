# SEO ও অর্গানিক দৃশ্যমানতা — Muslim Abaya

## সাইটে যা করা হয়েছে (কোড)

- **হোম:** সম্পূর্ণ meta, Open Graph, JSON-LD (`index.html`)
- **অন্যান্য পেজ:** `site-seo.js` + `site-seo-config.js` — title, description, canonical, Facebook শেয়ার ট্যাগ
- **ক্যাটাগরি:** CollectionPage + Breadcrumb schema
- **Facebook লিংক:** হেডার, ফুটার, হোমে “Facebook পেজ ফলো” ব্লক
- **সোশ্যাল URL এক জায়গায়:** `site-seo-config.js` → `social.facebook` ইত্যাদি

## SEO ১০০% নয় — আপনার করণীয় (অর্গানিক)

Google/Facebook অটোমেটিক #১ এ নিয়ে যায় না; নিচের ধাপগুলো করলে **ওয়েবসাইট + Facebook পেজ** একসাথে দেখা যায়।

### Google (ওয়েবসাইট)

1. [Google Search Console](https://search.google.com/search-console) → প্রপার্টি `https://muslimabaya.com` → Sitemap জমা: `https://muslimabaya.com/sitemap.xml`
2. “URL Inspection” দিয়ে হোম ও `/abaya` ইনডেক্স রিকোয়েস্ট
3. প্রতি নতুন প্রোডাক্ট/ক্যাটাগরিতে আপডেট থাকলে সাইটম্যাপ আবার সাবমিট (Netlify deploy পর)

### Facebook পেজ + ওয়েবসাইট লিংক

1. Facebook পেজ → **About** → Website: `https://muslimabaya.com`
2. পেজের **Username/URL** যদি `luxurydressofficial` না হয়, `site-seo-config.js` এ সঠিক Facebook URL আপডেট করুন
3. সাপ্তাহিক ২–৩ পোস্ট: নতুন ডিজাইন + লিংক `muslimabaya.com/abaya` (শেয়ার করলে OG ইমেজ দেখাবে)
4. Facebook Page → Settings → **Page transparency** / Shop যথাযথ ভেরিফাই

### Instagram / TikTok

- বায়োতে `muslimabaya.com` লিংক
- রিল/ভিডিও ক্যাপশনে ওয়েব লিংক

### কন্টেন্ট (সবচেয়ে গুরুত্বপূর্ণ)

- প্রতি প্রোডাক্টে স্পষ্ট নাম, দাম, ছবি (`category-products.js` / Product Manager)
- বাংলা + ইংরেজি কীওয়ার্ড: “আবায়া বাংলাদেশ”, “premium abaya COD” — `site-seo-config.js` এর category description এ যোগ করতে পারেন

---

Facebook URL পরিবর্তন: শুধু `site-seo-config.js` → `social.facebook` এডিট → Netlify deploy।
