# প্রোডাক্ট ম্যানেজার — দৈনিক কাজের সহজ গাইড

ঠিকানা: https://muslimabaya.com/product-manager (অ্যাডমিন লগইন লাগে)

## নতুন পণ্য
1. **+ Add product** চাপুন → খালি "Add new product" পেজ খুলবে (WooCommerce-এর মতো)।
2. নাম লিখুন (লিংক নিজে তৈরি হয়), Product description লিখুন।
3. **Product data → General**: Regular price, দরকার হলে Sale price / % off, Schedule (সেলের তারিখ)।
4. ডান দিকে **Product image** ও **Product gallery**-তে ছবি দিন, **Product categories**-এ ক্যাটাগরি টিক দিন।
5. শেষ না হলে **Save Draft** (ওয়েবসাইটে দেখায় না)। তৈরি হলে **Publish**।
6. **Preview** চাপলে সেভ না করেও নতুন ট্যাবে দেখতে পাবেন।

একই ডিজাইনের অন্য রং: পণ্য খুলে **Copy to a new draft** (বা তালিকায় **Duplicate**) → নাম, রং, ছবি বদলে Publish।

## দাম ও সেল
- Regular = আসল দাম, Sale = কম দাম (খালি = সেল নেই)। Sale দাম Regular-এর চেয়ে কম হতে হবে।
- **Schedule**: শুরু ও শেষের তারিখ দিলে বাংলাদেশ সময় রাত ১২টায় সেল নিজে শুরু/শেষ হয়।
- Variation (রং/সাইজ) আলাদা দাম ও আলাদা সেলের তারিখ: **Variations** ট্যাবে Edit।

## স্টক
- পুরো পণ্য শেষ: তালিকায় **Mark out of stock** (সঙ্গে সঙ্গে লাইভ)।
- সংখ্যা দিয়ে: **Inventory → Track stock quantity** → Quantity।
- রং/সাইজভিত্তিক: **Variations → Manage stock?**।
- তালিকার Stock কলামে "Low stock" দেখলে স্টক বাড়ান।

## ক্রম, দেখানো/লুকানো
- ক্যাটাগরিতে ক্রম: তালিকায় **Sorting** → টেনে সাজান → Save order।
- লুকাতে: Publish বক্স → Status **Draft** বা Visibility **Private**।
- নির্দিষ্ট সময়ে প্রকাশ: Publish বক্স → তারিখ Edit (সেই ঘণ্টায় সাইট নিজে আপডেট হয়)।
- তালিকায় না দেখিয়ে শুধু লিংকে বিক্রি: Catalog visibility → **Hidden**।

## সমস্যা হলে
- "Not saved: …" দেখালে বার্তাটা পড়ুন; পরিবর্তন হারায় না, আবার চাপুন।
- প্রতি ৬ ঘণ্টায় GitHub-এ **Site Health** নিজে চেক করে (হোম, ক্যাটাগরি, চেকআউট, ল্যান্ডিং পেজ, পণ্যের পেজ, অর্ডারের দাম-যাচাই)। কিছু ভাঙলে GitHub আপনাকে ই-মেইল করে।
- একসাথে অনেক পণ্য: **Bulk Upload** বা Export / Import CSV।
