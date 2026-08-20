(function () {
  var GTM_ID = 'GTM-ML7RL6BR';
  var SEO_VER = '20260603seo';
  var HEADER_CFG = window.SITE_HEADER_CONFIG || {};

  var TOP_BAR_FACEBOOK_FALLBACK =
    (HEADER_CFG.topBar && HEADER_CFG.topBar.facebookUrl) ||
    'https://www.facebook.com/muslimabayaofficial';
  var TOP_BAR_LINKS =
    (HEADER_CFG.topBar && Array.isArray(HEADER_CFG.topBar.links) && HEADER_CFG.topBar.links.length)
      ? HEADER_CFG.topBar.links
      : [
          { label: 'Help', href: '/help' },
          { label: 'Sign Up', href: '/signup' },
          { label: 'Sign In', href: '/signin' }
        ];

  var HEADER_BRAND = HEADER_CFG.brand || {
    name: 'Muslim Abaya',
    logoSrc: 'assets/logo-muslim-abaya.svg?v=20260603',
    logoAlt: 'Muslim Abaya',
    fallbackText: 'MUSLIM ABAYA'
  };

  var HEADER_WHATSAPP = HEADER_CFG.whatsapp || 'https://wa.me/8801970831783';

  var SEARCH_PLACEHOLDER = (HEADER_CFG.search && HEADER_CFG.search.placeholder) || 'Search';

  var ANNOUNCEMENTS =
    Array.isArray(HEADER_CFG.announcements) && HEADER_CFG.announcements.length
      ? HEADER_CFG.announcements
      : [
          '💎 PREMIUM MODEST WEAR | TIMELESS ELEGANCE & EVERYDAY COMFORT',
          '💎 Premium Modest Fashion | Elegant Abayas & Two-Piece Collections',
          '🚚 Buy 3 Dresses & Enjoy FREE Nationwide Delivery'
        ];

  (  function bootSiteSeo() {
    if (window.__maSiteSeoBoot) return;
    if (document.documentElement.getAttribute("data-seo-managed") === "full") return;
    if (document.querySelector('script[src*="site-seo.js"]')) {
      window.__maSiteSeoBoot = true;
      return;
    }
    window.__maSiteSeoBoot = true;
    function loadScript(src, next) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { if (next) next(); };
      s.onerror = function () { if (next) next(); };
      (document.head || document.documentElement).appendChild(s);
    }
    loadScript('site-seo-config.js?v=' + SEO_VER, function () {
      loadScript('site-seo.js?v=' + SEO_VER, function () {
        if (window.MaSiteSeo && typeof window.MaSiteSeo.apply === 'function') {
          window.MaSiteSeo.apply();
        }
      });
    });
  })();

  function getSocialUrl(key, fallback) {
    var seo = window.SITE_SEO;
    if (seo && seo.social && seo.social[key]) return seo.social[key];
    return fallback;
  }

  (function stripIndexHtmlFromUrl() {
    try {
      if (window.location.protocol === 'file:') return;
      var path = window.location.pathname || '';
      if (/\/index\.html$/i.test(path)) {
        var clean = path.replace(/\/index\.html$/i, '/') || '/';
        history.replaceState(null, '', clean + window.location.search + window.location.hash);
      }
    } catch (urlErr) {}
  })();

  (function injectEarlyHints() {
    if (!document.head) return;
    var added = {};
    function hint(rel, href, crossOrigin) {
      if (!href || added[href]) return;
      added[href] = true;
      var link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      if (crossOrigin) link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
    hint('preconnect', 'https://fonts.googleapis.com');
    hint('preconnect', 'https://fonts.gstatic.com', true);
    hint('dns-prefetch', 'https://www.googletagmanager.com');
    hint('dns-prefetch', 'https://www.youtube.com');
    hint('dns-prefetch', 'https://www.youtube-nocookie.com');
    hint('preconnect', 'https://i.ytimg.com');
    hint('dns-prefetch', 'https://cdnjs.cloudflare.com');
  })();

  function getSiteRoot() {
    var path = window.location.pathname || '/';
    var slash = path.lastIndexOf('/');
    if (slash <= 0) return '/';
    return path.slice(0, slash + 1);
  }

  /** Always relative paths — works on file:// and https:// */
  function siteAsset(file) {
    return String(file || '').replace(/^\//, '');
  }

  function prefersCleanUrls() {
    return window.location.protocol === 'https:' || window.location.protocol === 'http:';
  }

  function routeToHtmlFile(route) {
    var full = String(route || '/');
    var query =
      full.indexOf('?') >= 0 ? '?' + full.split('?').slice(1).join('?') : '';
    var r = full.split('?')[0];
    var htmlName = r.match(/([^/\\]+\.html?)$/i);
    if (htmlName) return htmlName[1] + query;
    if (!r || r === '/') return 'index.html' + query;
    r = r.replace(/^\/[A-Za-z]:\/+/, '').replace(/^\/+/, '');
    if (r.charAt(0) !== '/') r = '/' + r;
    if (/\.html?$/i.test(r)) return r.replace(/^\//, '') + query;
    var file = SITE_ROUTE_FILES[r];
    if (!file && window.CATALOG_SECTIONS) {
      var sections = window.CATALOG_SECTIONS;
      for (var si = 0; si < sections.length; si++) {
        var sec = sections[si];
        if (sec.path === r || '/' + sec.key === r) {
          file = sec.page;
          break;
        }
      }
    }
    return (file || r.replace(/^\//, '') + '.html') + query;
  }

  var SITE_ROUTE_FILES = {
    '/': 'index.html',
    '/abaya': 'abaya.html',
    '/cover-up': 'cover-up.html',
    '/tops-kurti': 'tops-kurti.html',
    '/premium-two-piece': 'premium-two-piece.html',
    '/embroidery': 'embroidery.html',
    '/karchupi': 'karchupi.html',
    '/kaftan': 'kaftan.html',
    '/hijab': 'hijab.html',
    '/panjabi': 'panjabi.html',
    '/video': 'video.html',
    '/category': 'category.html',
    '/checkout': 'checkout.html',
    '/product-links': 'product-links.html',
    '/product-manager': 'product-manager.html',
    '/about': 'about.html',
    '/help': 'help.html',
    '/signin': 'signin.html',
    '/signup': 'signup.html',
    '/terms': 'terms.html',
    '/refund': 'refund.html',
    '/thank-you': 'thank-you.html',
    '/success': 'success.html'
  };

  var CLEAN_ROUTE_FROM_FILE = (function () {
    var map = { 'index.html': '/' };
    Object.keys(SITE_ROUTE_FILES).forEach(function (route) {
      var file = SITE_ROUTE_FILES[route];
      if (file && route !== '/') map[file] = route;
    });
    return map;
  })();

  function siteHref(route) {
    var file = routeToHtmlFile(route);
    if (!prefersCleanUrls()) return file;
    var q = file.indexOf('?') >= 0 ? file.slice(file.indexOf('?')) : '';
    var base = q ? file.slice(0, file.indexOf('?')) : file;
    var clean = CLEAN_ROUTE_FROM_FILE[base];
    if (clean) return clean + q;
    return file;
  }

  function categoryHasProducts(key) {
    if (window.maCatalog && typeof window.maCatalog.categoryHasProducts === "function") {
      return window.maCatalog.categoryHasProducts(key);
    }
    var list = (window.CATEGORY_PRODUCTS || {})[key];
    return (
      Array.isArray(list) &&
      list.some(function (p) {
        return p && (p.image || p.name);
      })
    );
  }

  /** মেনু সক্রিয়: enabled:true অথবা ওই ক্যাটাগরিতে অন্তত ১টি প্রোডাক্ট */
  function navItemEnabledForSection(sec) {
    if (sec && sec.key && categoryHasProducts(sec.key)) return true;
    return sec.enabled !== false;
  }
function buildNavMenuItems() {
    var sections = window.CATALOG_SECTIONS || [];
    var extras = window.SITE_NAV_EXTRAS || [];

    // মূল ক্যাটাগরিগুলোর জন্য আসল পেজ পাথ (sec.path, যেমন "/tops-kurti") ব্যবহার করা হচ্ছে —
    // আগে এখানে "#" + key দিয়ে হ্যাশ-লিংক বানানো হতো, যেটা siteHref() দিয়ে গেলে
    // "#tops-kurti.html"-এর মতো একটা অকেজো স্ট্রিং তৈরি করত। ব্রাউজার "#" দিয়ে শুরু হওয়া
    // যেকোনো href-কে শুধু বর্তমান পেজের ভেতরের একটা fragment হিসেবে ধরে — তাই ক্লিক করলে
    // পেজই বদলাতো না। এখন সঠিক পাথ ব্যবহার করা হচ্ছে, যাতে মেনু ক্লিক করলে আসল ক্যাটাগরি পেজে যায়।
    var items = sections.map(function (sec) {
      var href = sec.path || ("/" + String(sec.key || "").replace(/\.html$/i, "").trim());
      return {
        href: href,
        label: sec.menu,
        enabled: navItemEnabledForSection(sec)
      };
    });

    extras.forEach(function (ex) {
      var href = ex.path || ("/" + String(ex.key || "").replace(/\.html$/i, "").trim());
      items.push({
        href: href,
        label: ex.menu,
        enabled: ex.enabled !== false
      });
    });

    return items;
}
  function renderNavMenuItem(it, mobile) {
    var label = String(it.label || "");
    if (it.enabled === false) {
      return (
        '<li><span class="nav-link-soon" aria-disabled="true" title="Coming Soon">' +
        label +
        "</span></li>"
      );
    }
    var href = siteHref(it.href);
    if (mobile) {
      return (
        '<li><a href="' +
        href +
        '" onclick="window.toggleAbayaMenu()">' +
        label +
        "</a></li>"
      );
    }
    return '<li><a href="' + href + '">' + label + "</a></li>";
  }

  function applyDynamicNavMenu() {
    var items = buildNavMenuItems();
    if (!items.length) return;
    var desktop = document.querySelector(".desktop-menu ul");
    if (desktop) {
      desktop.innerHTML = items.map(function (it) {
        return renderNavMenuItem(it, false);
      }).join("");
    }
    var mobile = document.querySelector("#mobileMenuPanel ul");
    if (mobile) {
      mobile.innerHTML =
        items
          .map(function (it) {
            return renderNavMenuItem(it, true);
          })
          .join("") +
        '<li><a href="' +
        siteHref("/category") +
        '" onclick="window.toggleAbayaMenu()">ALL CATEGORIES</a></li>' +
        '<li><a href="' +
        siteHref("/") +
        '" onclick="window.toggleAbayaMenu()">HOME</a></li>';
    }
    fixAllPageLinks();
  }

  function fixHeaderLinks(root) {
    if (!root) return;
    root.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (!href || href.indexOf('http') === 0 || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 || href.indexOf('#') === 0) return;
      if (href.charAt(0) === '/' || /^\/[A-Za-z]:/.test(href)) {
        a.setAttribute('href', siteHref(href));
        return;
      }
      if (!/\.html?$/i.test(href) && href.indexOf('?') === -1 && href.indexOf('/') === -1) {
        a.setAttribute('href', siteHref('/' + href));
      }
    });
  }

  /** Breadcrumb / body links — href="/" works on Netlify; file:// needs real .html paths */
  function fixAllPageLinks() {
    fixHeaderLinks(document.body);
  }
  var ICON_SEARCH =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 22L20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_BAG =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.5 7.67V6.7C7.5 4.45 9.31 2.24 11.56 2.03C14.24 1.77 16.5 3.88 16.5 6.51V7.89" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 22H15C19.02 22 19.74 20.39 19.95 18.43L20.7 12.43C20.97 9.99 20.27 8 16 8H8C3.73 8 3.03 9.99 3.3 12.43L4.05 18.43C4.26 20.39 4.98 22 9 22Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 12H15.51" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8.5 12H8.51" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_CHAT =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.5 19H8c-4 0-6-1-6-6V8c0-4 2-6 6-6h8c4 0 6 2 6 6v5c0 4-2 6-6 6h-.5c-.31 0-.61.15-.8.4l-1.5 2c-.66.88-1.74.88-2.4 0l-1.5-2c-.16-.22-.53-.4-.8-.4z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 11h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 11h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 11h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var ICON_USER =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_MENU =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
  var ICON_CHEV_LEFT =
    '<svg class="slider-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var ICON_CHEV_RIGHT =
    '<svg class="slider-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function buildAnnouncementSlidesHtml() {
    return ANNOUNCEMENTS.map(function (text, i) {
      return '<div class="ann-slide' + (i === 0 ? ' active' : '') + '">' + text + '</div>';
    }).join('');
  }

  function buildTopBarLinksHtml() {
    return TOP_BAR_LINKS.map(function (l) {
      return '<a href="' + l.href + '">' + l.label + '</a>';
    }).join(' | ');
  }

  function buildHeaderHtml() {
    var fbUrl = getSocialUrl('facebook', TOP_BAR_FACEBOOK_FALLBACK);
    return (
    '<header class="abaya-main-header">' +
    '<div class="header-top-bar"><div class="custom-container"><div class="top-bar-content">' +
    '<a href="' + fbUrl + '" target="_blank" rel="noopener noreferrer">Facebook</a> | ' +
    buildTopBarLinksHtml() +
    '</div></div></div>' +
    '<div class="header-middle-nav"><div class="custom-container nav-row">' +
    '<div class="brand-text-logo"><a href="/" class="brand-logo-link" aria-label="' + HEADER_BRAND.name + ' Home">' +
    '<img class="brand-logo-img" src="' + HEADER_BRAND.logoSrc + '" alt="' + HEADER_BRAND.logoAlt + '" width="220" height="46" decoding="async" fetchpriority="high">' +
  '<span class="brand-logo-fallback" aria-hidden="true">' + HEADER_BRAND.fallbackText + '</span></a></div>' +
    '<nav class="desktop-menu" aria-label="Main"><ul></ul></nav>' +
    '<div class="nav-icons">' +
    '<button type="button" class="nav-icon-btn" id="navSearchOpen" aria-label="Search" aria-expanded="false">' + ICON_SEARCH + '</button>' +
    '<button type="button" class="cart-drawer-trigger" data-cart-trigger="1" style="position:relative" aria-label="Cart">' + ICON_BAG + '<span id="cart-count">0</span></button>' +
    '<a href="' + HEADER_WHATSAPP + '" target="_blank" rel="noopener" aria-label="Message">' + ICON_CHAT + '</a>' +
    '<a href="/signin" aria-label="Account">' + ICON_USER + '</a>' +
    '<button type="button" class="nav-menu-btn" onclick="window.toggleAbayaMenu()" aria-label="Menu">' + ICON_MENU + '</button>' +
    '</div></div></div>' +
    '<div class="site-search-drawer" id="siteSearchDrawer" aria-hidden="true">' +
    '<div class="custom-container site-search-inner">' +
    '<div class="site-search-row">' +
    '<form class="site-search-form" id="siteSearchForm" role="search" autocomplete="off">' +
    ICON_SEARCH +
    '<input type="search" id="siteSearchInput" name="q" placeholder="' + SEARCH_PLACEHOLDER + '" autocomplete="off" aria-label="Search products">' +
    '</form>' +
    '<button type="button" class="site-search-close" id="siteSearchClose" aria-label="Close search">&times;</button>' +
    '</div>' +
    '<ul class="site-search-results" id="siteSearchResults" hidden></ul>' +
    '</div></div>' +
    '<div class="header-announcement-bar"><div class="custom-container announcement-slider">' +
    '<button type="button" class="slider-arrow left-arrow" onclick="window.moveAnnouncement(-1)" aria-label="Previous">' + ICON_CHEV_LEFT + '</button>' +
    '<div class="announcement-content">' +
    buildAnnouncementSlidesHtml() +
    '</div>' +
    '<button type="button" class="slider-arrow right-arrow" onclick="window.moveAnnouncement(1)" aria-label="Next">' + ICON_CHEV_RIGHT + '</button>' +
    '</div></div>' +
    '</header>' +
    '<div class="menu-overlay" id="menuOverlay" onclick="window.toggleAbayaMenu()"></div>' +
    '<div class="mobile-nav-panel" id="mobileMenuPanel">' +
    '<div class="mobile-nav-top"><button type="button" onclick="window.toggleAbayaMenu()" style="background:none;border:none;font-size:26px;cursor:pointer">&times;</button></div>' +
    '<ul></ul></div>'
    );
  }
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
        total = cartTotalQty(loadStoreCart({ readOnly: true }));
      } else {
        var raw = localStorage.getItem('secured_checkout_cart') || localStorage.getItem('category_cart_v2') || localStorage.getItem('user_cart') || localStorage.getItem('cart') || '[]';
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(function (item) { total += parseInt(item.quantity, 10) || 0; });
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

  function catalogReady() {
    return !!(
      window.CATALOG_SECTIONS &&
      window.CATALOG_SECTIONS.length &&
      window.CATEGORY_PRODUCTS
    );
  }

  function waitForCatalogReady(done, tries) {
    if (catalogReady() || (tries || 0) > 150) {
      done();
      return;
    }
    setTimeout(function () {
      waitForCatalogReady(done, (tries || 0) + 1);
    }, 25);
  }

  function ensureProductCatalog(cb) {
    function finish() {
      if (typeof window.syncCatalogFromSections === "function") {
        window.syncCatalogFromSections();
      }
      if (typeof window.refreshFooterShopLinks === "function") {
        window.refreshFooterShopLinks();
      }
      try {
        window.dispatchEvent(new CustomEvent("ma:catalog-ready"));
      } catch (e) {}
      cb();
    }
    if (catalogReady()) {
      finish();
      return;
    }
    if (!catalogLoadPromise) {
      catalogLoadPromise = new Promise(function (resolve) {
        function loadScript(file) {
          return new Promise(function (done) {
            var base = file.split("?")[0];
            var existing = document.querySelector('script[src*="' + base + '"]');
            if (existing) {
              waitForCatalogReady(done, 0);
              return;
            }
            var s = document.createElement("script");
            s.src = siteAsset(file);
            s.async = true;
            s.onload = function () {
              s.setAttribute("data-loaded", "1");
              done();
            };
            s.onerror = function () {
              done();
            };
            document.head.appendChild(s);
          });
        }
        loadScript("product-catalog-sync.js?v=20260531nav2")
          .then(function () {
            return loadScript("product-config.js?v=20260819audit");
          })
          .then(function () {
            return loadScript("product-utils.js?v=20260820stock");
          })
          .then(function () {
            return loadScript("category-products.js?v=20260820clean");
          })
          .then(function () {
            return loadScript("product-links-data.js?v=20260535");
          })
          .then(function () {
            return loadScript("product-catalog-loader.js?v=20260535");
          })
          .then(function () {
            waitForCatalogReady(resolve, 0);
          });
      });
    }
    catalogLoadPromise.then(finish);
  }

  function flattenCatalog() {
    var all = window.CATEGORY_PRODUCTS || {};
    var nav = window.CATEGORY_NAV || [];
    var hrefByKey = {};
    nav.forEach(function (n) {
      if (n.key) hrefByKey[n.key] = n.href || '/abaya';
    });
    var out = [];
    Object.keys(all).forEach(function (key) {
      (all[key] || []).forEach(function (p) {
        if (!p || !p.name) return;
        out.push({
          name: p.name,
          href: hrefByKey[key] || '/abaya',
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

    function buildSearchMatches(query) {
      var q = String(query || '').trim();
      if (!q) return [];
      var all = window.CATEGORY_PRODUCTS || {};
      var meta = window.CATEGORY_META || {};
      var nav = window.CATEGORY_NAV || [];
      var hrefByKey = {};
      nav.forEach(function (n) {
        if (n.key) hrefByKey[n.key] = n.href || '/abaya';
      });
      if (window.maSearch) {
        var terms = window.maSearch.getTerms(q);
        var seen = {};
        var out = [];
        Object.keys(all).forEach(function (key) {
          var catProducts = all[key] || [];
          var categoryHit = window.maSearch.categoryMatches(key, meta, q);
          catProducts.forEach(function (p) {
            if (!p || !p.name) return;
            var id = p.id || p.name;
            if (seen[id]) return;
            if (categoryHit || window.maSearch.productMatches(p, key, meta, q)) {
              seen[id] = true;
              out.push({
                name: p.name,
                href: hrefByKey[key] || '/abaya',
                key: key
              });
            }
          });
        });
        return out;
      }
      if (!catalog.length) catalog = flattenCatalog();
      var qLower = q.toLowerCase();
      var seenLegacy = {};
      return catalog.filter(function (item) {
        if (item.name.toLowerCase().indexOf(qLower) === -1) return false;
        var id = item.name + '|' + item.href;
        if (seenLegacy[id]) return false;
        seenLegacy[id] = true;
        return true;
      });
    }

    function renderResults(items) {
      if (!results) return;
      if (!items.length) {
        results.hidden = true;
        results.innerHTML = '';
        return;
      }
      results.innerHTML = items
        .slice(0, 12)
        .map(function (item) {
          var q = encodeURIComponent(input.value.trim());
          var href = siteHref(item.href) + (q ? '?q=' + q : '');
          return '<li><a href="' + href + '">' + item.name.replace(/</g, '&lt;') + '</a></li>';
        })
        .join('');
      results.hidden = false;
    }

    function runSearch() {
      var q = input.value.trim();
      if (!q) {
        renderResults([]);
        return;
      }
      ensureProductCatalog(function () {
        renderResults(buildSearchMatches(q));
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

    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('site-search-open')) return;
      if (drawer.contains(e.target) || openBtn.contains(e.target)) return;
      setSearchOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('site-search-open')) {
        setSearchOpen(false);
      }
    });

    input.addEventListener('input', runSearch);

    try {
      var urlQ = new URLSearchParams(window.location.search).get('q');
      if (urlQ) input.value = urlQ;
    } catch (prefillErr) {}

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = input.value.trim();
        if (!q) return;
        ensureProductCatalog(function () {
          var href = '/abaya';
          if (window.maSearch) {
            href = window.maSearch.pickRedirectHref(
              q,
              window.CATEGORY_NAV,
              window.CATEGORY_META,
              window.CATEGORY_PRODUCTS
            );
          } else {
            if (!catalog.length) catalog = flattenCatalog();
            var matches = buildSearchMatches(q);
            if (matches.length) href = matches[0].href;
          }
          window.location.href = siteHref(href) + '?q=' + encodeURIComponent(q);
        });
      });
    }
  }

  function syncSiteHeaderOffset() {
    var mount = document.getElementById('site-header-mount');
    if (!mount) return;
    // The header itself is position:fixed (see .abaya-main-header in
    // site-header.css), so it's removed from normal document flow —
    // measuring mount.offsetHeight here only reports the mount's own
    // static placeholder height (min-height:148px), completely
    // disconnected from the real header's rendered height. That mismatch
    // is what let the fixed header float taller than its reserved space
    // and cover the top of whatever came after it (e.g. the homepage
    // hero banner). Measure the actual fixed header element instead, and
    // push that real height back onto the placeholder so they always match.
    var header = mount.querySelector('.abaya-main-header') || mount.firstElementChild;
    var realHeight = header ? header.offsetHeight : mount.offsetHeight;
    if (realHeight) {
      mount.style.minHeight = realHeight + 'px';
      document.documentElement.style.setProperty('--site-header-h', realHeight + 'px');
    }
  }

  var prefetchedUrls = Object.create(null);
  var prefetchTimer = 0;

  function canPrefetch() {
    try {
      var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn && (conn.saveData || /(^2g$|^slow-2g$)/.test(String(conn.effectiveType || '')))) return false;
    } catch (e) {}
    return true;
  }

  function prefetchPage(url) {
    if (!url || prefetchedUrls[url] || !canPrefetch()) return;
    prefetchedUrls[url] = true;
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = url;
    document.head.appendChild(link);
  }

  function resolveInternalUrl(anchor) {
    if (!anchor) return '';
    var href = anchor.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || /^mailto:|^tel:|^javascript:/i.test(href)) return '';
    if (/^https?:\/\//i.test(href)) {
      try {
        var target = new URL(href, window.location.href);
        if (target.origin !== window.location.origin) return '';
        href = target.pathname + target.search;
      } catch (err) {
        return '';
      }
    }
    if (href.charAt(0) === '/' || /^\/[A-Za-z]:/.test(href)) return siteHref(href);
    if (/\.html?$/i.test(href) || href.indexOf('?') >= 0) return href;
    return '';
  }

  function initFastNavigation() {
    if (!canPrefetch()) return;

    var warmRoutes = [
      '/',
      '/abaya',
      '/premium-two-piece',
      '/embroidery',
      '/karchupi',
      '/kaftan',
      '/hijab',
      '/panjabi',
      '/video',
      '/category',
      '/checkout'
    ];

    function warmPopularPages() {
      warmRoutes.forEach(function (route) {
        try {
          prefetchPage(siteHref(route));
        } catch (e) {}
      });
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(warmPopularPages, { timeout: 2000 });
    } else {
      setTimeout(warmPopularPages, 800);
    }

    function schedulePrefetch(anchor) {
      var url = resolveInternalUrl(anchor);
      if (!url) return;
      clearTimeout(prefetchTimer);
      prefetchTimer = setTimeout(function () {
        prefetchPage(url);
      }, 45);
    }

    document.addEventListener('mouseover', function (ev) {
      var anchor = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (anchor) schedulePrefetch(anchor);
    }, true);

    document.addEventListener('touchstart', function (ev) {
      var anchor = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (anchor) schedulePrefetch(anchor);
    }, { passive: true, capture: true });

    document.addEventListener('focusin', function (ev) {
      var anchor = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
      if (anchor) schedulePrefetch(anchor);
    }, true);
  }

  function mountHeader() {
    var mount = document.getElementById('site-header-mount');
    if (!mount) return;
    mount.innerHTML = buildHeaderHtml();
    mount.querySelectorAll(".brand-logo-img[data-src]").forEach(function (img) {
      var link = img.closest(".brand-logo-link");
      img.src = siteAsset(img.getAttribute("data-src") || "assets/logo-muslim-abaya.svg");
      img.onerror = function () {
        img.style.display = "none";
        if (link) link.classList.add("brand-logo-failed");
      };
    });
    fixHeaderLinks(mount);
    document.body.classList.add('global-layout');
    document.body.classList.add('has-sticky-header');
    if (typeof syncCartBadgeFromStore === "function") {
      syncCartBadgeFromStore();
    } else {
      updateCartBadge();
    }
    initSiteSearch();
    ensureProductCatalog(function () {
      var applyNav = function () {
        applyDynamicNavMenu();
        syncSiteHeaderOffset();
      };
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(applyNav, { timeout: 600 });
      } else {
        applyNav();
      }
    });
    syncSiteHeaderOffset();
    window.addEventListener('resize', syncSiteHeaderOffset);
    if (document.fonts && typeof document.fonts.ready === 'object' && document.fonts.ready.then) {
      document.fonts.ready.then(syncSiteHeaderOffset);
    }
    if (annTimer) clearInterval(annTimer);
    annTimer = setInterval(function () { window.moveAnnouncement(1); }, 4000);
    initFastNavigation();
    fixAllPageLinks();
  }

  window.updateCartBadge = updateCartBadge;
  window.initFastNavigation = initFastNavigation;
  window.prefetchPage = prefetchPage;
  window.syncSiteHeaderOffset = syncSiteHeaderOffset;
  window.siteHref = siteHref;
  window.siteAsset = siteAsset;
  window.fixAllPageLinks = fixAllPageLinks;
  window.applyDynamicNavMenu = applyDynamicNavMenu;

  function ensureCartDrawerAssets() {
    if (!document.querySelector('link[href*="cart-drawer.css"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'cart-drawer.css?v=20260820fixui';
      document.head.appendChild(link);
    }
    if (document.querySelector('script[src*="cart-drawer.js"]')) return;
    if (!document.querySelector('link[href*="qty-stepper.css"]')) {
      var qtyCss = document.createElement('link');
      qtyCss.rel = 'stylesheet';
      qtyCss.href = 'qty-stepper.css?v=20260531qty';
      document.head.appendChild(qtyCss);
    }
    var s = document.createElement('script');
    s.src = 'cart-drawer.js?v=20260820fixui';
    s.defer = true;
    document.body.appendChild(s);
  }

  function ensureGtmLoaded() {
    if (window.__maGtmLoaded) return;
    var hasInlineGtm = !!document.querySelector('script[src*="googletagmanager.com/gtm.js?id=' + GTM_ID + '"]');
    if (hasInlineGtm) {
      window.__maGtmLoaded = true;
      return;
    }
    window.__maGtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
    document.head.appendChild(gtmScript);
  }

  /** GTM — interaction or idle (LCP-friendly) */
  function scheduleDeferredGtm() {
    if (window.__maGtmScheduled) return;
    window.__maGtmScheduled = true;
    var fired = false;
    function run() {
      if (fired) return;
      fired = true;
      ensureGtmLoaded();
    }
    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (ev) {
      window.addEventListener(ev, run, { once: true, passive: true });
    });
    // Hard cap: ad visitors who bounce in a few seconds must still register
    // the Meta/GA4 PageView. Fires by 2.5s at the latest regardless of idle.
    window.setTimeout(run, 2500);
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: 2500 });
    }
    // Last-resort: fire before the user leaves so the pageview is never lost.
    window.addEventListener('pagehide', run, { once: true });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') run();
    });
  }
  function runHeaderBoot() {
    mountHeader();
    ensureCartDrawerAssets();
    scheduleDeferredGtm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runHeaderBoot);
  } else {
    runHeaderBoot();
  }
})();
