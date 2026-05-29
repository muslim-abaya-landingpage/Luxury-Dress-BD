# অর্ডার শিট — দৈনিক কাজ ও লিংক গাইড (Muslim Abaya)

এক পেজে: কোথায় যাবেন, কী bookmark করবেন, প্রতিদিন কী করবেন।

---

## ১. গুরুত্বপূর্ণ লিংক (Bookmark করুন)

| নাম | লিংক / কোথা থেকে |
|-----|------------------|
| **Apps Script প্রজেক্ট** | [script.google.com](https://script.google.com) → **অর্ডার শিট** |
| **প্রজেক্ট সরাসরি** | `https://script.google.com/home/projects/1LFd_vDAiSJMdWrHJf2s_7fEVVxTt6g6q8cEVWfhVJhYJN-xpNcTFExCD` |
| **Google Sheet** | Drive → **অর্ডার শিট 2026** |
| **API টেস্ট** | নিচের Web app URL ব্রাউজারে খুলুন |
| **Steadfast API** | `https://steadfast.com.bd/user/api` |
| **সাইট Checkout** | `https://muslimabaya.com/checkout` |

### Web app URL (সাইট + API)

```
https://script.google.com/macros/s/AKfycbxZv7KU0JMY90576HoRF8wtHmEgW2ggkTxAoQKjO6on1cactlDgJDhoRLndCh3kK_hz/exec
```

**সফল টেস্ট:** পেজে লেখা `Muslim Abaya API OK`

**সতর্ক:** URL-এ `xZ` থাকতে হবে — `zv` দিলে “পৃষ্ঠা পাওয়া গেল না” আসে।

সাইটে একই URL: `site-api-config.js` → `url`

---

## ২. Bookmark সেভ করার ধাপ

1. Chrome/Edge-এ লিংক খুলুন  
2. **Ctrl + D** (Mac: Cmd + D)  
3. নাম দিন, যেমন: `অর্ডার শিট API`  
4. **Bookmarks bar**-এ রাখুন (সবচেয়ে দ্রুত)

Phone: Chrome → মেনু → **Add to Home screen**

---

## ৩. Apps Script — ৫টা জায়গা

| আইকন | নাম | কাজ |
|------|-----|-----|
| ℹ️ | **Overview** | Deployed? Error rate? |
| `<>` | **Editor** | `Code.gs` — কোড |
| 🕐 | **Triggers** | সময়মতো চালানো (ঐচ্ছিক) |
| 📋 | **Executions** | Error log দেখুন |
| ⚙️ | **Project Settings** | **Script properties** (key) |

**Deploy** বাটন (উপরে): Web app URL + **New version**

---

## ৪. Script properties (গোপন key)

**Project Settings → Script properties → Edit**

| Property | কী রাখবেন |
|----------|-----------|
| `AUTH_SECRET` | Sign Up (দীর্ঘ random) |
| `STEADFAST_API_KEY` | Steadfast → Api-Key |
| `STEADFAST_SECRET_KEY` | Steadfast → Secret-Key |
| `STEADFAST_WEBHOOK_TOKEN` | (ঐচ্ছিক) নিজে বানানো random |

**Property = নাম** (যেমন `STEADFAST_API_KEY`)  
**Value = key** (Steadfast থেকে copy)

Key **কখনো** chat, WhatsApp, Code.gs-এ লিখবেন না।

---

## ৫. দৈনিক রুটিন (অর্ডার প্রসেস)

```
① Sheet খুলুন → Online Order → নতুন row
② Pending অর্ডার → ফোনে confirm
③ (ঐচ্ছিক) Steadfast → Fraud Check → ফোন
④ Sheet → row সিলেক্ট → Muslim Abaya → Steadfast পাঠান
⑤ Tracking → WhatsApp/কল
⑥ Status = Shipped / Delivered
```

### Sheet কলাম (A–Q)

| কলাম | বিষয় |
|-------|--------|
| A | সময় |
| B | নাম |
| C | ফোন |
| D | পরিমাণ |
| E | ডেলিভারি চার্জ |
| F | ঠিকানা |
| G | পণ্য |
| H | মোট |
| I | Order ID |
| J | Status |
| K | Tracking |
| L | Consignment ID |
| M | Courier Status |
| N | জেলা |
| O | Payment |
| P | Txn / Sender |
| Q | Notes |

হেডার নেই? Sheet → **Muslim Abaya → Sheet headers (J–Q) সেট করুন**

---

## ৬. কোড বদলালে (অবশ্য)

### উপায় A — clasp (প্রস্তাবিত, clasp login হয়ে থাকলে)

1. `scripts\clasp-push.bat` ডাবল-ক্লিক **অথবা** PowerShell:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:Path"
   cd D:\Luxury-Dress-BD
   clasp push --force
   ```
2. **Deploy → Manage deployments → Edit → New version → Deploy**
3. API URL টেস্ট → `Muslim Abaya API OK`
4. Test order → Sheet-এ row

### উপায় B — হাতে paste (clasp না থাকলে)

1. `apps-script-copy.html` → সম্পূর্ণ কোড কপি  
2. Editor → `Code.gs` → Ctrl+A → Ctrl+V → **Save**  
3. **New version Deploy** (উপরের মতো ২–৪)

**সংক্ষিপ্ত চেকলিস্ট:** `দৈনিক-চেকলিস্ট.md`

**Save / push করলেই live হয় না — New version Deploy লাগে।**

---

## ৭. সমস্যা → সমাধান

| লক্ষণ | করণীয় |
|--------|---------|
| API → Page not found | URL `xZ` আছে কিনা; Web app URL Deploy থেকে copy |
| Script function not found: doGet | Deploy → **New version** |
| অর্ডার Sheet-এ নেই | Tab `Online Order`; **Executions**-এ error |
| Steadfast error | Script properties key; Regenerate key |
| Sign up fail | `AUTH_SECRET` আছে কিনা |
| Error rate বেশি | **Executions** → লাল line → কারণ দেখুন |

---

## ৮. সাপ্তাহিক চেকলিস্ট

- [ ] API URL → `Muslim Abaya API OK`  
- [ ] Executions → error কম (৫% এর নিচে লক্ষ্য)  
- [ ] Test order → Sheet row  
- [ ] Steadfast balance menu কাজ করে  
- [ ] Sheet backup: File → Download  

---

## ৯. সম্পর্কিত ফাইল (PC প্রজেক্ট)

| ফাইল | কাজ |
|------|-----|
| `দৈনিক-চেকলিস্ট.md` | ৫ মিনিটের দৈনিক/সাপ্তাহিক চেক |
| `scripts\clasp-push.bat` | এক ক্লিকে `clasp push` + Editor খোলে |
| `apps-script-copy.html` | সম্পূর্ণ কোড কপি (paste উপায়) |
| `site-api-config.js` | সাইট API URL |
| `api-setup.html` | ব্রাউজারে API টেস্ট |
| `APPS-SCRIPT-SETUP.md` | প্রথম সেটআপ |
| `SECURITY-GUIDE.md` | নিরাপত্তা |

---

## ১০. এক লাইন সারাংশ

**Bookmark:** Sheet + Apps Script + API URL + Steadfast  
**দৈনিক:** Sheet অর্ডার → ফোন confirm → Steadfast → tracking  
**কোড:** Paste → Save → **Deploy New version**  
**Key:** শুধু Script properties  

প্রশ্ন থাকলে `api-setup.html` খুলে API health দেখুন।
