# Luxury Dress BD — Muslim Abaya

muslimabaya.com এর সোর্স কোড।

## ফাইল স্ট্রাকচার
- `index.html` — হোমপেজ
- `checkout.html` — চেকআউট পেজ
- `abaya.html`, `premium-two-piece.html`, ইত্যাদি — ক্যাটাগরি পেজ
- `category-products.js` — সব প্রোডাক্টের ডেটা
- `category-renderer.js` — ক্যাটাগরি পেজে প্রোডাক্ট রেন্ডার করে
- `images/` — প্রোডাক্ট ছবি

## পারফরম্যান্স

লোকাল প্রিভিউ: `python3 scripts/serve-gzip.py` → http://127.0.0.1:43147/

বিস্তারিত: [PERFORMANCE-REPORT.md](PERFORMANCE-REPORT.md)

## E2E Testing ও Production Operations

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

E2E suite-টি Google Apps Script API mock করে—production order বা Sheet row তৈরি করে না। Setup ও coverage: [tests/e2e/README.md](tests/e2e/README.md)।

- GitHub Actions: [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) — `main`-এর PR/push-এ E2E gate; `workflow_dispatch` দিয়ে deploy-পরবর্তী HTTPS target smoke run করা যায়। Branch protection-এ `E2E / Playwright E2E`-কে required check করুন।
- [GitHub Actions CI/CD ও release gate guide (বাংলা)](docs/GITHUB-ACTIONS-CI-CD-BN.md)
- [Prometheus/Grafana setup, scope ও Alertmanager instructions](monitoring/README.md)
- [E2E report performance/UX analysis (বাংলা)](docs/E2E-PERFORMANCE-UX-ANALYSIS-BN.md)
- [Alertmanager Slack/Email practical guide (বাংলা)](docs/ALERTMANAGER-SLACK-EMAIL-GUIDE-BN.md)
- [Production security hardening ও rate limiting checklist (বাংলা)](docs/PRODUCTION-SECURITY-HARDENING-CHECKLIST-BN.md)
- [Checkout API config timing bug-এর technical note ও patch](docs/CHECKOUT-API-CONFIG-TIMING-BUG-BN.md)
- [Production monitoring ও alerting guide (বাংলা)](docs/PRODUCTION-MONITORING-BN.md)
- [Presentation speaker script (বাংলা)](docs/PRESENTATION-SPEAKER-SCRIPT-BN.md)
