# Webzo BD v9 — 30 Subdomain Multi-Site

## লক্ষ্য
একই landing-page engine দিয়ে `muslimabaya.com`-এর অধীনে বহু subdomain চালানো।

Examples:
- `hafeza.muslimabaya.com`
- `offer01.muslimabaya.com`
- `client01.muslimabaya.com`

## কীভাবে কাজ করে
`site-router.js` hostname দেখে slug বের করে `sites/<slug>.js` load করে। `config.js` হলো base config; প্রতিটি site file শুধু প্রয়োজনীয় values override করে।

Local test:
`index.html?site=hafeza`

## নতুন site
1. `sites/hafeza.js` copy করুন।
2. নতুন নাম দিন, যেমন `sites/client02.js`।
3. brand/product/images/tracking values override করুন।
4. Publish করুন।
5. Cloudflare-এ wildcard DNS/custom hostname setup থাকলে `client02.muslimabaya.com` একই deployment-এ পৌঁছাবে।

## Cloudflare/GitHub target
Recommended deployment flow:
GitHub main -> Cloudflare Pages/Workers static deployment -> wildcard custom domain `*.muslimabaya.com`.

DNS/Cloudflare account changes এই ZIP নিজে করতে পারে না; Cloudflare dashboard-এ domain এবং wildcard hostname bind করতে হবে।

## Security
Pixel IDs public হতে পারে, কিন্তু API secret, courier token, database service-role key, Meta CAPI access token frontend/site config-এ রাখবেন না। Server-side secrets Cloudflare environment/secrets-এ রাখুন।

## Scale
এই router 30-এ hard-coded নয়। প্রয়োজন হলে আরও site config যোগ করা যাবে। পরবর্তী cloud dashboard-এ project records/database থেকে config serve করা যাবে।
