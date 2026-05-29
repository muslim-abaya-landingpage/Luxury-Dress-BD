let currentIdx = 0;
let autoSlideInterval;
let isAutoSlideActive = true;
let checkoutTracked = false;
let cart = {};
const fallbackProducts = [
    { id: 'DR-01', name: 'Baby Pink Floral', img: 'images/Baby-Pink-Floral-Print.jpeg', price: 550 },
    { id: 'DR-08', name: 'Black Base Rose', img: 'images/Black-Base-Rose-Floral.jpeg', price: 550 },
    { id: 'DR-16', name: 'Black White Polka', img: 'images/Black-White-Polka-Dots.jpeg', price: 550 },
    { id: 'DR-23', name: 'Royal Blue Golden', img: 'images/Royal-Blue-Golden-Floral-Print.jpeg', price: 550 },
    { id: 'DR-28', name: 'Pink Floral Printed Co-ord Set', img: 'images/pink-floral-printed-co-ord-set.jpeg', price: 550 }
];
let products = fallbackProducts.slice();

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
                    name: String(p.name || 'Product').trim(),
                    img: img,
                    price: parseFloat(p.price) || 550,
                    category: key,
                    categoryLabel: catLabel,
                    categoryPath: catPath
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
function trackFB(event, data) {
    if (typeof pushTrackingEvent === 'function') {
        pushTrackingEvent(event, data || {});
    } else {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({ event: event }, data || {}));
    }
}
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

function initHomeCartFromStorage() {
    var fresh = {};
    products.forEach(function (p) { fresh[p.id] = 0; });

    var lines = typeof loadStoreCart === 'function' ? loadStoreCart({ readOnly: true }) : [];
    if (lines.length) {
        lines.forEach(function (line) {
            var qty = parseInt(line.quantity, 10) || 0;
            if (qty <= 0) return;
            var match = products.find(function (p) {
                return (line.id && p.id === line.id) ||
                    (line.name && p.name && String(p.name).trim() === String(line.name).trim());
            });
            if (match) {
                fresh[match.id] = (fresh[match.id] || 0) + qty;
            }
        });
    }
    cart = fresh;
    if (homeCartHasItems()) {
        markHomeCartActive();
    } else {
        clearHomeCartSession();
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
}

function applyStoreLinesToHomeCart(lines) {
    var fresh = {};
    products.forEach(function (p) { fresh[p.id] = 0; });
    (lines || []).forEach(function (line) {
        var match = products.find(function (p) {
            return (line.id && p.id === line.id) || p.name === line.name;
        });
        if (match) fresh[match.id] = Math.max(0, parseInt(line.quantity, 10) || 0);
    });
    cart = fresh;
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
    var lines = e.detail && e.detail.lines;
    if (!Array.isArray(lines)) return;
    applyStoreLinesToHomeCart(lines);
});
window.onload = function() {
    hydrateHomeProducts();
    initHomeCartFromStorage();
    renderSidebar();
    if (products.length) selectProduct(0, products[0].id, false, { animate: false });
    startAutoSlide();
    calc();
    window.setTimeout(function () {
        trackFB('ViewContent', { content_type: 'product', currency: 'BDT' });
    }, 3500);
};

// কার্টে প্রোডাক্ট যোগ এবং মেমোরিতে (localStorage) সেভ করার ফাংশন
function addToCart(productId) {
    toggleProductCart(productId);
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
    const toast = document.getElementById('cartToast');
    if (toast && getCartQty(productId) >= 1) {
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }
    calc(false);
}
function addProductSelection(productId) {
    toggleProductCart(productId);
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
    if (getCartQty(productId) < 1) cart[productId] = 1;
    syncHomeCartAfterChange();
    goToCheckoutPage();
}
function trackInitiateCheckout() {
    if (!checkoutTracked) {
        trackFB('InitiateCheckout', { currency: 'BDT' });
        checkoutTracked = true;
    }
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
card.innerHTML = `
    <div style="position: relative; overflow: hidden; border-radius: 8px;">
        <span class="product-sale-badge">Sale!</span>
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
        
        <img class="home-product-thumb" src="${thumbImg}" onclick="manualSelect(${i}, '${p.id}')" alt="${p.name}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg';">
    </div>

    <div class="product-info">
        <div class="product-meta-row">
            <span class="product-card-name" lang="en">${p.name}</span>
            <span class="product-card-price">${"\u09F3"}${p.price}</span>
        </div>
        <div class="product-actions-anzaar">
            <div class="home-card-qty" style="display:${inCart ? 'flex' : 'none'};align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
                <button type="button" class="qty-btn" aria-label="পরিমাণ কমান" onclick="event.stopPropagation();updateQty('${p.id}', -1)">−</button>
                <span class="qty-input" style="min-width:28px;text-align:center;font-weight:700;">${qty}</span>
                <button type="button" class="qty-btn" aria-label="পরিমাণ বাড়ান" onclick="event.stopPropagation();updateQty('${p.id}', 1)">+</button>
            </div>
            <div class="product-actions-row">
                <button type="button" class="anzaar-btn anzaar-btn-cart${inCart ? ' is-active' : ''}"
                    onclick="event.stopPropagation();toggleProductCart('${p.id}')">
                    ${inCart ? 'Remove' : 'Add to Cart'}
                </button>
                <button type="button" class="anzaar-btn anzaar-btn-buy" onclick="buyNowFromCard('${p.id}', event)">Buy Now</button>
            </div>
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
    selectProduct(index, id, true);
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

function applyHeroImage(nextImgSrc, animate) {
    if (!viewImg || !nextImgSrc) return;
    if (shouldDeferHeroSwap(nextImgSrc)) return;
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
    applyHeroImage(nextImgSrc, animate);
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
    if (val > 0) { 
        const toast = document.getElementById('cartToast');
        toast.classList.add('show');
        setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }
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
    if (qtyInput) qtyInput.value = cart[id];
    
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
    currentIdx += dir;
    if (currentIdx >= products.length) currentIdx = 0;
    if (currentIdx < 0) currentIdx = products.length - 1;
    selectProduct(currentIdx, products[currentIdx].id, false);
}
function startAutoSlide() {
    autoSlideInterval = setInterval(() => {
        if (isAutoSlideActive) {
            changeProduct(1);
        }
    }, 4000);
}
function showToast() {
    const toast = document.getElementById('cartToast');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
function removeFromCart(productId) {
    if (getCartQty(productId) > 0) {
        cart[productId] = 0;
        syncHomeCartAfterChange();
        renderSidebar();    
        calc(false);             
        const toast = document.getElementById('cartToast');
        toast.querySelector('.toast-text').innerText = "প্রোডাক্টটি সফলভাবে অপসারণ করা হয়েছে।";
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }
}
window.hydrateHomeProducts = hydrateHomeProducts;
window.renderSidebar = renderSidebar;
window.selectProduct = selectProduct;
window.__homeRefreshCatalog = function (opts) {
    opts = opts || {};
    hydrateHomeProducts();
    renderSidebar();
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
