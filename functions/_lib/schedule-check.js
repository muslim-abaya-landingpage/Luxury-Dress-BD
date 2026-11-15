/**
 * What the scheduled jobs must react to (shared by scripts/sale-boundary-check.mjs and /api/cron-tick):
 *   - a scheduled sale (Product Manager → Schedule) that starts today or ended yesterday, Bangladesh time
 *   - a scheduled publish date (Publish box) reached between `sinceMs` and `nowMs`
 * Prices customers see and pay are decided live; these only make the pre-built pages and Google data follow.
 */
export const dhakaDate = (ms) => new Date(ms + 6 * 3600000).toISOString().slice(0, 10);
export const dhakaHourMinute = (ms) => { const d = new Date(ms + 6 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

export function saleBoundaries(catalog, today) {
  const yesterday = dhakaDate(Date.parse(today + 'T12:00:00+06:00') - 86400000);
  const hits = [];
  for (const [cat, list] of Object.entries(catalog || {})) {
    for (const p of Array.isArray(list) ? list : []) {
      if (!p || typeof p !== 'object') continue;
      if (p.saleFrom === today) hits.push(`${cat}/${p.id}: sale starts ${today}`);
      if (p.saleTo === yesterday) hits.push(`${cat}/${p.id}: sale ended ${yesterday}`);
      for (const v of Array.isArray(p.variations) ? p.variations : []) {
        const label = v && (v.size || v.color || v.type || '');
        if (v && v.saleFrom === today) hits.push(`${cat}/${p.id} variation ${label}: sale starts ${today}`);
        if (v && v.saleTo === yesterday) hits.push(`${cat}/${p.id} variation ${label}: sale ended ${yesterday}`);
      }
    }
  }
  return hits;
}

export function publishesBetween(catalog, sinceMs, nowMs) {
  const hits = [];
  for (const [cat, list] of Object.entries(catalog || {})) {
    for (const p of Array.isArray(list) ? list : []) {
      if (!p || typeof p !== 'object' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(p.publishDate || ''))) continue;
      const at = Date.parse(p.publishDate + ':00+06:00');
      if (at <= nowMs && at > sinceMs) hits.push(`${cat}/${p.id}: published at ${p.publishDate}`);
    }
  }
  return hits;
}

/** Only the dates the scheduled jobs need (written to schedule.json at deploy, read by /api/cron-tick). */
export function scheduleSnapshot(catalog) {
  const out = {};
  for (const [cat, list] of Object.entries(catalog || {})) {
    const rows = [];
    for (const p of Array.isArray(list) ? list : []) {
      if (!p || typeof p !== 'object' || !p.id) continue;
      const row = { id: String(p.id) };
      ['saleFrom', 'saleTo', 'publishDate'].forEach((k) => { if (p[k]) row[k] = String(p[k]); });
      const vars = (Array.isArray(p.variations) ? p.variations : []).filter((v) => v && (v.saleFrom || v.saleTo))
        .map((v) => ({ size: v.size || '', color: v.color || '', type: v.type || '', saleFrom: v.saleFrom || '', saleTo: v.saleTo || '' }));
      if (vars.length) row.variations = vars;
      if (Object.keys(row).length > 1) rows.push(row);
    }
    if (rows.length) out[cat] = rows;
  }
  return out;
}
