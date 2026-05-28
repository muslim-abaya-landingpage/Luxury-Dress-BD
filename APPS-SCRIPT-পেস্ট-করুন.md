# অর্ডার শিট — ৩ মিনিট সেটআপ (আপনার করণীয়)

সাইটের কোড **প্রস্তুত**। Google-এ শুধু নিচের ৩টা করুন:

---

## ১. কোড পেস্ট

1. [script.google.com](https://script.google.com) → প্রজেক্ট **অর্ডার শিট**
2. **Editor** → পুরনো `Code.gs` এর ভিতর **সব মুছুন**
3. ব্রাউজারে **`apps-script-copy.html`** খুলুন → **সম্পূর্ণ কোড কপি** (অথবা ফাইল **`Code.gs`**)
4. **Ctrl+A** → **Ctrl+C** → Apps Script Editor এ **Ctrl+V**
5. **Save** (ডিস্ক আইকন)

---

## ২. AUTH_SECRET (আপনি করেছেন)

- Project Settings → Script properties
- `AUTH_SECRET` = আপনার গোপন কী
- **Save script properties**

---

## ৩. Deploy + সাইটে URL

1. **Deploy** → **New deployment** → ধরন **Web app**
2. Execute as: **Me** | Who has access: **Anyone**
3. **Deploy** → **Web app URL** কপি করুন
4. প্রজেক্টে **`site-api-config.js`** খুলুন → `url:` এ URL পেস্ট → সেভ

```javascript
window.MA_SITE_API = {
  url: "এখানে_আপনার_DEPLOY_URL"
};
```

5. ব্রাউজারে `api-setup.html` খুলে **সংযোগ টেস্ট** চাপুন

---

## কী কাজ করবে

| ফিচার | Sheet |
|--------|--------|
| Checkout অর্ডার | **Online Order** (A–H) |
| Sign Up / Sign In | Customers, Sessions |
| Newsletter | Subscribe |

---

## ঐচ্ছিক Facebook

Script properties এ যোগ করুন: `FB_ACCESS_TOKEN`, `FB_PIXEL_ID`

---

**মনে রাখুন:** পুরনো শুধু `doPost` কোড ব্যবহার করবেন না — শুধু **`google-apps-script-backend.gs`** পুরোটা।
