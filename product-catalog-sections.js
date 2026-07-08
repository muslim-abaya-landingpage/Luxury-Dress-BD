/**
 * ক্যাটাগরি সারি — মেনু ও HTML পেজের ম্যাপ (এক জায়গায় দেখুন)
 * product-links-data.js ও category-products.js এ একই ক্রম (①→⑧)
 *
 * enabled: true  → মেনুতে লিংক + হোম/All Categories-এ দেখাবে
 * enabled: false → প্রোডাক্ট না থাকলে মেনুতে ধূসর (Coming soon)
 * প্রোডাক্ট যোগ (category-products.js) করলে enabled:false হলেও মেনু অটো সক্রিয় হবে
 */
window.CATALOG_SECTIONS = [
  {
    key: "abaya",
    row: "①",
    menu: "ABAYA",
    menuBn: "আবায়া · বোরকা",
    page: "abaya.html",
    path: "/abaya",
    enabled: true
  },
  {
    key: "cover-up",
    row: "④",
    menu: "COVER UP",
    menuBn: "কভার আপ",
    page: "cover-up.html",
    path: "/cover-up",
    enabled: false
  },
  {
    key: "tops-kurti",
    row: "③",
    menu: "TOPS/KURTI",
    menuBn: "টপস/কুর্তি",
    page: "tops-kurti.html",
    path: "/tops-kurti",
    enabled: true
  },
  {
    key: "premium-two-piece",
    row: "②",
    menu: "PREMIUM TWO-PIECE",
    menuBn: "প্রিমিয়াম টু-পিস",
    page: "premium-two-piece.html",
    path: "/premium-two-piece",
    enabled: true
  },
  {
    key: "embroidery",
    row: "⑤",
    menu: "EMBROIDERY",
    menuBn: "এম্ব্রয়ডারি",
    page: "embroidery.html",
    path: "/embroidery",
    enabled: false
  },
  {
    key: "karchupi",
    row: "⑥",
    menu: "KARCHUPI",
    menuBn: "কারচুপি",
    page: "karchupi.html",
    path: "/karchupi",
    enabled: false
  },
  {
    key: "kaftan",
    row: "⑦",
    menu: "KAFTAN",
    menuBn: "কাফতান",
    page: "kaftan.html",
    path: "/kaftan",
    enabled: false
  },
  {
    key: "hijab",
    row: "⑧",
    menu: "HIJAB",
    menuBn: "হিজাব",
    page: "hijab.html",
    path: "/hijab",
    enabled: false
  },
  {
    key: "panjabi",
    row: "⑧",
    menu: "PANJABI",
    menuBn: "পাঞ্জাবী",
    page: "panjabi.html",
    path: "/panjabi",
    enabled: true
  }
];

/** মেনুতে অতিরিক্ত লিংক (ক্যাটালগ ছাড়া) */
window.SITE_NAV_EXTRAS = [
  {
    key: "video",
    menu: "VIDEO",
    page: "video.html",
    path: "/video",
    enabled: false
  }
];

window.isCatalogSectionEnabled = function (key) {
  var sections = window.CATALOG_SECTIONS || [];
  var extras = window.SITE_NAV_EXTRAS || [];
  var i;
  for (i = 0; i < sections.length; i++) {
    if (sections[i].key === key) return sections[i].enabled !== false;
  }
  for (i = 0; i < extras.length; i++) {
    if (extras[i].key === key) return extras[i].enabled !== false;
  }
  return true;
};

/**
 * CATALOG_SECTIONS থেকে CATEGORY_NAV / CATEGORY_META / খালি প্রোডাক্ট অ্যারে সিঙ্ক
 */
(function (g) {
  function syncCatalogFromSections() {
    var sections = g.CATALOG_SECTIONS;
    if (!sections || !sections.length) return;

    if (!g.CATEGORY_PRODUCTS) g.CATEGORY_PRODUCTS = {};
    if (!g.CATEGORY_META) g.CATEGORY_META = {};

    sections.forEach(function (sec) {
      if (!Array.isArray(g.CATEGORY_PRODUCTS[sec.key])) {
        g.CATEGORY_PRODUCTS[sec.key] = [];
      }
      if (!g.CATEGORY_META[sec.key]) {
        g.CATEGORY_META[sec.key] = { title: sec.menu };
      }
    });

    function isPrimaryName(name) {
      var s = String(name || "").toLowerCase();
      return (
        s.indexOf(" - back") === -1 &&
        s.indexOf("- back") === -1 &&
        s.indexOf(" - side") === -1 &&
        s.indexOf("- side") === -1
      );
    }

    function hubImageForKey(key) {
      var list = g.CATEGORY_PRODUCTS[key] || [];
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (!p || !isPrimaryName(p.name)) continue;
        
        var imgUrl = p.image || p.img;
        if (!imgUrl) continue;

        if (g.maCatalog && typeof g.maCatalog.resolveImageUrl === "function") {
          return g.maCatalog.resolveImageUrl(imgUrl);
        }
        return imgUrl;
      }
      return "";
    }

    function sectionShowsInNav(sec) {
      if (sec.enabled !== false) return true;
      if (g.maCatalog && typeof g.maCatalog.categoryHasProducts === "function") {
        return g.maCatalog.categoryHasProducts(sec.key);
      }
      var list = (g.CATEGORY_PRODUCTS || {})[sec.key];
      return (
        Array.isArray(list) &&
        list.some(function (p) {
          return p && (p.image || p.img || p.name);
        })
      );
    }

    var navFromSections = sections
      .filter(sectionShowsInNav)
      .map(function (sec) {
        var img = hubImageForKey(sec.key) || "images/Baby-Pink-Floral-Print.jpeg";
        return {
          key: sec.key,
          href: sec.path || "/" + sec.key,
          label: sec.menu,
          image: img
        };
      });

    var extras = (g.SITE_NAV_EXTRAS || [])
      .filter(function (ex) {
        return ex && ex.enabled !== false;
      })
      .map(function (ex) {
        return {
          key: ex.key,
          href: ex.path || "/" + ex.key,
          label: ex.menu,
          image: ""
        };
      });

    g.CATEGORY_NAV = navFromSections.concat(extras);

    if (typeof g.applyDynamicNavMenu === "function") {
      g.applyDynamicNavMenu();
    }
  }

  syncCatalogFromSections();
  g.syncCatalogFromSections = syncCatalogFromSections;
})(window);

