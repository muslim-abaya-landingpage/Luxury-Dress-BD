(() => {
  'use strict';
  const c = window.LANDING_CONFIG;
  const $ = id => document.getElementById(id);
  const text = (id, value) => { $(id).textContent = value ?? ''; };
  const money = value => '৳' + new Intl.NumberFormat('bn-BD').format(value);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const products = c?.products || [], areas = c?.deliveryAreas || [];
  if (!products.length || !areas.length || !c.hero?.images?.length || new Set(products.map(p => p.id)).size !== products.length || products.some(p => !/^[a-z0-9-]+$/.test(p.id) || !Number.isFinite(p.price) || p.price < 0) || areas.some(a => !/^[a-z0-9-]+$/.test(a.id) || !Number.isFinite(a.charge) || a.charge < 0)) {
    console.error('config.js: পণ্য, ছবি, ID ও ডেলিভারি সেটিংস যাচাই করুন');
    document.body.textContent = 'পেজের সেটিংসে সমস্যা হয়েছে। অনুগ্রহ করে যোগাযোগ করুন।';
    return;
  }
  document.title = c.brand.pageTitle;
  text('galleryBrand',c.brand.name.toUpperCase()); text('footerBrand',c.brand.name.toUpperCase());
  document.querySelector('meta[name="description"]').content = c.brand.description;
  const selected = Object.fromEntries(products.map(p => [p.id, { active: false, qty: 1, size: '', variant: p.variants?.[0]?.id || '' }]));
  const visibility=c.sectionVisibility||{}; const hide=(sel,off)=>{const el=document.querySelector(sel);if(el&&off===false)el.hidden=true}; hide('.feature',visibility.features);hide('#countdown',visibility.countdown);hide('#reviews',visibility.reviews);hide('#products',visibility.products);hide('#orderForm',visibility.order);
  const DRAFT_KEY=`order-draft:${c.brand.name}`, DUP_KEY=`order-duplicate:${c.brand.name}`, LAST_REF_KEY=`order-last-ref:${c.brand.name}`;
  let orderPageTime = Date.now(), submitting = false;
  const bnDigits='০১২৩৪৫৬৭৮৯';
  const normalizePhone=value=>{ let v=String(value||'').trim().replace(/[০-৯]/g,d=>String(bnDigits.indexOf(d))).replace(/[^\d+]/g,''); if(v.startsWith('+880'))v='0'+v.slice(4); else if(v.startsWith('880'))v='0'+v.slice(3); return v.slice(0,11); };
  const productInStock=p=>p.inStock!==false;
  const variantFor=p=>p.variants?.find(v=>v.id===selected[p.id]?.variant)||p.variants?.[0]||null;
  const priceFor=p=>Number(variantFor(p)?.price ?? p.price)||0;
  const stockMapFor=p=>variantFor(p)?.stockBySize||p.stockBySize;
  const sizeInStock=(p,size)=>!stockMapFor(p) || stockMapFor(p)[size]!==false && Number(stockMapFor(p)[size])!==0;
  const maxQtyFor=(p,size)=>{ const base=Math.max(1,Math.floor(Number(p.maxQty)||5)); const sv=stockMapFor(p)?.[size]; return typeof sv==='number' && Number.isFinite(sv) && sv>0 ? Math.min(base,Math.floor(sv)) : base; };
  const track = (name,detail) => window.trackLandingEvent?.(name,detail);
  const trackingItems = () => products.filter(p=>selected[p.id].active).map(p=>({item_id:p.id,item_name:p.name,price:priceFor(p),quantity:selected[p.id].qty}));
  const displaySrc = src => /^images\/black(?:-1|[2-7])?\.webp$/.test(src) ? src.replace(/^images\//, 'images/display/') : src;
  let galleryVisible = true, reviewsVisible = !('IntersectionObserver' in window);
  let photoIndex = 0, orderText = '', autoTimer, imageChange = 0;
  const galleryStyle = ['classic','glass','glass3d'].includes(c.hero.galleryStyle) ? c.hero.galleryStyle : 'glass3d';
  $('gallery').dataset.galleryStyle = galleryStyle;
  function showImage(index) {
    photoIndex = (index + c.hero.images.length) % c.hero.images.length;
    const nextSrc = displaySrc(c.hero.images[photoIndex]), change = ++imageChange;
    const main = $('mainImage'), stage = $('photoStage');
    const next = new Image(); next.src = nextSrc;
    const commit = () => {
      if (change !== imageChange) return;
      stage.querySelector('.photo-ghost')?.remove();
      if (main.getAttribute('src') !== nextSrc && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const ghost = main.cloneNode(); ghost.removeAttribute('id'); ghost.className = 'photo-ghost'; ghost.alt = ''; ghost.setAttribute('aria-hidden','true'); stage.insertBefore(ghost, main.nextSibling);
        main.src = nextSrc;
        requestAnimationFrame(() => requestAnimationFrame(() => ghost.classList.add('leaving')));
        setTimeout(() => ghost.remove(), 480);
      } else main.src = nextSrc;
    };
    if (next.complete) commit(); else { next.onload = commit; next.onerror = commit; }
    $('gallery').style.setProperty('--previous-photo', `url("${thumbSrc(c.hero.images[(photoIndex - 1 + c.hero.images.length) % c.hero.images.length])}")`);
    $('gallery').style.setProperty('--next-photo', `url("${thumbSrc(c.hero.images[(photoIndex + 1) % c.hero.images.length])}")`);
    const prevSrc=c.hero.images[(photoIndex-1+c.hero.images.length)%c.hero.images.length], sideNextSrc=c.hero.images[(photoIndex+1)%c.hero.images.length];
    if ($('glassPrev')) $('glassPrev').style.backgroundImage=`linear-gradient(#10251c22,#10251c22),url("${thumbSrc(prevSrc)}")`;
    if ($('glassNext')) $('glassNext').style.backgroundImage=`linear-gradient(#10251c22,#10251c22),url("${thumbSrc(sideNextSrc)}")`;
    $('photoStage').classList.remove('gallery-pop'); void $('photoStage').offsetWidth; $('photoStage').classList.add('gallery-pop');
    $('thumbList').querySelectorAll('button').forEach((b, i) => { b.classList.toggle('active', i === photoIndex); b.setAttribute('aria-pressed', String(i === photoIndex)); });
    text('galleryCounter', `${String(photoIndex + 1).padStart(2,'0')} / ${String(c.hero.images.length).padStart(2,'0')}`);
    const active = $('thumbList').querySelectorAll('button')[photoIndex], list = $('thumbList');
    if (active) list.scrollTo({left:list.scrollLeft+active.getBoundingClientRect().left-list.getBoundingClientRect().left-list.clientWidth/2+active.clientWidth/2,behavior:'smooth'});
    const progress = $('galleryProgress'); progress.classList.remove('running'); void progress.offsetWidth;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) progress.classList.add('running');
    startAuto();
  }
  function stopAuto() { clearInterval(autoTimer); autoTimer = undefined; $('galleryProgress').classList.remove('running'); }
  function startAuto() { clearInterval(autoTimer); if (!galleryVisible || $('productLightbox')?.hidden === false || c.hero.images.length < 2 || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches || $('photoStage').matches(':hover,:focus-within')) return; if(c.hero.galleryAutoPlay===false)return; autoTimer = setInterval(() => showImage(photoIndex + 1), Math.max(2500,Number(c.hero.galleryInterval)||5000)); }
  if ('IntersectionObserver' in window) {
    const visibilityObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.target === $('gallery')) { galleryVisible = entry.isIntersecting; galleryVisible ? startAuto() : stopAuto(); }
      else { reviewsVisible = entry.isIntersecting; reviewsVisible ? startReviewAuto() : stopReviewAuto(); }
    }), {threshold:0.05});
    visibilityObserver.observe($('gallery')); visibilityObserver.observe($('reviews'));
  }
  $('mainImage').alt = c.hero.imageAlt || products[0].name;
  // The thumbnail strip only ever shows these at 64x76 CSS px — serving the full
  // gallery-resolution file (900px+ wide) for every thumb was ~120KB x 8 images for
  // something displayed at postage-stamp size. images/thumb/<file> is a pre-sized
  // ~190px-wide copy of the same file; onerror falls back to the full image so a
  // future gallery image added without a matching thumb still shows something.
  const thumbSrc = src => /^images\/black(?:-1|[2-7])?\.webp$/.test(src) ? src.replace(/^images\//, 'images/thumb/') : src;
  $('thumbList').innerHTML = c.hero.images.map((src, i) => `<button type="button" class="thumb" data-photo="${i}" aria-label="ছবি ${i+1}"><img src="${escape(thumbSrc(src))}" data-fallback="${escape(src)}" alt="" width="64" height="76" loading="lazy" decoding="async"></button>`).join('');
  $('thumbList').querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.src = img.dataset.fallback; }, {once:true}));
  $('thumbList').onclick = e => { const b = e.target.closest('[data-photo]'); if (b) showImage(Number(b.dataset.photo)); };
  $('prev').onclick = () => showImage(photoIndex - 1); $('next').onclick = () => showImage(photoIndex + 1); if($('glassPrev')) $('glassPrev').onclick=()=>showImage(photoIndex-1); if($('glassNext')) $('glassNext').onclick=()=>showImage(photoIndex+1); showImage(0);
  $('photoStage').addEventListener('mouseenter', stopAuto); $('photoStage').addEventListener('mouseleave', startAuto);
  $('photoStage').addEventListener('focusin', stopAuto); $('photoStage').addEventListener('focusout', () => setTimeout(startAuto, 0));
  document.addEventListener('visibilitychange', () => document.hidden ? stopAuto() : startAuto());
  let touchX = 0, touchY = 0, swipeStart = false;
  $('photoStage').addEventListener('touchstart', e => {
    swipeStart = e.touches.length === 1 && !e.target.closest('button');
    if (swipeStart) { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }
  }, {passive:true});
  $('photoStage').addEventListener('touchend', e => {
    if (!swipeStart || !e.changedTouches.length) return;
    swipeStart = false;
    const dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) showImage(photoIndex + (dx < 0 ? 1 : -1));
  }, {passive:true});
  $('photoStage').addEventListener('touchcancel', () => { swipeStart = false; }, {passive:true});
  // PRO fullscreen viewer: swipe + double-click/tap zoom, no dependency.
  const lightbox=$('productLightbox'), lbImg=$('lightboxImage'), lbView=$('lightboxViewport'); let lbZoom=false, lbTouchX=0, lastTap=0;
  function syncLightbox(){ if(!lbImg)return; lbImg.src=c.hero.images[photoIndex]; lbImg.alt=c.hero.imageAlt||products[0].name; lbImg.classList.toggle('is-zoomed',lbZoom); }
  function openLightbox(){ if(c.hero.galleryLightbox===false)return; stopAuto(); lbZoom=false; syncLightbox(); lightbox.hidden=false; lightbox.setAttribute('aria-hidden','false'); document.body.classList.add('lightbox-open'); $('closeLightbox').focus(); }
  function closeLightbox(){ lightbox.hidden=true; lightbox.setAttribute('aria-hidden','true'); document.body.classList.remove('lightbox-open'); lbZoom=false; startAuto(); $('openLightbox')?.focus(); }
  function lbStep(n){ lbZoom=false; showImage(photoIndex+n); syncLightbox(); }
  if(c.hero.galleryLightbox===false && $('openLightbox')) $('openLightbox').hidden=true;
  $('openLightbox')?.addEventListener('click',openLightbox); $('mainImage').addEventListener('dblclick',openLightbox);
  $('closeLightbox')?.addEventListener('click',closeLightbox); $('lightboxPrev')?.addEventListener('click',()=>lbStep(-1)); $('lightboxNext')?.addEventListener('click',()=>lbStep(1));
  lightbox?.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});
  lbView?.addEventListener('dblclick',()=>{if(c.hero.galleryZoom===false)return;lbZoom=!lbZoom;syncLightbox();});
  lbView?.addEventListener('touchstart',e=>{lbTouchX=e.changedTouches[0].screenX; const now=Date.now(); if(now-lastTap<320 && c.hero.galleryZoom!==false){lbZoom=!lbZoom;syncLightbox();} lastTap=now;},{passive:true});
  lbView?.addEventListener('touchend',e=>{if(lbZoom)return;const d=e.changedTouches[0].screenX-lbTouchX;if(Math.abs(d)>45)lbStep(d<0?1:-1);},{passive:true});
  document.addEventListener('keydown',e=>{if(lightbox?.hidden!==false)return;if(e.key==='Tab'){const buttons=[...lightbox.querySelectorAll('button')];const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}if(e.key==='Escape')closeLightbox();if(e.key==='ArrowLeft')lbStep(-1);if(e.key==='ArrowRight')lbStep(1);});
  if(c.hero.gallerySidePreview===false){$('glassPrev')?.remove();$('glassNext')?.remove();}

  text('badge', c.hero.badge); $('badge').hidden = !c.hero.badge;
  text('announcementText', c.hero.announcement || 'এক টাকাও অগ্রিম নয় • ক্যাশ অন ডেলিভারি');
  text('priceBadge', money(priceFor(products[0]))); text('offerNote', c.hero.offerNote); $('offerNote').hidden = !c.hero.offerNote;
  text('heroCaption', c.hero.caption); text('heroCta', c.hero.buttonText);
  const s = c.sections;
  text('featureTitle', s.featuresTitle); $('featureList').innerHTML = (s.features || []).map(f => `<li>${escape(f)}</li>`).join('');
  for (const id of ['contactTitle','contactCaption','productsTitle','orderTitle']) text(id, s[id]);
  text('contactPhone', c.brand.phone ? c.brand.phone : s.contactButton);
  if (c.brand.phone) $('contactLink').href = 'tel:' + c.brand.phone.replace(/[^\d+]/g, '');
  const contactWa = String(c.order.whatsappNumber || '').replace(/\D/g,'');
  if (/^\d{11,15}$/.test(contactWa)) {
    $('contactWhatsapp').href = `https://wa.me/${contactWa}?text=${encodeURIComponent(`আসসালামু আলাইকুম। ${c.brand.name}-এর পণ্য অর্ডার করতে সহায়তা চাই।`)}`;
    $('contactWhatsapp').addEventListener('click', () => track('contact',{value:0,items:trackingItems()}));
  } else $('contactWhatsapp').hidden = true;
  const fixedEnd = c.hero.offerEndsAt && Number.isFinite(Date.parse(c.hero.offerEndsAt)) ? Date.parse(c.hero.offerEndsAt) : 0;
  const sessionDuration = 0; // শুধুমাত্র প্রকৃত offerEndsAt থাকলেই countdown দেখানো হবে
  let timerTarget = fixedEnd;
  if (!fixedEnd && sessionDuration) {
    const key = `order-visit-timer:${c.brand.name}`;
    try {
      const saved = Number(sessionStorage.getItem(key));
      timerTarget = saved > 0 ? saved : Date.now() + sessionDuration;
      if (!saved) sessionStorage.setItem(key,String(timerTarget));
    } catch { timerTarget = Date.now() + sessionDuration; }
  }
  if (timerTarget) {
    if (fixedEnd) { text('timerTitle','অফার শেষ হতে বাকি'); text('timerIntro','নির্ধারিত শেষ সময় পর্যন্ত কাউন্টডাউন'); }
    else { text('timerTitle','পছন্দের সেটটি বেছে নিন'); text('timerIntro','এই পেজে আপনার ভিজিটের সময়'); }
    const tick = () => {
      const left = Math.max(0,timerTarget-Date.now());
      text('timerDays',String(Math.floor(left/86400000)).padStart(2,'0'));
      text('timerHours',String(Math.floor(left/3600000)%24).padStart(2,'0'));
      text('timerMinutes',String(Math.floor(left/60000)%60).padStart(2,'0'));
      text('timerSeconds',String(Math.floor(left/1000)%60).padStart(2,'0'));
      if (!left) { clearInterval(timerInterval); text('timerIntro',fixedEnd ? 'নির্ধারিত অফারের সময় শেষ হয়েছে' : 'সময় শেষ হলেও স্বাভাবিকভাবে অর্ডার করতে পারবেন'); }
    };
    const timerInterval=setInterval(tick,1000); tick();
  } else $('countdown').hidden=true;
  const reviews = Array.isArray(c.reviews) ? c.reviews.filter(r => r.image) : [];
  $('reviewEmpty').hidden = reviews.length > 0; $('reviewControls').hidden = reviews.length < 2;
  $('reviewList').innerHTML = reviews.map((r,i) => `<article class="review-card"><button type="button" data-review="${i}" aria-label="রিভিউ ${i+1} বড় করে দেখুন"><img src="${escape(r.image)}" alt="${escape(r.alt || 'গ্রাহকের রিভিউ স্ক্রিনশট')}" width="300" height="310" loading="lazy" decoding="async"><span class="review-foot"><span>গ্রাহকের মেসেজ ${i+1}</span><span aria-hidden="true">↗</span></span></button></article>`).join('');
  const reviewPhone = String(c.order.whatsappNumber || '').replace(/\D/g,'');
  if (/^\d{11,15}$/.test(reviewPhone)) $('reviewWhatsapp').href=`https://wa.me/${reviewPhone}?text=${encodeURIComponent('আসসালামু আলাইকুম। আমার কেনাকাটার অভিজ্ঞতা শেয়ার করতে চাই।')}`;
  else $('reviewWhatsapp').hidden=true;
  let activeReview=0, reviewZoomed=false;
  const openReview = i => { if(!reviews.length)return; activeReview=(i+reviews.length)%reviews.length; const r=reviews[activeReview]; $('reviewFull').src=r.image; $('reviewFull').alt=r.alt || 'গ্রাহকের রিভিউ স্ক্রিনশট'; text('reviewLightCount',`${String(activeReview+1).padStart(2,'0')} / ${String(reviews.length).padStart(2,'0')}`); reviewZoomed=false; $('reviewFull').classList.remove('is-zoomed'); $('reviewDialog').showModal(); };
  $('reviewList').onclick = e => { const b=e.target.closest('[data-review]'); if (!b) return; stopReviewAuto(); openReview(Number(b.dataset.review)); };
  $('reviewClose').onclick=()=>$('reviewDialog').close();
  $('reviewDialog').onclick=e=>{ if (e.target===$('reviewDialog')) $('reviewDialog').close(); };
  $('reviewLightPrev').onclick=()=>openReview(activeReview-1); $('reviewLightNext').onclick=()=>openReview(activeReview+1);
  $('reviewZoom').onclick=()=>{reviewZoomed=!reviewZoomed;$('reviewFull').classList.toggle('is-zoomed',reviewZoomed)};
  $('reviewFull').ondblclick=()=>$('reviewZoom').click();
  let reviewAuto;
  const reviewPosition = () => { const list=$('reviewList'), cards=[...list.querySelectorAll('.review-card')]; if(!cards.length)return 0; const center=list.getBoundingClientRect().left+list.clientWidth/2; let best=0,dist=Infinity; cards.forEach((card,i)=>{const r=card.getBoundingClientRect(),d=Math.abs((r.left+r.width/2)-center);if(d<dist){dist=d;best=i}}); return best; };
  const moveReview = step => {
    const list=$('reviewList'), cards=[...list.querySelectorAll('.review-card')];
    if (!cards.length) return;
    const next=(reviewPosition()+step+cards.length)%cards.length;
    const card=cards[next];
    // Horizontal-only movement. scrollIntoView can move the whole document vertically.
    const target=card.offsetLeft - (list.clientWidth-card.offsetWidth)/2;
    list.scrollTo({left:Math.max(0,target),behavior:'smooth'});
  };
  $('reviewPrev').onclick=()=>moveReview(-1); $('reviewNext').onclick=()=>moveReview(1);
  const updateReviewCount=()=>{
    const pos=reviews.length ? Math.max(0,Math.min(reviews.length-1,reviewPosition())) : 0; activeReview=pos;
    text('reviewCount',reviews.length ? `${String(pos+1).padStart(2,'0')}  OF  ${String(reviews.length).padStart(2,'0')}` : '');
    const cards=[...$('reviewList').querySelectorAll('.review-card')];
    cards.forEach((card,i)=>{ const d=i-pos; card.classList.toggle('is-active',d===0); card.classList.toggle('is-prev',d===-1); card.classList.toggle('is-next',d===1); card.classList.toggle('is-far',Math.abs(d)>1); card.style.setProperty('--review-distance',String(Math.min(3,Math.abs(d)))); });
    const bar=$('reviewProgressBar'); if(bar) bar.style.width=reviews.length ? `${((pos+1)/reviews.length)*100}%` : '0%';
  };
  let reviewScrollRAF;
  $('reviewList').addEventListener('scroll',()=>{cancelAnimationFrame(reviewScrollRAF);reviewScrollRAF=requestAnimationFrame(updateReviewCount)},{passive:true}); updateReviewCount();
  $('reviewList').addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();$('reviewList').scrollBy({left:e.deltaY*.8,behavior:'auto'});stopReviewAuto();}}, {passive:false});
  document.addEventListener('keydown',e=>{if(!$('reviewDialog').open)return;if(e.key==='ArrowLeft')openReview(activeReview-1);if(e.key==='ArrowRight')openReview(activeReview+1);if(e.key==='Escape')$('reviewDialog').close();});
  if ('IntersectionObserver' in window) {
    const seen=new Set(); const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return; const p=products.find(x=>x.id===entry.target.dataset.product);
      if(p && !seen.has(p.id)){seen.add(p.id);track('view_item',{value:priceFor(p),items:[{item_id:p.id,item_name:p.name,price:priceFor(p),quantity:1}]});observer.unobserve(entry.target);}
    }),{threshold:.45});
    requestAnimationFrame(()=>document.querySelectorAll('#productList [data-product]').forEach(card=>observer.observe(card)));
  }
  function stopReviewAuto(){ clearInterval(reviewAuto); reviewAuto=undefined; }
  function startReviewAuto(){ stopReviewAuto(); if(!reviewsVisible || reviews.length<2 || document.hidden || $('reviewDialog').open || window.matchMedia('(prefers-reduced-motion: reduce)').matches || $('reviews').matches(':hover,:focus-within')) return; reviewAuto=setInterval(()=>moveReview(1),4500); }
  $('reviews').addEventListener('mouseenter',stopReviewAuto); $('reviews').addEventListener('mouseleave',startReviewAuto);
  $('reviews').addEventListener('focusin',stopReviewAuto); $('reviews').addEventListener('focusout',()=>setTimeout(startReviewAuto,0));
  $('reviewDialog').addEventListener('close',startReviewAuto);
  $('reviewList').addEventListener('pointerdown',stopReviewAuto);
  $('reviewList').addEventListener('pointerup',()=>setTimeout(startReviewAuto,1200));
  document.addEventListener('visibilitychange',()=>document.hidden?stopReviewAuto():startReviewAuto()); startReviewAuto();
  $('productList').innerHTML = products.map(p => `<article class="product${productInStock(p)?'':' out-of-stock'}" data-product="${p.id}"><input class="product-check" type="checkbox" id="p-${p.id}" aria-label="${escape(p.name)} নির্বাচন" ${productInStock(p)?'':'disabled'}><label class="product-head" for="p-${p.id}"><span class="product-copy"><span class="product-eyebrow">${escape(c.brand.name.toUpperCase())} COLLECTION</span><strong class="product-name">${escape(p.name)}</strong><span class="product-details">${escape(p.details)}</span><span class="sale" data-product-price>${money(priceFor(p))}</span><span class="stock-status">${productInStock(p)?'✓ স্টকে আছে':'স্টক শেষ'}</span><span class="select-action"><span class="select-icon" aria-hidden="true">✓</span><span class="select-label">${productInStock(p)?'এই পণ্যটি বেছে নিন':'বর্তমানে পাওয়া যাচ্ছে না'}</span><span aria-hidden="true">↗</span></span></span><img src="${escape(displaySrc(p.image))}" alt="${escape(p.name)}" width="118" height="190" loading="lazy" decoding="async"></label><div class="choices">${p.variants?.length>1 ? `<div class="variant-label">কালার / ভ্যারিয়েন্ট</div><div class="variant-row">${p.variants.map((v,vi)=>`<button type="button" class="variant-chip ${vi===0?'active':''}" data-variant="${escape(v.id)}"><span class="variant-swatch" style="background:${escape(v.swatch||'#777')}"></span>${escape(v.name||v.id)}</button>`).join('')}</div>`:''}${p.sizes?.length ? `<div class="choice-label">আপনার সাইজ</div><div class="size-row">${p.sizes.map(size => `<button type="button" data-size="${escape(size)}" aria-pressed="false" ${sizeInStock(p,size)?'':`disabled title="স্টক শেষ"`}>${escape(size)}″${sizeInStock(p,size)?'':' ✕'}</button>`).join('')}</div>` : ''}<div class="choice-label">পরিমাণ <small>(সর্বোচ্চ ${Math.max(1,Number(p.maxQty)||5)})</small></div><div class="qty"><button type="button" data-step="-1" aria-label="${escape(p.name)} কমান">−</button><span class="quantity">1</span><button type="button" data-step="1" aria-label="${escape(p.name)} বাড়ান">+</button></div></div></article>`).join('');
  $('productList').addEventListener('change', e => { if (e.target.type !== 'checkbox') return; const card = e.target.closest('[data-product]'); selected[card.dataset.product].active = e.target.checked; saveDraft(); card.classList.toggle('selected', e.target.checked); card.querySelector('.select-label').textContent=e.target.checked?'নির্বাচিত হয়েছে':'এই পণ্যটি বেছে নিন'; update(); if(e.target.checked){const p=products.find(x=>x.id===card.dataset.product);track('add_to_cart',{value:priceFor(p),items:[{item_id:p.id,item_name:p.name,price:priceFor(p),quantity:1}]});} });
  $('productList').addEventListener('click', e => {
    const b = e.target.closest('button'), card = b?.closest('[data-product]'); if (!card) return;
    const item = selected[card.dataset.product]; const p=products.find(x=>x.id===card.dataset.product);
    if (b.dataset.variant !== undefined) { item.variant=b.dataset.variant; item.size=''; card.querySelectorAll('[data-variant]').forEach(x=>x.classList.toggle('active',x===b)); const v=variantFor(p); const img=card.querySelector('.product-head img'); if(img&&v?.image)img.src=v.image; const priceEl=card.querySelector('[data-product-price]'); if(priceEl)priceEl.textContent=money(priceFor(p)); card.querySelectorAll('[data-size]').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-pressed','false');x.disabled=!sizeInStock(p,x.dataset.size);x.title=x.disabled?'স্টক শেষ':'';}); }
    if (b.dataset.size !== undefined && !b.disabled) { item.size = b.dataset.size; card.querySelectorAll('[data-size]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); }
    item.qty = Math.min(maxQtyFor(p,item.size),Math.max(1,item.qty + (b.dataset.step ? Number(b.dataset.step) : 0)));
    card.querySelector('.quantity').textContent = item.qty;
    saveDraft(); update();
  });
  $('deliveryOptions').innerHTML = areas.map(a => `<label class="delivery-option"><input type="radio" name="area_choice" value="${a.id}"><span class="delivery-copy"><span class="delivery-name">${escape(a.label)}</span><span class="delivery-price">ডেলিভারি চার্জ ${money(a.charge)}</span></span><span class="delivery-switch" aria-hidden="true"><span></span></span></label>`).join('');
  $('deliveryOptions').addEventListener('change',()=>{saveDraft();update();});
  const social=$('socialLinks');
  for(const [label,url] of [['Facebook',c.brand.facebookUrl],['TikTok',c.brand.tiktokUrl]]) {
    if(!/^https:\/\//.test(String(url||'')))continue;
    const a=document.createElement('a');a.href=url;a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';social.append(a);
  }
  $('agencyLink').textContent = c.brand.agencyName || c.brand.name;
  if (c.brand.agencyUrl) $('agencyLink').href=c.brand.agencyUrl;
  else $('agencyLink').removeAttribute('href');
  text('submit', c.order.mode === 'whatsapp' ? 'WhatsApp-এ অর্ডার পাঠান' : c.order.mode === 'copy' ? 'অর্ডারের তথ্য প্রস্তুত করুন' : 'অর্ডার কনফার্ম করুন');
  for (const id of ['name','address']) $(id).addEventListener('input',()=>{saveDraft();update();});
  $('phone').addEventListener('input',()=>{ const n=normalizePhone($('phone').value); if(n!==$('phone').value)$('phone').value=n; saveDraft();update(); });
  $('phone').addEventListener('blur',()=>{ $('phone').value=normalizePhone($('phone').value); saveDraft();update(); });
  let checkoutTracked=false;
  $('order').addEventListener('focusin',()=>{if(checkoutTracked || !products.some(p=>selected[p.id].active))return;checkoutTracked=true;const v=update();track('begin_checkout',{value:v.total,items:trackingItems()});});
  function update() {
    const picked = products.filter(p => selected[p.id].active);
    const subtotal = picked.reduce((sum,p) => sum+priceFor(p)*selected[p.id].qty, 0);
    const area = areas.find(a => a.id === document.querySelector('[name="area_choice"]:checked')?.value) || null;
    const baseCharge = picked.length && area ? area.charge : 0; const freeAt=Math.max(0,Number(c.order.freeShippingThreshold)||0); const charge=freeAt&&subtotal>=freeAt?0:baseCharge; let discount=0; const code=String($('coupon')?.dataset.applied||'').toUpperCase(); const coupon=(c.order.coupons||[]).find(x=>String(x.code||'').toUpperCase()===code); if(coupon){discount=coupon.type==='percent'?Math.round(subtotal*Math.min(100,Math.max(0,Number(coupon.value)||0))/100):Math.max(0,Number(coupon.value)||0);discount=Math.min(subtotal,discount)}
    $('selectedText').innerHTML = picked.map(p => `${escape(p.name)}${variantFor(p) ? ` - ${escape(variantFor(p).name||variantFor(p).id)}` : ''}${selected[p.id].size ? ` - সাইজ: ${escape(selected[p.id].size)}` : ''} - ${selected[p.id].qty}টি - ${money(priceFor(p)*selected[p.id].qty)}`).join('<br>') || 'কমপক্ষে একটি পণ্য নির্বাচন করুন';
    text('subtotal',money(subtotal)); text('delivery',charge===0&&baseCharge>0?'ফ্রি':money(charge)); if($('discountRow')){$('discountRow').hidden=!discount;text('discount','− '+money(discount))} text('total',money(Math.max(0,subtotal+charge-discount)));
    const missingSize = picked.some(p => p.sizes?.length && (!p.sizes.includes(selected[p.id].size) || !sizeInStock(p,selected[p.id].size)));
    products.forEach(p=>document.querySelector(`[data-product="${p.id}"]`)?.classList.toggle('missing-size',selected[p.id].active && !!p.sizes?.length && !selected[p.id].size));
    const validDetails = $('name').value.trim() && $('address').value.trim() && /^01\d{9}$/.test(normalizePhone($('phone').value));
    const validArea = !!area;
    const validChannel = c.order.mode !== 'whatsapp' || /^\d{11,15}$/.test(c.order.whatsappNumber || '');
    $('submit').disabled = submitting || !picked.length || missingSize || !validDetails || !validArea || !validChannel;
    text('hint', !picked.length ? 'কমপক্ষে একটি পণ্য নির্বাচন করুন' : missingSize ? 'নির্বাচিত পণ্যের সাইজ বেছে নিন' : !validDetails ? 'নাম, ঠিকানা ও সঠিক ফোন নম্বর লিখুন' : !validArea ? 'ডেলিভারি এরিয়া নির্বাচন করুন' : !validChannel ? 'WhatsApp নম্বর সেট করা হয়নি' : c.order.paymentText);
    const qtyCount=picked.reduce((n,p)=>n+selected[p.id].qty,0); text('mobileCartCount',qtyCount?`${qtyCount}টি পণ্য নির্বাচিত`:'পণ্য বাছাই করুন'); text('mobileCartTotal',money(Math.max(0,subtotal+charge-discount)));
    return { picked, subtotal, charge, discount, total: Math.max(0,subtotal+charge-discount), area }; 
  }
  function saveDraft(){ try { const area=document.querySelector('[name="area_choice"]:checked')?.value||''; localStorage.setItem(DRAFT_KEY,JSON.stringify({time:Date.now(),name:$('name').value,address:$('address').value,phone:$('phone').value,area,selected})); } catch {} }
  function restoreDraft(){ try { const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null'); if(!d || Date.now()-d.time>7*86400000)return; $('name').value=d.name||''; $('address').value=d.address||''; $('phone').value=normalizePhone(d.phone||''); if(d.area)document.querySelector(`[name="area_choice"][value="${CSS.escape(d.area)}"]`)?.click(); for(const p of products){const saved=d.selected?.[p.id];if(!saved||!productInStock(p))continue;const item=selected[p.id];item.active=!!saved.active;item.variant=(p.variants?.some(v=>v.id===saved.variant)?saved.variant:(p.variants?.[0]?.id||''));item.size=p.sizes?.includes(saved.size)&&sizeInStock(p,saved.size)?(saved.size||''):'';item.qty=Math.min(maxQtyFor(p,item.size),Math.max(1,Math.floor(Number(saved.qty)||1)));const card=document.querySelector(`[data-product="${p.id}"]`);const cb=card?.querySelector('.product-check');if(cb){cb.checked=item.active;card.classList.toggle('selected',item.active);card.querySelector('.select-label').textContent=item.active?'নির্বাচিত হয়েছে':'এই পণ্যটি বেছে নিন';card.querySelector('.quantity').textContent=item.qty;card.querySelectorAll('[data-variant]').forEach(b=>b.classList.toggle('active',b.dataset.variant===item.variant));const variant=variantFor(p);if(variant?.image)card.querySelector('.product-head img').src=variant.image;card.querySelector('[data-product-price]').textContent=money(priceFor(p));card.querySelectorAll('[data-size]').forEach(b=>{const on=b.dataset.size===item.size;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));b.disabled=!sizeInStock(p,b.dataset.size);b.title=b.disabled?'স্টক শেষ':'';});}} } catch {} }
  if($('applyCoupon')) $('applyCoupon').onclick=()=>{const raw=$('coupon').value.trim().toUpperCase(), found=(c.order.coupons||[]).find(x=>String(x.code||'').toUpperCase()===raw); $('coupon').dataset.applied=found?raw:''; $('couponMessage').textContent=found?'✓ কুপন প্রয়োগ হয়েছে':(raw?'কুপনটি সঠিক নয়':''); $('couponMessage').className='field-help '+(found?'success':'error'); update();};
  $('mobileCartButton').onclick=()=>{ const v=update(); document.querySelector(v.picked.length?'#orderForm':'#products').scrollIntoView({behavior:'smooth',block:'start'}); };
  restoreDraft(); saveDraft();
  const supportNumber = String(c.order.whatsappNumber || '').replace(/\D/g, '');
  if (!/^\d{11,15}$/.test(supportNumber)) $('supportWhatsapp').closest('.support').hidden = true;
  else $('supportWhatsapp').addEventListener('click', () => {
    const v = update();
    const items = v.picked.map(p => `${p.name}${selected[p.id].size ? ` (সাইজ ${selected[p.id].size}″)` : ''} × ${selected[p.id].qty}`).join(', ');
    const message = v.picked.length
      ? `আসসালামু আলাইকুম। অর্ডার করতে সহায়তা চাই।\nপণ্য: ${items}\nডেলিভারি এলাকা: ${v.area?.label || 'নির্বাচন করা হয়নি'}\nআনুমানিক মোট: ${money(v.total)}\nঅনুগ্রহ করে অর্ডারটি নিশ্চিত করতে সাহায্য করুন।`
      : `আসসালামু আলাইকুম। ${c.brand.name}-এর পণ্য অর্ডার করতে সহায়তা চাই।`;
    $('supportWhatsapp').href = `https://wa.me/${supportNumber}?text=${encodeURIComponent(message)}`;
    track('contact',{value:v.picked.length?v.total:0,items:trackingItems()});
  });
  async function submitToAdmin(v, eventId, signature) {
    const trackingSnapshot = trackingItems();
    const apiUrl = String(c.order.apiUrl || '');
    if (apiUrl !== '/api/order' && !/^https:\/\/script\.google\.com\/macros\/s\//.test(apiUrl)) throw new Error('অর্ডার API URL সেট করা হয়নি।');
    const fields = new URLSearchParams();
    const quantity = v.picked.reduce((n,p)=>n+selected[p.id].qty,0);
    const host = location.hostname, site = window.WEBZO_SITE?.slug || 'main';
    const detail = v.picked.map(p=>`${p.name} [${p.id}]${selected[p.id].size?' | Size '+selected[p.id].size:''}${variantFor(p)?' | '+(variantFor(p).name||variantFor(p).id):''} × ${selected[p.id].qty}`);
    const timestamp = Date.now();
    if (timestamp-orderPageTime>25*60*1000) orderPageTime=timestamp-5000;
    for (const [key,value] of Object.entries({RecordType:'Order',SiteTs:String(orderPageTime),_hp:document.querySelector('[name="bot-field"]').value,Name:$('name').value.trim(),Phone:$('phone').value,Address:$('address').value.trim(),District:v.area.id==='inside'?'Dhaka':v.area.label,Quantity:String(quantity),Total:String(v.total),Design:detail.join('\n'),EventID:eventId,EventTime:String(Math.floor(timestamp/1000)),PaymentMethod:'Cash On Delivery',SpecialNotes:`Landing page: ${site} (${host}); ${detail.join('; ')}; delivery: ${v.area.label} ${v.charge}; discount: ${v.discount}`,CartJSON:JSON.stringify(v.picked.map(p=>({id:p.id,name:p.name,qty:selected[p.id].qty,price:priceFor(p),size:selected[p.id].size,variant:variantFor(p)?.id||''})))})) fields.set(key,value);
    const cookie = key => document.cookie.split('; ').find(part => part.startsWith(key+'='))?.slice(key.length+1) || '';
    fields.set('FBP',cookie('_fbp').slice(0,200));
    fields.set('FBC',(cookie('_fbc') || (window.landingAttribution?.fbclid ? `fb.1.${timestamp}.${window.landingAttribution.fbclid}` : '')).slice(0,300));
    fields.set('TTCLID',(window.landingAttribution?.ttclid||'').slice(0,300));
    fields.set('TTP',cookie('_ttp').slice(0,200));
    fields.set('Site',site); fields.set('DeliveryArea',v.area.id); fields.set('Coupon',String($('coupon')?.dataset.applied||''));
    fields.set('EventSourceUrl',location.href);
    detail.forEach((line,i)=>fields.set(`Product_${i+1}`,line));
    v.picked.slice(0,12).forEach((p,i)=>fields.set(`Image_${i+1}`,new URL(variantFor(p)?.image||p.image,location.href).href));
    const response=await fetch(apiUrl,{method:'POST',body:fields,mode:'cors',credentials:apiUrl==='/api/order'?'same-origin':'omit',cache:'no-store'});
    const result=(await response.text()).trim();
    if (!response.ok || !result.startsWith('Success|')) throw new Error(result.startsWith('Error|')?result.slice(6):'অর্ডার নিশ্চিত করা যায়নি। আবার চেষ্টা করুন।');
    const id=result.slice(8).trim();
    if (!id) throw new Error('অর্ডার আইডি পাওয়া যায়নি। অর্ডারের অবস্থা যাচাই করুন।');
    try { sessionStorage.setItem(LAST_REF_KEY,id);sessionStorage.setItem(window.landingPendingKey,JSON.stringify({time:Date.now(),value:v.total,items:trackingSnapshot,event_id:eventId,orderMode:'apps-script'})); } catch {}
    location.assign('/thank-you');
  }
  $('order').addEventListener('submit', e => {
    if (new URLSearchParams(location.search).get('builderPreview') === '1') { e.preventDefault(); text('feedback','এটি বিল্ডার প্রিভিউ; এখানে আসল অর্ডার পাঠানো যাবে না।'); return; }
    if (submitting) { e.preventDefault(); return; }
    const v = update(); if ($('submit').disabled) { e.preventDefault(); return; }
    $('phone').value=normalizePhone($('phone').value);
    const signature=JSON.stringify({phone:$('phone').value,items:v.picked.map(p=>[p.id,selected[p.id].variant,selected[p.id].size,selected[p.id].qty]),area:v.area?.id,total:v.total});
    try { const last=JSON.parse(sessionStorage.getItem(DUP_KEY)||'null'); if(last && last.signature===signature && Date.now()-last.time<60000){e.preventDefault();text('feedback','এই অর্ডারটি ইতিমধ্যে পাঠানো হয়েছে। ১ মিনিট অপেক্ষা করুন।');return;} sessionStorage.setItem(DUP_KEY,JSON.stringify({signature,time:Date.now()})); } catch {}
    $('submit').disabled=true; $('submit').classList.add('is-loading'); $('submit').textContent='অর্ডার পাঠানো হচ্ছে…';
    const items = v.picked.map(p => `${p.name}${selected[p.id].size ? ` - সাইজ: ${selected[p.id].size}` : ''} - ${selected[p.id].qty}টি - ${money(priceFor(p)*selected[p.id].qty)}`).join('; ');
    text('feedback',''); $('brandField').value=c.brand.name; $('itemsField').value=items; $('itemQuantityField').value=String(v.picked.reduce((n,p)=>n+selected[p.id].qty,0)); $('deliveryAreaField').value=v.area.label; $('productTotalField').value=String(v.subtotal); $('deliveryChargeField').value=String(v.charge); $('grandTotalField').value=String(v.total);
    const eventId='MA-'+(window.landingNewEventId?.() || crypto.randomUUID()); $('orderReferenceField').value=eventId; try{sessionStorage.setItem(LAST_REF_KEY,eventId)}catch{}
    const attr=window.landingAttribution||{};
    for(const [field,key] of [['utmSourceField','utm_source'],['utmMediumField','utm_medium'],['utmCampaignField','utm_campaign'],['utmContentField','utm_content'],['utmTermField','utm_term'],['fbclidField','fbclid'],['ttclidField','ttclid']]) $(field).value=attr[key]||'';
    const cookie = key => document.cookie.split('; ').find(part => part.startsWith(key+'='))?.slice(key.length+1) || '';
    const gaCookie = cookie('_ga');
    $('gaClientIdField').value=/^GA\d+\.\d+\.(\d+\.\d+)$/.exec(gaCookie)?.[1] || '';
    $('fbpField').value=cookie('_fbp').slice(0,150);
    $('fbcField').value=(cookie('_fbc') || (attr.fbclid ? `fb.1.${Date.now()}.${attr.fbclid}` : '')).slice(0,250);
    $('ttpField').value=cookie('_ttp').slice(0,150);
    $('browserUaField').value=navigator.userAgent.slice(0,350); $('orderPayloadField').value=JSON.stringify(v.picked.map(p=>({id:p.id,name:p.name,unit_price:priceFor(p),variant:variantFor(p)?.name||variantFor(p)?.id||null,size:selected[p.id].size||null,qty:selected[p.id].qty,line_total:priceFor(p)*selected[p.id].qty}))); 
    orderText = `${c.brand.name} — অর্ডারের অনুরোধ\nঅর্ডার আইডি: ${eventId}\nনাম: ${$('name').value.trim()}\nফোন: ${$('phone').value.trim()}\nঠিকানা: ${$('address').value.trim()}\nপণ্য: ${items}\nডেলিভারি: ${v.area.label}\nপণ্য মূল্য: ${money(v.subtotal)}\nডেলিভারি চার্জ: ${money(v.charge)}\nসর্বমোট: ${money(v.total)}\nপেমেন্ট: ${c.order.paymentText}`;
    if (c.order.mode === 'apps-script') {
      e.preventDefault();
      submitting = true;
      submitToAdmin(v,eventId,signature).catch(err=>{submitting=false;try{sessionStorage.removeItem(DUP_KEY)}catch{} $('submit').classList.remove('is-loading');$('submit').textContent='অর্ডার কনফার্ম করুন';update();text('feedback',err instanceof TypeError?'সার্ভারের সঙ্গে যোগাযোগ করা যায়নি। ইন্টারনেট ও API সেটিংস যাচাই করে আবার চেষ্টা করুন।':String(err.message||err));});
      return;
    }
    if (c.order.mode === 'netlify') {
      if (location.protocol === 'file:' || ['localhost','127.0.0.1'].includes(location.hostname)) { e.preventDefault(); $('submit').disabled=false; $('submit').classList.remove('is-loading'); text('submit','অর্ডার কনফার্ম করুন'); text('feedback','লোকাল প্রিভিউতে অর্ডার জমা হবে না। Netlify-তে প্রকাশ করে Forms চালু করুন।'); }
      else try { saveDraft(); sessionStorage.setItem(window.landingPendingKey,JSON.stringify({time:Date.now(),value:v.total,items:trackingItems(),event_id:eventId,orderMode:'netlify'})); } catch {}
      return;
    }
    e.preventDefault();
    if (c.order.mode === 'whatsapp') { $('submit').disabled=false; $('submit').classList.remove('is-loading'); text('submit','WhatsApp-এ অর্ডার পাঠান'); track('contact',{value:v.total,items:trackingItems()}); window.open(`https://wa.me/${c.order.whatsappNumber}?text=${encodeURIComponent(orderText)}`,'_blank','noopener,noreferrer'); text('feedback','WhatsApp-এ Send চাপলে অর্ডার পাঠানো হবে।'); }
    else { $('submit').disabled=false; $('submit').classList.remove('is-loading'); text('submit','অর্ডারের তথ্য প্রস্তুত করুন'); $('copy').style.display='block'; text('feedback','অর্ডারের তথ্য প্রস্তুত। নিচে কপি করুন।'); }
  });
  $('copy').onclick = async () => { try { await navigator.clipboard.writeText(orderText); text('feedback','অর্ডারের তথ্য কপি হয়েছে।'); } catch { text('feedback','কপি করা যায়নি। আবার চেষ্টা করুন।'); } };
  update();
})();

// SMART PRO v4 quick-buy bridge: keeps hero purchase action synced with the first catalog product.
(() => {
  const c=window.LANDING_CONFIG, p=c?.products?.[0]; if(!p)return;
  const $=id=>document.getElementById(id), money=v=>'৳'+new Intl.NumberFormat('bn-BD').format(v);
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  if($('quickBuyName')) $('quickBuyName').textContent=p.name;
  if($('quickBuyDetails')) $('quickBuyDetails').textContent=p.details||c.hero.caption||'';
  if($('quickBuyPrice')) $('quickBuyPrice').textContent=money(Number(p.variants?.[0]?.price ?? p.price)||0);
  const sizes=$('quickBuySizes'), wrap=$('quickBuySizeWrap');
  if(!p.sizes?.length){ if(wrap)wrap.hidden=true; }
  else if(sizes){ sizes.innerHTML=p.sizes.map(x=>`<button type="button" data-qsize="${esc(x)}">${esc(x)}″</button>`).join(''); }
  let chosen='';
  sizes?.addEventListener('click',e=>{const b=e.target.closest('[data-qsize]');if(!b)return;chosen=b.dataset.qsize;sizes.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));});
  $('quickBuyCta')?.addEventListener('click',()=>{
    const card=document.querySelector(`[data-product="${CSS.escape(p.id)}"]`); if(!card)return;
    const cb=card.querySelector('.product-check'); if(cb&&!cb.checked)cb.click();
    if(chosen){const sb=[...card.querySelectorAll('[data-size]')].find(x=>x.dataset.size===chosen&&!x.disabled);sb?.click();}
    card.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>document.getElementById('orderForm')?.scrollIntoView({behavior:'smooth',block:'start'}),450);
  });
  const wa=String(c.order?.whatsappNumber||'').replace(/\D/g,'');
  if(/^\d{11,15}$/.test(wa)&&$('quickBuyWhatsapp')) $('quickBuyWhatsapp').href=`https://wa.me/${wa}?text=${encodeURIComponent(`আসসালামু আলাইকুম। ${c.brand.name}-এর ${p.name} সম্পর্কে জানতে চাই।`)}`;
})();
