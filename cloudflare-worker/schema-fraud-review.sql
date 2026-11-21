-- Fraud Review Queue — additive schema for D1 database ma-orders.
-- Safe to apply repeatedly. Does not alter or delete existing order tables.
-- All timestamps use Unix milliseconds, matching order_inbox and Worker timestamps.

CREATE TABLE IF NOT EXISTS fraud_reviews (
  review_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  order_id TEXT,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('review', 'high')),
  risk_action TEXT NOT NULL CHECK (risk_action IN ('challenge', 'manual_review')),
  reasons_json TEXT NOT NULL,
  signals_json TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'cleared', 'rejected', 'hold')),
  reviewer_id TEXT,
  reviewer_role TEXT,
  decision_at INTEGER,
  decision_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fraud_reviews_status_created
  ON fraud_reviews (review_status, created_at DESC, review_id DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_reviews_order_id
  ON fraud_reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_fraud_reviews_updated
  ON fraud_reviews (updated_at DESC);

CREATE TABLE IF NOT EXISTS fraud_review_events (
  event_record_id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'cleared', 'rejected', 'hold', 'reopened')),
  previous_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN ('pending', 'cleared', 'rejected', 'hold')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (review_id) REFERENCES fraud_reviews(review_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_fraud_review_events_review_created
  ON fraud_review_events (review_id, created_at DESC, event_record_id DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_review_events_actor_created
  ON fraud_review_events (actor_id, created_at DESC);
