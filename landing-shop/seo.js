(() => {
  'use strict';
  const c = window.LANDING_CONFIG;
  if (!c?.brand) return;
  const origin = String(c.brand.siteUrl || '').trim();
  const url = /^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(origin) ? new URL(origin).href : '';
  const absolute = path => url ? new URL(path, url).href : '';
  const set = (selector, value, attr = 'content') => {
    const el = document.querySelector(selector);
    if (el && value) el.setAttribute(attr, value);
  };
  document.title = c.brand.pageTitle || document.title;
  set('meta[name="description"]', c.brand.description);
  set('meta[property="og:site_name"]', c.brand.name);
  set('meta[property="og:title"]', c.brand.pageTitle);
  set('meta[property="og:description"]', c.brand.description);
  set('meta[property="og:image:alt"]', c.hero?.imageAlt);
  set('meta[name="twitter:title"]', c.brand.pageTitle);
  set('meta[name="twitter:description"]', c.brand.description);
  if (!url) return;
  set('meta[name="twitter:image"]', absolute(c.hero?.images?.[0] || ''));
  if (new URLSearchParams(location.search).has('builderPreview') || new URLSearchParams(location.search).has('site')) {
    const robots = document.createElement('meta'); robots.name='robots'; robots.content='noindex,follow'; document.head.appendChild(robots);
  }
  set('link[rel="canonical"]', url, 'href');
  set('meta[property="og:url"]', url);
  set('meta[property="og:image"]', absolute(c.hero?.images?.[0] || ''));
  const items = (c.products || []).filter(p => p.name && Number.isFinite(p.price) && p.image);
  const data = items.map(p => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: `${p.name} ${p.details || ''}`.trim(),
    image: absolute(p.image),
    brand: {'@type':'Brand', name:c.brand.name},
    offers: {'@type':'Offer', url:`${url}#products`, priceCurrency:'BDT', price:p.variants?.[0]?.price ?? p.price, availability:p.inStock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock'}
  }));
  if (data.length) {
    const script = document.getElementById('product-schema') || document.createElement('script');
    script.id = 'product-schema';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }
})();
