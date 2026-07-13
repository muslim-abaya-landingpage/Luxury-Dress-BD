// cart-drawer.js

function ensureCartDrawerRelatedStyles() {
  if (document.getElementById('cart-drawer-related-style')) return;
  const style = document.createElement('style');
  style.id = 'cart-drawer-related-style';
  style.textContent = `
    .related-wrapper { border-top: 1px solid #ececec; padding-top: 14px; margin-top: 10px; }
    .related-title { font-size: 14px; font-weight: 700; margin: 0 0 12px; color: #111; }
    .related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .related-card { border: 1px solid #ececec; border-radius: 10px; padding: 8px; text-align: left; }
    .related-card-thumb { width: 100%; aspect-ratio: 4/5; border-radius: 6px; overflow: hidden; background: #f5f5f5; margin-bottom: 6px; }
    .related-card-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .related-card-name { font-size: 12px; margin: 0 0 4px; color: #111; line-height: 1.3; min-height: 31px; }
    .related-card-price { font-size: 13px; font-weight: 700; color: #b8952e; margin: 0 0 6px; }
    .related-card-add { width: 100%; border: 1px solid #111; background: #fff; color: #111; font-size: 11px; font-weight: 600; padding: 6px 0; border-radius: 999px; cursor: pointer; }
    .related-card-add:hover { background: #111; color: #fff; }
  `;
  document.head.appendChild(style);
}

window.addRelatedProductToCart = function (productId) {
  const cats = window.CATEGORY_PRODUCTS || {};
  let product = null;
  let categoryKey = '';
  for (const key in cats) {
    const list = cats[key] || [];
    const found = list.find(p => p && String(p.id) === String(productId));
    if (found) {
      product = found;
      categoryKey = key;
      break;
    }
  }
  if (!product) return;

  let existing = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
  const already = existing.find(item => item.id === product.id && !item.size);
  if (already) {
    already.quantity = (parseInt(already.quantity, 10) || 0) + 1;
  } else {
    const meta = (window.CATEGORY_META && window.CATEGORY_META[categoryKey]) || {};
    existing.push({
      id: product.id,
      name: product.name,
      price: parseInt(product.price, 10) || 0,
      quantity: 1,
      image: product.image,
      category: categoryKey,
      categoryLabel: meta.title || categoryKey
    });
  }
  const updated = typeof window.persistStoreCart === 'function' ? window.persistStoreCart(existing) : existing;
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
    ? window.getRelatedProducts(primaryCategory, 8) || []
    : [];
  candidates = candidates.filter(p => p && p.id && !inCart[String(p.id)]);

  if (!candidates.length) {
    section.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  candidates = candidates.slice(0, 4);

  container.innerHTML = candidates.map(p => {
    const img = p.image || p.img || 'images/Baby-Pink-Floral-Print.jpeg';
    const price = parseInt(p.price, 10) || 0;
    const name = String(p.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const idAttr = String(p.id || '').replace(/'/g, "\\'");
    return `
      <div class="related-card">
        <div class="related-card-thumb"><img src="${img}" alt="${name}" loading="lazy" onerror="this.src='images/Baby-Pink-Floral-Print.jpeg'"></div>
        <p class="related-card-name">${name}</p>
        <p class="related-card-price">৳${price}</p>
        <button type="button" class="related-card-add" onclick="window.addRelatedProductToCart('${idAttr}')">Add to cart</button>
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

if (typeof window !== 'undefined') {
    window.addToCart = function (productIdOrImgUrl) {
        if (typeof productIdOrImgUrl === 'string' && (productIdOrImgUrl.includes('/') || productIdOrImgUrl.includes('.'))) {
            const product = findProductByImage(productIdOrImgUrl);
            if (product) {
                window.addToCartFromCard(product.id);
            } else {
                console.error("Product not found for image URL:", productIdOrImgUrl);
            }
        } else {
            window.addToCartFromCard(productIdOrImgUrl);
        }
    };
}

function ensureCartDrawerHtml() {
  if (document.getElementById('cart-drawer')) return;

  const overlay = document.createElement('div');
  overlay.className = 'cart-drawer-overlay';
  overlay.id = 'cart-drawer-overlay';
  document.body.appendChild(overlay);

  const drawer = document.createElement('div');
  drawer.className = 'cart-drawer';
  drawer.id = 'cart-drawer';
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
      <div id="cart-items-list"></div>
      <div id="related-products-section" class="related-wrapper" style="display: none;">
        <h3 class="related-title">Customers also bought</h3>
        <div id="related-products-container" class="related-grid"></div>
      </div>
    </div>
    <div class="cart-drawer-foot">
      <div class="cart-drawer-total-row">
       <span>Total:</span>
        <strong id="cart-drawer-total-price">৳0</strong>
      </div>
      <button type="button" class="cart-drawer-checkout">Proceed to Checkout</button>
    </div>
  `;
  document.body.appendChild(drawer);
  ensureCartDrawerRelatedStyles();
// Open / Close drawer helpers
const closeBtn = drawer.querySelector('.cart-drawer-close');

window.openCartDrawer = function () {
  const drawerEl = document.getElementById('cart-drawer');
  const overlayEl = document.getElementById('cart-drawer-overlay');
  if (!drawerEl || !overlayEl) return;

  drawerEl.classList.add('is-open');
  overlayEl.classList.add('is-open');
  document.body.classList.add('cart-drawer-open');
};

window.closeCartDrawer = function () {
  const drawerEl = document.getElementById('cart-drawer');
  const overlayEl = document.getElementById('cart-drawer-overlay');
  if (!drawerEl || !overlayEl) return;

  drawerEl.classList.remove('is-open');
  overlayEl.classList.remove('is-open');
  document.body.classList.remove('cart-drawer-open');
};

if (closeBtn) {
  closeBtn.addEventListener('click', window.closeCartDrawer);
}

if (overlay) {
  overlay.addEventListener('click', window.closeCartDrawer);
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    window.closeCartDrawer();
  }
});

  // Setup click handler for checkout
  const checkoutBtn = drawer.querySelector('.cart-drawer-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      window.location.href = typeof window.siteHref === 'function' ? window.siteHref('/checkout') : 'checkout.html';
    });
  }
}

window.renderCartList = function (cartItems) {
  const listContainer = document.getElementById('cart-items-list');
  if (!listContainer) return;

  if (!cartItems || cartItems.length === 0) {
    listContainer.innerHTML = `
      <div class="cart-drawer-empty">
        <p>Your shopping bag is currently empty.</p>
      </div>
    `;
    const totalEl = document.getElementById('cart-drawer-total-price');
    if (totalEl) totalEl.innerText = '৳0';
    return;
  }

  let total = 0;
  let html = '';

  cartItems.forEach((item, index) => {
    const price = parseInt(item.price, 10) || 550;
    const qty = parseInt(item.quantity, 10) || 1;
    const itemTotal = price * qty;
    total += itemTotal;

    const imgUrl = item.image || 'images/Baby-Pink-Floral-Print.jpeg';

    let sizeDetails = '';
    if (item.size) sizeDetails += `Size: ${item.size}`;
    if (item.colorLabel || item.color) {
      if (sizeDetails) sizeDetails += ' | ';
      sizeDetails += `Color: ${item.colorLabel || item.color}`;
    }

    html += `
      <div class="cart-drawer-item" data-index="${index}" data-id="${item.id}" data-size="${item.size || ''}">
        <div class="cart-drawer-thumb">
          <img src="${imgUrl}" alt="${item.name}" onerror="this.src='images/Baby-Pink-Floral-Print.jpeg'">
        </div>
        <div class="cart-drawer-item-main">
          <div class="cart-drawer-item-top">
            <h3 class="cart-drawer-name">${item.name}</h3>
            <button type="button" class="cart-drawer-remove" onclick="removeDrawerItem('${item.id}', '${item.size || ''}')">×</button>
          </div>
          ${sizeDetails ? `<div style="font-size: 11px; color: #666; margin-bottom: 6px;">${sizeDetails}</div>` : ''}
          <div class="cart-drawer-controls">
            <div class="cart-drawer-qty">
              <button type="button" onclick="updateDrawerQty('${item.id}', '${item.size || ''}', -1)">-</button>
              <span>${qty}</span>
              <button type="button" onclick="updateDrawerQty('${item.id}', '${item.size || ''}', 1)">+</button>
            </div>
            <span class="cart-drawer-line-price">৳${itemTotal}</span>
          </div>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;
  const totalEl = document.getElementById('cart-drawer-total-price');
  if (totalEl) totalEl.innerText = '৳' + total;
};

window.updateDrawerQty = function (productId, size, change) {
  let existing = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
  const found = existing.find(item => item.id === productId && (item.size || '') === size);
  if (found) {
    found.quantity = (parseInt(found.quantity, 10) || 0) + change;
    if (found.quantity < 1) {
      existing = existing.filter(item => !(item.id === productId && (item.size || '') === size));
    }
    const updated = typeof window.persistStoreCart === 'function' ? window.persistStoreCart(existing) : existing;
    if (typeof window.afterCartMutation === 'function') {
      window.afterCartMutation(updated);
    }
  }
};

window.removeDrawerItem = function (productId, size) {
  let existing = typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : [];
  existing = existing.filter(item => !(item.id === productId && (item.size || '') === size));
  const updated = typeof window.persistStoreCart === 'function' ? window.persistStoreCart(existing) : existing;
  if (typeof window.afterCartMutation === 'function') {
    window.afterCartMutation(updated);
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
if (typeof document !== 'undefined') {
  if (document.readyState !== 'loading') {
    ensureCartDrawerHtml();
    window.updateCartDrawerUI();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      ensureCartDrawerHtml();
      window.updateCartDrawerUI();
    });
  }
}
