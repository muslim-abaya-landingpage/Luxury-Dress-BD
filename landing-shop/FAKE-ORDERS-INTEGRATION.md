# Fake Orders সংযোগ — ২৯ সেপ্টেম্বর ২০২৬

## কোন ফাইল কোথায়
- এই ZIP-এর ভেতরের ওয়েবসাইট ফাইলগুলো GitHub repository-এর root-এ দিন; Cloudflare Pages-এ deploy করুন।
- সঙ্গে দেওয়া `FakeOrders.gs` আপনার বিদ্যমান Google Apps Script project-এ একই নামের ফাইলে বসান। এটি GitHub/Cloudflare frontend-এ লোড করবেন না।
- বিদ্যমান `Code.gs`, `doPost`, `onEdit`, courier বা tracking code মুছবেন না।

## চালু করা
1. Apps Script-এ `FAKE_ORDERS_SHEET_ID` আপনার দেওয়া Spreadsheet ID-ই রাখা হয়েছে। শিটে `Online Order` এবং `Fake` tab থাকতে হবে; `Fake`-এ A:AJ পর্যন্ত অন্তত ৩৬টি কলাম থাকতে হবে।
2. `setupFakeOrderSync()` একবার Run করে প্রয়োজনীয় অনুমতি দিন। এটি sheet-edit trigger এবং ৫ মিনিটের reconciliation trigger তৈরি করে; একই account/project থেকে আবার চালালে একই trigger দ্বিতীয়বার বানায় না। অন্য account-এর তৈরি triggers দৃশ্যমান নয়।
3. পুরোনো Fake অর্ডার এখনই কপি করতে `backfillFakeOrders()` চালান। পরে নির্ধারিত trigger কাজ করবে।
4. `Online Order`-এর I কলামে স্থায়ী order ID এবং J কলামে `Fake` status থাকতে হবে। ID খালি হলে অর্ডার কপি হবে না; execution log-এ ওই row দেখাবে।
5. নতুন অর্ডার পাঠিয়ে API-র ফেরত দেওয়া ID, Online Order-এর I কলাম এবং dashboard-এর ID মিলিয়ে দেখুন। তারপর নিজের test order-কে Fake করে কপি যাচাই করুন। এই পরীক্ষায় কোনও বাস্তব অর্ডার পাঠানো হয়নি।

## তথ্যের প্রবাহ
Landing page → Cloudflare `/api/order` → বিদ্যমান Apps Script `doPost` → Online Order → status Fake হলে Fake tab-এ snapshot।

| অংশ | বিদ্যমান চুক্তি / আচরণ |
|---|---|
| Frontend | RecordType=Order; Name, Phone, Address, District, Quantity, Total, Design, CartJSON, EventID এবং tracking fields পাঠায় |
| Cloudflare | ফর্ম forward করে; `Success\|<order ID>` পেলে সফল বলে |
| Backend | কোন field কোন sheet column-এ লিখবে তা মূল Code.gs নির্ধারণ করে; সেটি সরবরাহ করা হয়নি |
| FakeOrders | Online Order!I-এর ID ও J-এর Fake status পড়ে |
| Snapshot | A:AC-এর evaluated values ও formatting; AD=কপির সময়, AE=সন্দেহভাজন, AJ=তৎকালীন source row |
| Dedupe | স্থায়ী ID দিয়ে; source row শুধু audit তথ্য |

`EventID` হলো tracking identifier। মূল backend পরীক্ষা ছাড়া এটিকে sheet-এর Order ID ধরে নেওয়া হয়নি। Frontend field names, API URL, response contract, দাম বা tracking IDs বদলানো হয়নি।

## Dashboard থেকে status বদলালে
Apps Script/API থেকে cell বদলালে edit trigger চলে না। তাই `setupFakeOrderSync()`-এর scheduled reconciliation দরকার। অর্ডারটি reconciliation-এর সময়ও Fake থাকতে হবে। এটি real-time নয়; Apps Script scheduling/quota অনুযায়ী দেরি হতে পারে।

প্রয়োজনে আপনার authenticated backend-এর status-update function-এ status সফলভাবে save ও বিদ্যমান lock release করার পরে `archiveFakeOrderById(orderId)` কল করলে তাৎক্ষণিক snapshot নেওয়া যাবে। এটি কোনও নতুন public endpoint নয়; বর্তমান package-এর মূল Code.gs ছাড়া সে call যুক্ত করা হয়নি।

এই code fake order নিজে শনাক্ত/ব্লক করে না, অর্ডার delete করে না, courier cancel করে না, এবং status বদলায় না। শুধু আগে থেকে Fake চিহ্নিত অর্ডার সংরক্ষণ করে।

## ফিচার সংরক্ষণ
আপনার সর্বশেষ দেওয়া ZIP-কে ভিত্তি নেওয়া হয়েছে। Glass 3D, auto slide, side preview, zoom, thumbnails, quick buy, review slider, SEO এবং tracking setting রাখা হয়েছে। কেবল touch swipe-এ vertical scroll আলাদা করা, বড় touch target এবং zoom button-এর অবস্থান সহজ করা হয়েছে।

## পরীক্ষা ও সীমা
- বিদ্যমান ১২টি frontend/Worker regression check পাস।
- Mock Apps Script পরীক্ষায় values snapshot, audit fields, lock release, duplicate ID, reused/moved row, blank ID, bulk edit, scheduled backfill, immediate hook ও repeat-safe trigger setup যাচাই হয়েছে।
- Live Sheet, Apps Script authorization/deployment, মূল Code.gs column mapping ও browser visual test যাচাই করা হয়নি।
- Source: https://developers.google.com/apps-script/guides/triggers/installable
- Range values/format reference: https://developers.google.com/apps-script/reference/spreadsheet/range
