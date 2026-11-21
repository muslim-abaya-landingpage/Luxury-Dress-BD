import test from 'node:test';
import assert from 'node:assert/strict';
import { persistFraudReview } from '../../cloudflare-worker/fraud-review.js';

function fakeDb() {
  const state = { reviews: new Map(), events: new Map(), inserts: 0 };
  return {
    state,
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async run() {
          if (sql.includes('INSERT OR IGNORE INTO fraud_reviews')) {
            state.inserts++;
            const [reviewId, eventId, orderId, score, level, action, reasons, signals, createdAt, updatedAt] = values;
            if (!state.reviews.has(eventId)) state.reviews.set(eventId, {
              review_id: reviewId, event_id: eventId, order_id: orderId, risk_score: score,
              risk_level: level, risk_action: action, reasons_json: reasons, signals_json: signals,
              review_status: 'pending', created_at: createdAt, updated_at: updatedAt
            });
          } else if (sql.includes('INSERT OR IGNORE INTO fraud_review_events')) {
            const [eventId, reviewId, status, createdAt] = values;
            state.events.set(eventId, { review_id: reviewId, new_status: status, created_at: createdAt });
          }
          return { success: true };
        },
        async first() {
          const row = state.reviews.get(values[0]);
          return row ? { review_id: row.review_id, review_status: row.review_status } : null;
        }
      };
    }
  };
}

test('creates one pending review and one creation event for a saved risky order', async () => {
  const db = fakeDb();
  const result = await persistFraudReview(db, {
    eventId: 'event-001',
    orderId: 'ORD-001',
    now: 1700000000000,
    risk: { score: 55, level: 'review', action: 'challenge', reasons: ['repeat attempts'], samePhoneAttempts10m: 2 }
  });
  assert.equal(result.status, 'pending');
  assert.equal(db.state.reviews.size, 1);
  assert.equal(db.state.events.size, 1);
});

test('is idempotent for retries with the same event ID', async () => {
  const db = fakeDb();
  const input = { eventId: 'event-002', orderId: 'ORD-002', risk: { score: 65, level: 'high', action: 'manual_review', reasons: ['risk'] } };
  const first = await persistFraudReview(db, input);
  const second = await persistFraudReview(db, input);
  assert.equal(first.reviewId, second.reviewId);
  assert.equal(db.state.reviews.size, 1);
  assert.equal(db.state.events.size, 1);
});

test('does not queue low-risk orders', async () => {
  const db = fakeDb();
  assert.equal(await persistFraudReview(db, { eventId: 'event-003', risk: { score: 0, level: 'low', action: 'allow' } }), null);
  assert.equal(db.state.reviews.size, 0);
});

test('stores only allowlisted non-PII signals and bounded reasons', async () => {
  const db = fakeDb();
  await persistFraudReview(db, {
    eventId: 'event-004',
    risk: {
      score: 30, level: 'review', action: 'challenge',
      reasons: ['safe reason'],
      sameDeviceAttempts24h: 3,
      phone: '01700000000',
      ip: '192.0.2.1',
      userAgent: 'private browser data',
      email: 'private@example.com'
    }
  });
  const row = db.state.reviews.get('event-004');
  const serialized = JSON.stringify(row);
  assert.equal(serialized.includes('01700000000'), false);
  assert.equal(serialized.includes('192.0.2.1'), false);
  assert.equal(serialized.includes('private@example.com'), false);
  assert.equal(serialized.includes('private browser data'), false);
  assert.deepEqual(JSON.parse(row.signals_json), { sameDeviceAttempts24h: 3 });
});

test('rejects malformed risk score and action', async () => {
  const db = fakeDb();
  await assert.rejects(() => persistFraudReview(db, { eventId: 'bad-score', risk: { score: 101, level: 'high', action: 'manual_review' } }), /INVALID_RISK_SCORE/);
  await assert.rejects(() => persistFraudReview(db, { eventId: 'bad-action', risk: { score: 80, level: 'high', action: 'block' } }), /INVALID_RISK_ACTION/);
});
