-- Rollback for migrations/d1/0005_tracking_erp.sql.
-- Run only if the Tracking ERP migration has been applied and all tracking records may be discarded.
DROP TABLE IF EXISTS tracking_event_queue;
DROP TABLE IF EXISTS tracking_event_log;
DROP TABLE IF EXISTS tracking_event_dedup;
DROP TABLE IF EXISTS tracking_domains;
DROP TABLE IF EXISTS tracking_profiles;
