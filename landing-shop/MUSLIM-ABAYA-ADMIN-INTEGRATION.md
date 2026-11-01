# Muslim Abaya Admin Dashboard-এ ল্যান্ডিং পেজ অর্ডার

এই প্যাকেজের `config.js`-এ `order.mode: 'apps-script'` ও `order.apiUrl: '/api/order'` সেট করা আছে। Cloudflare Pages `_worker.js` বর্তমান Apps Script-এ অর্ডার পাঠায়। পণ্য বেছে অর্ডার পাঠালে `Online Order` শিটে জমা হবে; বর্তমান Admin Dashboard সেই শিটের অর্ডার দেখায়। API থেকে `Success|অর্ডার-আইডি` পাওয়া গেলেই Thank You পেজ দেখায়।

## প্রকাশের আগে

1. Cloudflare Pages-এ সম্পূর্ণ `client_builder_pro` ফোল্ডারের **ভেতরের ফাইলগুলো** প্রকাশ করুন। নতুন GitHub রিপোজিটরি ব্যবহার করলে Pages প্রকল্পের build output ও root সঠিক রাখুন।
2. মূল Muslim Abaya সাইটের `site-api-config.js`-এর URL বদলালে Pages-এর `ORDER_API_URL` variable আপডেট করে আবার deploy করুন। Apps Script-এ সাম্প্রতিক `Code.gs` deploy করা আছে কি না যাচাই করুন।
3. নিজের ফোন/ঠিকানায় একটি নিয়ন্ত্রিত অর্ডার দিয়ে `Online Order` শিট ও Admin Dashboard-এ রেকর্ড, পরিমাণ, মোট দাম এবং সাবডোমেইন (Note) মিলিয়ে দেখুন। অর্ডার পরীক্ষার আগে স্বয়ংক্রিয় কুরিয়ার মোড সক্রিয় আছে কি না যাচাই করুন।
4. Cloudflare Pages wildcard custom domain সমর্থন করে না; প্রতিটি সাবডোমেইন Pages → Custom domains-এ আলাদা করে যোগ করুন। সাবডোমেইনের জন্য `sites/<slug>.js` ফাইল দরকার। এই প্যাকেজে `main`, `hafeza`, `offer01` উদাহরণ আছে; বাকি সাবডোমেইন চালুর আগে অনুরূপ ফাইল তৈরি করুন।

## সীমা

বর্তমান Apps Script `Total` ব্রাউজার থেকে গ্রহণ করে; সার্ভারে ক্যাটালগ দাম যাচাই করে না। `Code.gs`-এ মূল্য ও স্টক যাচাই যোগ না করা পর্যন্ত একে নিরাপদ স্বয়ংক্রিয় পেমেন্ট/ফুলফিলমেন্ট ভিত্তি হিসেবে ব্যবহার করবেন না। এটি বিদ্যমান Product Manager থেকে পণ্যের তথ্য লাইভ সিঙ্ক করে না; প্রতিটি পেজের পণ্যের তথ্য এখনও `config.js`/`sites/*.js`-এ থাকে।

## ট্র্যাকিং যাচাই

বর্তমান `trackingMode: 'direct'`: GA4, Meta Pixel ও TikTok Pixel সাইটের কোড থেকে চলে; একই পেজে GTM লোড হয় না। Apps Script সফল অর্ডার ID দিলে Thank You পেজে একবার `Lead` / `SubmitForm` / `generate_lead` পাঠানো হয়। `Purchase` পাঠানো হয় না; বিদ্যমান backend-এ Confirmed অর্ডারে Purchase পাঠানোর আলাদা ব্যবস্থা আছে।

প্রকাশের পর GA4 web stream-এ `G-L2BNEXE0XG`, Meta Events Manager-এ `1465090315322833`, TikTok Events Manager-এ `D6FK9GBC77UC649NNCP0` ID ও টেস্ট ইভেন্ট মিলিয়ে নিন। এই অ্যাকাউন্টগুলোর ভেতরে প্রবেশ করে ID বা সার্ভারে event পৌঁছানো যাচাই করা হয়নি। GTM চালাতে চাইলে `trackingMode: 'gtm'` দিয়ে সব ট্যাগ/ইভেন্ট GTM-এ সেট করুন।

## সার্ভার ট্র্যাকিং

এই সংস্করণে Cloudflare Pages `_worker.js`-এ সফল অর্ডারের জন্য optional Meta CAPI Lead ও TikTok Events API SubmitForm আছে। একই event ID browser ও server-এ যায়। Pixel token না থাকলে CAPI বন্ধ থাকে, তবে অর্ডার জমা চলতে পারে। Cloudflare লগে ডেলিভারি অবস্থা পাওয়া যায়। D1 ও dashboard secret কনফিগার করলে `/tracking-status.html`-এ server Lead-এর সাম্প্রতিক অবস্থা দেখা যায়; এটি পূর্ণ browser analytics dashboard বা server-side GTM নয়।

বিস্তারিত Cloudflare variables, CAPI এবং test নির্দেশনা: `TRACKING-DEPLOY-GUIDE.md`।
