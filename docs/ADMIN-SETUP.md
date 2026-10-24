# Admin প্যানেল সেটআপ (Muslim Abaya)

WordPress-এর মতো **লগইন** → **ড্যাশবোর্ড** → **লিংক হাব** → **প্রোডাক্ট ম্যানেজার (সুরক্ষিত)**।

---

## ১. প্রথম অ্যাডমিন তৈরি (একবার)

1. **Google Sheet** → **অর্ডার শিট 2026** খুলুন  
2. মেনু **Muslim Abaya** → **Admin account তৈরি (প্রথমবার)**  
3. ইমেইল, মোবাইল, নাম, পাসওয়ার্ড দিন (৮+ অক্ষর)  
4. **Admins** নামে নতুন শীট তৈরি হবে (স্বয়ংক্রিয়)

---

## ২. কোড লাইভ করুন

```text
scripts\clasp-push.bat
```

অথবা `clasp push` → Apps Script → **Deploy → New version**

---

## ৩. ওয়েবসাইটে আপলোড — আর লাগে না

ওয়েবসাইট (অ্যাডমিন প্যানেলসহ) এখন GitHub থেকে Cloudflare Pages নিজে থেকে ডিপ্লয় করে।
GitHub-এর `main` ব্রাঞ্চে পরিবর্তন গেলে ১–২ মিনিটে সাইটে চলে আসে। cPanel/FTP-তে কোনো ফাইল আপলোড করবেন না
(আগের `ADMIN-হোস্টিং-আপলোড.bat` ও `hosting-pack` সরিয়ে দেওয়া হয়েছে, কারণ সেগুলো পুরোনো ফাইল তৈরি করত)।

Apps Script-এর কোড আলাদা: `docs/APPS-SCRIPT-AUTO-DEPLOY.md` দেখে একবার অটো-ডিপ্লয় চালু করলে সেটাও নিজে থেকে হবে;
না হলে Apps Script → **Deploy → Manage deployments → New version**।

---

## ৪. সাইটে URL

| পেজ | URL |
|-----|-----|
| লগইন | `https://muslimabaya.com/admin-login.html` |
| অর্ডার | `https://muslimabaya.com/admin-dashboard.html` |
| লিংক | `https://muslimabaya.com/admin-links.html` |
| প্রোডাক্ট | `https://muslimabaya.com/product-manager.html` |

**Bookmark:** `admin-links.html` (লগইনের পর)

---

## ৫. নতুন ফাইল (আপলোড লিস্ট)

- `admin-login.html`
- `admin-dashboard.html`
- `admin-links.html`
- `admin.css`
- `admin-config.js`
- `admin-api.js`
- `admin-guard.js`
- আপডেট: `Code.gs` (Apps Script), `product-manager.html`, `product-links.html`, `robots.txt`

---

## ৬. গ্রাহক vs Admin

| | গ্রাহক | Admin |
|--|--------|--------|
| পেজ | signin.html | admin-login.html |
| Sheet | Customers | Admins |
| সেশন key | ma_auth_session | ma_admin_session |

একই ইমেইল দুটোতেই থাকতে পারে (আলাদা পাসওয়ার্ড দিন)।

---

## ৭. সমস্যা

| সমস্যা | সমাধান |
|--------|---------|
| NO_ADMIN | Sheet মেনু থেকে Admin তৈরি করুন |
| NOT_ADMIN | admin-login দিয়ে লগইন করুন (signin নয়) |
| অর্ডার খালি | Deploy New version; Online Order শীটে ডেটা আছে কিনা |
| লগইন বারবার ফেল | AUTH_SECRET Script properties-এ আছে কিনা |

---

## ৮. নিরাপত্তা

- শক্তিশালী পাসওয়ার্ড (১২+ অক্ষর)
- `admin-login.html` পাবলিক মেনুতে লিংক দেবেন না
- `robots.txt`-এ admin পেজ Disallow করা আছে
