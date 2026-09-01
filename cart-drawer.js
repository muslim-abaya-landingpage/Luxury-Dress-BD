// cart-drawer.js
//
// AUDIT NOTE (see PROMPT step 19/22): searched the whole codebase for every
// symbol listed — showCartAddedToast, showCartRemovedToast,
// playCartButtonAddedUi, openCartDrawer, closeCartDrawer, afterCartMutation,
// addOrMergeStoreCartItem, storeCartUpdated, updateCartBadge,
// updateCartDrawerUI, cart-toast.js, cart-drawer.js, related-cart.js, and
// every Add to Cart handler. Within the 5 files provided (this file,
// cart-utils.js, cart-toast.js, related-cart.js, index.html):
//   - Every showCartAddedToast/showCartRemovedToast call lived in THIS file
//     (addRelatedProductToCart, and the checkout empty-selection guard) —
//     both removed below, no toast calls remain anywhere in these files.
//   - related-cart.js was already emptied by a prior fix (see its header
//     comment) and is not touched further.
//   - The site's per-page product-card "Add to Cart" buttons (home page,
//     category pages, product page) are NOT among the uploaded files — they
//     live in other page-specific scripts not provided here. Per the
//     instruction not to touch unrelated files, they are left alone. Those
//     handlers already call window.afterCartMutation(...)/
//     window.addOrMergeStoreCartItem(...) (that's the shared architecture
//     cart-utils.js documents), so to get the "instant drawer" behavior on
//     those pages, whoever owns each handler should call
//     window.openCartDrawer() once, after confirming the add succeeded —
//     exactly the pattern used below in addRelatedProductToCart, which is
//     the one add-to-cart flow that *is* in scope here (it lives inside the
//     drawer itself).

function ensureCartDrawerRelatedStyles() {
  if (document.getElementById('cart-drawer-related-style')) return;
  const style = document.createElement('style');
  style.id = 'cart-drawer-related-style';
  style.textContent = `
    .cart-drawer-body { overflow-x: hidden; }
    .related-wrapper {
      border-top: 1px solid rgba(17,17,17,.08);
      padding: 16px 14px 14px;
      margin: 12px -14px -14px;
      overflow-x: hidden;
      overflow-y: visible;
      background: #faf9f7;
    }
    .related-title {
      font-size: 13.5px; font-weight: 700; margin: 0 0 12px; padding-left: 2px;
      color: #111; letter-spacing: -0.01em; text-transform: uppercase; font-size: 12px;
    }
    .related-grid {
      display: flex; gap: 12px; overflow-x: auto; overflow-y: visible;
      padding: 4px 4px 12px; margin: 0 -4px;
      scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
      scrollbar-width: thin; max-width: 100%;
    }
    .related-grid::-webkit-scrollbar { height: 5px; }
    .related-grid::-webkit-scrollbar-thumb { background: rgba(0,0,0,.18); border-radius: 999px; }
    .related-card {
      flex: 0 0 132px; scroll-snap-align: start;
      border: 1px solid #ececec;
      border-radius: 10px; padding: 9px;
      text-align: left;
      background: #ffffff;
      box-shadow: none;
      transition: box-shadow .25s ease, transform .25s ease;
    }
    .related-card:hover {
      box-shadow: 0 6px 18px rgba(0,0,0,.08);
      transform: translateY(-3px);
    }
    .related-card-thumb { width: 100%; aspect-ratio: 4/5; border-radius: 8px; overflow: hidden; background: #f5f5f5; margin-bottom: 8px; position: relative; }
    .related-card-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s ease; }
    .related-card:hover .related-card-thumb img { transform: scale(1.05); }
    .related-card-name { font-size: 12px; margin: 0 0 4px; color: #111; line-height: 1.3; min-height: 31px; font-weight: 500; }
    .related-card-price { font-size: 13.5px; font-weight: 700; color: #111; margin: 0 0 8px; }
    .related-card-add {
      width: 100%; border: 1.5px solid #111;
      background: #fff;
      color: #111;
      font-size: 11px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase;
      padding: 7px 0; border-radius: 999px; cursor: pointer;
      transition: background .2s ease, color .2s ease;
    }
    .related-card-add:hover { background: #111; color: #fff; }
    .related-card-add.is-added { border-color: #16a34a; color: #16a34a; }

    /* Premium drawer chrome — supplements cart-drawer.min.css, doesn't replace it */
    .cart-drawer { width: 420px; max-width: 100vw; background: #fff; }
    @media (max-width: 480px) { .cart-drawer { width: 92vw; } }

    .cart-drawer-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 18px 18px 14px; border-bottom: 1px solid rgba(17,17,17,.08);
    }
    .cart-drawer-head-text h2 {
      margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: #111;
    }
    .cart-drawer-count { display: block; margin-top: 2px; font-size: 12px; color: #777; }
    .cart-drawer-close {
      border: none; background: transparent; font-size: 20px; line-height: 1;
      color: #111; cursor: pointer; padding: 4px 6px; border-radius: 6px;
    }
    .cart-drawer-close:hover { background: rgba(17,17,17,.06); }

    .cart-drawer-item { display: flex; gap: 12px; padding: 14px 0; border-bottom: 1px solid rgba(17,17,17,.06); }
    .cart-drawer-thumb { width: 64px; height: 78px; flex: 0 0 64px; border-radius: 8px; overflow: hidden; background: #f5f5f5; }
    .cart-drawer-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cart-drawer-item-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .cart-drawer-name { margin: 0; font-size: 13.5px; font-weight: 600; color: #111; line-height: 1.35; }
    .cart-drawer-remove {
      border: none; background: transparent; color: #999; font-size: 15px; line-height: 1;
      cursor: pointer; padding: 2px 4px; flex: 0 0 auto;
    }
    .cart-drawer-remove:hover { color: #c0392b; }
    /* Desktop-only visibility bump for the remove icon — mobile size/color
       was already fine per user feedback, this only sharpens it on wider
       screens where it looked faint. No other change. */
    @media (min-width: 481px) {
      .cart-drawer-remove { color: #555; font-size: 18px; }
      .cart-drawer-remove:hover { color: #c0392b; }
    }
    .cart-drawer-controls { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
    .cart-drawer-qty {
      display: inline-flex; align-items: center; border: 1px solid #ddd; border-radius: 999px; overflow: hidden;
    }
    .cart-drawer-qty button {
      border: none; background: #fff; width: 30px; height: 30px; font-size: 15px; cursor: pointer; color: #111;
    }
    .cart-drawer-qty button:hover { background: #f5f5f5; }
    .cart-drawer-qty span { min-width: 26px; text-align: center; font-size: 13px; font-weight: 600; }
    .cart-drawer-line-price { font-size: 13.5px; font-weight: 700; color: #111; }

    .cart-drawer-empty { text-align: center; padding: 48px 16px; }
    .cart-drawer-empty p { margin: 0 0 14px; font-size: 14px; color: #444; font-weight: 600; }
    .cart-drawer-empty-continue {
      display: inline-block; border: 1.5px solid #111; border-radius: 999px;
      padding: 9px 20px; font-size: 12.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .03em; color: #111; text-decoration: none;
    }
    .cart-drawer-empty-continue:hover { background: #111; color: #fff; }

    .cart-drawer-foot {
      position: sticky; bottom: 0; background: #fff; border-top: 1px solid rgba(17,17,17,.08);
      padding: 14px 18px 18px;
    }
    .cart-drawer-total-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .cart-drawer-total-row span { font-size: 13px; color: #555; }
    .cart-drawer-total-row strong { font-size: 17px; color: #111; }
    .cart-drawer-checkout {
      display: block; width: 100%; border: none; border-radius: 999px; background: #111; color: #fff;
      font-size: 14px; font-weight: 700; letter-spacing: .01em; padding: 13px 0; cursor: pointer;
      transition: background .2s ease;
    }
    .cart-drawer-checkout:hover { background: #000; }
    .cart-drawer-checkout:disabled { background: #ccc; cursor: not-allowed; }
    .cart-drawer-continue {
      display: block; text-align: center; margin-top: 10px; font-size: 12.5px; color: #555;
      text-decoration: underline; text-underline-offset: 2px;
    }
    @media (max-width: 480px) {
      .cart-drawer-qty button { width: 34px; height: 34px; font-size: 16px; }
      .cart-drawer-checkout { padding: 14px 0; font-size: 15px; }
    }
  `;
  document.head.appendChild(style);
}

window.addRelatedProductToCart = function (productId, categoryKey) {
  const cats = window.CATEGORY_PRODUCTS || {};
  let product = null;
  let foundCategoryKey = '';

  // Look inside the card's own category first. Product ids are only unique
  // *within* a category, not across all of them — a category-wide scan that
  // stops at the first id match (the old behavior) will silently grab a
  // different product that happens to share the same id in an earlier
  // category, which is why clicking one related-product card could add a
  // completely different item to the cart.
  if (categoryKey && Array.isArray(cats[categoryKey])) {
    const found = cats[categoryKey].find(p => p && String(p.id) === String(productId));
    if (found) {
      product = found;
      foundCategoryKey = categoryKey;
    }
  }

  // Fallback for callers that don't pass a category (e.g. cached/older
  // markup): scan every category, same as before.
  if (!product) {
    for (const key in cats) {
      const list = cats[key] || [];
      const found = list.find(p => p && String(p.id) === String(productId));
      if (found) {
        product = found;
        foundCategoryKey = key;
        break;
      }
    }
  }

  if (!product) return;
  categoryKey = foundCategoryKey;
  const meta = (window.CATEGORY_META && window.CATEGORY_META[categoryKey]) || {};

  let existing = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
  const line = {
    id: product.id,
    name: product.name,
    price: parseInt(product.price, 10) || 0,
    quantity: 1,
    image: product.image,
    color: product.color || '',
    colorLabel: product.colorLabel || '',
    category: categoryKey,
    categoryLabel: meta.title || categoryKey,
    selected: true
  };
  const updated = typeof window.addOrMergeStoreCartItem === 'function'
    ? window.addOrMergeStoreCartItem(existing, line)
    : (existing.push(line), existing);
  if (typeof window.afterCartMutation === 'function') {
    window.afterCartMutation(updated);
  } else {
    window.updateCartDrawerUI(updated);
  }
  // No toast — the drawer is already open (this handler only fires from
  // inside it), so updateCartDrawerUI() above is all the feedback needed.
};

// Collects candidates across every category in window.CATEGORY_PRODUCTS
// (not just the cart's primary category), lightly interleaved so the strip
// isn't dominated by whichever category happens to come first. Falls back
// to window.getRelatedProducts(primaryCategory) — the previous single-
// category source — if CATEGORY_PRODUCTS isn't available for some reason.
function collectRelatedCandidatesAllCategories(primaryCategory, inCart) {
  const cats = window.CATEGORY_PRODUCTS;
  if (!cats || typeof cats !== 'object') {
    return typeof window.getRelatedProducts === 'function'
      ? (window.getRelatedProducts(primaryCategory, 20) || [])
      : [];
  }
  const perCategoryLists = Object.keys(cats).map(key => {
    const list = Array.isArray(cats[key]) ? cats[key] : [];
    return list
      .filter(p => p && p.id && !inCart[String(p.id)])
      .map(p => Object.assign({}, p, { category: p.category || p.categoryKey || key }));
  });
  // Round-robin interleave across categories instead of concatenating, so
  // "all categories" doesn't just mean "the first category with enough
  // stock" in practice.
  const merged = [];
  let addedSomething = true;
  while (addedSomething) {
    addedSomething = false;
    for (const list of perCategoryLists) {
      const next = list.shift();
      if (next) {
        merged.push(next);
        addedSomething = true;
      }
    }
  }
  return merged;
}

window.renderCartDrawerRelated = function (cartItems) {
  const section = document.getElementById('related-products-section');
  const container = document.getElementById('related-products-container');
  if (!section || !container) return;

  stopRelatedAutoSlide();

  if (!cartItems || !cartItems.length) {
    section.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const inCart = {};
  cartItems.forEach(item => { inCart[String(item.id)] = true; });

  const primaryCategory = cartItems[0].category || cartItems[0].categoryKey || '';
  const candidates = collectRelatedCandidatesAllCategories(primaryCategory, inCart).slice(0, 20);

  if (!candidates.length) {
    section.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.innerHTML = candidates.map(p => {
    const img = p.image || p.img || 'images/Baby-Pink-Floral-Print.jpeg';
    const price = parseInt(p.price, 10) || 0;
    const name = String(p.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const idAttr = String(p.id || '').replace(/'/g, "\\'");
    // Carry the product's own category so addRelatedProductToCart can look
    // it up in the right list — falls back to the cart's primary category
    // if the candidate object itself doesn't carry one.
    const catAttr = String(p.category || p.categoryKey || primaryCategory || '').replace(/'/g, "\\'");
    return `
      <div class="related-card">
        <div class="related-card-thumb"><img src="${img}" alt="${name}" loading="lazy" onerror="this.src='images/Baby-Pink-Floral-Print.jpeg'"></div>
        <p class="related-card-name">${name}</p>
        <p class="related-card-price">৳${price}</p>
        <button type="button" class="related-card-add" onclick="window.addRelatedProductToCart('${idAttr}', '${catAttr}')">Add to cart</button>
      </div>
    `;
  }).join('');
  section.style.display = '';
  startRelatedAutoSlide(container);
};

// --- Auto-sliding "Customers also bought" carousel ---------------------
// Plain scrollLeft animation, no library. One interval per open drawer,
// always torn down (stopRelatedAutoSlide) before a re-render so re-renders
// on cart changes never stack up duplicate timers.
let relatedAutoSlideTimer = null;
let relatedAutoSlideResumeTimer = null;

function stopRelatedAutoSlide() {
  if (relatedAutoSlideTimer) {
    clearInterval(relatedAutoSlideTimer);
    relatedAutoSlideTimer = null;
  }
  if (relatedAutoSlideResumeTimer) {
    clearTimeout(relatedAutoSlideResumeTimer);
    relatedAutoSlideResumeTimer = null;
  }
}

function startRelatedAutoSlide(container) {
  stopRelatedAutoSlide();
  if (!container || container.scrollWidth <= container.clientWidth + 4) return;

  const STEP_INTERVAL_MS = 2600;
  const RESUME_DELAY_MS = 3500;

  function step() {
    const card = container.querySelector('.related-card');
    const cardStep = card ? card.getBoundingClientRect().width + 12 : 140;
    const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 2;
    container.scrollTo({
      left: atEnd ? 0 : container.scrollLeft + cardStep,
      behavior: 'smooth'
    });
  }

  function pause() {
    if (relatedAutoSlideTimer) {
      clearInterval(relatedAutoSlideTimer);
      relatedAutoSlideTimer = null;
    }
    if (relatedAutoSlideResumeTimer) clearTimeout(relatedAutoSlideResumeTimer);
    relatedAutoSlideResumeTimer = setTimeout(() => {
      if (document.body.contains(container)) resume();
    }, RESUME_DELAY_MS);
  }

  function resume() {
    if (relatedAutoSlideTimer) return;
    relatedAutoSlideTimer = setInterval(step, STEP_INTERVAL_MS);
  }

  // Manual interaction (touch swipe, mouse drag/wheel) pauses, then
  // auto-slide resumes on its own after a short delay. Hover pauses too
  // and resumes on mouse-leave.
  container.addEventListener('pointerdown', pause);
  container.addEventListener('touchstart', pause, { passive: true });
  container.addEventListener('wheel', pause, { passive: true });
  container.addEventListener('mouseenter', pause);
  container.addEventListener('mouseleave', resume);

  resume();
}

function findProductByImage(imgUrl) {
    const cats = window.CATEGORY_PRODUCTS || {};
    for (const catKey in cats) {
        const list = cats[catKey];
        if (Array.isArray(list)) {
            const found = list.find(p => p.image === imgUrl || p.img === imgUrl || (p.image && imgUrl.endsWith(p.image)));
            if (found) return found;
        }
    }
    return null;
}

// Note: a window.addToCart(productIdOrImgUrl) wrapper used to live here and
// called window.addToCartFromCard(...) — a function that only ever existed
// in index-home-app.js, which is not loaded anywhere on the site. Nothing
// currently calls window.addToCart, so it was removed rather than fixed to
// call a real handler; each page (home, category, product) has its own
// local add-to-cart implementation already. If you need a single global
// entry point again, wire it to window.addOrMergeStoreCartItem (from
// cart-utils.js) instead of a per-page function.

function ensureCartDrawerHideStyle() {
  if (document.getElementById('cart-drawer-hide-init')) return;
  const style = document.createElement('style');
  style.id = 'cart-drawer-hide-init';
  style.textContent =
    '.cart-drawer:not(.is-open){visibility:hidden!important;pointer-events:none!important;transform:translate3d(calc(100% + 40px),0,0)!important}' +
    '.cart-drawer-overlay:not(.is-open){opacity:0!important;visibility:hidden!important;pointer-events:none!important}';
  document.head.appendChild(style);
}

function ensureCartDrawerHtml() {
  if (document.getElementById('cart-drawer')) return;

  ensureCartDrawerHideStyle();

  const overlay = document.createElement('div');
  overlay.className = 'cart-drawer-overlay';
  overlay.id = 'cart-drawer-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.appendChild(overlay);

  const drawer = document.createElement('div');
  drawer.className = 'cart-drawer';
  drawer.id = 'cart-drawer';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = `
    <div class="cart-drawer-head">
      <div class="cart-drawer-head-text">
        <h2>Shopping Bag</h2>
        <span class="cart-drawer-count" id="cart-drawer-count"></span>
      </div>
      <button
        type="button"
        class="cart-drawer-close"
        aria-label="Close shopping cart"
      >×</button>
    </div>
    <div class="cart-drawer-body">
      <div id="cart-items-list"></div>
      <div id="related-products-section" class="related-wrapper" style="display: none;">
        <h3 class="related-title">Customers also bought</h3>
        <div id="related-products-container" class="related-grid"></div>
      </div>
    </div>
    <div class="cart-drawer-foot">
      <div class="cart-drawer-total-row">
        <span>Subtotal</span>
        <strong id="cart-drawer-total-price">৳0</strong>
      </div>
      <button type="button" class="cart-drawer-checkout">Checkout &rarr;</button>
      <a href="#" class="cart-drawer-continue" id="cart-drawer-continue">Continue Shopping</a>
    </div>
  `;
  document.body.appendChild(drawer);
  ensureCartDrawerRelatedStyles();
// Open / Close drawer helpers
window.openCartDrawer = function () {
  // Always refresh the list before showing — otherwise a caller opening
  // right after an add/remove could show a drawer still rendering whatever
  // was last drawn (e.g. empty, from before the item was added).
  window.updateCartDrawerUI();
  drawer.classList.add('is-open');
  overlay.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('cart-drawer-open');
};

window.closeCartDrawer = function () {
  stopRelatedAutoSlide();
  drawer.classList.remove('is-open');
  overlay.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('cart-drawer-open');
};

// Close button
const closeBtn = drawer.querySelector('.cart-drawer-close');
if (closeBtn) {
  closeBtn.addEventListener('click', window.closeCartDrawer);
}

// Click outside drawer
overlay.addEventListener('click', window.closeCartDrawer);

// ESC key support
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    window.closeCartDrawer();
  }
});

  // Setup click handler for checkout — the whole bag goes to checkout now,
  // so this just navigates (the button is disabled/hidden while empty via
  // renderCartList, so there's nothing to guard here).
  const checkoutBtn = drawer.querySelector('.cart-drawer-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      if (checkoutBtn.disabled) return;
      window.location.href = typeof window.siteHref === 'function' ? window.siteHref('/checkout') : 'checkout.html';
    });
  }
  const continueLink = drawer.querySelector('#cart-drawer-continue');
  if (continueLink) {
    continueLink.addEventListener('click', function (e) {
      e.preventDefault();
      window.closeCartDrawer();
    });
  }
}

window.renderCartList = function (cartItems) {
  const listContainer = document.getElementById('cart-items-list');
  if (!listContainer) return;
  const countEl = document.getElementById('cart-drawer-count');
  const checkoutBtn = document.querySelector('.cart-drawer-checkout');
  const totalEl = document.getElementById('cart-drawer-total-price');

  const totalPcs = typeof window.cartTotalQty === 'function' ? window.cartTotalQty(cartItems) : (cartItems || []).length;

  if (!cartItems || cartItems.length === 0) {
    listContainer.innerHTML = `
      <div class="cart-drawer-empty">
        <p>Your shopping bag is empty</p>
        <a href="${typeof window.siteHref === 'function' ? window.siteHref('/') : 'index.html'}" class="cart-drawer-empty-continue">Continue Shopping</a>
      </div>
    `;
    if (totalEl) totalEl.innerText = '৳0';
    if (countEl) countEl.textContent = '';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;
  if (countEl) countEl.textContent = totalPcs + (totalPcs === 1 ? ' item' : ' items');

  let subtotal = 0;
  let html = '';

  cartItems.forEach((item, index) => {
    const price = parseInt(item.price, 10) || 550;
    const qty = parseInt(item.quantity, 10) || 1;
    const itemTotal = price * qty;
    subtotal += itemTotal;

    const imgUrl = item.image || 'images/Baby-Pink-Floral-Print.jpeg';
    const safeName = String(item.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let sizeDetails = '';
    if (item.size) sizeDetails += `Size: ${item.size}`;
    if (item.colorLabel || item.color) {
      if (sizeDetails) sizeDetails += ' | ';
      sizeDetails += `Color: ${item.colorLabel || item.color}`;
    }
    if (item.customNote) {
      if (sizeDetails) sizeDetails += ' | ';
      sizeDetails += `Note: ${item.customNote}`;
    }

    html += `
      <div class="cart-drawer-item" data-index="${index}" data-id="${item.id}" data-size="${item.size || ''}">
        <div class="cart-drawer-thumb">
          <img src="${imgUrl}" alt="${safeName}" onerror="this.src='images/Baby-Pink-Floral-Print.jpeg'">
        </div>
        <div class="cart-drawer-item-main">
          <div class="cart-drawer-item-top">
            <h3 class="cart-drawer-name">${safeName}</h3>
            <button type="button" class="cart-drawer-remove" onclick="removeDrawerItem(${index})" aria-label="Remove ${safeName}">🗑</button>
          </div>
          ${sizeDetails ? `<div style="font-size: 11px; color: #666; margin-bottom: 6px;">${sizeDetails}</div>` : ''}
          <div class="cart-drawer-controls">
            <div class="cart-drawer-qty">
              <button type="button" onclick="updateDrawerQty(${index}, -1)" aria-label="Decrease quantity">-</button>
              <span>${qty}</span>
              <button type="button" onclick="updateDrawerQty(${index}, 1)" aria-label="Increase quantity">+</button>
            </div>
            <span class="cart-drawer-line-price">৳${itemTotal}</span>
          </div>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;
  if (totalEl) totalEl.innerText = '৳' + subtotal;
};

// Note: the drawer UI no longer has a select/deselect system (the whole bag
// now goes to checkout), so window.toggleDrawerLineSelected and
// window.setAllDrawerLinesSelected — which only ever existed to back that
// UI — were removed. cart-utils.js still exports setStoreCartLineSelected /
// setAllStoreCartLinesSelected / getSelectedStoreCartLines untouched, in
// case something else depends on them.

window.updateDrawerQty = function (index, change) {
  let existing = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
  if (!existing[index]) return;
  existing[index].quantity = (parseInt(existing[index].quantity, 10) || 0) + change;
  if (existing[index].quantity < 1) {
    existing.splice(index, 1);
  }
  const updated = typeof window.persistStoreCart === 'function' ? window.persistStoreCart(existing) : existing;
  if (typeof window.afterCartMutation === 'function') {
    window.afterCartMutation(updated);
  } else {
    window.updateCartDrawerUI(updated);
  }
};

window.removeDrawerItem = function (index) {
  let existing = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
  if (!existing[index]) return;
  existing.splice(index, 1);
  const updated = typeof window.persistStoreCart === 'function' ? window.persistStoreCart(existing) : existing;
  if (typeof window.afterCartMutation === 'function') {
    window.afterCartMutation(updated);
  } else {
    window.updateCartDrawerUI(updated);
  }
};

window.updateCartDrawerUI = function (cartLines) {
  const lines = cartLines || (typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : []);
  if (typeof window.updateCartUI === 'function') {
    window.updateCartUI(lines);
  } else {
    if (typeof window.renderCartList === 'function') {
      window.renderCartList(lines);
    }
  }
  if (typeof window.renderCartDrawerRelated === 'function') {
    window.renderCartDrawerRelated(lines);
  }
};

// Setup interception
if (typeof window !== 'undefined') {
  const originalUpdateCartBadge = window.updateCartBadge;
  window.updateCartBadge = function (cartLines) {
    if (typeof originalUpdateCartBadge === 'function') {
      originalUpdateCartBadge(cartLines);
    }
    window.updateCartDrawerUI(cartLines);
  };
  
  window.addEventListener('storeCartUpdated', function (e) {
    const lines = e.detail && e.detail.lines;
    window.updateCartDrawerUI(lines);
  });
}

// Open the drawer when the bag icon (in the header, injected by site-header.js) is clicked.
// This used to live only in related-cart.js, which is homepage-only — so on every other
// page (category pages, checkout, etc.) clicking the bag icon did nothing. Bound once here,
// delegated on document so it works no matter when the header markup gets injected.
if (typeof document !== 'undefined' && !window.__cartDrawerOpenBound) {
  window.__cartDrawerOpenBound = true;
  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('.cart-drawer-trigger, [data-cart-trigger], .shopping-cart-icon');
    if (!trigger) return;
    e.preventDefault();
    ensureCartDrawerHtml();
    if (typeof window.openCartDrawer === 'function') {
      window.openCartDrawer();
    }
  });
}

// Self initialize
//
// This file is loaded as a `defer` script near the top of most pages'
// script lists. By the time any defer script runs, document.readyState is
// already 'interactive' (never 'loading') -- defer scripts execute during
// the 'interactive' phase, before DOMContentLoaded fires. Checking for
// `!== 'loading'` therefore always took the "run immediately" branch below,
// which ran ensureCartDrawerHtml()/updateCartDrawerUI() before later defer
// scripts (category-products.js, product-links-data.js, etc.) had a chance
// to define window.CATEGORY_PRODUCTS / window.getRelatedProducts -- so a
// returning visitor with items already in their cart would silently get no
// "Customers also bought" row on first paint. Wait for DOMContentLoaded
// instead: it only fires after every defer script has finished, so this is
// guaranteed to run last among them. If this file is ever loaded well after
// the page is fully done (readyState 'complete'), DOMContentLoaded has
// already fired and never will again, so run immediately in that case.
if (typeof document !== 'undefined') {
  ensureCartDrawerHideStyle();
  if (document.readyState === 'complete') {
    ensureCartDrawerHtml();
    window.updateCartDrawerUI();
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      ensureCartDrawerHtml();
      window.updateCartDrawerUI();
    }, { once: true });
  }
}
