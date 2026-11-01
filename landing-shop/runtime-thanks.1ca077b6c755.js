
/* discount.js */
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

;

/* theme.js */
(() => {
  'use strict';
  const cfg = window.LANDING_CONFIG || {};
  const presets = {
    emeraldGold:{primary:'#173B2D',primary2:'#244D39',accent:'#E7C981',accent2:'#F3DDA7',background:'#F7F4EA',surface:'#FFFDF8',surface2:'#F3F5ED',text:'#17251D',muted:'#667268',border:'#D9D4C5',danger:'#AD3131',success:'#287044',onPrimary:'#FFFFFF',onAccent:'#173526'},
    blackGold:{primary:'#151515',primary2:'#292929',accent:'#D8B56A',accent2:'#F0D89C',background:'#F6F3EC',surface:'#FFFFFF',surface2:'#F0EEE8',text:'#171717',muted:'#6D6A64',border:'#D9D3C7',danger:'#A92E2E',success:'#2E7045',onPrimary:'#FFFFFF',onAccent:'#171717'},
    maroonGold:{primary:'#4A1831',primary2:'#672542',accent:'#D9B56C',accent2:'#F1D79E',background:'#FAF4F5',surface:'#FFFDFD',surface2:'#F7ECEF',text:'#2C1821',muted:'#765E68',border:'#E1CED5',danger:'#B12D3B',success:'#34734B',onPrimary:'#FFFFFF',onAccent:'#321421'},
    navyGold:{primary:'#142A43',primary2:'#203E5E',accent:'#D6B56D',accent2:'#F0D89F',background:'#F4F7FA',surface:'#FFFFFF',surface2:'#EDF2F6',text:'#182431',muted:'#647180',border:'#D4DDE5',danger:'#B0363C',success:'#2D7351',onPrimary:'#FFFFFF',onAccent:'#15283C'},
    mochaCream:{primary:'#49352B',primary2:'#654A3C',accent:'#D9B98A',accent2:'#F1D9B6',background:'#FAF5ED',surface:'#FFFDF9',surface2:'#F4EADF',text:'#2E251F',muted:'#75685F',border:'#E2D4C4',danger:'#AD3A35',success:'#42704B',onPrimary:'#FFFFFF',onAccent:'#34271F'}
  };
  const tcfg = cfg.theme || {};
  const base = presets[tcfg.activePreset] || presets.emeraldGold;
  const t = {...base,...(tcfg.custom || {})};
  const root = document.documentElement;
  const vars = {primary:t.primary,'primary-2':t.primary2,accent:t.accent,'accent-2':t.accent2,bg:t.background,surface:t.surface,'surface-2':t.surface2,text:t.text,muted:t.muted,border:t.border,danger:t.danger,success:t.success,'on-primary':t.onPrimary,'on-accent':t.onAccent};
  Object.entries(vars).forEach(([k,v])=>v&&root.style.setProperty(`--${k}`,v));
  root.dataset.theme = tcfg.activePreset || 'emeraldGold';
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=t.primary;
})();

;

/* tracking.js */
/* Conversion events represent real browser actions, not a completed payment. */
(() => {
  'use strict';
  const c = window.LANDING_CONFIG || {};
  if (new URLSearchParams(location.search).get('builderPreview') === '1') return;
  const m = c.marketing || {};
  const mode = m.trackingMode === 'direct' ? 'direct' : 'gtm';
  const channel = String(c.brand?.name || 'store').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const pendingKey = `landing-pending-lead:${channel}`;
  window.dataLayer = window.dataLayer || [];
  const query = new URLSearchParams(location.search);
  const keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','ttclid'];
  let attribution = {};
  try { attribution = JSON.parse(sessionStorage.getItem(`landing-attribution:${channel}`) || '{}'); } catch {}
  for (const key of keys) if (query.get(key)) attribution[key] = query.get(key).slice(0,200);
  try { sessionStorage.setItem(`landing-attribution:${channel}`,JSON.stringify(attribution)); } catch {}
  window.landingAttribution = attribution;
  window.landingNewEventId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  if (mode === 'gtm' && /^GTM-[A-Z0-9]+$/.test(String(m.gtmId || ''))) {
    window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
    const script=document.createElement('script'); script.async=true;
    script.src=`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(m.gtmId)}`;
    document.head.appendChild(script);
  }
  const ga4Ready = mode === 'direct' && /^G-[A-Z0-9]+$/.test(String(m.ga4MeasurementId || ''));
  // Google Ads conversion tracking shares the same gtag.js loader as GA4 — gtag.js is
  // fetched once (whichever ID triggers it) and each valid ID gets its own 'config' call.
  const googleAdsReady = mode === 'direct'
    && /^AW-\d+$/.test(String(m.googleAdsConversionId || ''))
    && /^[A-Za-z0-9_-]{6,25}$/.test(String(m.googleAdsConversionLabel || ''));
  if (ga4Ready || googleAdsReady) {
    window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
    const script=document.createElement('script'); script.async=true;
    script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Ready ? m.ga4MeasurementId : m.googleAdsConversionId)}`;
    document.head.appendChild(script);
    window.gtag('js',new Date());
    if (ga4Ready) window.gtag('config',m.ga4MeasurementId);
    if (googleAdsReady) window.gtag('config',m.googleAdsConversionId);
  }
  const clarityReady = /^[a-z0-9]{6,20}$/i.test(String(m.clarityId || ''));
  if (clarityReady) {
    (function(win,doc,tag,src,id){
      win[tag]=win[tag]||function(){(win[tag].q=win[tag].q||[]).push(arguments);};
      const s=doc.createElement(src); s.async=1; s.src='https://www.clarity.ms/tag/'+id;
      const first=doc.getElementsByTagName(src)[0];
      first.parentNode.insertBefore(s,first);
    })(window,document,'clarity','script',m.clarityId);
  }
  if (mode === 'direct' && /^\d{5,25}$/.test(String(m.metaPixelId || ''))) {
    window.fbq=window.fbq||function(){if(window.fbq.callMethod)window.fbq.callMethod.apply(window.fbq,arguments);else window.fbq.queue.push(arguments);};
    window.fbq.queue=window.fbq.queue||[]; window.fbq.loaded=true; window.fbq.version='2.0';
    const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';document.head.appendChild(script);
    window.fbq('init',m.metaPixelId);window.fbq('track','PageView');
  }
  const tiktokReady = mode === 'direct' && /^[A-Z0-9]{10,30}$/i.test(String(m.tiktokPixelId || ''));
  if (tiktokReady) {
    const ttq = window.ttq = window.ttq || [];
    ttq.methods = ['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
    ttq.setAndDefer = (queue,method) => { queue[method] = (...args) => queue.push([method,...args]); };
    for (const method of ttq.methods) ttq.setAndDefer(ttq,method);
    ttq.instance = id => { const queue = ttq._i[id] || []; for (const method of ttq.methods) ttq.setAndDefer(queue,method); return queue; };
    ttq.load = (id,options) => {
      const url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {}; ttq._i[id] = []; ttq._i[id]._u = url;
      ttq._t = ttq._t || {}; ttq._t[id] = Date.now();
      ttq._o = ttq._o || {}; ttq._o[id] = options || {};
      const script = document.createElement('script'); script.async = true;
      script.src = `${url}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
      document.head.appendChild(script);
    };
    ttq.load(m.tiktokPixelId); ttq.page();
  }
  const metaEvents={view_item:'ViewContent',add_to_cart:'AddToCart',begin_checkout:'InitiateCheckout',contact:'Contact',generate_lead:'Lead',purchase:'Purchase'};
  const tiktokEvents={view_item:'ViewContent',add_to_cart:'AddToCart',begin_checkout:'InitiateCheckout',contact:'Contact',generate_lead:'SubmitForm',purchase:'CompletePayment'};
  const ga4Events={view_item:'view_item',add_to_cart:'add_to_cart',begin_checkout:'begin_checkout',contact:'contact',generate_lead:'generate_lead',purchase:'purchase'};
  window.trackLandingEvent=(name,detail={})=>{
    // Never send name, phone, address, or raw form contents to ad tags.
    const event={event:name,currency:'BDT',value:Number(detail.value)||0,items:detail.items||[],event_id:detail.event_id||window.landingNewEventId(),brand:c.brand?.name||''};
    window.dataLayer.push(event);
    if(mode==='direct' && window.fbq && metaEvents[name]) {
      const params={currency:'BDT',value:event.value,content_ids:event.items.map(i=>i.item_id),content_type:'product'};
      window.fbq('track',metaEvents[name],params,{eventID:event.event_id});
    }
    if (tiktokReady && tiktokEvents[name]) {
      window.ttq.track(tiktokEvents[name],{currency:'BDT',value:event.value,content_type:'product',content_ids:event.items.map(i=>i.item_id),contents:event.items.map(i=>({content_id:i.item_id,content_name:i.item_name,quantity:i.quantity,price:i.price}))},{event_id:event.event_id});
    }
    if (ga4Ready && ga4Events[name] && !(name === 'generate_lead' && m.ga4LeadViaServer)) window.gtag('event',ga4Events[name],{currency:'BDT',value:event.value,items:event.items,event_id:event.event_id,transaction_id:event.event_id});
    // Google Ads conversion — separate from the GA4 config above, fires only for 'purchase'
    // (Ads conversion actions are usually tied to a single specific action, not every event).
    if (googleAdsReady && name === 'purchase') {
      window.gtag('event','conversion',{send_to:`${m.googleAdsConversionId}/${m.googleAdsConversionLabel}`,value:event.value,currency:'BDT',transaction_id:event.event_id});
    }
    return event.event_id;
  };
  const isThanks=/\/thank-you(?:\.html)?$/.test(location.pathname);
  window.dataLayer.push({event:'landing_page_view',brand:c.brand?.name||'',page_type:isThanks?'order_received':'landing'});
  if (isThanks) {
    try {
      const pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null');
      sessionStorage.removeItem(pendingKey);
      if(pending && Date.now()-pending.time<10*60*1000 && pending.value>0 && ['netlify','apps-script'].includes(pending.orderMode)) {
        window.trackLandingEvent('generate_lead',{value:pending.value,items:pending.items,event_id:pending.event_id});
        // Purchase is browser-only right now — the Worker's server-side CAPI call (see
        // _worker.js) only ever sends 'Lead', so there is no matching server event to
        // dedupe this against yet; it gets its own event_id rather than reusing the
        // Lead one. See the firePurchaseOnOrderSubmit comment in config.js for why this
        // fires at order-submission time rather than after the order is confirmed.
        if (m.firePurchaseOnOrderSubmit === true) {
          window.trackLandingEvent('purchase',{value:pending.value,items:pending.items});
        }
      }
    } catch { try { sessionStorage.removeItem(pendingKey); } catch {} }
  }
  window.landingPendingKey=pendingKey;
})();

;

/* thank-you.js */
(() => {const c=window.LANDING_CONFIG;document.querySelector('#brand').textContent=c.brand.name;document.title='অর্ডার পাওয়া গেছে | '+c.brand.name;try{const key='order-last-ref:'+c.brand.name,ref=sessionStorage.getItem(key);if(ref){const el=document.querySelector('#orderRef');el.hidden=false;el.textContent='আপনার অর্ডার আইডি: '+ref}localStorage.removeItem('order-draft:'+c.brand.name)}catch{}})();
