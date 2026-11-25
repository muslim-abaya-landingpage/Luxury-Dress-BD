# Tracking Management ERP — নিরাপদ বাস্তবায়ন পরিকল্পনা

## লক্ষ্য

MUSLIM ABAYA-র বর্তমান Meta/TikTok/GA4 tracking নষ্ট না করে Admin Panel-এ বহু Pixel, বহু Domain, Server-Side API configuration, Event Monitoring এবং Deduplication ব্যবস্থাপনা যোগ করা।

## বর্তমান ভিত্তি

- `admin-tracking-settings.html`: বর্তমানে একটি Meta Pixel ID ও একটি TikTok Pixel ID সম্পাদনা করা যায়।
- `cloudflare-worker/worker.js`: `/_ma/e`-এ event গ্রহণ করে Meta CAPI এবং configured থাকলে TikTok Events API-তে পাঠানোর বিদ্যমান কোড রয়েছে।
- Browser ও Server-এর event ID matching-এর কিছু বাস্তবায়ন আছে।
- Confirmed order থেকে Purchase পাঠানোর Apps Script logic রয়েছে।
- এগুলোকে নতুন ব্যবস্থায় সরাসরি প্রতিস্থাপন করা হবে না; migration হবে compatibility-first।

## নতুন ডেটা মডেল

Migration `migrations/d1/0005_tracking_erp.sql` নিচের টেবিল প্রস্তুত করে:

1. `tracking_profiles` — আলাদা Tracking Profile, Pixel IDs এবং encrypted token ciphertext।
2. `tracking_domains` — কোন hostname কোন profile ব্যবহার করবে।
3. `tracking_event_dedup` — provider + profile + event ID-ভিত্তিক idempotency ledger।
4. `tracking_event_log` — PII-বিহীন event delivery outcome, status ও provider trace ID।
5. `tracking_event_queue` — AES-GCM encrypted payload, bounded retry schedule এবং dead-letter state।

## নিরাপত্তা নীতি

- Access token কখনো browser-এ পাঠানো হবে না।
- D1-এ token ciphertext ছাড়া plaintext token রাখা যাবে না। Encryption key Cloudflare Worker Secret-এ থাকবে।
- Event log-এ customer name, phone, email, IP, cookie বা raw request body লেখা যাবে না।
- Admin API-তে বিদ্যমান AdminVerify session validation বাধ্যতামূলক হবে।
- Domain resolver কেবল আগে থেকে নিবন্ধিত ও enabled hostname গ্রহণ করবে; client পাঠানো arbitrary Pixel ID বিশ্বাস করবে না।
- Profile/Domain update-এ validation, audit metadata ও safe error response থাকবে।
- Retry queue-তে কেবল AES-GCM authenticated encryption-এ সুরক্ষিত event payload থাকবে; provider token queue payload-এ রাখা হবে না।
- Retry worker প্রতি ৫ মিনিটে চলবে; transient network/HTTP 429/5xx failure-এ exponential backoff (১ মিনিট থেকে সর্বোচ্চ ১২ ঘণ্টা), সর্বোচ্চ ৬টি attempt; এরপর dead-letter।
- Preview Worker-এ `IS_PREVIEW=1` guard আছে, তাই Preview cron Production `/api/cron-tick` endpoint কল করবে না।

## ধাপে ধাপে কাজ

### Phase 1 — Foundation
- আলাদা Git branch-এ schema ও technical plan।
- বর্তমান Pixel settings ও event path-এর compatibility map।
- Migration-এর SQL validation ও rollback review।

### Phase 2 — Admin API
- Profile CRUD, Domain mapping, credential save/rotate।
- Secret encryption/decryption inside Worker only।
- Role/session verification এবং input validation।

### Phase 3 — Event Router
- Hostname → enabled profile resolve।
- Meta ও TikTok provider routing; GA4 routing আলাদা পরবর্তী কাজ।
- Same event ID preservation and provider-level deduplication।
- Existing single-profile behavior as a fallback during migration।

### Phase 4 — Monitoring
- PII-free delivery logs, provider status, error codes, event counts।
- Retry queue with bounded exponential backoff and dead-letter state।
- Test Events mode and health summary।

### Phase 5 — Admin UI and QA
- Multiple profiles, multiple domains, token status (never reveal token), event map, Advanced Matching allow-list।
- Mocked provider tests, D1 SQLite tests, authorization tests, E2E checks।
- Cloudflare Preview + isolated preview D1 only।

## Release boundary

- এই migration Git branch-এ staged থাকবে; production D1-এ apply করা হবে না।
- Live Worker secrets বা existing D1 values read/write করা হবে না।
- Existing order intake, checkout, Apps Script Purchase flow, production Pixel IDs এবং GTM container untouched থাকবে যতক্ষণ না Preview QA ও আলাদা deployment approval পাওয়া যায়।
- Production rollout-এর আগে current D1 backup, schema compatibility, secret rotation plan, rollback SQL এবং event parity checklist প্রয়োজন।
