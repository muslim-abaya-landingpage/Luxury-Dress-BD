-- Order Approval Workflow — additive D1 migration for ma-orders.
-- This migration creates approval metadata only. It does not alter order_inbox,
-- operational order status, stock, courier, payment, or CAPI records.
-- Timestamps use Unix milliseconds, matching the existing Worker/D1 tables.

CREATE TABLE IF NOT EXISTS order_approvals (
  approval_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'hold')),
  assigned_to TEXT,
  approved_by TEXT,
  reviewer_role TEXT,
  decision_reason TEXT,
  reviewed_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_approvals_status_created
  ON order_approvals (approval_status, created_at DESC, approval_id DESC);
CREATE INDEX IF NOT EXISTS idx_order_approvals_assigned_status
  ON order_approvals (assigned_to, approval_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS order_approval_events (
  event_id TEXT PRIMARY KEY,
  approval_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'assigned', 'approved', 'rejected', 'hold', 'reopened')),
  previous_status TEXT,
  new_status TEXT NOT NULL CHECK (new_status IN ('pending', 'approved', 'rejected', 'hold')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'staff', 'manager')),
  assigned_to TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (approval_id) REFERENCES order_approvals(approval_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_order_approval_events_approval_created
  ON order_approval_events (approval_id, created_at DESC, event_id DESC);
CREATE INDEX IF NOT EXISTS idx_order_approval_events_actor_created
  ON order_approval_events (actor_id, created_at DESC);
