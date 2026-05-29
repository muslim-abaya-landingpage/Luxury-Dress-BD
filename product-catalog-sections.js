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
    menuBn: "আবায়া",
    page: "abaya.html",
    path: "/abaya",
    enabled: true
  },
  {
    key: "cover-up",
    row: "②",
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
    enabled: false
  },
  {
    key: "premium-two-piece",
    row: "④",
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
