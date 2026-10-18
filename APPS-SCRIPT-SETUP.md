# অর্ডার শিট — Google Apps Script সেটআপ

> **দৈনিক কাজ + লিংক:** `APPS-SCRIPT-দৈনিক-কাজ.md`  
> দ্রুত পেস্ট: `APPS-SCRIPT-পেস্ট-করুন.md` · সাইট টেস্ট: `api-setup.html`

## ১. Script properties (আপনি যা করেছেন)

1. [script.google.com](https://script.google.com) → প্রজেক্ট **অর্ডার শিট**
2. **Project Settings** → **Script properties**
3. Property: `AUTH_SECRET` = দীর্ঘ র্যান্ডম পাসওয়ার্ড (৩২+ অক্ষর)
4. **Save script properties**

## ২. কোড পেস্ট

1. **Editor** → `Code.gs` (বা নতুন ফাইল)
2. `apps-script-copy.html` পেজে থাকা **সব** `.gs` ও `.html` source একই প্রকল্পে রাখুন—`.gs`-এর জন্য **＋ → Script**, `ProductPicker.html`-এর মতো HTML file-এর জন্য **＋ → HTML**। এতে `Operations.gs` ও `CatalogPublish.gs`-এর মতো Admin API modules-ও অন্তর্ভুক্ত; শুধু তিনটি ফাইল কপি করলে কিছু dashboard route চলবে না। আলাদা `doGet` তৈরি করবেন না।
3. **Save**

### Security patch (2026-10-17)

- `GET ?RecordType=Subscribe` এখন `METHOD_NOT_ALLOWED` JSON দেয় এবং Subscribe Sheet-এ কিছু লেখে না। Google Apps Script `ContentService` response-এ HTTP status code বেছে নেওয়া যায় না—তাই GET-এর HTTP status `200` হলেও JSON-এ `ok:false` থাকবে।
- Newsletter/footer-এর স্বাভাবিক পথ `POST`; `site-footer.js` আগেই form-urlencoded POST পাঠায়, তাই POST subscription flow চালু থাকে।
- Order limiter-এর bypass এখন default-এ **খালি**। `ORDER_RATE_LIMIT_BYPASS` Script Property স্পষ্টভাবে সেট থাকলেই allowlist প্রযোজ্য হবে। আগে থেকে Script Properties-এ property থাকলে তা এখনও কার্যকর—Project Settings-এ review করুন; অনুমোদিত প্রয়োজন না থাকলে মুছে দিন। `ORDER_RATE_LIMIT_MAX` না থাকলে limit প্রতি ফোনে ৩০ মিনিটে ৬টি order।
- Source `apps-script/Code.gs`; `apps-script-copy.html` থেকে কপি করার আগে generated Code.gs parity test চালান: `npm run test:backend`।
- এই security patch-এর জন্য কোনো Sheet migration বা `setupOnlineOrderExtraHeaders` চালানোর দরকার নেই। `main`-এ Git merge হওয়া **Apps Script deployment নয়**; Code.gs Save করার পর নিচের ধাপ অনুযায়ী নতুন Web App version প্রকাশ করতে হবে।

প্রকাশের পর test deployment/আলাদা Sheet-এ POST subscription যাচাই করুন। Production-এ POST probe দেবেন না—তা বাস্তব Subscribe row লিখতে পারে। GET-only নিরাপদ probe হিসেবে `?RecordType=Subscribe&contact=security-probe@example.invalid` ব্যবহার করলে JSON `METHOD_NOT_ALLOWED` পাওয়া উচিত এবং Sheet row বাড়বে না।

## ৩. Deploy (Web app)

আগের ডিপ্লয়মেন্ট আপডেট করতে **Deploy → Manage deployments → Edit → Version: New version → Deploy** ব্যবহার করুন। আগের URL-ই থাকবে; সাইটের API URL বদলাতে হবে না। H কলামে সাইজের বিন্যাস ও যাচাইয়ের জন্য `ORDER-SIZE-SETUP.md` দেখুন।

প্রথমবার ডিপ্লয় করলে:

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
| `checkout.html` | অর্ডার → Sheet এ **`Online Order`** ট্যাব |
| ফুটার Subscribe | Sheet এ **`Subscribe`** ট্যাব (Online Order এ নয়) |

## Sheet ট্যাব

- **`Online Order`** — A–G মূল তথ্য, H পণ্যের সাইজ, I মোট টাকা, J অর্ডার আইডি, K স্ট্যাটাস, L–N কুরিয়ার, R নোট এবং S–AD ছবি। কোড আগের H=টাকা বিন্যাসও চেনে। বিস্তারিত `ORDER-SIZE-SETUP.md`।
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
| অর্ডার Sheet এ যায় না | `apps-script-copy.html` থেকে canonical `apps-script/Code.gs` ও companion files কপি করে একই Apps Script project-এ deploy করা আছে কিনা দেখুন; `google-apps-script-backend.gs` পুরোনো/অসম্পূর্ণ এবং Admin API-এর জন্য ব্যবহার করবেন না। |
| পুরনো URL | `site-footer.js` আর আলাদা URL ব্যবহার করে না — শুধু `site-api-config.js` |
| Subscribe সবুজ কিন্তু Sheet খালি | লাইভে পুরনো `site-footer.js` — `site-footer.js` + `site-api-config.js` `main`-এ push করে Cloudflare Pages deploy সফল করুন; Apps Script Deploy **Anyone** + New version |
| API URL লগইন পেজ দেখায় | Deploy → Who has access: **Anyone** (Google অ্যাকাউন্ট লাগবে না) |

বিস্তারিত: `SECURITY-GUIDE.md`
