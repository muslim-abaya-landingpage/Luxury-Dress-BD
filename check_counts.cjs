// check_counts.cjs
const fs = require('fs');
const path = require('path');

global.window = global;
global.document = {
  head: { appendChild: () => {} },
  body: { appendChild: () => {} },
  querySelector: () => null,
  addEventListener: () => {}
};

const filesToLoad = [
  'product-config.js',
  'product-utils.js',
  'product-catalog-sections.js',
  'category-products.js',
  'product-links-data.js',
  'product-catalog-loader.js'
];

filesToLoad.forEach(file => {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  eval(code);
});

// Replicate the functions from index-home-app.js
function isPrimaryShowcaseName(name) {
    var s = String(name || '').toLowerCase();
    return s.indexOf(' - back') === -1 &&
           s.indexOf('- back') === -1 &&
           s.indexOf(' - side') === -1 &&
           s.indexOf('- side') === -1;
}

function normalizeImageKey(url) {
    var u = String(url || '').split('?')[0].split('#')[0];
    try { u = decodeURIComponent(u); } catch (e) {}
    var file = (u.split('/').pop() || u).toLowerCase();
    return file.replace(/[^a-z0-9]/g, '');
}

function resolveHomeImage(p) {
    var raw = p.image || p.img || '';
    if (window.maCatalog && typeof window.maCatalog.resolveImageUrl === 'function') {
        return window.maCatalog.resolveImageUrl(raw);
    }
    return raw;
}

function categoryHasProducts(key) {
    if (window.maCatalog && typeof window.maCatalog.categoryHasProducts === 'function') {
        return window.maCatalog.categoryHasProducts(key);
    }
    var list = (window.CATEGORY_PRODUCTS || {})[key];
    return Array.isArray(list) && list.length > 0;
}

function getHomeCategoryKeys() {
    if (window.CATALOG_SECTIONS && window.CATALOG_SECTIONS.length) {
        return window.CATALOG_SECTIONS.filter(function (s) {
            if (s.enabled === false) return false;
            return categoryHasProducts(s.key);
        }).map(function (s) { return s.key; });
    }
    return Object.keys(window.CATEGORY_PRODUCTS || {}).filter(categoryHasProducts);
}

function homeProductHasTypeChoice(rawProduct, categoryKey) {
    if (rawProduct && rawProduct.priceByType && Object.keys(rawProduct.priceByType).length > 1) return true;
    if (Array.isArray(rawProduct && rawProduct.types) && rawProduct.types.length > 1) return true;
    var defs = window.SITE_LINKS && window.SITE_LINKS.defaults && window.SITE_LINKS.defaults.byCategory;
    var cat = defs && categoryKey && defs[categoryKey];
    if (cat && Array.isArray(cat.types) && cat.types.length > 1) return true;
    if (cat && cat.priceByType && Object.keys(cat.priceByType).length > 1) return true;
    return false;
}

function homeTypePriceFrom(rawProduct, categoryKey) {
    var map = (rawProduct && rawProduct.priceByType) || null;
    if (!map) {
        var defs = window.SITE_LINKS && window.SITE_LINKS.defaults && window.SITE_LINKS.defaults.byCategory;
        var cat = defs && categoryKey && defs[categoryKey];
        map = cat && cat.priceByType;
    }
    if (map) {
        var vals = Object.keys(map)
            .map(function (k) { return parseInt(map[k], 10) || 0; })
            .filter(function (v) { return v > 0; });
        if (vals.length) return Math.min.apply(null, vals);
    }
    return 0;
}

function buildProductsFromCatalog() {
    var all = window.CATEGORY_PRODUCTS || {};
    var catKeys = getHomeCategoryKeys();
    var globalSeen = {};
    var out = [];
    var indices = {};
    var i;
    catKeys.forEach(function (k) { indices[k] = 0; });

    var more = true;
    var safety = 0;
    while (more && safety < 600) {
        more = false;
        safety++;
        for (i = 0; i < catKeys.length; i++) {
            var key = catKeys[i];
            var list = all[key] || [];
            while (indices[key] < list.length) {
                var p = list[indices[key]++];
                if (!p || !p.name || !isPrimaryShowcaseName(p.name)) continue;
                var img = resolveHomeImage(p);
                if (!img) continue;
                var imgKey = normalizeImageKey(img);
                if (globalSeen[imgKey]) continue;
                globalSeen[imgKey] = true;
                var catLabel = key;
                var catPath = '/' + key;
                if (window.CATALOG_SECTIONS) {
                    window.CATALOG_SECTIONS.some(function (s) {
                        if (s.key === key) {
                            catLabel = s.menuBn || s.menu || key;
                            catPath = s.path || catPath;
                            return true;
                        }
                        return false;
                    });
                }
                var baseId = String(p.id || (key + '-' + out.length)).trim();
                var uid = baseId;
                var dupeN = 0;
                while (out.some(function (x) { return x.id === uid; })) {
                    dupeN += 1;
                    uid = baseId + '-v' + dupeN;
                }
                out.push({
                    id: uid,
                    catalogId: baseId,
                    name: String(p.name || 'Product').trim(),
                    img: img,
                    price: parseFloat(p.price) || 550,
                    category: key,
                    categoryLabel: catLabel,
                    categoryPath: catPath,
                    hasTypes: homeProductHasTypeChoice(p, key),
                    typePriceFrom: homeTypePriceFrom(p, key)
                });
                more = true;
                break;
            }
        }
    }
    return out;
}

const homepageProducts = buildProductsFromCatalog();
const counts = {};
homepageProducts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
console.log('Category Counts:', counts);
console.log('Total Products:', homepageProducts.length);
