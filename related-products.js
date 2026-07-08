// related-products.js

if (typeof window !== 'undefined') {
    window.RELATED_PRODUCTS = window.RELATED_PRODUCTS || {
        'abaya': ['premium-two-piece', 'tops-kurti'],
        'premium-two-piece': ['abaya', 'tops-kurti'],
        'tops-kurti': ['premium-two-piece', 'abaya'],
        'cover-up': ['abaya', 'premium-two-piece'],
        'kaftan': ['abaya', 'premium-two-piece'],
        'hijab': ['abaya'],
        'panjabi': ['abaya']
    };
}

function getRelatedProducts(currentCategory, limit = 4) {
    const targetCategories = (window.RELATED_PRODUCTS && window.RELATED_PRODUCTS[currentCategory]) || [];
    let recommendations = [];

    // Ensure we have links data
    if (typeof window !== 'undefined' && !window.PRODUCT_LINKS_DATA && window.CATEGORY_PRODUCTS) {
        window.PRODUCT_LINKS_DATA = {};
        for (const catKey in window.CATEGORY_PRODUCTS) {
            window.PRODUCT_LINKS_DATA[catKey] = window.CATEGORY_PRODUCTS[catKey].map(p => p.image || p.img);
        }
    }

    const linksData = (window.PRODUCT_LINKS_DATA) || {};

    targetCategories.forEach(cat => {
        const productsInCat = linksData[cat] || [];
        const items = productsInCat.slice(0, 2);
        recommendations = [...recommendations, ...items];
    });

    // Fallback in case no recommendations found
    if (recommendations.length === 0 && typeof window !== 'undefined' && window.CATEGORY_PRODUCTS) {
        for (const cat in window.CATEGORY_PRODUCTS) {
            if (cat !== currentCategory) {
                const list = window.CATEGORY_PRODUCTS[cat].map(p => p.image || p.img);
                recommendations = [...recommendations, ...list.slice(0, 2)];
            }
        }
    }

    return [...new Set(recommendations)].slice(0, limit);
}

if (typeof window !== 'undefined') {
    window.getRelatedProducts = getRelatedProducts;
}
