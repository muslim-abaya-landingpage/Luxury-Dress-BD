-- Removes only the Size Manager tables added by 0001_size_manager.sql. Orders stay in Google Sheets and the
-- website falls back to the old size pickers when /api/size-config has no data.
DROP TABLE IF EXISTS size_audit_log;
DROP INDEX IF EXISTS size_config_versions_one_active;
DROP TABLE IF EXISTS size_config_versions;
DROP TABLE IF EXISTS size_product_overrides;
DROP TABLE IF EXISTS size_category_settings;
DROP TABLE IF EXISTS size_options;
DROP TABLE IF EXISTS size_fields;
DROP TABLE IF EXISTS size_templates;
