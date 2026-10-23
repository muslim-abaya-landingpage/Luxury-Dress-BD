-- D1 database "ma-orders" (binding DB in the Worker, ORDERS_DB in the Pages project).
-- IP tracking & blocking, added 2026-10-24. Safe to run more than once.

-- One row per order attempt that reached the Worker (/_ma/order).
-- outcome: received | saved | queued | rejected | needs_attention | blocked
CREATE TABLE IF NOT EXISTS order_ip_log (
  event_id   TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  ip         TEXT,
  country    TEXT,
  asn        INTEGER,
  as_org     TEXT,
  user_agent TEXT,
  phone      TEXT,
  name       TEXT,
  total      TEXT,
  order_id   TEXT,
  outcome    TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_ip_log_ip ON order_ip_log (ip, created_at);
CREATE INDEX IF NOT EXISTS idx_order_ip_log_phone ON order_ip_log (phone, created_at);
CREATE INDEX IF NOT EXISTS idx_order_ip_log_order ON order_ip_log (order_id);
CREATE INDEX IF NOT EXISTS idx_order_ip_log_created ON order_ip_log (created_at);

-- ip: an IPv4 address, or an IPv6 /64 network written as "2001:db8:0:1::/64".
-- expires_at NULL = permanent.
CREATE TABLE IF NOT EXISTS blocked_ips (
  ip         TEXT PRIMARY KEY,
  reason     TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  expires_at INTEGER
);
