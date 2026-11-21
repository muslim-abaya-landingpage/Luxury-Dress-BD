/**
 * Persist a review only after the corresponding order has been saved successfully.
 * Stores allowlisted, non-PII risk signals only; never copies order payload, IP, phone,
 * email, user-agent or device fingerprint into the review tables.
 */
const SIGNAL_KEYS = [
  'samePhoneAttempts10m',
  'ipAttempts30m',
  'distinctPhones30m',
  'sameDeviceAttempts24h',
  'vpnOrProxy',
  'hostingNetwork'
];

function safeReasons(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, 12)
    .map((item) => String(item || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180))
    .filter(Boolean);
}

function safeSignals(risk) {
  const out = {};
  for (const key of SIGNAL_KEYS) {
    const value = risk && risk[key];
    if (typeof value === 'boolean') out[key] = value;
    else if (Number.isFinite(Number(value))) out[key] = Math.max(0, Math.min(100000, Number(value)));
  }
  return out;
}

export async function persistFraudReview(db, input = {}) {
  const risk = input.risk || {};
  if (!db || !input.eventId || !risk || !['review', 'high'].includes(risk.level)) return null;
  const score = Number(risk.score);
  const action = risk.action;
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error('INVALID_RISK_SCORE');
  if (!['challenge', 'manual_review'].includes(action)) throw new Error('INVALID_RISK_ACTION');

  const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  const proposedId = 'fr_' + crypto.randomUUID();
  const reasons = JSON.stringify(safeReasons(risk.reasons));
  const signals = JSON.stringify(safeSignals(risk));

  await db.prepare(
    'INSERT OR IGNORE INTO fraud_reviews ' +
    '(review_id, event_id, order_id, risk_score, risk_level, risk_action, reasons_json, signals_json, review_status, version, created_at, updated_at) ' +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1, ?, ?)"
  ).bind(
    proposedId,
    String(input.eventId).slice(0, 160),
    String(input.orderId || '').slice(0, 80) || null,
    score,
    risk.level,
    action,
    reasons,
    signals,
    now,
    now
  ).run();

  // Read the canonical row after INSERT OR IGNORE. This makes retries idempotent even if
  // another request won the unique event_id race with a different proposed UUID.
  const review = await db.prepare(
    'SELECT review_id, review_status FROM fraud_reviews WHERE event_id = ?'
  ).bind(String(input.eventId).slice(0, 160)).first();
  if (!review) throw new Error('FRAUD_REVIEW_NOT_PERSISTED');

  await db.prepare(
    'INSERT OR IGNORE INTO fraud_review_events ' +
    '(event_record_id, review_id, action, previous_status, new_status, actor_id, actor_role, reason, created_at) ' +
    "VALUES (?, ?, 'created', NULL, ?, 'system:worker', 'system', NULL, ?)"
  ).bind('created:' + review.review_id, review.review_id, review.review_status || 'pending', now).run();

  return { reviewId: review.review_id, status: review.review_status || 'pending' };
}
