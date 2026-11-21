-- site_settings: generic admin-managed key/value store for the Cloudflare Worker
-- (cloudflare-worker/worker.js). First use: admin-tracking-settings.html lets the
-- owner save meta_pixel_id / tiktok_pixel_id here; the worker reads these keys on
-- every request that needs a pixel ID (the /gtm.js proxy and the CAPI senders),
-- so changing a pixel no longer needs a code edit or redeploy.
-- Applied directly to D1 database "ma-orders" on 2026-11-21 via the Cloudflare MCP
-- tools; this file just records the schema in the repo for future reference.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);
