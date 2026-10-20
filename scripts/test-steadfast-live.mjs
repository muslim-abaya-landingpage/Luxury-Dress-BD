#!/usr/bin/env node
/**
 * Safe live test for AdminCourierTracking.
 *
 * Default: read-only tracking read (Refresh=0).
 * Mutating/provider-refresh mode requires BOTH --sync and CONFIRM_SYNC=YES.
 * Never print ADMIN_TOKEN, API keys, customer data, or raw provider responses.
 *
 * Usage:
 *   ADMIN_TOKEN='your-existing-admin-session-token' \
 *     node scripts/test-steadfast-live.mjs --order=141
 *
 * Explicit provider refresh / sync test:
 *   CONFIRM_SYNC=YES ADMIN_TOKEN='...' \
 *     node scripts/test-steadfast-live.mjs --order=141 --sync
 */
import { readFile } from 'node:fs/promises';

const args = new Set(process.argv.slice(2));
const orderArg = process.argv.find((value) => value.startsWith('--order='));
const orderId = orderArg ? orderArg.slice('--order='.length).trim() : '';
const isSync = args.has('--sync');
const token = String(process.env.ADMIN_TOKEN || '').trim();
const timeoutMs = Math.min(60000, Math.max(5000, Number(process.env.TIMEOUT_MS || 30000)));

function fail(message, code = 2) {
  console.error(`FAIL: ${message}`);
  process.exitCode = code;
}

function usage() {
  console.log('Usage: ADMIN_TOKEN=… node scripts/test-steadfast-live.mjs --order=141 [--sync]');
  console.log('Default is read-only. Add --sync only with CONFIRM_SYNC=YES.');
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}
if (!orderId) fail('Missing --order=<order-id>.');
if (!token) fail('Missing ADMIN_TOKEN. Use an existing admin session token; do not paste it into source control.');
if (isSync && process.env.CONFIRM_SYNC !== 'YES') {
  fail('Sync mode is blocked. Set CONFIRM_SYNC=YES together with --sync.');
}
if (process.exitCode) process.exit(process.exitCode);

const configSource = await readFile(new URL('../site-api-config.js', import.meta.url), 'utf8');
const apiUrl = process.env.API_URL || (configSource.match(/url:\s*["']([^"']+)["']/) || [])[1];
if (!apiUrl || !/^https:\/\//i.test(apiUrl)) fail('Could not resolve a secure HTTPS API_URL.');
if (process.exitCode) process.exit(process.exitCode);

const body = new URLSearchParams({
  RecordType: 'AdminCourierTracking',
  Token: token,
  OrderId: orderId,
  Refresh: isSync ? '1' : '0'
});

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
let response;
try {
  response = await fetch(apiUrl, { method: 'POST', body, signal: controller.signal });
} catch (error) {
  fail(error?.name === 'AbortError' ? 'Request timed out.' : 'Network request failed.');
  process.exit(process.exitCode || 2);
} finally {
  clearTimeout(timer);
}

const raw = await response.text();
let result;
try {
  result = JSON.parse(raw);
} catch {
  fail(`API returned a non-JSON response (HTTP ${response.status}).`);
  process.exit(process.exitCode || 2);
}

if (!response.ok || !result || result.ok === false) {
  const safeCode = String(result?.error || `HTTP_${response.status}`).replace(/[^A-Z0-9_\-]/gi, '').slice(0, 80);
  fail(`Courier endpoint rejected the request: ${safeCode || 'REQUEST_FAILED'}`);
  process.exit(process.exitCode || 2);
}

if (result.version !== 1) {
  fail('Courier endpoint responded, but the tracking contract version is not 1.');
  process.exit(process.exitCode || 2);
}

console.log(JSON.stringify({
  ok: true,
  mode: isSync ? 'provider-refresh-and-sync' : 'read-only-tracking-read',
  httpStatus: response.status,
  contractVersion: result.version,
  hasCourierStatus: Boolean(result.courierStatus),
  eventCount: Array.isArray(result.events) ? result.events.length : 0,
  hasFetchedAt: Boolean(result.fetchedAt),
  hasTrackingReference: Boolean(result.tracking || result.consignmentId)
}, null, 2));
