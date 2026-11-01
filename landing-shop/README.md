# ক্লায়েন্টের জন্য সহজে সম্পাদনযোগ্য ল্যান্ডিং পেজ

এটি Netlify-তে সরাসরি প্রকাশ করার উপযোগী static site। `dist/` ফোল্ডারের ভেতরেই `index.html` আছে। ZIP আপলোড করলে ZIP-এর প্রথম স্তরেও `index.html` থাকবে। কোনো npm install বা build command দরকার নেই।

## নতুন ক্লায়েন্টের জন্য যা বদলাবেন

শুধু `config.js` খুলুন:

| অংশ | কী বদলাবেন |
| --- | --- |
| `brand` | ব্যবসার নাম, পেজের title/description, প্রকাশিত `siteUrl`, এজেন্সির নাম ও লিংক, Facebook/TikTok পেজ, কল নম্বর |
| `hero` | হেডারের `announcement`, গ্যালারির ছবির পথ, ব্যাজ, অফার লেখা, বাটন, ভিজিট-ভিত্তিক টাইমারের `sessionMinutes`; প্রকৃত মেয়াদ থাকলে `offerEndsAt` |
| `reviews` | গ্রাহকের রিভিউ স্ক্রিনশটের ছবি ও সংক্ষিপ্ত বর্ণনা |
| `sections` | বৈশিষ্ট্যের তালিকা ও শিরোনাম |
| `products` | প্রতিটি পণ্যের আলাদা `id`, নাম, দাম, ছবি, সাইজের তালিকা |
| `deliveryAreas` | এলাকা, নাম ও চার্জ |
| `order` | অর্ডার নেওয়ার পদ্ধতি: `netlify`, `whatsapp` বা `copy` |
| `marketing` | `gtmId`, `trackingMode`, ঐচ্ছিক সরাসরি `metaPixelId`; GTM ID ফাঁকা থাকলে GTM লোড হয় না |

ছবি `images/` ফোল্ডারে রাখুন এবং `config.js`-এ `images/ছবির-নাম.webp` লিখুন। একই `id` দুবার ব্যবহার করবেন না। দাম ও চার্জ ইংরেজি সংখ্যায় লিখবেন। পণ্য বা সাইজ যত খুশি যোগ/বাদ দিতে পারবেন। অর্ডারের লজিক বদলাতে `app.js` সম্পাদনার প্রয়োজন নেই; নতুন ব্র্যান্ডের SEO সেটিংসের জন্য নিচের নির্দেশনা অনুসরণ করুন।

## রেসপন্সিভ ডিজাইন ও SEO

ফোন, ট্যাবলেট ও ডেস্কটপে পেজের লেআউট মানিয়ে যায়। সব পর্দায় গ্যালারির ছবি ও থাম্বনেইলের নিচে অফার লেখা, শিরোনাম ও অর্ডার বাটন থাকে। বড় পর্দায় বৈশিষ্ট্যে দুই কলাম এবং ডেলিভারি এলাকায় পাশাপাশি কার্ড; ছোট পর্দায় সব অংশ এক কলামে থাকে। ছবির অনুপাত ও প্রস্থ নির্ধারিত আছে, প্রধান ছবি আগেই লোড হয়, বাকিগুলো প্রয়োজনমতো লোড হয়। আটটি পণ্যের WebP ছবি মোট প্রায় ১৬ MB থেকে প্রায় ১ MB-তে কমানো হয়েছে।

`config.js`-এর `brand.siteUrl`-এ প্রকাশিত HTTPS ডোমেইন দিন। `seo.js` পেজের title, description, canonical, Open Graph এবং Product structured data-তে ব্যবসার তথ্য ও পণ্যের মূল্য ব্যবহার করে। বাস্তব স্টক/রেটিং জানা না থাকায় সেগুলোর দাবি যুক্ত করা হয়নি। তবে Facebook/অন্যান্য social crawler সাধারণত JavaScript চালায় না: **নতুন ক্লায়েন্টের জন্য `index.html`-এর static title, description, canonical, `og:*` এবং প্রথম ছবির preload/src-ও বদলাতে হবে।** `robots.txt` ও `sitemap.xml`-এ ডোমেইন বদলান। ডোমেইন সংযুক্ত হওয়ার আগে `muslimabaya.co`-এর canonical ঠিক আছে কি না যাচাই করুন। `thank-you.html` সার্চে ইনডেক্স না হওয়ার নির্দেশ দেওয়া আছে। Google Search Console-এ sitemap জমা দিলে নতুন সাইট খুঁজে পেতে সুবিধা হয়; ইনডেক্স বা র‍্যাঙ্কিং নিশ্চিত নয়।

পণ্যের গ্যালারি প্রতি ৫ সেকেন্ডে নিজে বদলায়। ছবিতে মাউস রাখলে, বোতামে ফোকাস থাকলে বা reduced motion চালু থাকলে থামে; ফোনে আঙুল দিয়েও পাশে নেওয়া যায়। রিভিউগুলো প্রতি ৪.৫ সেকেন্ডে নিজে স্লাইড হয়; মাউস, ফোকাস, স্পর্শ, বড় করে দেখা, ট্যাব আড়াল বা reduced motion থাকলে থামে। রিভিউ কার্ডে চাপলে পুরো স্ক্রিনশট বড় করে দেখা যায়। এই স্ক্রিনশটগুলো গ্রাহকের সাধারণ বোরকা অভিজ্ঞতা; নির্দিষ্ট হাফেজা সেটের রিভিউ হিসেবে দাবি করবেন না। প্রকাশের অনুমতি নিশ্চিত করুন।

রিভিউ স্লাইডার কেবল তার নিজের তালিকার ভেতরে অনুভূমিকভাবে চলে; পেজের অন্য অংশে স্ক্রল অবস্থান বদলায় না। ডেলিভারি এরিয়া কার্ড ও সুইচে চাপলে নির্বাচন হয় এবং মোট মূল্য সঙ্গে সঙ্গে বদলায়।

পেজের শুরুতে ঘোষণা অংশ আছে; লেখা `hero.announcement` থেকে বদলান। `assets/logo.png`-এ প্রতিষ্ঠানের লোগো আছে—অন্য ক্লায়েন্টের জন্য ছবিটি ও `index.html`-এর alt বদলান। ডেলিভারি এরিয়ার লোকেশন পিন চিহ্ন SVG, তাই আলাদা আইকন লাইব্রেরি লাগে না। অর্ডার ফর্ম ও সামারিতে পণ্য না থাকলে “কমপক্ষে একটি পণ্য নির্বাচন করুন” লেখা দেখায়। ফুটারের এজেন্সির নাম ও লিংক `brand.agencyName`/`brand.agencyUrl` থেকে আসে; Facebook/TikTok লিংক `brand.facebookUrl`/`brand.tiktokUrl` থেকে আসে।

এখন `hero.sessionMinutes: 30` থাকায় প্রতিটি ট্যাবের ভিজিটে ৩০ মিনিটের টাইমার চলে। একই ট্যাবে রিফ্রেশ করলে সময় নতুন করে শুরু হয় না; গণনা শেষ হলেও অর্ডার ফর্ম চালু থাকে। এটি অফারের প্রকৃত শেষ সময় বলে দাবি করে না। সময় বদলাতে `sessionMinutes`-এর সংখ্যা বদলান। প্রকৃত অফার শেষের সময় নির্ধারিত হলে `hero.offerEndsAt`-এ ISO সময় লিখতে পারেন, যেমন `2026-12-31T23:59:00+06:00`; সেটি ভিজিট-ভিত্তিক সময়ের চেয়ে অগ্রাধিকার পাবে।

## অর্ডার নেওয়ার তিনটি পদ্ধতি

- **`netlify` (বর্তমান সেটিং):** ক্রেতা ফর্ম পূরণ করলে Netlify Forms-এ `orders` নামে অর্ডার সংরক্ষিত হয় এবং সফল হলে `thank-you.html` দেখা যায়। Netlify Dashboard → আপনার Site → Forms → **Enable form detection** চালু করে *তারপর* নতুন deploy দিন। Forms → Submission notifications-এ আপনার ইমেইল যুক্ত করুন। Deploy-এর পর Forms-এ `orders` ফর্ম দেখা যাচ্ছে কি না নিশ্চিত করুন এবং নিজের নম্বর দিয়ে একটি বাস্তব পরীক্ষামূলক অর্ডার পাঠান। Netlify-তে প্রকাশ না করলে এই পদ্ধতি কাজ করবে না।
- **`whatsapp`:** `order.mode: 'whatsapp'` এবং `whatsappNumber: '8801XXXXXXXXX'` দিন। ক্রেতা ফর্ম পূরণ করলে WhatsApp-এ লেখা প্রস্তুত হবে; ক্রেতাকে সেখানে **Send** চাপতে হবে। এটি Netlify Forms-এ অর্ডার সংরক্ষণ করে না।
- **`copy`:** ক্রেতা অর্ডারের তথ্য কপি করতে পারবেন। এটি নিজে কোথাও অর্ডার পাঠায় না।

`brand.phone`-এ কল নম্বর এবং `order.whatsappNumber`-এ একই নম্বরের আন্তর্জাতিক ফরম্যাট দিলে পেজে কল বাটন ও ফর্মের নিচে **“অর্ডার করতে সমস্যা হলে WhatsApp-এ অর্ডার করুন”** বাটন দেখা যাবে। নম্বর `01971642683` হলে WhatsApp ফরম্যাট `8801971642683`। এই সহায়তা বাটন সব `mode`-এ থাকে; পণ্য বাছা থাকলে মেসেজে পণ্যের তথ্য ও আনুমানিক মোট যুক্ত হয়। ক্রেতাকে WhatsApp-এ Send চাপতে হবে।

পণ্য ও ডেলিভারি মূল্য ব্রাউজারে হিসাব হয়। Netlify Forms-এ জমা হওয়া মূল্যকে চূড়ান্ত পেমেন্টের আগে কর্মী দিয়ে যাচাই করুন; ব্রাউজারের পাঠানো মান গ্রাহক বদলাতে পারেন। পেমেন্ট বা স্টক ব্যবস্থাপনার স্বয়ংক্রিয় ব্যবস্থা এতে নেই।

বিজ্ঞাপনের জন্য `tracking.js`-এ GTM dataLayer event প্রস্তুত আছে। `marketing.gtmId`-এ প্রকৃত GTM ID দিলে container লোড হবে; GTM-এ GA4 tag ও trigger প্রকাশ করতে হবে। `trackingMode: 'direct'`-এ বর্তমান Meta ও TikTok browser Pixel চলে; GTM-এ একই Pixel আবার বসাবেন না। `generate_lead` শুধু সফল Netlify অর্ডারের thank-you পেজে একবার পাঠানো হয়; TikTok-এ এটি `SubmitForm`। WhatsApp খোলাকে `Contact` বলা হয়; এটি অর্ডার নিশ্চিত হওয়ার প্রমাণ নয়। `Purchase` event নেই, কারণ এই সাইটে পেমেন্ট বা কর্মীর যাচাই সম্পন্ন হয় না। UTM ও `fbclid`/`ttclid` Netlify Forms-এর hidden field-এ জমা হয়। বিস্তারিত `TRACKING-SETUP.md`-এ।

GTM ও GA4-এর পাবলিক ID, Netlify verified form event-এর server-side Meta/TikTok/GA4 relay, গোপন environment variables এবং Git/CLI deploy পদ্ধতি `TRACKING-SETUP.md`-এ আছে। `netlify.toml` দিয়ে পূর্ণ প্রজেক্ট deploy করতে হবে; শুধু static ZIP-এ server function চলে না।

## Netlify-তে প্রকাশ

1. প্রয়োজনমতো `config.js` ও ছবি বদলান।
2. ZIP-এর প্রথম স্তরে `index.html`, `config.js`, `seo.js`, `tracking.js`, `app.js`, `styles.css`, `robots.txt`, `sitemap.xml`, `thank-you.html`, `images/` ও `reviews/` আছে কি না দেখুন।
3. আপনার Netlify সাইটে নতুন deploy-তে ফাইলগুলো প্রকাশ করুন। Netlify Drop-এ ZIP বা এই ফাইলগুলোর ফোল্ডার ব্যবহার করুন। GitHub-সংযুক্ত সাইট হলে সেই repository-তে ফাইলগুলো commit করুন; আলাদা Drop সাইট তৈরি করলে মূল ডোমেইন নিজে বদলাবে না।
4. Netlify Forms detection চালু ও deploy সম্পন্ন হওয়ার পর টেস্ট অর্ডার দিয়ে Dashboard-এ জমা হয়েছে কি না দেখুন।

**বর্তমান সীমাবদ্ধতা:** আপনার দেওয়া Netlify স্ক্রিনশটে production deploy সাময়িকভাবে paused দেখাচ্ছে। Netlify-তে credits/plan সমস্যা মিটলে বা পরের billing cycle-এ deploy চালু হলে এই ZIP প্রকাশ করা যাবে।

## Google Sheet ও ৩০টি সাবডোমেইন

আলাদা **Developer Toolkit ZIP**-এ `integrations/LandingOrders.gs` এবং `integrations/README.md` ফাইলে Netlify Forms থেকে আপনার `অর্ডার শিট 2026`-এর `Online Order` ট্যাবে অর্ডার কপি করার কোড ও সেটআপ দেওয়া আছে। Apps Script এডিটর লিংক নিজে Web App endpoint নয়; বিদ্যমান script-এর `doPost` রাউটিং না দেখে সেটি পরিবর্তন করা হয়নি। পরীক্ষামূলক অর্ডার জমা দিয়ে Netlify Forms ও Sheet মিলিয়ে নিতে হবে। মূল সাইটের ZIP-এ কোনো গোপন কী নেই।

Toolkit-এ `subdomains/clients/example.json`, `subdomains/build-site.mjs` এবং `subdomains/README.md`-এ `muslimabaya.com`-এর অধীনে একেকটি আলাদা সাবডোমেইন সাইট তৈরি ও প্রকাশের পদ্ধতি আছে। এখনো কোনো DNS, Netlify custom domain বা live সাবডোমেইন তৈরি হয়নি। একেকটি slug ও Netlify site hostname পাওয়ার পর ধাপে ধাপে CNAME যুক্ত করতে হবে। মূল সাইটের `muslimabaya.co` SEO URL এবং সাবডোমেইনের `muslimabaya.com` আলাদা করে রাখা হয়েছে।

রেফারেন্স সাইটের যাচাইহীন স্টক সংখ্যা বা রেটিং এই টেমপ্লেটে রাখা হয়নি। ছবিগুলো আপনার আপলোড করা ফাইল থেকে নেওয়া। অন্য ক্লায়েন্টের জন্য ছবি ব্যবহারের অনুমতি যাচাই করুন।

## Premium Glass Gallery v2
Builder > Hero / Offer থেকে Gallery style নির্বাচন করুন: Premium Glass 3D, Glass Slider, বা Classic। Auto slide এবং interval-ও এখান থেকে নিয়ন্ত্রণ করা যায়। Glass modes-এ বর্তমান ছবির দুই পাশে previous/next preview, glass controls, depth animation, swipe, thumbnails এবং reduced-motion accessibility আছে।


## PRO v3.1 Gallery Hotfix
- Removed duplicate pseudo/ghost side preview cards in Glass/Glass3D modes.
- Rebalanced desktop center/side gallery proportions and reduced dead space.
- Full garment uses object-fit: contain in center and side previews.
- Improved glass controls, compact thumbnails, price/zoom spacing, tablet and mobile geometry.

## SMART PRO v4 hero upgrade
This build adds a luxury conversion hero: balanced 3D side previews, compact full-product center stage, floating glass thumbnail dock, separated offer/price/zoom controls, and a responsive Quick Buy panel linked to the real product selector/order form. Desktop keeps purchase information above the fold; mobile stacks Quick Buy under the gallery and preserves the sticky cart.

## SMART PRO v4.1 — Pixel Perfect Polish
- Desktop 3D gallery geometry rebalanced so side previews no longer collide with Quick Buy.
- Main product remains fully visible with contain rendering.
- Quick Buy spacing, typography, size controls and CTA refined.
- Tablet decorative side cards are removed to prevent overlap.
- Mobile product-first geometry, compact trust stack and horizontally scrollable thumbnails.
- Hover/focus control polish and reduced visual clutter.


## V7 Order & Sales Desk
Orders button opens a local order dashboard. Import Netlify Forms CSV, manage statuses, see delivered revenue, add manual orders, and export CSV. See AGENCY-BUILDER-v7-GUIDE.md.
