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

## ৩. এক ক্লিকে হোস্টিং প্যাক (সবচেয়ে সহজ)

**`ADMIN-হোস্টিং-আপলোড.bat`** ডাবল-ক্লিক করুন।

- `hosting-pack` ফোল্ডার তৈরি হবে (আপলোডের জন্য সব ফাইল)
- `clasp push` চেষ্টা করবে
- Apps Script Editor খুলবে (Deploy → New version)

`hosting-pack` এর ভিতরের **সব ফাইল** সাইটের মূল ফোল্ডারে (যেখানে `index.html`) আপলোড করুন।

---

## ৪. সাইটে URL (হোস্টিং-এ আপলোড করুন)

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
