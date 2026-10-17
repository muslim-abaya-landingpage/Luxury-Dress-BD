# Storefront E2E Tests

The suite runs Playwright against the repository's static server and **mocks every Google Apps Script request**. It does not create live orders, signup users, newsletter records, or sheet rows.

## Run locally

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

If a compatible system Chromium is already installed, set its path instead of downloading Playwright's browser:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The test runner starts `scripts/serve-gzip.py` on `127.0.0.1:43147`. The local server resolves clean URLs such as `/thank-you` to matching `.html` files, like the configured static hosting. Override its port with `E2E_PORT=43148`. To test an existing non-production staging host, set `E2E_BASE_URL=https://staging.example.invalid`; that host must serve the same static application. Keep the Apps Script API intercepted: do not change the mock or point a test order at production.

GitHub Actions runs this suite for pull requests and pushes to `main`. After a deployment, maintainers can manually dispatch `.github/workflows/e2e.yml` with an HTTPS `target_url` to run the same frontend suite against that deployed origin. The test intercepts the Apps Script API before any order POST is sent, so this validates the deployed frontend/API boundary without creating production data. The remote run does not validate a live Sheet write.

## Coverage

- Public storefront, product, account, checkout and policy page HTTP/title smoke checks
- Cart hydration, selected-line totals, district delivery and free shipping at quantity 3+
- Successful mocked COD order, request payload, order ID presentation and cart clearing
- Mocked backend rejection, retry affordance and cart preservation
- Required delivery fields, Terms acceptance and payment transaction reference gates
- Guest redirect from the admin orders page
- Mobile checkout horizontal-overflow guard

## CI

Install the pinned npm dependencies, install Chromium (`npx playwright install --with-deps chromium` on a Linux CI runner), then run `npm run test:e2e`. `CI=1` enables `forbidOnly`, one retry and two workers. Reports, traces, screenshots and test-result files are written to ignored `playwright-report/` and `test-results/` folders.

The current browser suite tests the frontend/API boundary using deterministic mocked responses. It does **not** prove Apps Script/Google Sheets live write correctness. For that, configure a separate Apps Script deployment and test spreadsheet, create clearly marked synthetic test rows, and add cleanup/reconciliation before enabling a staging-only backend test.
