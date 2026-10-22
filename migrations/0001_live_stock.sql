-- Independent stock switch store. Existing catalog, orders, and inventory are untouched.
CREATE TABLE IF NOT EXISTS live_stock (
  product_id TEXT PRIMARY KEY NOT NULL,
  in_stock INTEGER NOT NULL CHECK(in_stock IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS live_stock_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  old_value INTEGER,
  new_value INTEGER NOT NULL,
  actor TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_live_stock_audit_product ON live_stock_audit(product_id, changed_at);
