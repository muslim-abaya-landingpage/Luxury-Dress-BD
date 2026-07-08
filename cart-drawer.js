// cart-drawer.js

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
      <h2>আপনার শপিং কার্ট</h2>
      <button type="button" class="cart-drawer-close" aria-label="Close cart">বন্ধ করুন ×</button>
    </div>
    <div class="cart-drawer-body">
      <div id="cart-items-list"></div>
      <div id="related-products-section" class="related-wrapper" style="display: none;">
        <h3 class="related-title">আপনার জন্য আরও কিছু:</h3>
        <div id="related-products-container" class="related-grid"></div>
      </div>
    </div>
    <div class="cart-drawer-foot">
      <div class="cart-drawer-total-row">
        <span>সর্বমোট:</span>
        <strong id="cart-drawer-total-price">৳0</strong>
      </div>
      <button type="button" class="cart-drawer-checkout">অর্ডার নিশ্চিত করুন</button>
    </div>
  `;
  document.body.appendChild(drawer);

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
        <p>আপনার শপিং কার্ট খালি আছে।</p>
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
