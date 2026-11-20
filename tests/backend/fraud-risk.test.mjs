import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreFraudRisk } from '../../cloudflare-worker/fraud-risk.js';

test('preserves existing repeat-phone risk thresholds', () => {
  assert.equal(scoreFraudRisk({ samePhoneAttempts10m: 2 }).score, 25);
  assert.equal(scoreFraudRisk({ samePhoneAttempts10m: 3 }).score, 35);
  assert.equal(scoreFraudRisk({ samePhoneAttempts10m: 5 }).score, 50);
  assert.equal(scoreFraudRisk({ samePhoneAttempts10m: 3 }).action, 'challenge');
});

test('shared IP alone is not risky without multiple distinct phones', () => {
  assert.equal(scoreFraudRisk({ ipAttempts30m: 8, distinctPhones30m: 1 }).level, 'low');
});

test('adds repeat-device and network signals with explainable reasons', () => {
  const result = scoreFraudRisk({
    sameDeviceAttempts24h: 3,
    vpnOrProxy: true,
    hostingNetwork: true
  });
  assert.equal(result.score, 55);
  assert.equal(result.level, 'review');
  assert.equal(result.action, 'challenge');
  assert.equal(result.reasons.length, 3);
});

test('caps score and supports explicit thresholds', () => {
  const result = scoreFraudRisk({
    samePhoneAttempts10m: 5,
    sameDeviceAttempts24h: 5,
    vpnOrProxy: true,
    hostingNetwork: true
  }, { reviewAt: 20, highAt: 50 });
  assert.equal(result.score, 100);
  assert.equal(result.action, 'manual_review');
});

test('does not reject or hard-block on score alone', () => {
  const result = scoreFraudRisk({ samePhoneAttempts10m: 5, sameDeviceAttempts24h: 5 });
  assert.notEqual(result.action, 'block');
});
