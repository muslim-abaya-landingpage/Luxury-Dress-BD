/**
 * Page-level SEO: meta, canonical, Open Graph, JSON-LD, Facebook/social connect block.
 */
(function (global) {
  var CFG = global.SITE_SEO || {};
  var SITE = String(CFG.siteUrl || "https://muslimabaya.com").replace(/\/$/, "");
  var BRAND = CFG.brand || "Muslim Abaya";
  var DEFAULT_IMG = CFG.defaultImage || SITE + "/images/Baby-Pink-Floral-Print.jpeg";
  var SOCIAL = CFG.social || {};

  function normalizePath(pathname) {
    var p = String(pathname || "/");
    p = p.replace(/\/index\.html$/i, "/");
    p = p.replace(/\.html$/i, "");
    if (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
    return p || "/";
  }

  function pathToCanonical(path) {
    if (path === "/" || path === "") return SITE + "/";
    return SITE + path;
  }

  function upsertMeta(selector, attr, key, content) {
    if (!content) return;
    var el = document.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function upsertLink(rel, href) {
    if (!href) return;
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function upsertJsonLd(id, data) {
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function findCategoryMeta(key) {
    if (!key) return null;
    var cats = CFG.categories || {};
    if (cats[key]) return cats[key];
    var sections = global.CATALOG_SECTIONS || [];
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].key === key) {
        var label = sections[i].menuBn || sections[i].menu || key;
        return {
          title: label + " | " + BRAND,
          description:
            label +
            " কালেকশন — প্রিমিয়াম মডেস্ট ফ্যাশন, ক্যাশ অন ডেলিভারি। " +
            BRAND +
            " (muslimabaya.com)।"
        };
      }
    }
    return null;
  }

  function resolvePageMeta() {
    var path = normalizePath(global.location && global.location.pathname);
    var pages = CFG.pages || {};
    if (pages[path]) return { path: path, meta: pages[path] };

    var body = document.body;
    var catKey = body && body.getAttribute("data-shop-category");
    if (catKey) {
      var cm = findCategoryMeta(catKey);
      if (cm) return { path: path, meta: cm, categoryKey: catKey };
    }
    return {
      path: path,
      meta: {
        title: BRAND + " | muslimabaya.com",
        description:
          BRAND +
          " — বাংলাদেশে প্রিমিয়াম আবায়া ও মডেস্ট ফ্যাশন। ক্যাশ অন ডেলিভারি।"
      }
    };
  }

  function homeSeoManaged() {
    return (
      document.documentElement.getAttribute("data-seo-managed") === "full" ||
      !!document.querySelector('meta[property="og:url"][content="https://muslimabaya.com/"]')
    );
  }

  function applyDocumentMeta(info) {
    var meta = info.meta || {};
    var canonical = pathToCanonical(info.path);
    var title = meta.title || BRAND;
    var desc = meta.description || "";
    var image = meta.image || DEFAULT_IMG;

    if (title && document.title !== title) document.title = title;

    upsertMeta('meta[name="description"]', "name", "description", desc);
    upsertMeta('meta[name="robots"]', "name", "robots", meta.robots || "index, follow");
    upsertLink("canonical", canonical);

    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", BRAND);
    upsertMeta('meta[property="og:locale"]', "property", "og:locale", CFG.locale || "bn_BD");
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", desc);
    upsertMeta('meta[property="og:image"]', "property", "og:image", image);
    upsertMeta('meta[property="og:type"]', "property", "og:type", meta.ogType || "website");
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);

    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", desc);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);

    if (!document.querySelector('link[rel="sitemap"]')) {
      var sm = document.createElement("link");
      sm.rel = "sitemap";
      sm.type = "application/xml";
      sm.title = "Sitemap";
      sm.href = "/sitemap.xml";
      document.head.appendChild(sm);
    }
    if (!document.getElementById("ma-seo-css")) {
      var css = document.createElement("link");
      css.id = "ma-seo-css";
      css.rel = "stylesheet";
      css.href = "site-seo.css?v=20260531seo";
      document.head.appendChild(css);
    }
    if (/\/signin$|\/signup$/.test(info.path)) {
      upsertMeta('meta[name="robots"]', "name", "robots", "noindex, nofollow");
    }
  }

  function buildOrganizationSchema() {
    var sameAs = [];
    ["facebook", "instagram", "youtube", "tiktok"].forEach(function (k) {
      if (SOCIAL[k]) sameAs.push(SOCIAL[k]);
    });
    return {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": SITE + "/#organization",
      name: BRAND,
      alternateName: ["muslimabaya", "muslimabaya.com"],
      url: SITE + "/",
      logo: DEFAULT_IMG,
      sameAs: sameAs,
      contactPoint: {
        "@type": "ContactPoint",
        telephone: CFG.phone || "+8801971642683",
        contactType: "customer service",
        areaServed: "BD",
        availableLanguage: ["bn", "en"]
      }
    };
  }

  function buildBreadcrumbSchema(path, categoryLabel) {
    var items = [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }
    ];
    if (categoryLabel && path !== "/") {
      items.push({
        "@type": "ListItem",
        position: 2,
        name: categoryLabel,
        item: pathToCanonical(path)
      });
    } else if (path !== "/") {
      var pageName = (CFG.pages[path] && CFG.pages[path].title) || path.replace(/^\//, "");
      items.push({
        "@type": "ListItem",
        position: 2,
        name: pageName.split("|")[0].trim(),
        item: pathToCanonical(path)
      });
    }
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items
    };
  }

  function buildCollectionSchema(path, categoryKey, label) {
    var count = 0;
    if (categoryKey && global.CATEGORY_PRODUCTS && global.CATEGORY_PRODUCTS[categoryKey]) {
      count = global.CATEGORY_PRODUCTS[categoryKey].length;
    }
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: label || categoryKey,
      url: pathToCanonical(path),
      description: (CFG.categories && CFG.categories[categoryKey] && CFG.categories[categoryKey].description) || "",
      numberOfItems: count,
      isPartOf: { "@id": SITE + "/#website" }
    };
  }

  function applyStructuredData(info) {
    if (homeSeoManaged()) return;
    upsertJsonLd("ma-seo-organization", buildOrganizationSchema());
    var label = "";
    if (info.categoryKey && global.CATALOG_SECTIONS) {
      global.CATALOG_SECTIONS.forEach(function (s) {
        if (s.key === info.categoryKey) label = s.menuBn || s.menu || s.key;
      });
    }
    upsertJsonLd("ma-seo-breadcrumb", buildBreadcrumbSchema(info.path, label));
    if (info.categoryKey) {
      upsertJsonLd(
        "ma-seo-collection",
        buildCollectionSchema(info.path, info.categoryKey, label)
      );
    }
  }

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function injectSocialConnectBlock() {
    var mount = document.getElementById("ma-social-connect-mount");
    if (!mount || mount.getAttribute("data-filled") === "1") return;
    var fb = SOCIAL.facebook;
    if (!fb) return;
    mount.setAttribute("data-filled", "1");
    mount.innerHTML =
      '<section class="ma-social-connect" aria-label="আমাদের সাথে যুক্ত থাকুন">' +
      '<div class="ma-social-connect-inner">' +
      "<h2>Facebook ও Instagram এ আমাদের পেজ</h2>" +
      "<p>নতুন কালেকশন, লাইভ ও অফার সবার আগে পেতে ফলো করুন — ওয়েবসাইট ও সোশ্যাল মিডিয়ায় একই ব্র্যান্ড।</p>" +
      '<div class="ma-social-connect-actions">' +
      '<a class="ma-social-btn ma-social-btn-fb" href="' +
      escHtml(fb) +
      '" target="_blank" rel="noopener noreferrer">Facebook পেজ ফলো করুন</a>' +
      (SOCIAL.instagram
        ? '<a class="ma-social-btn ma-social-btn-ig" href="' +
          escHtml(SOCIAL.instagram) +
          '" target="_blank" rel="noopener noreferrer">Instagram</a>'
        : "") +
      "</div></div></section>";
  }

  function apply() {
    var path = normalizePath(global.location && global.location.pathname);
    var info = resolvePageMeta();

    if (!homeSeoManaged()) {
      applyDocumentMeta(info);
      applyStructuredData(info);
    }

    if (path === "/") {
      injectSocialConnectBlock();
    }

    global.__maSiteSeoApplied = true;
  }

  function scheduleCategorySchemaRefresh() {
    var body = document.body;
    var key = body && body.getAttribute("data-shop-category");
    if (!key || homeSeoManaged()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (global.CATEGORY_PRODUCTS || tries > 40) {
        clearInterval(timer);
        if (global.CATEGORY_PRODUCTS) {
          var info = resolvePageMeta();
          applyStructuredData(info);
        }
      }
    }, 150);
  }

  global.MaSiteSeo = { apply: apply, pathToCanonical: pathToCanonical };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      apply();
      scheduleCategorySchemaRefresh();
    });
  } else {
    apply();
    scheduleCategorySchemaRefresh();
  }
})(typeof window !== "undefined" ? window : this);
