const PROFILE_KEY_RE = /^[a-z0-9][a-z0-9_-]{1,47}$/;
const PIXEL_ID_RE = /^\d{6,40}$/;
const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function cleanText(value, max = 120) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey(env, usages = ['encrypt']) {
  const encoded = String(env.TRACKING_ENCRYPTION_KEY || '').trim();
  if (!encoded) throw new Error('TRACKING_ENCRYPTION_KEY_MISSING');
  let raw;
  try { raw = base64ToBytes(encoded); } catch (error) { throw new Error('TRACKING_ENCRYPTION_KEY_INVALID'); }
  if (raw.length !== 32) throw new Error('TRACKING_ENCRYPTION_KEY_INVALID');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, usages);
}

async function encryptToken(value, env) {
  const key = await encryptionKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(value);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return 'v1.' + bytesToBase64(iv) + '.' + bytesToBase64(new Uint8Array(encrypted));
}

function validateConfig(value) {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const allowedMatching = ['em', 'ph', 'fn', 'ln', 'external_id'];
  const matching = Array.isArray(config.advancedMatching) ? config.advancedMatching : [];
  const events = config.events && typeof config.events === 'object' && !Array.isArray(config.events) ? config.events : {};
  const eventNames = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Lead'];
  const cleanEvents = {};
  for (const name of eventNames) {
    const item = events[name];
    cleanEvents[name] = item !== false;
  }
  return {
    advancedMatching: [...new Set(matching.filter((key) => allowedMatching.includes(key)))],
    events: cleanEvents,
    currency: cleanText(config.currency || 'BDT', 3).toUpperCase() || 'BDT'
  };
}

async function readProfiles(env) {
  const rows = await env.DB.prepare(
    'SELECT id, profile_key, name, meta_pixel_id, tiktok_pixel_id, enabled, config_json, ' +
    'meta_token_ciphertext, tiktok_token_ciphertext, created_at, updated_at ' +
    'FROM tracking_profiles ORDER BY id ASC'
  ).all();
  const domains = await env.DB.prepare(
    'SELECT id, profile_id, hostname, enabled FROM tracking_domains ORDER BY hostname ASC'
  ).all();
  const byProfile = new Map();
  for (const row of (domains.results || [])) {
    if (!byProfile.has(row.profile_id)) byProfile.set(row.profile_id, []);
    byProfile.get(row.profile_id).push({ id: row.id, hostname: row.hostname, enabled: !!row.enabled });
  }
  return (rows.results || []).map((row) => {
    let config = {};
    try { config = JSON.parse(row.config_json || '{}'); } catch (error) {}
    return {
      id: row.id, key: row.profile_key, name: row.name,
      metaPixelId: row.meta_pixel_id || '', tiktokPixelId: row.tiktok_pixel_id || '',
      metaTokenConfigured: !!row.meta_token_ciphertext,
      tiktokTokenConfigured: !!row.tiktok_token_ciphertext,
      enabled: !!row.enabled, config: validateConfig(config),
      domains: byProfile.get(row.id) || [],
      createdAt: row.created_at, updatedAt: row.updated_at
    };
  });
}

async function saveProfile(request, env, admin) {
  let body;
  try { body = await request.json(); } catch (error) { return json({ ok: false, error: 'BAD_JSON' }, 400); }
  const key = cleanText(body.key, 48).toLowerCase();
  const name = cleanText(body.name, 100);
  const metaId = cleanText(body.metaPixelId, 40);
  const tiktokId = cleanText(body.tiktokPixelId, 40);
  if (!PROFILE_KEY_RE.test(key) || !name) return json({ ok: false, error: 'INVALID_PROFILE' }, 400);
  if (metaId && !PIXEL_ID_RE.test(metaId)) return json({ ok: false, error: 'INVALID_META_PIXEL_ID' }, 400);
  if (tiktokId && !PIXEL_ID_RE.test(tiktokId)) return json({ ok: false, error: 'INVALID_TIKTOK_PIXEL_ID' }, 400);
  const config = validateConfig(body.config);
  const now = Math.floor(Date.now() / 1000);
  const who = cleanText(admin.email || admin.name || 'admin', 160);
  let metaCipher = null;
  let tiktokCipher = null;
  try {
    for (const raw of [body.metaAccessToken, body.tiktokAccessToken]) {
      if (raw != null && raw !== '' && (typeof raw !== 'string' || raw.length > 5000 || !raw.trim())) {
        return json({ ok: false, error: 'INVALID_ACCESS_TOKEN' }, 400);
      }
    }
    if (typeof body.metaAccessToken === 'string' && body.metaAccessToken.trim()) metaCipher = await encryptToken(body.metaAccessToken.trim(), env);
    if (typeof body.tiktokAccessToken === 'string' && body.tiktokAccessToken.trim()) tiktokCipher = await encryptToken(body.tiktokAccessToken.trim(), env);
  } catch (error) {
    const code = String(error && error.message || '');
    return json({ ok: false, error: code === 'TRACKING_ENCRYPTION_KEY_MISSING' ? code : 'TRACKING_ENCRYPTION_UNAVAILABLE' }, 503);
  }
  try {
    const existing = await env.DB.prepare('SELECT id, enabled FROM tracking_profiles WHERE profile_key = ?').bind(key).first();
    if (existing) {
      await env.DB.prepare(
        'UPDATE tracking_profiles SET name = ?, meta_pixel_id = ?, tiktok_pixel_id = ?, ' +
        'meta_token_ciphertext = CASE WHEN ? = 1 THEN NULL WHEN ? IS NOT NULL THEN ? ELSE meta_token_ciphertext END, ' +
        'tiktok_token_ciphertext = CASE WHEN ? = 1 THEN NULL WHEN ? IS NOT NULL THEN ? ELSE tiktok_token_ciphertext END, ' +
        'enabled = ?, config_json = ?, updated_at = ?, updated_by = ? WHERE id = ?'
      ).bind(name, metaId || null, tiktokId || null,
        body.clearMetaToken === true ? 1 : 0, metaCipher, metaCipher,
        body.clearTiktokToken === true ? 1 : 0, tiktokCipher, tiktokCipher,
        body.enabled === false ? 0 : (body.enabled === true ? 1 : (Number(existing.enabled) === 0 ? 0 : 1)), JSON.stringify(config), now, who, existing.id).run();
      return json({ ok: true, id: existing.id, updated: true });
    }
    const result = await env.DB.prepare(
      'INSERT INTO tracking_profiles (profile_key, name, meta_pixel_id, tiktok_pixel_id, meta_token_ciphertext, ' +
      'tiktok_token_ciphertext, enabled, config_json, created_at, updated_at, created_by, updated_by) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(key, name, metaId || null, tiktokId || null, metaCipher, tiktokCipher,
      body.enabled === false ? 0 : 1, JSON.stringify(config), now, now, who, who).run();
    return json({ ok: true, id: result.meta && result.meta.last_row_id, created: true }, 201);
  } catch (error) {
    const message = String(error && error.message || '');
    return json({ ok: false, error: message.includes('UNIQUE') ? 'PROFILE_KEY_EXISTS' : 'SAVE_FAILED' }, 503);
  }
}

async function addDomain(request, env) {
  let body;
  try { body = await request.json(); } catch (error) { return json({ ok: false, error: 'BAD_JSON' }, 400); }
  const hostname = cleanText(body.hostname, 253).toLowerCase().replace(/\.$/, '');
  const profileId = Number(body.profileId);
  if (!Number.isSafeInteger(profileId) || profileId < 1 || !HOST_RE.test(hostname)) {
    return json({ ok: false, error: 'INVALID_DOMAIN_MAPPING' }, 400);
  }
  try {
    const profile = await env.DB.prepare('SELECT id FROM tracking_profiles WHERE id = ? AND enabled = 1').bind(profileId).first();
    if (!profile) return json({ ok: false, error: 'PROFILE_NOT_FOUND' }, 404);
    const result = await env.DB.prepare(
      'INSERT INTO tracking_domains (profile_id, hostname, enabled) VALUES (?, ?, 1)'
    ).bind(profileId, hostname).run();
    return json({ ok: true, id: result.meta && result.meta.last_row_id }, 201);
  } catch (error) {
    const message = String(error && error.message || '');
    return json({ ok: false, error: message.includes('UNIQUE') ? 'DOMAIN_ALREADY_ASSIGNED' : 'DOMAIN_SAVE_FAILED' }, 503);
  }
}


export async function encryptTrackingPayload(payload, env) {
  const serialized = JSON.stringify(payload);
  if (typeof serialized !== 'string' || serialized.length > 180000) throw new Error('TRACKING_RETRY_PAYLOAD_INVALID');
  return encryptToken(serialized, env);
}

export async function decryptTrackingPayload(ciphertext, env) {
  const serialized = await decryptTrackingToken(ciphertext, env);
  const payload = JSON.parse(serialized);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('TRACKING_RETRY_PAYLOAD_INVALID');
  return payload;
}

export async function enqueueTrackingRetry(env, record) {
  if (!env.DB || !record || !Number.isSafeInteger(record.profileId) ||
      !['meta', 'tiktok'].includes(record.provider) ||
      !/^[A-Za-z0-9_.:-]{1,120}$/.test(String(record.eventId || ''))) {
    throw new Error('TRACKING_RETRY_RECORD_INVALID');
  }
  const encrypted = await encryptTrackingPayload(record.payload, env);
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO tracking_event_queue (profile_id, provider, event_id, encrypted_payload, status, attempt_count, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)"
  ).bind(record.profileId, record.provider, String(record.eventId), encrypted, now + 60, now, now).run();
  return Number(result.meta && result.meta.changes || 0) > 0;
}

export async function decryptTrackingToken(ciphertext, env) {
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  const parts = ciphertext.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('TRACKING_TOKEN_FORMAT_INVALID');
  const key = await encryptionKey(env, ['decrypt']);
  const iv = base64ToBytes(parts[1]);
  if (iv.length !== 12) throw new Error('TRACKING_TOKEN_FORMAT_INVALID');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(parts[2]));
  return new TextDecoder().decode(plain);
}

export async function resolveTrackingProfile(hostname, env) {
  if (!env.DB) return null;
  const host = cleanText(hostname, 253).toLowerCase().replace(/\.$/, '');
  if (!HOST_RE.test(host)) return null;
  try {
    const row = await env.DB.prepare(
      'SELECT p.id, p.profile_key, p.name, p.meta_pixel_id, p.tiktok_pixel_id, ' +
      'p.meta_token_ciphertext, p.tiktok_token_ciphertext, p.enabled, p.config_json ' +
      'FROM tracking_domains d JOIN tracking_profiles p ON p.id = d.profile_id ' +
      'WHERE d.hostname = ? AND d.enabled = 1 AND p.enabled = 1 LIMIT 1'
    ).bind(host).first();
    if (!row) return null;
    let config = {};
    try { config = JSON.parse(row.config_json || '{}'); } catch (error) {}
    return {
      id: row.id, key: row.profile_key, name: row.name,
      metaPixelId: row.meta_pixel_id || '', tiktokPixelId: row.tiktok_pixel_id || '',
      metaTokenCiphertext: row.meta_token_ciphertext || '',
      tiktokTokenCiphertext: row.tiktok_token_ciphertext || '',
      config: validateConfig(config)
    };
  } catch (error) {
    return null;
  }
}

export async function claimTrackingEvent(env, profileId, provider, eventId) {
  const dedupKey = String(profileId) + ':' + provider + ':' + String(eventId);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'DELETE FROM tracking_event_dedup WHERE profile_id = ? AND provider = ? AND event_id = ? AND expires_at <= ?'
  ).bind(profileId, provider, eventId, now).run();
  const result = await env.DB.prepare(
    'INSERT OR IGNORE INTO tracking_event_dedup (dedup_key, profile_id, provider, event_id, expires_at, created_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(dedupKey, profileId, provider, eventId, now + 48 * 60 * 60, now).run();
  return Number(result.meta && result.meta.changes || 0) > 0;
}

export async function releaseTrackingEvent(env, profileId, provider, eventId) {
  if (!env.DB || !profileId || !provider || !eventId) return;
  try {
    const key = String(profileId) + ':' + provider + ':' + String(eventId);
    await env.DB.prepare('DELETE FROM tracking_event_dedup WHERE dedup_key = ?').bind(key).run();
  } catch (error) {}
}

export async function logTrackingEvent(env, record) {
  if (!env.DB || !record || !['meta', 'tiktok', 'ga4'].includes(record.provider)) return;
  const safe = {
    profileId: Number.isSafeInteger(record.profileId) ? record.profileId : null,
    hostname: cleanText(record.hostname, 253) || null,
    provider: record.provider,
    eventName: cleanText(record.eventName, 80) || 'Unknown',
    eventId: cleanText(record.eventId, 120) || null,
    status: ['accepted', 'sent', 'failed', 'skipped', 'duplicate'].includes(record.status) ? record.status : 'failed',
    httpStatus: Number.isInteger(record.httpStatus) ? record.httpStatus : null,
    errorCode: cleanText(record.errorCode, 80) || null,
    traceId: cleanText(record.traceId, 120) || null
  };
  try {
    await env.DB.prepare(
      'INSERT INTO tracking_event_log (profile_id, hostname, provider, event_name, event_id, status, http_status, error_code, provider_trace_id, details_json, created_at) ' +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)"
    ).bind(safe.profileId, safe.hostname, safe.provider, safe.eventName, safe.eventId, safe.status,
      safe.httpStatus, safe.errorCode, safe.traceId, Math.floor(Date.now() / 1000)).run();
  } catch (error) {}
}

export async function handleTrackingAdmin(request, env, url, verifyAdminToken) {
  if (!env.DB) return json({ ok: false, error: 'TRACKING_DB_UNAVAILABLE' }, 503);
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  }
  let body = {};
  if (request.method === 'POST') {
    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > 16384) return json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413);
    try {
      const raw = await request.clone().text();
      if (raw.length > 16384) return json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, 413);
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'BAD_JSON' }, 400);
    } catch (error) { return json({ ok: false, error: 'BAD_JSON' }, 400); }
  }
  const token = body.token || '';
  const admin = await verifyAdminToken(env, token);
  if (!admin || admin.ok === false) {
    return json({ ok: false, error: (admin && admin.error) || 'INVALID_TOKEN' }, (admin && admin.status) || 401);
  }

  if (request.method === 'POST' && cleanText(body.action, 40) === 'list') {
    try {
      const profiles = await readProfiles(env);
      const summary = await env.DB.prepare(
        'SELECT provider, status, COUNT(*) AS total FROM tracking_event_log ' +
        'WHERE created_at >= ? GROUP BY provider, status'
      ).bind(Math.floor(Date.now() / 1000) - 86400).all();
      return json({ ok: true, profiles, summary: summary.results || [] });
    } catch (error) {
      return json({ ok: false, error: 'TRACKING_SCHEMA_NOT_READY' }, 503);
    }
  }

  const action = cleanText(body.action, 40);
  if (action === 'profile.save' && request.method === 'POST') return saveProfile(request, env, admin);
  if (action === 'domain.add' && request.method === 'POST') return addDomain(request, env);
  if (action === 'domain.remove' && request.method === 'POST') {
    const id = Number(body.domainId);
    if (!Number.isSafeInteger(id) || id < 1) return json({ ok: false, error: 'INVALID_DOMAIN_ID' }, 400);
    await env.DB.prepare('DELETE FROM tracking_domains WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }
  if (action === 'profile.toggle' && request.method === 'POST') {
    const id = Number(body.profileId);
    if (!Number.isSafeInteger(id) || id < 1 || typeof body.enabled !== 'boolean') return json({ ok: false, error: 'INVALID_PROFILE_STATE' }, 400);
    await env.DB.prepare('UPDATE tracking_profiles SET enabled = ?, updated_at = ?, updated_by = ? WHERE id = ?')
      .bind(body.enabled ? 1 : 0, Math.floor(Date.now() / 1000), cleanText(admin.email || admin.name || 'admin', 160), id).run();
    return json({ ok: true });
  }
  if (action === 'stats' && request.method === 'POST') {
    try {
      const queue = await env.DB.prepare(
        "SELECT status, COUNT(*) AS total FROM tracking_event_queue GROUP BY status"
      ).all();
      const events = await env.DB.prepare(
        "SELECT status, COUNT(*) AS total FROM tracking_event_log WHERE created_at >= ? GROUP BY status"
      ).bind(Math.floor(Date.now() / 1000) - 86400).all();
      const providers = await env.DB.prepare(
        "SELECT provider, status, COUNT(*) AS total FROM tracking_event_log WHERE created_at >= ? GROUP BY provider, status"
      ).bind(Math.floor(Date.now() / 1000) - 86400).all();
      const counts = {};
      for (const row of (queue.results || [])) counts[row.status] = Number(row.total || 0);
      const eventCounts = {};
      for (const row of (events.results || [])) eventCounts[row.status] = Number(row.total || 0);
      return json({ ok: true, queue: counts, events24h: eventCounts, providers24h: providers.results || [] });
    } catch (error) {
      return json({ ok: false, error: 'TRACKING_STATS_UNAVAILABLE' }, 503);
    }
  }
  if (action === 'logs' && request.method === 'POST') {
    const limit = Math.max(1, Math.min(100, Number(body.limit) || 50));
    const status = cleanText(body.status, 20);
    const provider = cleanText(body.provider, 20);
    const clauses = ['created_at >= ?'];
    const params = [Math.floor(Date.now() / 1000) - 7 * 86400];
    if (['accepted', 'sent', 'failed', 'skipped', 'duplicate'].includes(status)) { clauses.push('status = ?'); params.push(status); }
    if (['meta', 'tiktok', 'ga4'].includes(provider)) { clauses.push('provider = ?'); params.push(provider); }
    const result = await env.DB.prepare(
      'SELECT id, profile_id, hostname, provider, event_name, event_id, status, http_status, error_code, provider_trace_id, created_at ' +
      'FROM tracking_event_log WHERE ' + clauses.join(' AND ') + ' ORDER BY created_at DESC LIMIT ?'
    ).bind(...params, limit).all();
    return json({ ok: true, logs: result.results || [] });
  }
  return json({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
}
