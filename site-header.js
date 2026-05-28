(function () {
  var GTM_ID = 'GTM-ML7RL6BR';

  function getSiteRoot() {
    var path = window.location.pathname || '/';
    var slash = path.lastIndexOf('/');
    if (slash <= 0) return '/';
    return path.slice(0, slash + 1);
  }

  function siteAsset(file) {
    var root = getSiteRoot();
    return root + String(file || '').replace(/^\//, '');
  }
  var ICON_SEARCH =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path d="M21 21l-4.5-4.5"/></svg>';
  var ICON_BAG =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 1 8 0"/><path d="M6 9h12a2 2 0 0 1 2 2v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-7a2 2 0 0 1 2-2z"/><circle cx="9" cy="14" r="0.6" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg>';
  var ICON_CHAT =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 3H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h3l3 3 3-3h3a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke-width="2.5"/></svg>';
  var ICON_USER =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4.5"/></svg>';
  var ICON_MENU =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';

  var HEADER_HTML =
    '<header class="abaya-main-header">' +
    '<div class="header-top-bar"><div class="custom-container"><div class="top-bar-content">' +
    '<a href="help.html">Help</a> | <a href="signup.html">Sign Up</a> | <a href="signin.html">Sign In</a>' +
    '</div></div></div>' +
    '<div class="header-middle-nav"><div class="custom-container nav-row">' +
    '<div class="brand-text-logo"><a href="/">MUSLIM ABAYA</a></div>' +
    '<nav class="desktop-menu"><ul>' +
    '<li><a href="abaya.html">ABAYA</a></li>' +
    '<li><a href="cover-up.html">COVER UP</a></li>' +
    '<li><a href="tops-kurti.html">TOPS/KURTI</a></li>' +
    '<li><a href="premium-two-piece.html">PREMIUM TWO-PIECE</a></li>' +
    '<li><a href="embroidery.html">EMBROIDERY</a></li>' +
    '<li><a href="karchupi.html">KARCHUPI</a></li>' +
    '<li><a href="kaftan.html">KAFTAN</a></li>' +
    '<li><a href="hijab.html">HIJAB</a></li>' +
    '<li><a href="video.html">VIDEO</a></li>' +
    '</ul></nav>' +
    '<div class="nav-icons">' +
    '<button type="button" class="nav-icon-btn" id="navSearchOpen" aria-label="Search" aria-expanded="false">' + ICON_SEARCH + '</button>' +
    '<button type="button" class="cart-drawer-trigger" data-cart-trigger="1" style="position:relative" aria-label="Cart">' + ICON_BAG + '<span id="cart-count">0</span></button>' +
    '<a href="https://wa.me/8801971642683" target="_blank" rel="noopener" aria-label="Message">' + ICON_CHAT + '</a>' +
    '<a href="checkout.html" aria-label="Account">' + ICON_USER + '</a>' +
    '<button type="button" class="nav-menu-btn" onclick="window.toggleAbayaMenu()" aria-label="Menu">' + ICON_MENU + '</button>' +
    '</div></div></div>' +
    '<div class="site-search-drawer" id="siteSearchDrawer" aria-hidden="true">' +
    '<button type="button" class="site-search-close" id="siteSearchClose" aria-label="Close search">&times;</button>' +
    '<div class="site-search-inner">' +
    '<form class="site-search-form" id="siteSearchForm" role="search" autocomplete="off">' +
  ICON_SEARCH +
    '<input type="search" id="siteSearchInput" name="q" placeholder="Search" autocomplete="off" aria-label="Search products">' +
    '</form>' +
    '<ul class="site-search-results" id="siteSearchResults" hidden></ul>' +
    '</div></div>' +
    '<div class="header-announcement-bar"><div class="custom-container announcement-slider">' +
    '<button type="button" class="slider-arrow left-arrow" onclick="window.moveAnnouncement(-1)" aria-label="Previous">&#8249;</button>' +
    '<div class="announcement-content">' +
    '<div class="ann-slide active">EID COLLECTION 2026 – WHERE ELEGANCE MEETS CELEBRATION</div>' +
    '<div class="ann-slide">সারা দেশে দ্রুত ডেলিভারি • ক্যাশ অন হোম ডেলিভারি</div>' +
    '<div class="ann-slide">৩টি ড্রেস কিনুন, ফ্রি ডেলিভারি সুবিধা</div>' +
    '</div>' +
    '<button type="button" class="slider-arrow right-arrow" onclick="window.moveAnnouncement(1)" aria-label="Next">&#8250;</button>' +
    '</div></div>' +
    '</header>' +
    '<div class="menu-overlay" id="menuOverlay" onclick="window.toggleAbayaMenu()"></div>' +
    '<div class="mobile-nav-panel" id="mobileMenuPanel">' +
    '<div class="mobile-nav-top"><button type="button" onclick="window.toggleAbayaMenu()" style="background:none;border:none;font-size:26px;cursor:pointer">&times;</button></div>' +
    '<ul>' +
    '<li><a href="abaya.html" onclick="window.toggleAbayaMenu()">ABAYA</a></li>' +
    '<li><a href="cover-up.html" onclick="window.toggleAbayaMenu()">COVER UP</a></li>' +
    '<li><a href="tops-kurti.html" onclick="window.toggleAbayaMenu()">TOPS/KURTI</a></li>' +
    '<li><a href="premium-two-piece.html" onclick="window.toggleAbayaMenu()">PREMIUM TWO-PIECE</a></li>' +
    '<li><a href="embroidery.html" onclick="window.toggleAbayaMenu()">EMBROIDERY</a></li>' +
    '<li><a href="karchupi.html" onclick="window.toggleAbayaMenu()">KARCHUPI</a></li>' +
    '<li><a href="kaftan.html" onclick="window.toggleAbayaMenu()">KAFTAN</a></li>' +
    '<li><a href="hijab.html" onclick="window.toggleAbayaMenu()">HIJAB</a></li>' +
    '<li><a href="video.html" onclick="window.toggleAbayaMenu()">VIDEO</a></li>' +
    '<li><a href="category.html" onclick="window.toggleAbayaMenu()">ALL CATEGORIES</a></li>' +
    '<li><a href="/" onclick="window.toggleAbayaMenu()">HOME</a></li>' +
    '</ul></div>';

  var annIdx = 0;
  var annTimer = null;

  function showAnnSlide(index) {
    var slides = document.querySelectorAll('.ann-slide');
    if (!slides.length) return;
    slides.forEach(function (s) { s.classList.remove('active'); });
    annIdx = index;
    if (annIdx >= slides.length) annIdx = 0;
    if (annIdx < 0) annIdx = slides.length - 1;
    slides[annIdx].classList.add('active');
  }

  window.moveAnnouncement = function (step) {
    showAnnSlide(annIdx + step);
  };

  window.toggleAbayaMenu = function () {
    var menu = document.getElementById('mobileMenuPanel');
    var overlay = document.getElementById('menuOverlay');
    if (!menu) return;
    var willOpen = !menu.classList.contains('active');
    if (willOpen && typeof window.closeCartDrawer === 'function') {
      window.closeCartDrawer();
    }
    menu.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
  };

  function updateCartBadge(cartLines) {
    var badge = document.getElementById('cart-count');
    if (!badge) return;
    var total = 0;
    try {
      if (Array.isArray(cartLines) && typeof cartTotalQty === 'function') {
        total = cartTotalQty(cartLines);
      } else if (typeof cartTotalQty === 'function' && typeof loadStoreCart === 'function') {
        total = cartTotalQty(loadStoreCart());
      } else {
        var raw = localStorage.getItem('secured_checkout_cart') || localStorage.getItem('cart') || localStorage.getItem('user_cart') || '[]';
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(function (item) { total += parseInt(item.quantity, 10) || 0; });
        } else if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(function (k) { total += parseInt(parsed[k], 10) || 0; });
        }
      }
    } catch (e) {}
    if (total > 0) {
      badge.textContent = String(total);
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  var catalogLoadPromise = null;

  function ensureProductCatalog(cb) {
    if (window.CATEGORY_PRODUCTS && window.CATEGORY_NAV) {
      cb();
      return;
    }
    if (!catalogLoadPromise) {
      catalogLoadPromise = new Promise(function (resolve) {
        var existing = document.querySelector('script[src*="category-products.js"]');
        if (existing) {
          existing.addEventListener('load', resolve, { once: true });
          if (window.CATEGORY_PRODUCTS) resolve();
          return;
        }
        var s = document.createElement('script');
        s.src = siteAsset('category-products.js');
        s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { resolve(); };
        document.head.appendChild(s);
      });
    }
    catalogLoadPromise.then(cb);
  }

  function flattenCatalog() {
    var all = window.CATEGORY_PRODUCTS || {};
    var nav = window.CATEGORY_NAV || [];
    var hrefByKey = {};
    nav.forEach(function (n) {
      if (n.key) hrefByKey[n.key] = n.href || 'abaya.html';
    });
    var out = [];
    Object.keys(all).forEach(function (key) {
      (all[key] || []).forEach(function (p) {
        if (!p || !p.name) return;
        out.push({
          name: p.name,
          href: hrefByKey[key] || 'abaya.html',
          key: key
        });
      });
    });
    return out;
  }

  function initSiteSearch() {
    var openBtn = document.getElementById('navSearchOpen');
    var drawer = document.getElementById('siteSearchDrawer');
    var closeBtn = document.getElementById('siteSearchClose');
    var form = document.getElementById('siteSearchForm');
    var input = document.getElementById('siteSearchInput');
    var results = document.getElementById('siteSearchResults');
    if (!openBtn || !drawer || !input) return;

    var catalog = [];

    function setSearchOpen(open) {
      document.body.classList.toggle('site-search-open', open);
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
      openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        if (typeof window.closeCartDrawer === 'function') window.closeCartDrawer();
        var menu = document.getElementById('mobileMenuPanel');
        var overlay = document.getElementById('menuOverlay');
        if (menu) menu.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        window.setTimeout(function () { input.focus(); }, 80);
      } else {
        input.value = '';
        if (results) {
          results.hidden = true;
          results.innerHTML = '';
        }
      }
    }

    function renderResults(items) {
      if (!results) return;
      if (!items.length) {
        results.hidden = true;
        results.innerHTML = '';
        return;
      }
      results.innerHTML = items
        .slice(0, 8)
        .map(function (item) {
          var q = encodeURIComponent(input.value.trim());
          var href = siteAsset(item.href) + (q ? '?q=' + q : '');
          return '<li><a href="' + href + '">' + item.name.replace(/</g, '&lt;') + '</a></li>';
        })
        .join('');
      results.hidden = false;
    }

    function runSearch() {
      var q = input.value.trim().toLowerCase();
      if (!q) {
        renderResults([]);
        return;
      }
      ensureProductCatalog(function () {
        if (!catalog.length) catalog = flattenCatalog();
        var seen = {};
        var matches = catalog.filter(function (item) {
          if (item.name.toLowerCase().indexOf(q) === -1) return false;
          var id = item.name + '|' + item.href;
          if (seen[id]) return false;
          seen[id] = true;
          return true;
        });
        renderResults(matches);
      });
    }

    openBtn.addEventListener('click', function () {
      var willOpen = !document.body.classList.contains('site-search-open');
      setSearchOpen(willOpen);
      if (willOpen) ensureProductCatalog(function () { catalog = flattenCatalog(); });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function () { setSearchOpen(false); });
    }

    drawer.addEventListener('click', function (e) {
      if (e.target === drawer) setSearchOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('site-search-open')) {
        setSearchOpen(false);
      }
    });

    input.addEventListener('input', runSearch);

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = input.value.trim();
        if (!q) return;
        ensureProductCatalog(function () {
          if (!catalog.length) catalog = flattenCatalog();
          var qLower = q.toLowerCase();
          var first = null;
          for (var i = 0; i < catalog.length; i++) {
            if (catalog[i].name.toLowerCase().indexOf(qLower) !== -1) {
              first = catalog[i];
              break;
            }
          }
          window.location.href = siteAsset(first ? first.href : 'abaya.html') + '?q=' + encodeURIComponent(q);
        });
      });
    }
  }

  function isHomePage() {
    var path = window.location.pathname || '/';
    var file = path.split('/').pop() || '';
    return file === '' || file.toLowerCase() === 'index.html';
  }

  function syncSiteHeaderOffset() {
    var mount = document.getElementById('site-header-mount');
    if (!mount) return;
    document.documentElement.style.setProperty('--site-header-h', mount.offsetHeight + 'px');
  }

  function mountHeader() {
    var mount = document.getElementById('site-header-mount');
    if (!mount) return;
    mount.innerHTML = HEADER_HTML;
    document.body.classList.add('global-layout');
    if (!isHomePage()) {
      document.body.classList.add('has-sticky-header');
    }
    updateCartBadge();
    initSiteSearch();
    ensureProductCatalog(function () {});
    syncSiteHeaderOffset();
    window.addEventListener('resize', syncSiteHeaderOffset);
    if (annTimer) clearInterval(annTimer);
    annTimer = setInterval(function () { window.moveAnnouncement(1); }, 4000);
  }

  window.updateCartBadge = updateCartBadge;
  window.syncSiteHeaderOffset = syncSiteHeaderOffset;

  function ensureCartDrawerAssets() {
    if (document.querySelector('script[src*="cart-drawer.js?v=20260528b"]')) return;
    if (!document.querySelector('link[href*="cart-drawer.css?v=20260528b"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'cart-drawer.css?v=20260528b';
      document.head.appendChild(link);
    }
    var s = document.createElement('script');
    s.src = 'cart-drawer.js?v=20260528b';
    s.defer = true;
    document.body.appendChild(s);
  }

  function ensureGtmLoaded() {
    var hasInlineGtm = !!document.querySelector('script[src*="googletagmanager.com/gtm.js?id=' + GTM_ID + '"]');
    if (hasInlineGtm) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var firstScript = document.getElementsByTagName('script')[0];
    var gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(gtmScript, firstScript);
    } else {
      document.head.appendChild(gtmScript);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ensureGtmLoaded();
      mountHeader();
      ensureCartDrawerAssets();
    });
  } else {
    ensureGtmLoaded();
    mountHeader();
    ensureCartDrawerAssets();
  }
})();
