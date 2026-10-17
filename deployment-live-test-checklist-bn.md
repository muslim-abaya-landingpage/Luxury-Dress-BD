# Muslimabaya.com — Live Deployment ও Smoke-test Checklist

**উদ্দেশ্য:** PIN-ভিত্তিক order tracking, merged Apps Script analytics এবং storefront পরিবর্তন নিরাপদে live প্রকাশ ও যাচাই করা। Production order তৈরি বা customer data দেখার আগে প্রতিটি release ধাপ সম্পন্ন করুন।

## ১. প্রকাশের আগে

- [ ] PR #69-এ `apps-script/Code.gs` ও `apps-script-copy.html` conflict resolution commit/push হয়েছে। Embedded copy canonical `apps-script/Code.gs`-এর সঙ্গে sync—backend contract test pass করেছে।
- [ ] PR draft থেকে **Ready for review** করা হয়েছে; GitHub/Netlify required checks pass এবং PR mergeable।
- [ ] Apps Script project ও production API URL সঠিক project-কে নির্দেশ করে—এটি নিশ্চিত করা হয়েছে।
- [ ] বর্তমান Apps Script `Code.gs`-এর backup নিরাপদ স্থানে রাখা হয়েছে; কোনো code বা screenshot-এ secret/customer data প্রকাশ করা হয়নি।
- [ ] কম ট্রাফিকের release window ঠিক করা হয়েছে। Backend ও frontend একই window-তে deploy হবে; মাঝের সময়ে নতুন order নেওয়া সাময়িকভাবে বন্ধ বা maintenance notice দেখানো হবে।
- [ ] একটি অনুমোদিত internal test order/customer প্রস্তুত আছে। Test order-টি স্পষ্টভাবে `TEST—DO NOT FULFILL` হিসেবে চিহ্নিত করুন, যেন fulfillment বা courier dispatch না হয়।

## ২. Apps Script backend প্রকাশ

- [ ] Google Apps Script editor-এ production website-এর সঙ্গে যুক্ত project খুলুন।
- [ ] Repository-র conflict-resolved `apps-script/Code.gs`-এর সম্পূর্ণ contents editor-এর `Code.gs`-এ বসিয়ে Save করুন। অন্য `.gs` ফাইল মুছবেন না।
- [ ] `Deploy` → `Manage deployments` থেকে সক্রিয় Web App deployment edit করে নতুন version প্রকাশ করুন। বিদ্যমান Web App URL, execute-as identity ও access setting অপরিবর্তিত রাখুন। নতুন URL তৈরি হলে frontend API configuration update না করে rollout থামান।
- [ ] Deployment সফল হয়েছে এবং active deployment নতুন version দেখাচ্ছে—নিশ্চিত করুন।

## ৩. Frontend প্রকাশ

- [ ] Backend deploy সফল হওয়ার পরই PR #69 merge করুন; এতে production branch থেকে Netlify storefront deploy শুরু হবে। শুধু Deploy Preview-কে production release ধরে নেবেন না।
- [ ] Netlify production deploy সফল এবং production domain-এ নতুন build live—নিশ্চিত করুন।
- [ ] Backend ও frontend দুই deployment-ই সফল না হওয়া পর্যন্ত maintenance notice/order pause সরাবেন না।

## ৪. Live smoke tests

### মূল পৃষ্ঠা, SEO ও নিরাপত্তা

- [ ] `https://muslimabaya.com/`, `/abaya`, `/category`, একটি product page, `/video`, `/help` এবং `/order-track` খোলে; redirect বা 5xx নেই।
- [ ] Homepage, category এবং product page-এর **raw HTML**-এ উপযুক্ত `<title>`, meta description, canonical, একটি বর্ণনামূলক H1, Open Graph এবং Twitter card tags আছে।
- [ ] `/video`-তে configured product videos দেখা যায়; video title ও player responsive থাকে।
- [ ] Response headers-এ `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` এবং `Permissions-Policy` আছে। Admin/login পৃষ্ঠা authentication ছাড়া customer/order data দেখায় না।

### Checkout ও tracking PIN

- [ ] Internal test order submit করলে confirmation page-এ Order ID এবং **ঠিক ৮ অঙ্কের PIN** দেখা যায়। Test PINটি private channel-এ সংরক্ষণ করুন; screenshot বা public log-এ শেয়ার করবেন না।
- [ ] Google Sheet-এর order row-এ `TrackingPinHash` ও `TrackingPinSalt` লেখা হয়েছে; plaintext PIN কোনো cell-এ রাখা হয়নি। Customer spreadsheet public/share link নয়—এটি যাচাই করুন।
- [ ] `/order-track`-এ test phone + Order ID + সঠিক PIN দিলে শুধু ওই order-এর status আসে।
- [ ] একই order-এ একটি ভুল PIN পরীক্ষা করলে order details প্রকাশ হয় না। Repeated attempts দিয়ে live rate-limit brute-force test করবেন না।
- [ ] Browser network request-এ phone, Order ID ও PIN URL/query string-এ নেই; credentials POST body-তে আছে। Browser history/referrer-এ PIN নেই।
- [ ] Admin dashboard authorized admin session-এ খোলে এবং merged analytics ও order data expectedভাবে দেখায়। Logout বা unauthenticated session-এ private data দেখা যায় না।

### Mobile navigation

- [ ] 390px-প্রস্থের mobile viewport-এ horizontal overflow নেই।
- [ ] Bottom navigation-এর category action menu খুলতে পারে; header menu unavailable হলেও category hub-এ যায়।
- [ ] Cart drawer/checkout button bottom navigation-এর আড়ালে পড়ে না।

## ৫. শেষ ধাপ ও rollback

- [ ] Test order-টি admin-এ `TEST—DO NOT FULFILL` হিসেবে চিহ্নিত/বাতিল করে fulfillment বন্ধ রাখা হয়েছে; test PIN customer-facing channel-এ পাঠানো হয়নি।
- [ ] Checkout ও tracking স্বাভাবিকভাবে কাজ করার পরই maintenance notice/order pause সরানো হয়েছে।
- [ ] Backend বা storefront smoke-test fail করলে rollout থামান: আগের Netlify production deploy-এ rollback করুন এবং Apps Script-এর আগের Web App version restore/redeploy করুন। এক অংশ rollback করে অন্য অংশ নতুন version-এ ফেলে রাখবেন না; উভয়পাশের compatibility যাচাই করুন।
- [ ] Release time, Netlify deploy ID, Apps Script version, smoke-test ফলাফল ও rollback সিদ্ধান্ত লিখে রাখুন—কিন্তু PIN, phone number বা customer details নথিভুক্ত করবেন না।
