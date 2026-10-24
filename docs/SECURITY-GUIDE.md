# নিরাপত্তা ও পাসওয়ার্ড গাইড (Muslim Abaya)

## আপনার সাইটে যা যোগ করা হয়েছে

| সুরক্ষা | কাজ |
|---------|-----|
| **হ্যাশ পাসওয়ার্ড** | পাসওয়ার্ড plain text এ সেভ হয় না — SHA-256 + salt + গোপন কী |
| **লগইন সেশন** | ৩০ দিন টোকেন; পাসওয়ার্ড বারবার পাঠানো লাগে না |
| **Rate limit** | একই নম্বর/ইমেইলে বারবার আক্রমণ ঠেকায় |
| **Security headers** | `_headers` — clickjacking, MIME sniffing কমায় |
| **ইনপুট চেক** | ইমেইল, মোবাইল, পাসওয়ার্ড শক্তি যাচাই |

---

## একবার সেটআপ (অবশ্যই করুন)

### ১. Google Apps Script — `AUTH_SECRET`

1. [script.google.com](https://script.google.com) → আপনার প্রজেক্ট  
2. **Project Settings** → **Script properties** → Add  
3. Name: `AUTH_SECRET`  
4. Value: দীর্ঘ র্যান্ডম টেক্সট (উদাহরণ: ৪০ অক্ষরের এলোমেলো) — **কাউকে দেবেন না**  
5. `google-apps-script-backend.gs` কোড পেস্ট → **Deploy** → **New deployment** → Web app → **Anyone**  
6. URL কপি → `site-api-config.js` → `url` (বিস্তারিত: `APPS-SCRIPT-SETUP.md`)

### ২. Google Sheet

স্বয়ংক্রিয় ট্যাব: `Customers`, `Sessions`, `Orders`, `Logins`, `Subscribe`

- **Customers** — শুধু পাসওয়ার্ড **হ্যাশ** (মানুষ পড়তে পারবে না)  
- **Sessions** — লগইন টোকেন  
- **Logins** — শুধু সফল/ব্যর্থ (পাসওয়ার্ড নেই)

### ৩. GitHub

- `AUTH_SECRET` কখনো কোডে লিখবেন না  
- `.env` ফাইল commit করবেন না  

---

## পাসওয়ার্ড নিয়ম (ইউজার)

- কমপক্ষে **৮ অক্ষর**  
- অন্তত **১টি অক্ষর + ১টি সংখ্যা**  
- স্পেস নয়  

---

## আপনি যা করবেন (রক্ষণাবেক্ষণ)

1. **নিয়মিত** Google Sheet ব্যাকআপ (File → Download)  
2. **AUTH_SECRET** মাসে একবার বদলালে সব ইউজার পুনরায় Sign Up লাগতে পারে — তাই শুধু লিক হলে বদলান  
3. সন্দেহ হলে Sheet → `Customers` → স্ট্যাটাস `blocked`  
4. `product-links.html` — শুধু আপনি ব্যবহার করুন; পাবলিক লিংক শেয়ার করবেন না  

---

## সীমা (সতর্ক থাকুন)

- স্ট্যাটিক সাইট — সম্পূর্ণ ব্যাংক-লেভেল সুরক্ষা Firebase/সার্ভার ছাড়া সম্ভব নয়  
- Apps Script URL পাবলিক — গোপন কী (`AUTH_SECRET`) ছাড়া পাসওয়ার্ড ক্র্যাক করা কঠিন  
- ইউজার ডিভাইসে malware থাকলে — তার দায়িত্ব আলাদা  

প্রশ্ন থাকলে `PRODUCT-GUIDE.md` ও `auth-config.js` দেখুন।
