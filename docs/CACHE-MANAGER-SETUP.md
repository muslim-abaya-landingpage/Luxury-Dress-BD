# Muslim Abaya Cache Manager

This is an isolated Cloudflare Worker. It does not replace or modify white-lab-3589, webzo-license, the Pages deployment, or the existing admin-purge rebuild workflow.

## Components
- workers/cache-manager/worker.js: owner-authenticated Cloudflare CDN purge API.
- functions/api/cache-manager-auth.js: validates the existing owner session using the Sessions/Admins sheet and the Pages GOOGLE_SA_JSON secret.
- Worker Secret CLOUDFLARE_API_TOKEN: zone-scoped token with Cache Purge: Purge. Keep its value out of GitHub and browser JavaScript.

## Worker deployment
Create a separate Worker named muslim-abaya-cache-manager. Use workers/cache-manager/worker.js as the module, enable its workers.dev endpoint, and do not add storefront routes or bind it to existing Workers. Use compatibility date 2026-11-19.

In Worker Settings → Variables and Secrets, add a Secret:
- Name: CLOUDFLARE_API_TOKEN
- Value: the separately generated zone-scoped Cache Purge token

Deploy after adding the secret. The Worker calls the Cloudflare zone purge endpoint using this secret.

## Authentication
The browser sends the existing ma_admin_session token as Authorization: Bearer. The Worker does not trust a role supplied by the browser. It calls https://muslimabaya.com/api/cache-manager-auth, which validates the token against the existing Sessions/Admins data and requires the owner account. The Pages Function must be deployed before protected Worker API calls can succeed.

CORS is restricted to https://muslimabaya.com and https://www.muslimabaya.com.

## API
- GET /health: public liveness check; no secret values are returned.
- GET /api/status: owner-authenticated status.
- POST /api/purge: owner-authenticated purge.

Request examples:
- {"action":"site"} purges only muslimabaya.com and www.muslimabaya.com.
- {"action":"urls","urls":["https://muslimabaya.com/product/example"]} purges selected URLs.
- {"action":"prefixes","prefixes":["muslimabaya.com/product/"]} purges a URL prefix.
- {"action":"zone","confirm":"PURGE_ENTIRE_ZONE_MUSLIMABAYA_COM"} purges the entire zone and can affect every hostname. Use only when explicitly intended.

The separate shop.muslimabaya.com application is intentionally excluded from site, URL, and prefix purges.

## Tests
Run: node --test tests/backend/cache-manager-worker.test.mjs tests/backend/cache-manager-auth.test.mjs
