-- Device fingerprint order attempts (added 2026-11-21). Same shape and purpose as
-- device_order_log (schema-device.sql), but keyed by a client-computed, already-hashed
-- fingerprint (DeviceFP) instead of the ma_device cookie, so it survives a cleared cookie
-- or a private window. Only the hash is ever stored, never the raw browser traits.
-- Apply to the same D1 database used by cloudflare-worker/worker.js.
CREATE TABLE IF NOT EXISTS device_fp_log (
  event_id TEXT PRIMARY KEY,
  fp_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  phone TEXT
);
CREATE INDEX IF NOT EXISTS idx_device_fp_log_fp_time ON device_fp_log (fp_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_device_fp_log_created ON device_fp_log (created_at);
