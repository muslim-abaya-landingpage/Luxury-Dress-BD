# প্রোডাক্ট যোগ / বাদ করার গাইড (Muslim Abaya)

**সংক্ষিপ্ত বাংলা গাইড:** `প্রোডাক্ট-সহজ-গাইড.md` · PC: `প্রোডাক্ট-এডিট.bat`

## প্রোডাক্ট ম্যানেজার — `product-manager.html` ⭐⭐ (একটাই যথেষ্ট)

**সব ক্যাটাগরি এক পেজে:** ছবির URL, দাম, সাইজ, রঙ, ফ্যাব্রিক, নাম + **নতুন ক্যাটাগরি যোগ**।  
**HTML/checkout এডিট করতে হবে না** — ক্যাটাগরি পেজ (`abaya.html`, …) ডেটা ফাইল থেকে অটো লোড করে।

1. `প্রোডাক্ট-এডিট.bat` চালান (বা `http://localhost:5500/product-manager.html`)  
2. বামে ক্যাটাগরি বেছে নিন → প্রোডাক্ট এডিট করুন  
3. **সেভ করুন** → `category-products.js` + `product-links-data.js` + `product-catalog-sections.js` ডাউনলোড  
4. প্রজেক্টে রিপ্লেস → Netlify আপলোড → `Ctrl+F5`  
5. নতুন ক্যাটাগরি হলে: HTML + `_redirects-new-categories.txt` ও ডাউনলোড হবে — সেগুলো যোগ করুন

---

## লিংক এডিট — `product-links.html` (ঐচ্ছিক)

শুধু অনেক ছবির URL একসাথে বদলাতে। সাধারণত **product-manager**-এ প্রতি প্রোডাক্টে **ছবির URL** দিলেই হয়; সেভে `product-links-data.js` অটো তৈরি হয়।

বিস্তারিত: `PRODUCT-CATALOG-MAP.md`

---

## কোন সারি = কোন পেজ?

মেনুর মতো **① আবায়া → ⑧ হিজাব** — `product-links-data.js` ও `category-products.js` এ একই ক্রম।

```javascript
"premium-two-piece": [
  "https://github.com/.../images/Dress-1.jpeg?raw=1",
  "https://github.com/.../images/Dress-2.jpeg?raw=1",
  "images/local-photo.jpeg",
],
```

| ফাইল | কাজ |
|------|-----|
| `product-links.html` | ছবির লিংক এডিট (UI) |
| `product-links-data.js` | ছবির লিংক ডেটা (সেভের পর রিপ্লেস) |
| `product-config.js` | সব সাইট লিংক এক জায়গা (CDN বদল, WhatsApp, ভবিষ্যত প্রোডাক্ট পেজ) |
| `category-products.js` | পুরো তথ্য সহ প্রোডাক্ট (নাম, দাম, রঙ ঠিক করতে) |

**লিংক পরিবর্তন:** ছবির সার্ভার বদলালে `product-config.js` → `images.replace` এ পুরনো→নতুন URL দিন — প্রতিটি প্রোডাক্ট এডিট করতে হবে না।

**প্রোডাক্ট পেজ (ভবিষ্যত):** `product-config.js` → `productPage.enabled: true` এবং `pattern: "/product/{id}"` — তারপর `link: "/product/DR-01"` দিলে ছবিতে ক্লিক করলে সেই পেজে যাবে।

---

## হোম পেইজ স্লাইডার (`index.html`)

হোমে **সব ক্যাটাগরি** (① আবায়া → ⑧ হিজাব) থেকে প্রোডাক্ট দেখায় — `category-products.js` + `product-catalog-sections.js` থেকে **অটো**।  
একই ছবি অনেক সারিতে থাকলে **একবার** দেখায় (ডাবল নয়)। নতুন সারি `CATALOG_SECTIONS`-এ যোগ করলে হোমেও আসে।

| আপনি যা করেন | কোথায় |
|--------------|--------|
| যেকোনো সারিতে প্রোডাক্ট যোগ | `category-products.js` → সেই সারির `[ ... ]` |
| ছবির লিংক (সারি অনুযায়ী) | `product-links.html` → সেভ → `product-links-data.js` |
| নতুন ক্যাটাগরি সারি | `product-catalog-sections.js` + `category-products.js` + HTML পেজ |

---

## এক জায়গা — `category-products.js`

সব ক্যাটাগরি পেজ (`abaya.html`, `premium-two-piece.html`, …) এই ফাইল থেকে প্রোডাক্ট লোড করে।

| পেজ | ফাইলে কী খুঁজবেন |
|-----|------------------|
| Abaya | `abaya: [ ... ]` |
| Two-piece | `"premium-two-piece": [ ... ]` |
| Cover Up | `"cover-up": [ ... ]` |
| Tops/Kurti | `"tops-kurti": [ ... ]` |

**গুরুত্বপূর্ণ:** Abaya-র প্রোডাক্ট শুধু `abaya` অ্যারেতে রাখুন। Two-piece শুধু `"premium-two-piece"` অ্যারেতে। অন্য অ্যারেতে কপি করবেন না — নাহলে ভুল পেজে দেখাবে।

---

## ক্রম (সিরিয়াল) — অটোমেটিক

প্রোডাক্ট **HTML-এ এক এক করে বসানো লাগে না**। `category-renderer.js` লিস্ট থেকে কার্ড বানায়।

| আপনি যা করেন | সাইটে যা হয় |
|--------------|-------------|
| অ্যারেতে নতুন `{ ... },` **নিচে যোগ** | গ্রিডে **সবার শেষে** নতুন কার্ড |
| অ্যারেতে **উপরে** যোগ | গ্রিডে **প্রথমে** দেখাবে |
| মাঝখানে যোগ | সেই **অবস্থান অনুযায়ী** বাম→ডান, উপর→নিচ |
| শুধু `image` / `name` / `price` বদলান | **ক্রম একই**, শুধু তথ্য/ছবি বদলে |
| পুরো ব্লক মুছুন | সাইট থেকে **অটো উঠে যাবে** |

**শুধু `category-products.js` এডিট + সেভ + `Ctrl+F5`** — বাকি পেজ, বাটন, কার্ট কোড আবার লিখতে হবে না।

উদাহরণ (`premium-two-piece`):

```javascript
"premium-two-piece": [
  { id: "DR-29", name: "Baby Pink Light Pink", image: "images/....jpeg", price: 550, ... },
  { id: "DR-NEW", name: "My New Dress", image: "images/new-dress.jpeg", price: 599, ... },  // ← যোগ
],
```

---

## নতুন প্রোডাক্ট যোগ (+)

1. `category-products.js` খুলুন।
2. সঠিক ক্যাটাগরির `[` `]` এর ভিতরে নিচের মতো একটি ব্লক কপি করে পেস্ট করুন:

```javascript
{
  id: "ABY-NEW-1",
  name: "Your Product Name",
  image: "images/your-photo.jpeg",
  link: "index.html",
  price: 799,
  color: "maroon",
  colorLabel: "Maroon",
  fabric: "দুবাই চেরি",
  sizes: ["50", "52", "54", "56"]
},
```

3. `id` — প্রতিটি প্রোডাক্টে **অনন্য** (যেমন `DR-31`, `ABY-NEW-1`)।
4. `image` — `images/` ফোল্ডারে ছবি রাখুন, অথবা GitHub raw লিংক (Maroon Abaya-র মতো)।
5. সেভ করুন → ব্রাউজারে `Ctrl+F5` → সংশ্লিষ্ট ক্যাটাগরি পেজ খুলুন।

---

## প্রোডাক্ট বাদ (−)

1. যে `{ ... },` ব্লকটি মুছতে চান সেটি পুরোটা ডিলিট করুন (কমা সহ)।
2. সেভ → `Ctrl+F5`।

---

## ছবি (image)

- লোকাল: `image: "images/My-Photo.jpeg"`
- GitHub: `https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/My-Photo.jpeg?raw=1`
- Abaya কালো সেটের ফাইলনাম: `Black...jpeg`, `Black..jpeg`, `Black.jpeg` (`.jpg` নয়)

---

## Sign In / Sign Up — Google Sheet

- ফর্ম সাবমিট → `auth-sheets.js` → আপনার Apps Script URL।
- Sheet-এ লগ দেখতে `google-apps-script-backend.gs` কোড **Apps Script-এ পেস্ট** করে **নতুন deployment** করুন (একই URL থাকলে আপডেট deployment)।
- ট্যাব: `Customers` (রেজিস্টার), `Logins` (সাইন ইন), `Orders` (চেকআউট)।

**পাসওয়ার্ড লগইন ও অর্ডার:** `APPS-SCRIPT-SETUP.md` দেখুন — Apps Script এ `AUTH_SECRET` + `site-api-config.js` এ Deploy URL। Sign Up, Checkout, Newsletter একই API।

---

## সার্চ

- হেডার সার্চ **two piece** → `premium-two-piece.html` পেজে যাবে।
- কোনো ক্যাটাগরি পেজে `?q=` থাকলে শুধু **সেই ক্যাটাগরির** মধ্যে ফিল্টার হবে।
