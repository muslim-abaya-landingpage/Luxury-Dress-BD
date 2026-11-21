/**
 * Email helpers shared by the order Worker (cloudflare-worker/worker.js keeps an identical copy
 * between the "email-guard:begin/end" markers; tests/backend/order-email-guard.test.mjs fails if
 * the two drift apart) and the admin API (functions/api/admin-email.js).
 *
 * D1 table (database ma-orders, see cloudflare-worker/schema-email.sql):
 *   blocked_emails   blocked email addresses (admin order page → block by email)
 */
// email-guard:begin
/** Normalised email (trimmed, lowercased), or '' when it doesn't look like an email. */
function normalizeEmail(v) {
  const s = String(v || '').trim().toLowerCase();
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}
// email-guard:end

export { normalizeEmail };
