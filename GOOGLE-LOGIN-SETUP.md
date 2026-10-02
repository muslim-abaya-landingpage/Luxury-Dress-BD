# Google দিয়ে লগইন ("Continue with Google") চালু করা

কোড সাইটে তৈরি আছে, কিন্তু **আপনি Client ID বসানোর আগে পুরোপুরি বন্ধ** (কোনো বাটন দেখায় না, Google থেকে কিছু নামে না)।

## ১. Google Cloud-এ Client ID বানান (আপনাকে করতে হবে)
> Google-এর মেনুর নাম বদলাতে পারে — না মিললে "OAuth client ID" লিখে সার্চ করুন।

1. [console.cloud.google.com](https://console.cloud.google.com) → একটি প্রজেক্ট বানান বা বেছে নিন
2. **APIs & Services → OAuth consent screen**: App name = Muslim Abaya, support email দিন, Publish করুন (In production)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins** এ দিন: `https://muslimabaya.com` (আর `www` ব্যবহার করলে `https://www.muslimabaya.com`)
4. Create চাপুন → **Client ID** কপি করুন (`xxxx.apps.googleusercontent.com` দিয়ে শেষ হয়)

## ২. Apps Script-এ বসান
1. `apps-script-copy.html` থেকে **নতুন Code.gs** পেস্ট করুন (এতে `googleLogin_` যোগ হয়েছে)
2. Project Settings → **Script properties** → `GOOGLE_CLIENT_ID` = আপনার Client ID → Save
3. **Deploy → Manage deployments → ✏️ Edit → New version → Deploy**

## ৩. সাইটে বসান
`site-api-config.js`-এর শেষে `window.MA_GOOGLE_CLIENT_ID = "..."` এ Client ID বসান।
**গুরুত্বপূর্ণ:** `.js` ফাইল ১ বছর ক্যাশ হয়, তাই এডিট করলে `signin.html` ও `signup.html`-এ `site-api-config.js?v=...` এর `v=` বদলাতে হবে। সহজ উপায়: Client ID আমাকে দিন, আমি সব ঠিকঠাক করে দেব।

## কীভাবে কাজ করে
- Google থেকে পাওয়া টোকেন Apps Script আবার Google দিয়ে যাচাই করে (audience = আপনার Client ID, issuer, মেয়াদ, ইমেইল verified)।
- নতুন গ্রাহক হলে `Customers` শীটে ইমেইল + নাম দিয়ে তৈরি হয় (পাসওয়ার্ড থাকে না, মোবাইল ফাঁকা — চেকআউটে দেবে)।
- একই ইমেইলে আগে অ্যাকাউন্ট থাকলে সেটাতেই ঢোকে।
- `blocked` গ্রাহক ঢুকতে পারে না।
