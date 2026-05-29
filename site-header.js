(function () {
  var GTM_ID = 'GTM-ML7RL6BR';

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

  function buildNavMenuItems() {
    var sections = window.CATALOG_SECTIONS || [];
    var extras = window.SITE_NAV_EXTRAS || [];
    var items = sections.map(function (sec) {
      return {
        href: sec.path || "/" + sec.key,
        label: sec.menu,
        enabled: sec.enabled !== false
      };
    });
    extras.forEach(function (ex) {
      items.push({
        href: ex.path || "/" + ex.key,
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
        '<li><span class="nav-link-soon" aria-disabled="true" title="শীঘ্রই আসছে">' +
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
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path d="M21 21l-4.5-4.5"/></svg>';
  var ICON_BAG =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7a4 4 0 1 1 8 0"/><path d="M6 9h12a2 2 0 0 1 2 2v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-7a2 2 0 0 1 2-2z"/><circle cx="9" cy="14" r="0.6" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg>';
  var ICON_CHAT =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 3H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h3l3 3 3-3h3a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/><path d="M8 11h.01M12 11h.01M16 11h.01" stroke-width="2.5"/></svg>';
  var ICON_USER =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4.5"/></svg>';
  var ICON_MENU =
    '<svg class="nav-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
  var ICON_CHEV_LEFT =
    '<svg class="slider-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  var ICON_CHEV_RIGHT =
    '<svg class="slider-arrow-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  var HEADER_HTML =
    '<header class="abaya-main-header">' +
    '<div class="header-top-bar"><div class="custom-container"><div class="top-bar-content">' +
    '<a href="/help">Help</a> | <a href="/signup">Sign Up</a> | <a href="/signin">Sign In</a>' +
    '</div></div></div>' +
    '<div class="header-middle-nav"><div class="custom-container nav-row">' +
    '<div class="brand-text-logo"><a href="/" class="brand-logo-link" aria-label="Muslim Abaya Home">' +
    '<img class="brand-logo-img" data-src="assets/logo-muslim-abaya.svg" alt="" width="240" height="44" decoding="async">' +
  '<span class="brand-logo-fallback" aria-hidden="true">MUSLIM ABAYA</span></a></div>' +
    '<nav class="desktop-menu" aria-label="Main"><ul></ul></nav>' +
    '<div class="nav-icons">' +
    '<button type="button" class="nav-icon-btn" id="navSearchOpen" aria-label="Search" aria-expanded="false">' + ICON_SEARCH + '</button>' +
    '<button type="button" class="cart-drawer-trigger" data-cart-trigger="1" style="position:relative" aria-label="Cart">' + ICON_BAG + '<span id="cart-count">0</span></button>' +
    '<a href="https://wa.me/8801971642683" target="_blank" rel="noopener" aria-label="Message">' + ICON_CHAT + '</a>' +
    '<a href="/signin" aria-label="Account">' + ICON_USER + '</a>' +
    '<button type="button" class="nav-menu-btn" onclick="window.toggleAbayaMenu()" aria-label="Menu">' + ICON_MENU + '</button>' +
    '</div></div></div>' +
    '<div class="site-search-drawer" id="siteSearchDrawer" aria-hidden="true">' +
    '<div class="custom-container site-search-inner">' +
    '<div class="site-search-row">' +
    '<form class="site-search-form" id="siteSearchForm" role="search" autocomplete="off">' +
    ICON_SEARCH +
    '<input type="search" id="siteSearchInput" name="q" placeholder="Search" autocomplete="off" aria-label="Search products">' +
    '</form>' +
    '<button type="button" class="site-search-close" id="siteSearchClose" aria-label="Close search">&times;</button>' +
    '</div>' +
    '<ul class="site-search-results" id="siteSearchResults" hidden></ul>' +
    '</div></div>' +
    '<div class="header-announcement-bar"><div class="custom-container announcement-slider">' +
    '<button type="button" class="slider-arrow left-arrow" onclick="window.moveAnnouncement(-1)" aria-label="Previous">' + ICON_CHEV_LEFT + '</button>' +
    '<div class="announcement-content">' +
    '<div class="ann-slide active">EID COLLECTION 2026 – WHERE ELEGANCE MEETS CELEBRATION</div>' +
    '<div class="ann-slide">সারা দেশে দ্রুত ডেলিভারি • ক্যাশ অন হোম ডেলিভারি</div>' +
    '<div class="ann-slide">৩টি ড্রেস কিনুন, ফ্রি ডেলিভারি সুবিধা</div>' +
    '</div>' +
    '<button type="button" class="slider-arrow right-arrow" onclick="window.moveAnnouncement(1)" aria-label="Next">' + ICON_CHEV_RIGHT + '</button>' +
    '</div></div>' +
    '</header>' +
    '<div class="menu-overlay" id="menuOverlay" onclick="window.toggleAbayaMenu()"></div>' +
    '<div class="mobile-nav-panel" id="mobileMenuPanel">' +
    '<div class="mobile-nav-top"><button type="button" onclick="window.toggleAbayaMenu()" style="background:none;border:none;font-size:26px;cursor:pointer">&times;</button></div>' +
    '<ul></ul></div>';

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
        if (window.CATEGORY_PRODUCTS && window.CATEGORY_NAV) {
          resolve();
          return;
        }
        function loadScript(file) {
          return new Promise(function (done) {
            var src = siteAsset(file);
            if (document.querySelector('script[src*="' + file.split('?')[0] + '"]')) {
              done();
              return;
            }
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = function () { done(); };
            s.onerror = function () { done(); };
            document.head.appendChild(s);
          });
        }
        loadScript('product-catalog-sections.js?v=20260530d')
          .then(function () { return loadScript('product-catalog-sync.js?v=20260608'); })
          .then(function () { return loadScript('product-config.js?v=20260535'); })
          .then(function () { return loadScript('product-utils.js?v=20260535'); })
          .then(function () { return loadScript('category-products.js?v=20260535'); })
          .then(function () { return loadScript('product-links-data.js?v=20260535'); })
          .then(function () { return loadScript('product-catalog-loader.js?v=20260535'); })
          .then(resolve);
      });
    }
    catalogLoadPromise.then(cb);
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
    mount.innerHTML = HEADER_HTML;
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
    if (!isHomePage()) {
      document.body.classList.add('has-sticky-header');
    }
    if (typeof syncCartBadgeFromStore === "function") {
      syncCartBadgeFromStore();
    } else {
      updateCartBadge();
    }
    initSiteSearch();
    ensureProductCatalog(function () {
      if (typeof window.syncCatalogFromSections === "function") {
        window.syncCatalogFromSections();
      }
      applyDynamicNavMenu();
    });
    if (window.CATALOG_SECTIONS && window.CATALOG_SECTIONS.length) {
      applyDynamicNavMenu();
    }
    syncSiteHeaderOffset();
    window.addEventListener('resize', syncSiteHeaderOffset);
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

  function ensureCartDrawerAssets() {
    if (document.querySelector('script[src*="cart-drawer.js?v=20260530d"]')) return;
    if (!document.querySelector('link[href*="cart-drawer.css?v=20260530d"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'cart-drawer.css?v=20260530d';
      document.head.appendChild(link);
    }
    var s = document.createElement('script');
    s.src = 'cart-drawer.js?v=20260530d';
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
