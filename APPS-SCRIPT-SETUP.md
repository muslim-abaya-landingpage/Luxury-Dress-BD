# অর্ডার শিট — Google Apps Script সেটআপ

> দ্রুত গাইড (বাংলা): `APPS-SCRIPT-পেস্ট-করুন.md`  
> সাইটে টেস্ট: `api-setup.html` খুলুন

## ১. Script properties (আপনি যা করেছেন)

1. [script.google.com](https://script.google.com) → প্রজেক্ট **অর্ডার শিট**
2. **Project Settings** → **Script properties**
3. Property: `AUTH_SECRET` = দীর্ঘ র্যান্ডম পাসওয়ার্ড (৩২+ অক্ষর)
4. **Save script properties**

## ২. কোড পেস্ট

1. **Editor** → `Code.gs` (বা নতুন ফাইল)
2. `google-apps-script-backend.gs` ফাইলের **সম্পূর্ণ** কোড কপি করে পেস্ট করুন
3. **Save**

## ৩. Deploy (Web app)

1. **Deploy** → **New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. **Deploy** → **Web app URL** কপি করুন

## ৪. সাইটে URL লাগান

`site-api-config.js` খুলে `url:` এ Deploy URL পেস্ট করুন:

```javascript
window.MA_SITE_API = {
  url: "https://script.google.com/macros/s/...../exec"
};
```

এক URL দিয়ে চলবে: **Sign Up**, **Sign In**, **Checkout অর্ডার**, **Newsletter**

## ৫. টেস্ট

| টেস্ট | কী দেখবেন |
|--------|-----------|
| ব্রাউজারে Web app URL খুলুন | `Muslim Abaya API OK` |
| `signup.html` | নতুন অ্যাকাউন্ট → Sheet এ `Customers` ট্যাব |
| `signin.html` | লগইন সফল |
| `checkout.html` | অর্ডার → Sheet এ `Orders` ট্যাব |

## Sheet ট্যাব

- **`Online Order`** — চেকআউট অর্ডার (কলাম A–H: সময়, নাম, ফোন, পরিমাণ, ডেলিভারি চার্জ, ঠিকানা, প্রোডাক্ট, মোট)
- `Customers` — Sign Up (হ্যাশ পাসওয়ার্ড)
- `Sessions` — লগইন টোকেন
- `Logins` — লগইন অডিট
- `Subscribe` — নিউজলেটার

### ঐচ্ছিক (Facebook CAPI)

Script properties এ যোগ করলে Purchase ইভেন্ট যাবে:

- `FB_ACCESS_TOKEN`
- `FB_PIXEL_ID`

## সমস্যা হলে

| সমস্যা | সমাধান |
|--------|--------|
| `AUTH_NOT_CONFIGURED` | Script properties এ `AUTH_SECRET` সেভ করুন |
| Sign up কাজ করে না | Deploy URL `site-api-config.js` এ ঠিক আছে কিনা দেখুন |
| অর্ডার Sheet এ যায় না | একই URL + `google-apps-script-backend.gs` deploy করা আছে কিনা |
| পুরনো URL | `site-footer.js` আর আলাদা URL ব্যবহার করে না — শুধু `site-api-config.js` |

বিস্তারিত: `SECURITY-GUIDE.md`
