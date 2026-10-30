/**
 * Size Manager storage in Cloudflare D1 (binding STOCK_DB, tables from migrations/d1/0001_size_manager.sql).
 *
 * The admin edits draft rows (size_templates, size_fields, size_options, size_category_settings,
 * size_product_overrides). "Publish" turns the draft into one configuration object (the format size-core.js
 * reads) and stores it as a new row in size_config_versions; only that active row is served to the website and
 * to the Apps Script order check. "Rollback" publishes an older version again and restores the draft from it.
 * Every change is written to size_audit_log. All SQL is parameterized.
 */
import { SIZE_CATEGORIES } from './size-defaults.js';

const KEY_RE = /^[a-z0-9_]{1,40}$/;
const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const PRODUCT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,100}$/;
const BAD_TEXT_RE = /[<>{}`\\\u0000-\u001f]/;
const LEGACY_SLOTS = ['body', 'length', 'dressLength', 'sleeve', 'palazzo', 'sizes'];
export const LIMITS = { fields: 20, options: 60, label: 60, value: 40, actor: 120, note: 200 };

const fail = (code) => { throw Object.assign(new Error(code), { code }); };
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
const bool = (v, dflt) => (typeof v === 'boolean' ? v : dflt);

function text(v, max, code) {
  const s = String(v == null ? '' : v).trim();
  if (s.length > max || BAD_TEXT_RE.test(s)) fail(code);
  return s;
}

function options(list, code) {
  if (!Array.isArray(list)) fail(code);
  if (list.length > LIMITS.options) fail('TOO_MANY_OPTIONS');
  const seen = new Set();
  return list.map((o) => {
    const obj = o && typeof o === 'object' ? o : { value: o };
    const value = text(obj.value, LIMITS.value, code);
    if (!value || seen.has(norm(value))) fail(code);
    seen.add(norm(value));
    return { value, label_bn: text(obj.label_bn, LIMITS.label, code), label_en: text(obj.label_en, LIMITS.label, code) };
  });
}

/** Checks and normalizes one template from the admin panel. */
export function validateTemplate(input) {
  const t = input && typeof input === 'object' ? input : fail('BAD_TEMPLATE');
  const id = String(t.id || '');
  if (!TEMPLATE_ID_RE.test(id)) fail('BAD_TEMPLATE_ID');
  const name_bn = text(t.name_bn, LIMITS.label, 'BAD_NAME');
  const name_en = text(t.name_en, LIMITS.label, 'BAD_NAME');
  if (!name_bn && !name_en) fail('BAD_NAME');
  if (!Array.isArray(t.fields) || !t.fields.length) fail('NO_FIELDS');
  if (t.fields.length > LIMITS.fields) fail('TOO_MANY_FIELDS');
  const keys = new Set();
  const fields = t.fields.map((f) => {
    if (!f || typeof f !== 'object' || !KEY_RE.test(String(f.key || '')) || keys.has(f.key)) fail('BAD_FIELD_KEY');
    keys.add(f.key);
    const out = {
      key: f.key,
      label_bn: text(f.label_bn, LIMITS.label, 'BAD_LABEL'),
      label_en: text(f.label_en, LIMITS.label, 'BAD_LABEL'),
      required: bool(f.required, true),
      enabled: bool(f.enabled, true),
      allowCustom: bool(f.allowCustom, false),
      default: text(f.default, LIMITS.value, 'BAD_DEFAULT'),
      legacy: Array.isArray(f.legacy) ? f.legacy.map(String) : [],
      options: options(f.options || [], 'BAD_OPTION')
    };
    if (!out.label_bn && !out.label_en) fail('BAD_LABEL');
    if (out.legacy.some((s) => !LEGACY_SLOTS.includes(s))) fail('BAD_LEGACY');
    // A field with no values of its own is allowed when customers may type one, or when it only serves old products' size lists.
    if (!out.options.length && !out.allowCustom && !out.legacy.length) fail('FIELD_HAS_NO_CHOICES');
    return out;
  });
  return { id, name_bn, name_en, fields };
}

export function validateCategory(input, templateIds) {
  const c = input && typeof input === 'object' ? input : fail('BAD_CATEGORY');
  if (!SIZE_CATEGORIES.includes(c.category_key)) fail('BAD_CATEGORY');
  if (!templateIds.has(c.template_id)) fail('UNKNOWN_TEMPLATE');
  return { category_key: c.category_key, template_id: c.template_id, enabled: c.enabled === true };
}

export function validateOverride(input, templateIds) {
  const o = input && typeof input === 'object' ? input : fail('BAD_OVERRIDE');
  if (!PRODUCT_ID_RE.test(String(o.product_id || ''))) fail('BAD_PRODUCT_ID');
  const template_id = o.template_id == null || o.template_id === '' ? null : String(o.template_id);
  if (template_id !== null && !templateIds.has(template_id)) fail('UNKNOWN_TEMPLATE');
  const enabled = typeof o.enabled === 'boolean' ? o.enabled : null;
  const src = o.fields && typeof o.fields === 'object' && !Array.isArray(o.fields) ? o.fields : {};
  if (Object.keys(src).length > LIMITS.fields) fail('TOO_MANY_FIELDS');
  const fields = {};
  Object.keys(src).forEach((key) => {
    if (!KEY_RE.test(key)) fail('BAD_FIELD_KEY');
    const f = src[key] && typeof src[key] === 'object' ? src[key] : fail('BAD_OVERRIDE');
    const out = {};
    ['label_bn', 'label_en'].forEach((k) => { if (k in f) out[k] = text(f[k], LIMITS.label, 'BAD_LABEL'); });
    ['required', 'enabled', 'allowCustom'].forEach((k) => { if (typeof f[k] === 'boolean') out[k] = f[k]; });
    if ('default' in f) out.default = text(f.default, LIMITS.value, 'BAD_DEFAULT');
    if ('options' in f) out.options = options(f.options, 'BAD_OPTION');
    fields[key] = out;
  });
  return { product_id: o.product_id, template_id, enabled, use_template: o.use_template === true, fields };
}

const stmt = (sql, ...params) => ({ sql, params });

function templateStatements(t, now, actor) {
  const out = [
    stmt('INSERT INTO size_templates (id, name_bn, name_en, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET name_bn = excluded.name_bn, name_en = excluded.name_en, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
    t.id, t.name_bn, t.name_en, now, actor),
    stmt('DELETE FROM size_options WHERE template_id = ?', t.id),
    stmt('DELETE FROM size_fields WHERE template_id = ?', t.id)
  ];
  t.fields.forEach((f, i) => {
    out.push(stmt('INSERT INTO size_fields (template_id, key, label_bn, label_en, sort_order, required, enabled, allow_custom, default_value, legacy_slots) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', t.id, f.key, f.label_bn, f.label_en, i, f.required ? 1 : 0, f.enabled ? 1 : 0,
    f.allowCustom ? 1 : 0, f.default, JSON.stringify(f.legacy)));
    f.options.forEach((o, j) => out.push(stmt('INSERT INTO size_options (template_id, field_key, value, label_bn, label_en, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      t.id, f.key, o.value, o.label_bn, o.label_en, j)));
  });
  return out;
}

const categoryStatement = (c, now, actor) => stmt(
  'INSERT INTO size_category_settings (category_key, template_id, enabled, updated_at, updated_by) VALUES (?, ?, ?, ?, ?) ' +
  'ON CONFLICT(category_key) DO UPDATE SET template_id = excluded.template_id, enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
  c.category_key, c.template_id, c.enabled ? 1 : 0, now, actor);

const overrideStatement = (o, now, actor) => stmt(
  'INSERT INTO size_product_overrides (product_id, template_id, enabled, use_template, fields_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
  'ON CONFLICT(product_id) DO UPDATE SET template_id = excluded.template_id, enabled = excluded.enabled, use_template = excluded.use_template, ' +
  'fields_json = excluded.fields_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
  o.product_id, o.template_id, o.enabled === null ? null : o.enabled ? 1 : 0, o.use_template ? 1 : 0, JSON.stringify(o.fields), now, actor);

const auditStatement = (now, actor, action, target, before, after) => stmt(
  'INSERT INTO size_audit_log (at, actor, action, target, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?)',
  now, actor, action, target, before === undefined ? null : JSON.stringify(before), after === undefined ? null : JSON.stringify(after));

/** Statements that replace the whole draft with `config` (used by the seed and by rollback). */
export function draftStatementsFromConfig(config, now, actor) {
  const out = [
    stmt('DELETE FROM size_product_overrides'),
    stmt('DELETE FROM size_category_settings'),
    stmt('DELETE FROM size_options'),
    stmt('DELETE FROM size_fields'),
    stmt('DELETE FROM size_templates')
  ];
  Object.values(config.templates || {}).forEach((t) => out.push(...templateStatements(t, now, actor)));
  Object.keys(config.categories || {}).forEach((k) => out.push(categoryStatement({ category_key: k, ...config.categories[k], template_id: config.categories[k].template }, now, actor)));
  Object.keys(config.products || {}).forEach((id) => {
    const p = config.products[id];
    out.push(overrideStatement({ product_id: id, template_id: p.template || null, enabled: typeof p.enabled === 'boolean' ? p.enabled : null,
      use_template: p.useTemplate === true, fields: p.fields || {} }, now, actor));
  });
  return out;
}

export async function runStatements(db, list) {
  if (!list.length) return [];
  return db.batch(list.map((s) => db.prepare(s.sql).bind(...s.params)));
}

const rowsOf = async (db, sql, ...params) => ((await db.prepare(sql).bind(...params).all()).results || []);

/** The current draft as one configuration object (size-core.js format, without a version). */
export async function readDraft(db) {
  const [templates, fields, opts, cats, overrides] = await Promise.all([
    rowsOf(db, 'SELECT id, name_bn, name_en, updated_at FROM size_templates ORDER BY id'),
    rowsOf(db, 'SELECT * FROM size_fields ORDER BY template_id, sort_order, key'),
    rowsOf(db, 'SELECT * FROM size_options ORDER BY template_id, field_key, sort_order, value'),
    rowsOf(db, 'SELECT category_key, template_id, enabled FROM size_category_settings ORDER BY category_key'),
    rowsOf(db, 'SELECT * FROM size_product_overrides ORDER BY product_id')
  ]);
  const config = { categories: {}, templates: {}, products: {} };
  const updatedAt = {};
  templates.forEach((t) => {
    config.templates[t.id] = { id: t.id, name_bn: t.name_bn, name_en: t.name_en, fields: [] };
    updatedAt[t.id] = t.updated_at;
  });
  const byField = {};
  fields.forEach((f) => {
    const t = config.templates[f.template_id];
    if (!t) return;
    const out = { key: f.key, label_bn: f.label_bn, label_en: f.label_en, required: f.required === 1, enabled: f.enabled === 1,
      allowCustom: f.allow_custom === 1, default: f.default_value, legacy: JSON.parse(f.legacy_slots || '[]'), options: [] };
    t.fields.push(out);
    byField[f.template_id + '\u0000' + f.key] = out;
  });
  opts.forEach((o) => {
    const f = byField[o.template_id + '\u0000' + o.field_key];
    if (f) f.options.push({ value: o.value, label_bn: o.label_bn, label_en: o.label_en });
  });
  cats.forEach((c) => { config.categories[c.category_key] = { template: c.template_id, enabled: c.enabled === 1 }; });
  overrides.forEach((o) => {
    config.products[o.product_id] = { template: o.template_id || null, enabled: o.enabled === null ? null : o.enabled === 1,
      useTemplate: o.use_template === 1, fields: JSON.parse(o.fields_json || '{}') };
  });
  return { config, updatedAt };
}

/** The published configuration the website and the order check use, or null when nothing is published. */
export async function readActive(db) {
  const row = await db.prepare('SELECT version, snapshot_json, published_at FROM size_config_versions WHERE active = 1').first();
  if (!row) return null;
  return { version: row.version, publishedAt: row.published_at, config: JSON.parse(row.snapshot_json) };
}

export async function listVersions(db, limit = 30) {
  return rowsOf(db, 'SELECT version, published_at, published_by, note, active FROM size_config_versions ORDER BY version DESC LIMIT ?', limit);
}

async function nextVersion(db) {
  const row = await db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM size_config_versions').first();
  return Number(row && row.v || 0) + 1;
}

function checkPublishable(config) {
  Object.keys(config.categories).forEach((k) => {
    if (!config.templates[config.categories[k].template]) fail('CATEGORY_TEMPLATE_MISSING');
  });
  Object.values(config.products).forEach((p) => { if (p.template && !config.templates[p.template]) fail('PRODUCT_TEMPLATE_MISSING'); });
}

function publishStatements(config, version, now, actor, note) {
  const snapshot = JSON.stringify(Object.assign({ version }, config));
  return [
    stmt('UPDATE size_config_versions SET active = 0 WHERE active = 1'),
    stmt('INSERT INTO size_config_versions (version, snapshot_json, published_at, published_by, note, active) VALUES (?, ?, ?, ?, ?, 1)',
      version, snapshot, now, actor, note),
    auditStatement(now, actor, 'publish', 'v' + version, undefined, { note })
  ];
}

export async function publish(db, { now, actor, note = '' }) {
  const { config } = await readDraft(db);
  checkPublishable(config);
  const version = await nextVersion(db);
  await runStatements(db, publishStatements(config, version, now, actor, text(note, LIMITS.note, 'BAD_NOTE')));
  return version;
}

/** Publishes an older version again (as a new version number) and makes it the draft too. */
export async function rollback(db, { version, now, actor }) {
  const row = await db.prepare('SELECT snapshot_json FROM size_config_versions WHERE version = ?').bind(Number(version)).first();
  if (!row) fail('UNKNOWN_VERSION');
  const old = JSON.parse(row.snapshot_json);
  delete old.version;
  const next = await nextVersion(db);
  await runStatements(db, draftStatementsFromConfig(old, now, actor)
    .concat(publishStatements(old, next, now, actor, 'rollback to v' + Number(version))));
  return next;
}

export async function saveTemplate(db, input, { now, actor, expectedUpdatedAt }) {
  const t = validateTemplate(input);
  const cur = await db.prepare('SELECT updated_at FROM size_templates WHERE id = ?').bind(t.id).first();
  // Someone else saved this template since it was loaded: refuse instead of overwriting their change.
  if (cur && expectedUpdatedAt !== undefined && Number(expectedUpdatedAt) !== Number(cur.updated_at)) fail('CONFLICT');
  const before = cur ? (await readDraft(db)).config.templates[t.id] : undefined;
  await runStatements(db, templateStatements(t, now, actor).concat(auditStatement(now, actor, 'save_template', t.id, before, t)));
  return t;
}

export async function deleteTemplate(db, id, { now, actor }) {
  const used = await db.prepare('SELECT (SELECT COUNT(*) FROM size_category_settings WHERE template_id = ?) + ' +
    '(SELECT COUNT(*) FROM size_product_overrides WHERE template_id = ?) AS n').bind(id, id).first();
  if (Number(used && used.n || 0) > 0) fail('TEMPLATE_IN_USE');
  const before = (await readDraft(db)).config.templates[id];
  if (!before) fail('UNKNOWN_TEMPLATE');
  await runStatements(db, [stmt('DELETE FROM size_templates WHERE id = ?', id), auditStatement(now, actor, 'delete_template', id, before)]);
}

async function templateIds(db) {
  return new Set((await rowsOf(db, 'SELECT id FROM size_templates')).map((r) => r.id));
}

export async function saveCategory(db, input, { now, actor }) {
  const c = validateCategory(input, await templateIds(db));
  await runStatements(db, [categoryStatement(c, now, actor), auditStatement(now, actor, 'save_category', c.category_key, undefined, c)]);
  return c;
}

export async function saveOverride(db, input, { now, actor }) {
  const o = validateOverride(input, await templateIds(db));
  await runStatements(db, [overrideStatement(o, now, actor), auditStatement(now, actor, 'save_override', o.product_id, undefined, o)]);
  return o;
}

export async function deleteOverride(db, productId, { now, actor }) {
  if (!PRODUCT_ID_RE.test(String(productId || ''))) fail('BAD_PRODUCT_ID');
  await runStatements(db, [stmt('DELETE FROM size_product_overrides WHERE product_id = ?', productId),
    auditStatement(now, actor, 'delete_override', productId)]);
}

export { templateStatements, categoryStatement, auditStatement, publishStatements };
