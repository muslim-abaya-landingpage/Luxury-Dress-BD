-- Pseudonymous first-party device activity. No raw fingerprint or browser hardware attributes are stored.
-- Apply to the same D1 database used by cloudflare-worker/worker.js.
CREATE TABLE IF NOT EXISTS device_order_log (
  event_id TEXT PRIMARY KEY,
  device_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  phone TEXT
);
CREATE INDEX IF NOT EXISTS idx_device_order_log_device_time ON device_order_log (device_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_device_order_log_created ON device_order_log (created_at);
