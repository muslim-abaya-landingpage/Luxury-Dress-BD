# Website and admin performance update — 2026-10-13

The homepage keeps editable catalog data separate while combining five static scripts into two minified bundles. Static script bytes decrease from 67,962 to 33,913, and these five requests become two. Rebuild with `node scripts/build-home-speed.mjs` when any bundled source changes, then bump both bundle versions in `index.html`.

The header waits for the homepage bundle instead of injecting duplicate catalog scripts. The initial catalog-ready notification no longer rebuilds an already rendered homepage. Explicit catalog refreshes still render changes.

Dashboard and order-list navigation can reuse the current session's successful response for at most 15 seconds. Refresh always reads from the server. Mutations, logout and account changes invalidate reuse; no write is served from cache.

## Backend deployment status

The `Code.gs` change is prepared and tested but is NOT yet deployed to Apps Script. Google sign-in returned 502 Bad Gateway in the current browser. Until that update is deployed, the live backend still checks courier setup before admin POST requests.

Apply the small `doPost` change to the current live source, preserving any newer project edits: remove the two self-heal calls at the beginning, and call them in `if (isOrder)` after classifying the request. Deploy a New version of the existing web app; keep its URL, access and Script Properties unchanged.

Validation: 59 automated tests passed, including navigation reuse/expiry, forced refresh, mutation/session isolation, mobile sliders, cart updates and order-size mapping. End-user load-time improvements have not been measured on a Bangladesh mobile connection.
