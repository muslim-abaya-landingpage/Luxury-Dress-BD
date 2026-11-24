-- Tracking Management ERP foundation.
-- IMPORTANT: This migration is intentionally staged in Git only. Do not apply to production
-- until the Worker API, admin UI, preview D1 binding, and rollback procedure are verified.

CREATE TABLE IF NOT EXISTS tracking_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  meta_pixel_id TEXT,
  tiktok_pixel_id TEXT,
  meta_token_ciphertext TEXT,
  tiktok_token_ciphertext TEXT,
  token_key_version INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_by TEXT,
  updated_by TEXT,
  CHECK (json_valid(config_json))
);

CREATE TABLE IF NOT EXISTS tracking_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES tracking_profiles(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tracking_domains_profile
  ON tracking_domains(profile_id, enabled);

CREATE TABLE IF NOT EXISTS tracking_event_dedup (
  dedup_key TEXT PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES tracking_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'tiktok', 'ga4')),
  event_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(profile_id, provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_event_dedup_expiry
  ON tracking_event_dedup(expires_at);

CREATE TABLE IF NOT EXISTS tracking_event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES tracking_profiles(id) ON DELETE SET NULL,
  hostname TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'tiktok', 'ga4')),
  event_name TEXT NOT NULL,
  event_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'sent', 'failed', 'skipped', 'duplicate')),
  http_status INTEGER,
  error_code TEXT,
  provider_trace_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (json_valid(details_json))
);

CREATE INDEX IF NOT EXISTS idx_tracking_event_log_created
  ON tracking_event_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_event_log_profile_created
  ON tracking_event_log(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tracking_event_log_status_created
  ON tracking_event_log(status, created_at DESC);

-- Retry payloads must be encrypted by the Worker before insertion.
-- Never put raw customer PII or provider access tokens in plaintext here.
CREATE TABLE IF NOT EXISTS tracking_event_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES tracking_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'tiktok', 'ga4')),
  event_id TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  encryption_key_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_error_code TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(profile_id, provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_event_queue_due
  ON tracking_event_queue(status, next_attempt_at);
