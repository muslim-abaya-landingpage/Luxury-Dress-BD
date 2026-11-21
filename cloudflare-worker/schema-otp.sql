-- WhatsApp order-phone OTP (added 2026-11-21). Only used for orders whose fraud-risk score is
-- already review/high (see scoreFraudRisk in fraud-risk.js) -- most orders never touch this table.
-- One append-only row per code sent, so rate limiting is a plain COUNT(*) query, same shape as
-- order_ip_log and device_order_log. Apply to the same D1 database used by cloudflare-worker/worker.js.
CREATE TABLE IF NOT EXISTS order_otp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_order_otp_log_phone_time ON order_otp_log (phone, created_at);
CREATE INDEX IF NOT EXISTS idx_order_otp_log_created ON order_otp_log (created_at);
