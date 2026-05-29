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
        if (!p || !p.image || !isPrimaryName(p.name)) continue;
        if (g.maCatalog && typeof g.maCatalog.resolveImageUrl === "function") {
          return g.maCatalog.resolveImageUrl(p.image);
        }
        return p.image;
      }
      return "";
    }

    var navFromSections = sections.map(function (sec) {
      var img = hubImageForKey(sec.key) || "images/Baby-Pink-Floral-Print.jpeg";
      return {
        key: sec.key,
        href: sec.path || "/" + sec.key,
        label: sec.menu,
        image: img
      };
    });

    var extras = (g.CATEGORY_NAV || []).filter(function (n) {
      return n && n.key === "video";
    });

    g.CATEGORY_NAV = navFromSections.concat(extras);
  }

  syncCatalogFromSections();
  g.syncCatalogFromSections = syncCatalogFromSections;
})(window);
