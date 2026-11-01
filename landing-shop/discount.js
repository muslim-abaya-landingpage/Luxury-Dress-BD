/* ডিসকাউন্ট ইঞ্জিন — config.js-এর `discount` অংশ পড়ে দাম নিজে থেকে কমায়, আর সময় শেষ হলে নিজে থেকে বন্ধ করে।
   একই ফাংশন ব্রাউজারে (দেখানো দাম, কার্ট, অর্ডার) আর Cloudflare _worker.js-এ (দাম যাচাই) চলে,
   তাই দুই জায়গায় হিসাব সবসময় এক থাকে। এখানে কিছু বদলাতে হয় না — শুধু config.js-এর discount বদলান। */
/* DISCOUNT-FN-START */
function maDiscountActive(d, now) {
  if (!d || d.enabled !== true) return false;
  const value = Number(d.value);
  if (!Number.isFinite(value) || value <= 0) return false;
  const t = s => { const x = Date.parse(String(s || '')); return Number.isFinite(x) ? x : null; };
  const start = t(d.startsAt), end = t(d.endsAt);
  if (start !== null && now < start) return false;
  if (end !== null && now >= end) return false;
  return true;
}
function maDiscountedPrice(price, d) {
  const p = Number(price) || 0, v = Number(d.value) || 0;
  // সর্বোচ্চ ৯০% ছাড়, যাতে ভুল করে দাম ০ হয়ে না যায়।
  const cut = Math.min(d.type === 'fixed' ? v : p * Math.min(90, v) / 100, p * 0.9);
  return Math.max(0, Math.round(p - cut));
}
function maApplyDiscount(cfg, now) {
  if (!cfg || cfg._discountApplied) return cfg;
  cfg._discountApplied = true;
  const d = cfg.discount;
  if (!maDiscountActive(d, now) || !Array.isArray(cfg.products)) return cfg;
  const only = Array.isArray(d.products) && d.products.length ? d.products.map(String) : null;
  for (const p of cfg.products) {
    if (!p || (only && !only.includes(String(p.id)))) continue;
    p.regularPrice = Number(p.price) || 0;
    p.price = maDiscountedPrice(p.price, d);
    for (const v of (Array.isArray(p.variants) ? p.variants : [])) {
      if (v.price == null) continue;
      v.regularPrice = Number(v.price) || 0;
      v.price = maDiscountedPrice(v.price, d);
    }
  }
  if (d.label && cfg.hero) cfg.hero.badge = String(d.label);
  return cfg;
}
/* DISCOUNT-FN-END */
if (typeof window !== 'undefined' && window.LANDING_CONFIG) maApplyDiscount(window.LANDING_CONFIG, Date.now());
