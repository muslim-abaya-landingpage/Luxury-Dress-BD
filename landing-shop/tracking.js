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
