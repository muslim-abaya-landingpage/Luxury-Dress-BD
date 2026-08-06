// product-links-data.js
//
// NOTE: window.PRODUCT_LINKS_DATA is also the name product-utils.js's
// normalizeAll()/applyLinkOverlay() expects for the *image-link overlay*
// table (edited via product-links.html / product-manager.html) — there,
// each category key must map to a plain array of image-URL strings,
// positionally matched against category-products.js. This file previously
// reused that exact same global name for an unrelated internal cache
// (a plain copy of CATEGORY_PRODUCTS used only to look up related
// products), which silently pre-empted the real overlay data and, even if
// timing hadn't already made it a no-op, would have fed product *objects*
// into code that expects URL *strings*. Renamed to a private cache key so
// the two systems can no longer collide.
if (typeof window !== 'undefined') {
    window.RELATED_PRODUCTS = window.RELATED_PRODUCTS || {
        'abaya': ['premium-two-piece', 'tops-kurti'],
        'premium-two-piece': ['abaya', 'tops-kurti'],
        'tops-kurti': ['premium-two-piece', 'abaya'],
        'cover-up': ['abaya', 'premium-two-piece'],
        'kaftan': ['abaya', 'premium-two-piece'],
        'hijab': ['abaya', 'premium-two-piece'],
        'panjabi': ['abaya', 'premium-two-piece']
    };
}

function getRelatedProducts(currentCategory, limit = 4) {
    const targetCategories = (window.RELATED_PRODUCTS && window.RELATED_PRODUCTS[currentCategory]) || [];
    let recommendations = [];

    if (typeof window !== 'undefined' && !window.__relatedProductsCache && window.CATEGORY_PRODUCTS) {
        window.__relatedProductsCache = {};
        for (const catKey in window.CATEGORY_PRODUCTS) {
            window.__relatedProductsCache[catKey] = window.CATEGORY_PRODUCTS[catKey];
        }
    }

    const linksData = window.__relatedProductsCache || window.CATEGORY_PRODUCTS || {};

    targetCategories.forEach(cat => {
        const productsInCat = linksData[cat] || [];
        const items = productsInCat.slice(0, 2);
        recommendations = [...recommendations, ...items];
    });

    if (recommendations.length === 0 && typeof window !== 'undefined' && window.CATEGORY_PRODUCTS) {
        for (const cat in window.CATEGORY_PRODUCTS) {
            if (cat !== currentCategory) {
                const list = window.CATEGORY_PRODUCTS[cat];
                recommendations = [...recommendations, ...list.slice(0, 2)];
            }
        }
    }

    // Dedupe by product id (fast + correct) instead of JSON.stringify-ing
    // whole objects (slow, and fragile if key order ever differs).
    const seenIds = new Set();
    const uniqueRecommendations = recommendations.filter(p => {
        if (!p || p.id == null || seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
    });

    return uniqueRecommendations.slice(0, limit);
}

if (typeof window !== 'undefined') {
    window.getRelatedProducts = getRelatedProducts;
}
