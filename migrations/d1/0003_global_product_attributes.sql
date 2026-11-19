-- Global reusable Product Manager attributes. Additive only; existing product catalog and variation rows are untouched.
CREATE TABLE IF NOT EXISTS global_product_attributes (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  attributes_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT 0
);
