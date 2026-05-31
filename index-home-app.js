let currentIdx = 0;
let autoSlideInterval;
let isAutoSlideActive = true;
let checkoutTracked = false;
let buyNowRedirecting = false;
let homeCartSyncSuppress = false;
let cart = {};
const fallbackProducts = [
    { id: 'DR-01', name: 'Baby Pink Floral', img: 'images/Baby-Pink-Floral-Print.jpeg', price: 550 },
    { id: 'DR-08', name: 'Black Base Rose', img: 'images/Black-Base-Rose-Floral.jpeg', price: 550 },
    { id: 'DR-16', name: 'Black White Polka', img: 'images/Black-White-Polka-Dots.jpeg', price: 550 },
    { id: 'DR-23', name: 'Royal Blue Golden', img: 'images/Royal-Blue-Golden-Floral-Print.jpeg', price: 550 },
    { id: 'DR-28', name: 'Pink Floral Printed Co-ord Set', img: 'images/pink-floral-printed-co-ord-set.jpeg', price: 550 }
];
let products = fallbackProducts.slice();

function homeProductById(productId) {
    return products.find(function (x) { return x.id === productId; }) || null;
}

function toastCartAdded(productId) {
    if (typeof showCartAddedToast !== 'function') return;
    var p = homeProductById(productId);
    showCartAddedToast({
        name: p ? p.name : productId,
        image: p ? (p.img || p.image) : '',
        price: p ? p.price : undefined
    });
}

function isPrimaryShowcaseName(name) {
    var s = String(name || '').toLowerCase();
    return s.indexOf(' - back') === -1 &&
           s.indexOf('- back') === -1 &&
           s.indexOf(' - side') === -1 &&
           s.indexOf('- side') === -1;
}

function normalizeImageKey(url) {
    var u = String(url || '').split('?')[0].split('#')[0];
    try { u = decodeURIComponent(u); } catch (e) {}
    var file = (u.split('/').pop() || u).toLowerCase();
    return file.replace(/[^a-z0-9]/g, '');
}

function resolveHomeImage(p) {
    var raw = p.image || p.img || '';
    if (window.maCatalog && typeof window.maCatalog.resolveImageUrl === 'function') {
        return window.maCatalog.resolveImageUrl(raw);
    }
    return raw;
}

function categoryHasProducts(key) {
    if (window.maCatalog && typeof window.maCatalog.categoryHasProducts === 'function') {
        return window.maCatalog.categoryHasProducts(key);
    }
    var list = (window.CATEGORY_PRODUCTS || {})[key];
    return Array.isArray(list) && list.length > 0;
}

function getHomeCategoryKeys() {
    if (window.CATALOG_SECTIONS && window.CATALOG_SECTIONS.length) {
        return window.CATALOG_SECTIONS.filter(function (s) {
            if (s.enabled === false) return false;
            return categoryHasProducts(s.key);
        }).map(function (s) { return s.key; });
    }
    return Object.keys(window.CATEGORY_PRODUCTS || {}).filter(categoryHasProducts);
}

/** প্রোডাক্টে একাধিক অর্ডার-টাইপ আছে কিনা (যেমন আবায়া: Full Set / Abaya Only) */
function homeProductHasTypeChoice(rawProduct, categoryKey) {
    if (rawProduct && rawProduct.priceByType && Object.keys(rawProduct.priceByType).length > 1) return true;
    if (Array.isArray(rawProduct && rawProduct.types) && rawProduct.types.length > 1) return true;
    var defs = window.SITE_LINKS && window.SITE_LINKS.defaults && window.SITE_LINKS.defaults.byCategory;
    var cat = defs && categoryKey && defs[categoryKey];
    if (cat && Array.isArray(cat.types) && cat.types.length > 1) return true;
    if (cat && cat.priceByType && Object.keys(cat.priceByType).length > 1) return true;
    return false;
}

/** টাইপ-যুক্ত প্রোডাক্টের সর্বনিম্ন দাম ("৭৯৯ থেকে" দেখানোর জন্য) */
function homeTypePriceFrom(rawProduct, categoryKey) {
    var map = (rawProduct && rawProduct.priceByType) || null;
    if (!map) {
        var defs = window.SITE_LINKS && window.SITE_LINKS.defaults && window.SITE_LINKS.defaults.byCategory;
        var cat = defs && categoryKey && defs[categoryKey];
        map = cat && cat.priceByType;
    }
    if (map) {
        var vals = Object.keys(map)
            .map(function (k) { return parseInt(map[k], 10) || 0; })
            .filter(function (v) { return v > 0; });
        if (vals.length) return Math.min.apply(null, vals);
    }
    return 0;
}

/** সব ক্যাটাগরি (①–⑧) — রাউন্ড-রবিন; একই ছবি একবার (ডুপ্লিকেট নয়) */
function buildProductsFromCatalog() {
    var all = window.CATEGORY_PRODUCTS || {};
    var catKeys = getHomeCategoryKeys();
    var globalSeen = {};
    var out = [];
    var indices = {};
    var i;
    catKeys.forEach(function (k) { indices[k] = 0; });

    var more = true;
    var safety = 0;
    while (more && safety < 600) {
        more = false;
        safety++;
        for (i = 0; i < catKeys.length; i++) {
            var key = catKeys[i];
            var list = all[key] || [];
            while (indices[key] < list.length) {
                var p = list[indices[key]++];
                if (!p || !p.name || !isPrimaryShowcaseName(p.name)) continue;
                var img = resolveHomeImage(p);
                if (!img) continue;
                var imgKey = normalizeImageKey(img);
                if (globalSeen[imgKey]) continue;
                globalSeen[imgKey] = true;
                var catLabel = key;
                var catPath = '/' + key;
                if (window.CATALOG_SECTIONS) {
                    window.CATALOG_SECTIONS.some(function (s) {
                        if (s.key === key) {
                            catLabel = s.menuBn || s.menu || key;
                            catPath = s.path || catPath;
                            return true;
                        }
                        return false;
                    });
                }
                var baseId = String(p.id || (key + '-' + out.length)).trim();
                var uid = baseId;
                var dupeN = 0;
                while (out.some(function (x) { return x.id === uid; })) {
                    dupeN += 1;
                    uid = baseId + '-v' + dupeN;
                }
                out.push({
                    id: uid,
                    catalogId: baseId,
                    name: String(p.name || 'Product').trim(),
                    img: img,
                    price: parseFloat(p.price) || 550,
                    category: key,
                    categoryLabel: catLabel,
                    categoryPath: catPath,
                    hasTypes: homeProductHasTypeChoice(p, key),
                    typePriceFrom: homeTypePriceFrom(p, key)
                });
                more = true;
                break;
            }
        }
    }
    return out;
}

function hydrateHomeProducts() {
    var fromCatalog = buildProductsFromCatalog();
    if (fromCatalog.length) products = fromCatalog;
}

function homeCategoryHref(p) {
    var route = (p && p.categoryPath) || '/';
    if (typeof window.siteHref === 'function') return window.siteHref(route);
    return route;
}
/* টাইপ-যুক্ত প্রোডাক্ট (যেমন আবায়া) — অর্ডারের আগে বড় ডিটেইল ভিউ খোলে
   যেখানে Full Set / শুধু আবায়া + সাইজ বাছাই করা যায় */
function goToProductDetail(productId, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var p = products.find(function (x) { return x.id === productId; });
    if (!p) return;
    var base = homeCategoryHref(p);
    var detailId = p.catalogId || p.id;
    window.location.href = base + '#p=' + encodeURIComponent(detailId);
}
/* হিরো (বড়) ছবিতে ট্যাপ করলে বর্তমান প্রোডাক্টের ডিটেইল ভিউ খোলে */
function openCurrentProductDetail(ev) {
    var p = products[currentIdx];
    if (!p) return;
    goToProductDetail(p.id, ev);
}
function trackFB(event, data) {
    if (typeof pushTrackingEvent === 'function') {
        pushTrackingEvent(event, data || {});
    } else {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({ event: event }, data || {}));
    }
}

let viewContentFired = false;
function getCurrentHomeProduct() {
    if (!products || !products.length) return null;
    return products[currentIdx] || products[0] || null;
}
function fireHomeViewContent() {
    if (viewContentFired) return;
    viewContentFired = true;
    var p = getCurrentHomeProduct();
    var data = { content_type: 'product', currency: 'BDT' };
    if (p) {
        data.content_ids = [p.id];
        data.content_name = p.name;
        data.value = p.price || 550;
    }
    trackFB('ViewContent', data);
}
// Fire ViewContent early (not gated on heavy media/window.onload) so ad
// visitors register it fast, and include product data for retargeting/DPA.
(function scheduleHomeViewContent() {
    function go() { window.setTimeout(fireHomeViewContent, 1500); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', go, { once: true });
    } else {
        go();
    }
})();
const sidebar = document.getElementById('sidebarList');
const viewImg = document.getElementById('view');
var HOME_CART_SESSION_KEY = 'muslim_abaya_home_cart_active';

function markHomeCartActive() {
    if (typeof markStoreCartSession === 'function') markStoreCartSession();
    else try { sessionStorage.setItem(HOME_CART_SESSION_KEY, '1'); } catch (e) {}
}

function clearHomeCartSession() {
    if (typeof clearStoreCartSession === 'function') clearStoreCartSession();
    else try { sessionStorage.removeItem(HOME_CART_SESSION_KEY); } catch (e) {}
}

function homeCartHasItems() {
    return products.some(function (p) { return getCartQty(p.id) > 0; });
}

function findHomeProductForLine(line) {
    if (!line) return null;
    var lid = String(line.id || '').trim();
    var lname = String(line.name || '').trim().toLowerCase();
    return products.find(function (p) {
        if (!p) return false;
        if (lid && (p.id === lid || p.catalogId === lid)) return true;
        if (lname && String(p.name || '').trim().toLowerCase() === lname) return true;
        return false;
    }) || null;
}

function rebuildCartFromStoreLines(lines) {
    var fresh = {};
    products.forEach(function (p) { fresh[p.id] = 0; });
    (lines || []).forEach(function (line) {
        var match = findHomeProductForLine(line);
        if (!match) return;
        var qty = parseInt(line.quantity, 10) || 0;
        if (qty <= 0) return;
        fresh[match.id] = (fresh[match.id] || 0) + qty;
    });
    cart = fresh;
}

function remapHomeCartFromStore() {
    var lines = typeof loadStoreCart === 'function' ? loadStoreCart({ readOnly: true }) : [];
    rebuildCartFromStoreLines(lines);
    if (homeCartHasItems()) {
        markHomeCartActive();
    } else {
        clearHomeCartSession();
    }
}

function initHomeCartFromStorage() {
    remapHomeCartFromStore();
    if (!homeCartHasItems()) {
        if (typeof refreshCartBadgeUI === 'function') refreshCartBadgeUI([]);
        else if (typeof updateCartBadge === 'function') updateCartBadge([]);
    }
}

function getHomeCartLines() {
    if (typeof buildLinesFromHomeCart === 'function') {
        return buildLinesFromHomeCart(cart, products);
    }
    return products.map(function (p) {
        var qty = getCartQty(p.id);
        if (qty <= 0) return null;
        return { id: p.id, name: p.name, price: p.price, quantity: qty, image: p.img };
    }).filter(Boolean);
}

function syncHomeCartAfterChange() {
    var arr = getHomeCartLines();
    homeCartSyncSuppress = true;
    if (arr.length) {
        markHomeCartActive();
        if (typeof persistStoreCart === 'function') persistStoreCart(arr);
    } else {
        clearHomeCartSession();
        if (typeof clearStoreCart === 'function') clearStoreCart();
    }
    if (typeof afterCartMutation === 'function') {
        afterCartMutation(arr);
    }
    homeCartSyncSuppress = false;
}

function applyStoreLinesToHomeCart(lines) {
    rebuildCartFromStoreLines(lines);
    if (homeCartHasItems()) {
        markHomeCartActive();
    } else {
        clearHomeCartSession();
        if (typeof clearStoreCart === 'function') clearStoreCart();
    }
    renderSidebar();
    calc(false);
}

window.addEventListener('storeCartUpdated', function (e) {
    if (homeCartSyncSuppress) return;
    var lines = e.detail && e.detail.lines;
    if (!Array.isArray(lines)) return;
    applyStoreLinesToHomeCart(lines);
});
window.onload = function() {
    hydrateHomeProducts();
    bindHomeSidebarActions();
    initHomeCartFromStorage();
    renderSidebar();
    if (products.length) selectProduct(0, products[0].id, false, { animate: false });
    startAutoSlide();
    calc();
    // Fallback: ensure ViewContent fires even if the early scheduler missed.
    // Guarded by viewContentFired so it never double-counts.
    window.setTimeout(fireHomeViewContent, 800);
};

// কার্টে প্রোডাক্ট যোগ এবং মেমোরিতে (localStorage) সেভ করার ফাংশন
function addToCart(productId) {
    addToCartFromCard(productId);
}
function syncHomeCartToCheckout() {
    if (typeof persistStoreCart !== 'function') return;
    persistStoreCart(getHomeCartLines());
}
function getCartQty(productId) {
    return parseInt(cart[productId], 10) || 0;
}
function toggleProductCart(productId) {
    if (getCartQty(productId) >= 1) {
        cart[productId] = 0;
    } else {
        cart[productId] = 1;
    }
    syncHomeCartAfterChange();
    renderSidebar();
    if (getCartQty(productId) >= 1) toastCartAdded(productId);
    calc(false);
}
function addProductSelection(productId) {
    addToCartFromCard(productId);
}
function goToCheckoutPage() {
    var lines = getHomeCartLines();
    var pcs = 0;
    lines.forEach(function (line) {
        pcs += parseInt(line.quantity, 10) || 0;
    });
    if (!lines.length || !pcs) {
        alert('অনুগ্রহ করে অন্তত একটি পণ্য কার্টে যোগ করুন।');
        return;
    }
    if (typeof flushStoreCartForCheckout === 'function') {
        flushStoreCartForCheckout(lines);
    } else {
        syncHomeCartToCheckout();
        if (typeof markStoreCartSession === 'function') markStoreCartSession();
    }
    trackInitiateCheckout();
    window.location.href = typeof window.siteHref === 'function' ? window.siteHref('/checkout') : 'checkout.html';
}

function buyNowFromCard(productId, ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (ev && ev.stopPropagation) ev.stopPropagation();
    if (buyNowRedirecting) return;
    buyNowRedirecting = true;
    setTimeout(function () { buyNowRedirecting = false; }, 1200);
    if (getCartQty(productId) < 1) cart[productId] = 1;
    syncHomeCartAfterChange();
    goToCheckoutPage();
}

function addToCartFromCard(productId, ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (ev && ev.stopPropagation) ev.stopPropagation();
    var p = products.find(function (x) { return x.id === productId; });
    if (!p) return;
    var oldQty = getCartQty(productId);
    var line = {
        id: p.catalogId || p.id,
        name: p.name,
        price: parseInt(p.price, 10) || 550,
        quantity: 1,
        image: p.img || p.image || '',
        category: p.category || '',
        categoryLabel: p.categoryLabel || ''
    };
    homeCartSyncSuppress = true;
    if (typeof addOrMergeStoreCartItem === 'function') {
        var existing = typeof loadStoreCart === 'function' ? loadStoreCart({ readOnly: true }) : [];
        var merged = addOrMergeStoreCartItem(existing, line);
        rebuildCartFromStoreLines(merged);
        markHomeCartActive();
        if (typeof afterCartMutation === 'function') afterCartMutation(merged);
    } else {
        cart[productId] = oldQty + 1;
        syncHomeCartAfterChange();
    }
    homeCartSyncSuppress = false;
    if (getCartQty(productId) > oldQty) {
        trackFB('AddToCart', {
            content_ids: [productId],
            content_name: p.name,
            value: p.price || 550,
            currency: 'BDT'
        });
    }
    isAutoSlideActive = false;
    clearInterval(autoSlideInterval);
    renderSidebar();
    calc(false);
    toastCartAdded(productId);
}
function trackInitiateCheckout() {
    if (checkoutTracked) return;
    checkoutTracked = true;
    var data = { currency: 'BDT' };
    var lines = getHomeCartLines();
    if (typeof buildCartTrackingSnapshot === 'function') {
        data = buildCartTrackingSnapshot(lines);
    } else if (lines.length) {
        var value = 0;
        var ids = [];
        lines.forEach(function (l) {
            value += (parseInt(l.price, 10) || 0) * (parseInt(l.quantity, 10) || 1);
            if (l.id) ids.push(String(l.id));
        });
        data.value = value;
        data.order_value = value;
        data.content_ids = ids;
    }
    trackFB('InitiateCheckout', data);
}
function bindHomeSidebarActions() {
    if (!sidebar || sidebar.getAttribute('data-home-cart-bound') === '1') return;
    sidebar.setAttribute('data-home-cart-bound', '1');
    sidebar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-home-cart-action]');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute('data-product-id');
        var action = btn.getAttribute('data-home-cart-action');
        if (!id || !action) return;
        if (action === 'add') addToCartFromCard(id, e);
        else if (action === 'buy') buyNowFromCard(id, e);
    }, true);
}
function renderSidebar() {
    sidebar.innerHTML = '';
    products.forEach((p, i) => {
        const qty = getCartQty(p.id);
        const inCart = qty > 0;
        const card = document.createElement('div');
        card.className = 'item-card' + (i === 0 ? ' active' : '') + (inCart ? ' in-cart' : '');
        card.id = `card-${p.id}`;
        const thumbImg = p.img && p.img.indexOf('/upload/') !== -1
            ? p.img.replace('/upload/', '/upload/f_auto,q_auto,w_200,c_scale/')
            : p.img;
        const orderViaDetail = !!p.hasTypes;
        const priceHtml = orderViaDetail && p.typePriceFrom
            ? `${"\u09F3"}${p.typePriceFrom}`
            : `${"\u09F3"}${p.price}`;
        const qtyStepperHtml = orderViaDetail ? '' : `
            <div class="ma-qty-stepper home-card-qty${inCart ? " is-visible" : ""}" role="group" aria-label="Quantity">
                <button type="button" class="ma-qty-stepper__btn" aria-label="পরিমাণ কমান"${qty <= 1 ? " disabled" : ""} onclick="event.stopPropagation();updateQty('${p.id}', -1)">−</button>
                <span class="ma-qty-stepper__value" id="qty-${p.id}" aria-live="polite">${qty}</span>
                <button type="button" class="ma-qty-stepper__btn" aria-label="পরিমাণ বাড়ান" onclick="event.stopPropagation();updateQty('${p.id}', 1)">+</button>
            </div>`;
        const actionsRowHtml = `<div class="product-actions-row">
                <button type="button" class="anzaar-btn anzaar-btn-cart${inCart ? ' is-active' : ''}" data-home-cart-action="add" data-product-id="${p.id}">Add to Cart</button>
                <button type="button" class="anzaar-btn anzaar-btn-buy" data-home-cart-action="buy" data-product-id="${p.id}">Buy Now</button>
            </div>`;
card.innerHTML = `
    <div style="position: relative; overflow: hidden; border-radius: 8px;">
        <span class="product-sale-badge">Sale</span>
        <button type="button" 
                onclick="removeFromCart('${p.id}')" 
                class="premium-cancel-btn"
                aria-label="কার্ট থেকে সরান"
                style="position: absolute; 
                       top: 10px; 
                       right: 10px; 
                       background: rgba(255, 255, 255, 0.2); 
                       color: #000; 
                       border: 1px solid rgba(255, 255, 255, 0.4); 
                       border-radius: 50%; 
                       width: 35px; 
                       height: 35px; 
                       cursor: pointer; 
                       z-index: 50; 
                       display: ${inCart ? 'flex' : 'none'}; 
                       align-items: center; 
                       justify-content: center; 
                       font-size: 16px; 
                       backdrop-filter: blur(8px); 
                       -webkit-backdrop-filter: blur(8px); 
                       transition: all 0.3s ease;">
            ✕
        </button>
        
        <img class="home-product-thumb" src="${thumbImg}" style="cursor:pointer" onclick="goToProductDetail('${p.id}', event)" alt="${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg';">
    </div>

    <div class="product-info">
        <div class="product-meta-row">
            <span class="product-card-name" lang="en">${p.name}</span>
            <span class="product-card-price">${priceHtml}</span>
        </div>
        <div class="product-actions-anzaar">
            ${qtyStepperHtml}
            ${actionsRowHtml}
            <a href="https://wa.me/8801971642683?text=${encodeURIComponent(p.name + ' অর্ডার করতে চাই')}"
                target="_blank" rel="noopener" class="anzaar-btn anzaar-btn-msg">Send Message</a>
        </div>
    </div>
`;
sidebar.appendChild(card);
});
}
function manualSelect(index, id) {
    isAutoSlideActive = false;
    clearInterval(autoSlideInterval);
    selectProduct(index, id, true, { forceHero: true });
}

function setHomePriceTag(price) {
    const priceEl = document.getElementById('homePriceTag');
    if (!priceEl) return;
    priceEl.textContent = "\u09F3" + price;
}

var LCP_LOCK_MS = 10000;
var lcpLockUntil = Date.now() + LCP_LOCK_MS;

function isRemoteImageUrl(url) {
    return /^https?:\/\//i.test(String(url || ''));
}

function sameImageFile(a, b) {
    function tail(u) {
        try {
            u = decodeURIComponent(String(u || '').split('?')[0].split('#')[0]);
        } catch (e) {}
        return (u.split('/').pop() || u).toLowerCase();
    }
    return tail(a) === tail(b) && tail(a).length > 0;
}

function shouldDeferHeroSwap(nextSrc) {
    if (Date.now() < lcpLockUntil && isRemoteImageUrl(nextSrc)) return true;
    if (viewImg && viewImg.src && sameImageFile(viewImg.src, nextSrc)) return true;
    return false;
}

function applyHeroImage(nextImgSrc, animate, options) {
    options = options || {};
    if (!viewImg || !nextImgSrc) return;
    if (!options.forceHero && shouldDeferHeroSwap(nextImgSrc)) return;
    if (!animate) {
        viewImg.src = nextImgSrc;
        viewImg.classList.remove('fade-out');
        return;
    }
    viewImg.classList.add('fade-out');
    setTimeout(function () {
        viewImg.src = nextImgSrc;
        setTimeout(function () {
            viewImg.classList.remove('fade-out');
        }, 50);
    }, 300);
}

function selectProduct(index, id, shouldScroll, options) {
    options = options || {};
    currentIdx = index;
    const p = products[index];
    if (!p) return;
    setHomePriceTag(p.price);
    const nextImgSrc = p.img && p.img.indexOf('/upload/') !== -1
        ? p.img.replace('/upload/', '/upload/f_auto,q_auto,w_600/')
        : p.img;
    var animate = options.animate !== false;
    applyHeroImage(nextImgSrc, animate, options);
    document.querySelectorAll('.item-card').forEach(el => el.classList.remove('active'));
    const selectedCard = document.getElementById(`card-${id}`);
    if (selectedCard) {
        selectedCard.classList.add('active');
        if(shouldScroll) {
            selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}
function updateQty(id, val) {
    let oldQty = getCartQty(id);
    cart[id] = Math.max(0, oldQty + val);
    if (val > 0) toastCartAdded(id);
    if (cart[id] > oldQty) {
        var p = products.find(function (x) { return x.id === id; });
        trackFB('AddToCart', {
            content_ids: [id],
            content_name: p ? p.name : id,
            value: p ? p.price : 550,
            currency: 'BDT'
        });
    }
    isAutoSlideActive = false; 
    clearInterval(autoSlideInterval); 
    
    const qtyInput = document.getElementById(`qty-${id}`);
    if (qtyInput) {
        if ("value" in qtyInput) qtyInput.value = cart[id];
        else qtyInput.textContent = cart[id];
    }
    
    if (getCartQty(id) > 0) {
        let productIndex = products.findIndex(p => p.id === id);
        if (productIndex !== -1) selectProduct(productIndex, id, true);
    }
    syncHomeCartAfterChange();
    renderSidebar();
    calc(false); 
}
function calc(syncCart) {
    var q = 0;
    products.forEach(function (p) {
        q += getCartQty(p.id);
    });
    updateCartIcon(q);
    if (syncCart !== false) syncHomeCartToCheckout();
}
function goToCheckout(e) {
    if (e && e.preventDefault) e.preventDefault();
    goToCheckoutPage();
}
function openHomeCartDrawer() {
    var btn = document.querySelector('[data-cart-trigger]');
    if (btn) btn.click();
    else if (typeof window.openCartDrawer === 'function') window.openCartDrawer();
}
function updateCartIcon(total) {
    const cartBadge = document.getElementById('cart-count');
    if (cartBadge) {
        if (total > 0) {
            cartBadge.innerText = total;
            cartBadge.style.display = 'block'; 
        } else {
            cartBadge.style.display = 'none';
        }
    }
}
function changeProduct(dir) {
    isAutoSlideActive = false;
    clearInterval(autoSlideInterval);
    currentIdx += dir;
    if (currentIdx >= products.length) currentIdx = 0;
    if (currentIdx < 0) currentIdx = products.length - 1;
    selectProduct(currentIdx, products[currentIdx].id, false, { forceHero: true, animate: true });
}
function startAutoSlide() {
    autoSlideInterval = setInterval(() => {
        if (isAutoSlideActive) {
            changeProduct(1);
        }
    }, 4000);
}
function showToast() {
    var p = products[currentIdx];
    if (typeof showCartAddedToast === 'function' && p) {
        showCartAddedToast({ name: p.name, image: p.img || p.image, price: p.price });
    }
}
function removeFromCart(productId) {
    if (getCartQty(productId) > 0) {
        var p = homeProductById(productId);
        cart[productId] = 0;
        syncHomeCartAfterChange();
        renderSidebar();
        calc(false);
        if (typeof showCartRemovedToast === 'function') {
            showCartRemovedToast({ name: p ? p.name : productId });
        }
    }
}
window.hydrateHomeProducts = hydrateHomeProducts;
window.renderSidebar = renderSidebar;
window.selectProduct = selectProduct;
window.changeProduct = changeProduct;
window.manualSelect = manualSelect;
window.toggleProductCart = toggleProductCart;
window.buyNowFromCard = buyNowFromCard;
window.addToCartFromCard = addToCartFromCard;
window.updateQty = updateQty;
window.goToProductDetail = goToProductDetail;
window.openCurrentProductDetail = openCurrentProductDetail;
window.removeFromCart = removeFromCart;
window.__homeRefreshCatalog = function (opts) {
    opts = opts || {};
    hydrateHomeProducts();
    remapHomeCartFromStore();
    renderSidebar();
    calc(false);
    if (!products.length) return;
    var idx = Math.min(currentIdx, products.length - 1);
    if (opts.deferHero) {
        selectProduct(idx, products[idx].id, false, { animate: false });
        window.setTimeout(function () {
            lcpLockUntil = 0;
            selectProduct(idx, products[idx].id, false, { animate: false });
        }, LCP_LOCK_MS);
    } else {
        selectProduct(idx, products[idx].id, false, { animate: false });
    }
};
