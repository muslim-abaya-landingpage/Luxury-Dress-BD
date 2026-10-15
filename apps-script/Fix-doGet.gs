/**
 * Compatibility note: this file intentionally defines no doGet().
 * A former fallback implementation here shadowed Code.gs and returned the
 * generic health text for StockStatus, OrderSchema, auth and other GET APIs.
 * The canonical GET router is the single doGet() in Code.gs.
 */
