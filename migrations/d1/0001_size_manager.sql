-- Size Manager (Cloudflare D1 database "muslimabaya-live-stock", Pages binding STOCK_DB).
-- Only adds new size_* tables; no existing table is changed. Undo: 0001_size_manager.down.sql.
-- Category and product data stay in the GitHub catalog files; rows here refer to them by key / product ID.

CREATE TABLE IF NOT EXISTS size_templates (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 40 AND id NOT GLOB '*[^a-z0-9-]*'),
  name_bn TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

-- `key` never changes once used: orders and stock refer to it. Labels are display text only.
CREATE TABLE IF NOT EXISTS size_fields (
  template_id TEXT NOT NULL REFERENCES size_templates(id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (length(key) BETWEEN 1 AND 40 AND key NOT GLOB '*[^a-z0-9_]*'),
  label_bn TEXT NOT NULL DEFAULT '',
  label_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  required INTEGER NOT NULL DEFAULT 1 CHECK (required IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  allow_custom INTEGER NOT NULL DEFAULT 0 CHECK (allow_custom IN (0, 1)),
  default_value TEXT NOT NULL DEFAULT '',
  legacy_slots TEXT NOT NULL DEFAULT '[]', -- JSON list: which old size list an existing product uses for this field
  PRIMARY KEY (template_id, key)
);

CREATE TABLE IF NOT EXISTS size_options (
  template_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  value TEXT NOT NULL CHECK (length(value) BETWEEN 1 AND 40),
  label_bn TEXT NOT NULL DEFAULT '',
  label_en TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (template_id, field_key, value),
  FOREIGN KEY (template_id, field_key) REFERENCES size_fields(template_id, key) ON DELETE CASCADE
);

-- Only the 8 Size Manager categories (Kaftan and Karchupi are left out on purpose).
CREATE TABLE IF NOT EXISTS size_category_settings (
  category_key TEXT PRIMARY KEY CHECK (category_key IN
    ('abaya', 'cover-up', 'premium-two-piece', 'tops-kurti', 'embroidery', 'hijab', 'panjabi', 'three-piece-dress')),
  template_id TEXT NOT NULL REFERENCES size_templates(id),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS size_product_overrides (
  product_id TEXT PRIMARY KEY CHECK (length(product_id) BETWEEN 2 AND 101),
  template_id TEXT REFERENCES size_templates(id),
  enabled INTEGER CHECK (enabled IS NULL OR enabled IN (0, 1)),
  use_template INTEGER NOT NULL DEFAULT 0 CHECK (use_template IN (0, 1)), -- 1 = ignore the product's old size lists
  fields_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

-- Every Publish stores the whole configuration. The website and the order check read only the active one.
CREATE TABLE IF NOT EXISTS size_config_versions (
  version INTEGER PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  published_at INTEGER NOT NULL,
  published_by TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS size_config_versions_one_active ON size_config_versions(active) WHERE active = 1;

CREATE TABLE IF NOT EXISTS size_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT
);
