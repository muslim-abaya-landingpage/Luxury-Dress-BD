// product-links-data.js
if (typeof window !== 'undefined') {
    window.RELATED_PRODUCTS = window.RELATED_PRODUCTS || {
        'abaya': ['premium-two-piece', 'tops-kurti'],
        'premium-two-piece': ['abaya', 'tops-kurti'],
        'tops-kurti': ['premium-two-piece', 'abaya'],
        'cover-up': ['abaya', 'premium-two-piece'],
        'kaftan': ['abaya', 'premium-two-piece'],
        'hijab': ['abaya','premium-two-piece'],
        'panjabi': ['abaya','premium-two-piece']
    };
}

function getRelatedProducts(currentCategory, limit = 4) {
    const targetCategories = (window.RELATED_PRODUCTS && window.RELATED_PRODUCTS[currentCategory]) || [];
    let recommendations = [];

    if (typeof window !== 'undefined' && !window.PRODUCT_LINKS_DATA && window.CATEGORY_PRODUCTS) {
        window.PRODUCT_LINKS_DATA = {};
        for (const catKey in window.CATEGORY_PRODUCTS) {
            window.PRODUCT_LINKS_DATA[catKey] = window.CATEGORY_PRODUCTS[catKey]; 
        }
    }

    const linksData = (window.PRODUCT_LINKS_DATA) || {};

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

    const uniqueRecommendations = Array.from(
        new Set(recommendations.map(p => JSON.stringify(p)))
    ).map(p => JSON.parse(p));

    return uniqueRecommendations.slice(0, limit);
}

if (typeof window !== 'undefined') {
    window.getRelatedProducts = getRelatedProducts;
}
