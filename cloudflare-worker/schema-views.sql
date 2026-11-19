-- D1 database "ma-orders" (binding DB). Real, honest "X people viewing now" counter
-- for product pages — NOT a fake/random social-proof number. Added 2026-11-20.
-- session_id: a random id the browser keeps in sessionStorage, no personal data.
-- A browser "pings" every ~25s while the real product page (not a category quick-view
-- popup) is open; a row older than the active window is simply not counted (and is
-- cleaned up lazily on the next ping for that product).
CREATE TABLE IF NOT EXISTS product_live_views (
  session_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (session_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_plv_product_seen ON product_live_views (product_id, last_seen);
