# Messenger ইনবক্স — সেটআপ গাইড (বিনামূল্যে)

তিনটি Facebook Page-এর সব মেসেজ এক জায়গায় দেখা, উত্তর দেওয়া, টিমের কাউকে দায়িত্ব দেওয়া
আর কোন কথোপকথন থেকে অর্ডার হলো তা ট্র্যাক করা — Admin Panel → **Messenger ইনবক্স**
(`admin-inbox.html`)।

খরচ: শূন্য। ব্যবহার হয় Google Apps Script + Google Sheet + Meta-র Messenger API (সবই বিনামূল্যে,
তবে Google-এর দৈনিক ব্যবহারের সীমা আছে)।

| Page | Page ID |
|---|---|
| Luxury Dress BD (facebook.com/luxurydressbd) | 964928770039259 |
| Muslim Abaya (facebook.com/muslimabayaofficial) | 381729145014885 |
| Luxury Dress (facebook.com/luxurydress.shop) | 258170054039575 |

> Page ID-গুলো Meta Ads থেকে নাম দেখে মেলানো হয়েছে। নিশ্চিত হতে: Page → About → Page transparency → Page ID।

## ১. প্রতিটি Page-এর token Script Properties-এ রাখুন

1. developers.facebook.com → **Luxury Dress BD Messenger** অ্যাপ → Messenger → Messenger API Settings।
2. "Generate access tokens" অংশে **Add Page** দিয়ে তিনটি Page-ই যোগ করুন, প্রতিটির জন্য **Generate** চাপুন।
3. Apps Script → Project Settings → **Script properties**-এ যোগ করুন:
   - `MSGR_PAGE_TOKEN_964928770039259` = Luxury Dress BD-এর token
   - `MSGR_PAGE_TOKEN_381729145014885` = Muslim Abaya-এর token
   - `MSGR_PAGE_TOKEN_258170054039575` = Luxury Dress-এর token

   (পুরোনো `MSGR_PAGE_TOKEN` থাকলে সেটা Luxury Dress BD-এর জন্য এখনও কাজ করবে।)

⚠️ Token কখনো চ্যাটে, GitHub-এ বা কোনো ফাইলে লিখবেন না — শুধু Script properties-এ।

## ২. তিনটি Page-কে webhook-এ যুক্ত করুন

একই পেজে (Messenger API Settings → Webhooks) প্রতিটি Page-এর পাশে **Add subscriptions** চাপুন এবং টিক দিন:
`messages`, `messaging_postbacks`, `messaging_referrals`, **`message_echoes`**।

`message_echoes` দিলে Business Suite বা ফোন থেকে দেওয়া উত্তরও ইনবক্সে দেখা যাবে।

## ৩. Apps Script-এ নতুন কোড deploy করুন

1. কম্পিউটারে repo ফোল্ডারে **`API-কোড-পেস্ট-ও-Deploy.bat`** ডাবল-ক্লিক করুন — পুরো কোড কপি হবে ও
   Apps Script Editor খুলবে। Editor-এ `Code.gs` → **Ctrl+A → Ctrl+V → Ctrl+S**।
   (বিকল্প: `apps-script-copy.html` খুলে "সম্পূর্ণ কোড কপি", অথবা `clasp push`।)

   ⚠️ repo-র মূল ফোল্ডারের পুরোনো `Code.gs` **ব্যবহার করবেন না** — আসল কোড `apps-script/Code.gs`।
2. **Deploy → Manage deployments → Edit (✏️) → Version: New version → Deploy**।
   (নতুন deployment নয় — একই deployment-এ New version, যাতে URL না বদলায়।)

## ৪. টিম যোগ করা

টিমের প্রত্যেকের জন্য আলাদা লগইন বানান: Google Sheet → Muslim Abaya মেনু → **টিম সদস্য যোগ করুন**।
`Admins` শিটের **Name** কলামের নামগুলোই ইনবক্সে "দায়িত্বে" তালিকায় আসবে, আর
"শুধু আমার" ফিল্টার লগইন করা ব্যক্তির নাম দিয়ে কাজ করে।

## কীভাবে ব্যবহার করবেন

- **সব Page এক জায়গায়:** উপরে "সব Page" রাখলে তিন Page-এর মেসেজ একসাথে, নতুনটা উপরে।
- **দ্রুত উত্তর:** নিচের তৈরি-উত্তর বাটনে চাপ দিন → Enter। (Meta-র নিয়মে গ্রাহকের শেষ মেসেজের
  ২৪ ঘণ্টার মধ্যে উত্তর দিতে হয়; পরে দিলে ইনবক্স সেটা জানিয়ে দেবে।)
- **দায়িত্ব:** "দায়িত্বে" থেকে নাম বেছে **সেভ করুন**।
- **অর্ডার ট্র্যাক:** স্ট্যাটাস "অর্ডার কনফার্ম" + অর্ডার মূল্য দিয়ে সেভ করলে Meta-তে একবার
  Purchase ইভেন্ট যায় (কোন বিজ্ঞাপন থেকে অর্ডার এলো Meta বুঝতে পারে)। উপরে কনভার্শন রেট দেখায়।

ডেটা থাকে Google Sheet-এ: `MessengerContacts` (প্রতিটি কথোপকথন) আর `MessengerMessages` (প্রতিটি মেসেজ)।

## সীমাবদ্ধতা

- এই সিস্টেম চালুর **পরের** মেসেজই সেভ হয়; পুরোনো কথোপকথন আসবে না।
- ছবি/ভয়েস মেসেজ শুধু `[image]`, `[audio]` হিসেবে দেখায় — দেখতে Business Suite খুলুন।
- Purchase ইভেন্ট dataset `1465090315322833`-এ যায়। অন্য Page-এর জন্য আলাদা dataset থাকলে
  Script property `MSGR_DATASET_ID_<PageID>` দিয়ে সেট করুন।
