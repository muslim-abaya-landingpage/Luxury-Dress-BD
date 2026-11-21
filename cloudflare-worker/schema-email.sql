-- D1 database "ma-orders" (binding DB in the Worker, ORDERS_DB in the Pages project).
-- Email blocking, added 2026-11-21. Safe to run more than once.

-- email: lowercased, trimmed. expires_at NULL = permanent.
CREATE TABLE IF NOT EXISTS blocked_emails (
  email      TEXT PRIMARY KEY,
  reason     TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  expires_at INTEGER
);
