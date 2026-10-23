/**
 * IP helpers shared by the order Worker (cloudflare-worker/worker.js keeps an identical copy between the
 * "ip-guard:begin/end" markers; tests/backend/order-ip-guard.test.mjs fails if the two drift apart) and
 * the admin API (functions/api/admin-ip.js).
 *
 * D1 tables (database ma-orders, see cloudflare-worker/schema-ip.sql):
 *   order_ip_log  one row per order attempt that reached the Worker: IP, network, device, phone, outcome
 *   blocked_ips   blocked addresses; an IPv6 address is blocked as its /64 network
 */
// ip-guard:begin
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Expands an IPv6 address to 8 lowercase groups without leading zeros, or returns null. */
function ipv6Groups(ip) {
  let s = String(ip || '').trim().toLowerCase();
  if (!s || s.indexOf(':') === -1 || !/^[0-9a-f:.]+$/.test(s)) return null;
  let tail = [];
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    if (!IPV4_RE.test(v4[1])) return null;
    const p = v4[1].split('.').map(Number);
    tail = [((p[0] << 8) | p[1]).toString(16), ((p[2] << 8) | p[3]).toString(16)];
    s = s.slice(0, -v4[1].length);
    if (s.endsWith(':') && !s.endsWith('::')) s = s.slice(0, -1);
  }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const rest = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const known = head.length + rest.length + tail.length;
  if (parts.length === 1 && known !== 8) return null;
  if (parts.length === 2 && known > 7) return null;
  const fill = parts.length === 2 ? new Array(8 - known).fill('0') : [];
  const groups = head.concat(fill, rest, tail);
  if (groups.length !== 8) return null;
  for (let i = 0; i < 8; i++) {
    if (!/^[0-9a-f]{1,4}$/.test(groups[i])) return null;
    groups[i] = parseInt(groups[i], 16).toString(16);
  }
  return groups;
}

/** Normalised address ("1.2.3.4", or IPv6 in full 8-group form), or '' when invalid. */
function normalizeIp(ip) {
  const s = String(ip || '').trim();
  if (IPV4_RE.test(s)) return s;
  const g = ipv6Groups(s);
  if (!g) return '';
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) is the IPv4 address.
  if (g.slice(0, 5).every((x) => x === '0') && g[5] === 'ffff') {
    const a = parseInt(g[6], 16), b = parseInt(g[7], 16);
    return [a >> 8, a & 255, b >> 8, b & 255].join('.');
  }
  return g.join(':');
}

/** What a block stores: the IPv4 address itself, or the IPv6 /64 network ("2001:db8:0:1::/64"). */
function ipBlockKey(ip) {
  const n = normalizeIp(ip);
  if (!n) return '';
  if (n.indexOf(':') === -1) return n;
  return n.split(':').slice(0, 4).join(':') + '::/64';
}

/** Every stored block that would cover this address (exact address and, for IPv6, its /64). */
function ipBlockKeys(ip) {
  const n = normalizeIp(ip);
  if (!n) return [];
  const key = ipBlockKey(n);
  return key === n ? [n] : [n, key];
}

/** Bangladesh mobile number as 01XXXXXXXXX ('' when it is not one). */
function localPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 13 && d.indexOf('880') === 0) d = d.slice(2);
  else if (d.length === 10 && d.charAt(0) === '1') d = '0' + d;
  return /^01\d{9}$/.test(d) ? d : '';
}

/** Short device text from a User-Agent, e.g. "Android · Chrome". */
function deviceLabel(ua) {
  const s = String(ua || '');
  if (!s) return '';
  const os = /iPhone|iPad|iPod/.test(s) ? 'iPhone/iPad' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : 'অন্যান্য';
  const app = /FBAN|FBAV|FB_IAB/.test(s) ? 'Facebook app' : /Instagram/.test(s) ? 'Instagram app' : /musical_ly|TikTok|BytedanceWebview/.test(s) ? 'TikTok app'
    : /SamsungBrowser/.test(s) ? 'Samsung Internet' : /OPR\/|Opera/.test(s) ? 'Opera' : /Edg\//.test(s) ? 'Edge' : /CriOS|Chrome\//.test(s) ? 'Chrome'
    : /Firefox|FxiOS/.test(s) ? 'Firefox' : /Safari/.test(s) ? 'Safari' : 'Browser';
  return os + ' · ' + app;
}
// ip-guard:end

export { normalizeIp, ipBlockKey, ipBlockKeys, localPhone, deviceLabel };
