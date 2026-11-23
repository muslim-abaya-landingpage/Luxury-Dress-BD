import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeOrderSettings } from '../../cloudflare-worker/worker.js';

test('order settings apply safe defaults and preserve explicit switches', () => {
  assert.deepEqual(sanitizeOrderSettings({}), {
    mobileVerification: true, confirmationSms: false, locationFields: true,
    vpnProtection: true, duplicateBlock: true, duplicateWindowMinutes: 10,
    courierProtection: true, courierSuccessRatio: 50
  });
  const settings = sanitizeOrderSettings({
    mobileVerification: false, confirmationSms: true, locationFields: false,
    vpnProtection: false, duplicateBlock: false, duplicateWindowMinutes: 45,
    courierProtection: false, courierSuccessRatio: 72
  });
  assert.equal(settings.mobileVerification, false);
  assert.equal(settings.confirmationSms, true);
  assert.equal(settings.locationFields, false);
  assert.equal(settings.vpnProtection, false);
  assert.equal(settings.duplicateBlock, false);
  assert.equal(settings.duplicateWindowMinutes, 45);
  assert.equal(settings.courierProtection, false);
  assert.equal(settings.courierSuccessRatio, 72);
});

test('order settings reject unsafe time and success ratio values', () => {
  assert.equal(sanitizeOrderSettings({ duplicateWindowMinutes: 0 }), null);
  assert.equal(sanitizeOrderSettings({ duplicateWindowMinutes: 1441 }), null);
  assert.equal(sanitizeOrderSettings({ duplicateWindowMinutes: 1.5 }), null);
  assert.equal(sanitizeOrderSettings({ courierSuccessRatio: -1 }), null);
  assert.equal(sanitizeOrderSettings({ courierSuccessRatio: 101 }), null);
  assert.equal(sanitizeOrderSettings({ courierSuccessRatio: 50.5 }), null);
});
