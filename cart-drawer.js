// cart-drawer.js

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
  if (typeof window.showCartAddedToast === 'function') {
    window.showCartAddedToast({ name: product.name, image: product.image, price: product.price });
  }
};

window.renderCartDrawerRelated = function (cartItems) {
  const section = document.getElementById('related-products-section');
  const container = document.getElementById('related-products-container');
  if (!section || !container) return;

  if (!cartItems || !cartItems.length) {
    section.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  const inCart = {};
  cartItems.forEach(item => { inCart[String(item.id)] = true; });

  const primaryCategory = cartItems[0].category || cartItems[0].categoryKey || '';
  let candidates = typeof window.getRelatedProducts === 'function'
    ? window.getRelatedProducts(primaryCategory, 20) || []
    : [];
  candidates = candidates.filter(p => p && p.id && !inCart[String(p.id)]);

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
};

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
  <h2>Your Shopping Cart</h2>
  <button
    type="button"
    class="cart-drawer-close"
    aria-label="Close shopping cart"
  >
    Close ×
  </button>
</div>
    <div class="cart-drawer-body">
      <div class="cart-select-bar" id="cart-select-bar" hidden>
        <button type="button" class="cart-select-all-btn" id="cart-select-all">Select all</button>
        <button type="button" class="cart-select-all-btn" id="cart-deselect-all">Deselect all</button>
        <span class="cart-select-count" id="cart-select-count"></span>
      </div>
      <div id="cart-items-list"></div>
      <div id="related-products-section" class="related-wrapper" style="display: none;">
        <h3 class="related-title">Customers also bought</h3>
        <div id="related-products-container" class="related-grid"></div>
      </div>
    </div>
    <div class="cart-drawer-foot">
      <div class="cart-drawer-total-row">
       <span>Checkout total:</span>
        <strong id="cart-drawer-total-price">৳0</strong>
      </div>
      <p class="cart-drawer-select-hint" id="cart-drawer-select-hint"></p>
      <button type="button" class="cart-drawer-checkout">Proceed to Checkout</button>
    </div>
  `;
  document.body.appendChild(drawer);
  ensureCartDrawerRelatedStyles();
// Open / Close drawer helpers
window.openCartDrawer = function () {
  // Always refresh the list before showing — otherwise callers like the
  // "View bag" button in cart-toast.js could open a drawer still showing
  // whatever was rendered last (e.g. empty, from before the item was added).
  window.updateCartDrawerUI();
  drawer.classList.add('is-open');
  overlay.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('cart-drawer-open');
};

window.closeCartDrawer = function () {
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

  // Setup click handler for checkout
  const checkoutBtn = drawer.querySelector('.cart-drawer-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      const lines = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
      const selected = typeof window.getSelectedStoreCartLines === 'function'
        ? window.getSelectedStoreCartLines(lines)
        : lines;
      if (!selected.length) {
        if (typeof window.showCartAddedToast === 'function') {
          window.showCartAddedToast({ name: 'Select at least one item for checkout', image: '', price: 0 });
        }
        return;
      }
      window.location.href = typeof window.siteHref === 'function' ? window.siteHref('/checkout') : 'checkout.html';
    });
  }
  const selectAllBtn = drawer.querySelector('#cart-select-all');
  const deselectAllBtn = drawer.querySelector('#cart-deselect-all');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', function () { window.setAllDrawerLinesSelected(true); });
  }
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', function () { window.setAllDrawerLinesSelected(false); });
  }
}

window.renderCartList = function (cartItems) {
  const listContainer = document.getElementById('cart-items-list');
  if (!listContainer) return;
  const selectBar = document.getElementById('cart-select-bar');
  const selectCount = document.getElementById('cart-select-count');
  const hintEl = document.getElementById('cart-drawer-select-hint');
  const isSelected = typeof window.isStoreCartLineSelected === 'function'
    ? window.isStoreCartLineSelected
    : function () { return true; };

  if (!cartItems || cartItems.length === 0) {
    listContainer.innerHTML = `
      <div class="cart-drawer-empty">
        <p>Your shopping bag is currently empty.</p>
      </div>
    `;
    const totalEl = document.getElementById('cart-drawer-total-price');
    if (totalEl) totalEl.innerText = '৳0';
    if (selectBar) selectBar.hidden = true;
    if (hintEl) hintEl.textContent = '';
    return;
  }

  if (selectBar) selectBar.hidden = false;

  let checkoutTotal = 0;
  let html = '';
  let selectedCount = 0;
  let selectedPcs = 0;

  cartItems.forEach((item, index) => {
    const price = parseInt(item.price, 10) || 550;
    const qty = parseInt(item.quantity, 10) || 1;
    const itemTotal = price * qty;
    const checked = isSelected(item);
    if (checked) {
      checkoutTotal += itemTotal;
      selectedCount += 1;
      selectedPcs += qty;
    }

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
      <div class="cart-drawer-item${checked ? '' : ' is-deselected'}" data-index="${index}" data-id="${item.id}" data-size="${item.size || ''}">
        <label class="cart-line-check">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleDrawerLineSelected(${index}, this.checked)" aria-label="Select for checkout">
        </label>
        <div class="cart-drawer-thumb">
          <img src="${imgUrl}" alt="${safeName}" onerror="this.src='images/Baby-Pink-Floral-Print.jpeg'">
        </div>
        <div class="cart-drawer-item-main">
          <div class="cart-drawer-item-top">
            <h3 class="cart-drawer-name">${safeName}</h3>
            <button type="button" class="cart-drawer-remove" onclick="removeDrawerItem(${index})">×</button>
          </div>
          ${sizeDetails ? `<div style="font-size: 11px; color: #666; margin-bottom: 6px;">${sizeDetails}</div>` : ''}
          <div class="cart-drawer-controls">
            <div class="cart-drawer-qty">
              <button type="button" onclick="updateDrawerQty(${index}, -1)">-</button>
              <span>${qty}</span>
              <button type="button" onclick="updateDrawerQty(${index}, 1)">+</button>
            </div>
            <span class="cart-drawer-line-price">৳${itemTotal}</span>
          </div>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;
  const totalEl = document.getElementById('cart-drawer-total-price');
  if (totalEl) totalEl.innerText = '৳' + checkoutTotal;
  if (selectCount) {
    selectCount.textContent = selectedCount + ' of ' + cartItems.length + ' selected';
  }
  if (hintEl) {
    const bagPcs = typeof window.cartTotalQty === 'function' ? window.cartTotalQty(cartItems) : cartItems.length;
    hintEl.textContent = 'Bag: ' + bagPcs + ' pcs · Checkout: ' + selectedPcs + ' pcs';
  }
};

window.toggleDrawerLineSelected = function (index, selected) {
  let existing = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
  const updated = typeof window.setStoreCartLineSelected === 'function'
    ? window.setStoreCartLineSelected(existing, index, selected)
    : existing;
  if (typeof window.afterCartMutation === 'function') {
    window.afterCartMutation(updated);
  } else {
    window.updateCartDrawerUI(updated);
  }
};

window.setAllDrawerLinesSelected = function (selected) {
  let existing = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
  const updated = typeof window.setAllStoreCartLinesSelected === 'function'
    ? window.setAllStoreCartLinesSelected(existing, selected)
    : existing;
  if (typeof window.afterCartMutation === 'function') {
    window.afterCartMutation(updated);
  } else {
    window.updateCartDrawerUI(updated);
  }
};

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
