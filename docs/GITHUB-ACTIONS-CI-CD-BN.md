# GitHub Actions E2E — CI/CD wiring guide

## Workflow behavior

Workflow: [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml)

- Pull request targeting `main`: install lockfile dependencies, run Apps Script security contract tests, install Chromium, then run the full Playwright E2E suite.
- Push to `main`: run the same checks again and upload HTML report/failure evidence as a 14-day artifact.
- Manual `workflow_dispatch`: leave `target_url` blank to test the checkout’s local static copy; provide an HTTPS deployed origin (for example `https://muslimabaya.com`) for post-deploy frontend smoke testing.
- In every mode, the browser test intercepts Google Apps Script requests. It never submits a live order or writes to Google Sheets. A remote run checks the deployed frontend and its request boundary; it does not prove live Apps Script persistence.

The workflow needs no deployment credentials for E2E. It uses least-privilege `contents: read`, Node.js 20 (matching `netlify.toml`), and artifacts are retained for 14 days.

## Make E2E a production release gate

1. In GitHub, open **Settings → Rules → Rulesets** (or **Branches → Branch protection rules**) and target `main`.
2. Require pull requests and require the job check **`Playwright E2E`** before merge. The picker may display it as `E2E / Playwright E2E`; select the matching job from the latest successful run. See the step-by-step [main branch protection guide](GITHUB-MAIN-BRANCH-PROTECTION-BN.md).
3. Confirm the Netlify production site is configured to deploy only the protected `main` branch (or the chosen protected release branch). The repository’s `netlify.toml` publishes the static site from the root and runs `scripts/prepare-netlify-headers.mjs`.
4. Do not add `npm run build` to this workflow: `netlify.toml` explicitly warns that the leftover Vite/React build publishes only `dist/` and would make the other static pages unavailable.
5. After Netlify reports deployment complete, use **Actions → E2E → Run workflow** and optionally supply the deployed HTTPS URL in `target_url`. This is a GET/page-flow smoke test with the Apps Script boundary mocked; use a separate staging Apps Script + test Sheet for any backend-write verification.

## Deployment boundary

This workflow deliberately **does not publish to Netlify**. No Netlify site ID/token or deploy workflow existed in the repository, and the existing hosting config indicates that Netlify owns the static publish step. Keep that existing deployment path; if the team later chooses Actions-based deployment, add the Netlify action only after obtaining the authorized site ID/token, storing them in GitHub secrets, and defining an approval/environment policy.

## Troubleshooting

- **Chromium missing:** the workflow installs it with `npx playwright install --with-deps chromium`; local setup is in [`tests/e2e/README.md`](../tests/e2e/README.md).
- **Remote target test fails at navigation:** pass the site origin (scheme + host), not a deep page URL; check HTTPS redirects and clean-URL hosting.
- **Production API is unavailable:** a browser E2E result is not an API write test—the configured Apps Script calls are deliberately mocked. Check the separate GET-only Prometheus probes and Apps Script Executions.
- **Report unavailable:** download the `playwright-e2e-<run-id>-<attempt>` artifact from the workflow run.
