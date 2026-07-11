// related-products.js

if (typeof window !== "undefined") {
  window.RELATED_PRODUCTS = window.RELATED_PRODUCTS || {
    abaya: ["premium-two-piece", "tops-kurti"],
    "premium-two-piece": ["abaya", "tops-kurti"],
    "tops-kurti": ["premium-two-piece", "abaya"],
    "cover-up": ["abaya", "premium-two-piece"],
    kaftan: ["abaya", "premium-two-piece"],
    hijab: ["abaya"],
    panjabi: ["abaya"]
  };
}

function getRelatedProducts(currentCategory, limit = 4) {
  const targetCategories =
    (window.RELATED_PRODUCTS && window.RELATED_PRODUCTS[currentCategory]) || [];

  let recommendations = [];

  // Build product cache if it doesn't exist
  if (
    typeof window !== "undefined" &&
    !window.PRODUCT_LINKS_DATA &&
    window.CATEGORY_PRODUCTS
  ) {
    window.PRODUCT_LINKS_DATA = {};

    for (const catKey in window.CATEGORY_PRODUCTS) {
      window.PRODUCT_LINKS_DATA[catKey] = window.CATEGORY_PRODUCTS[catKey];
    }
  }

  const productsData = window.PRODUCT_LINKS_DATA || {};

  // Get products from related categories
  targetCategories.forEach((cat) => {
    const productsInCat = productsData[cat] || [];
    recommendations.push(...productsInCat.slice(0, 2));
  });

  // Fallback if no related products found
  if (
    recommendations.length === 0 &&
    typeof window !== "undefined" &&
    window.CATEGORY_PRODUCTS
  ) {
    for (const cat in window.CATEGORY_PRODUCTS) {
      if (cat !== currentCategory) {
        recommendations.push(
          ...window.CATEGORY_PRODUCTS[cat].slice(0, 2)
        );
      }
    }
  }

  // Remove duplicate products by ID
  const uniqueProducts = [];
  const seenIds = new Set();

  recommendations.forEach((product) => {
    if (product && !seenIds.has(product.id)) {
      seenIds.add(product.id);
      uniqueProducts.push(product);
    }
  });

  return uniqueProducts.slice(0, limit);
}

if (typeof window !== "undefined") {
  window.getRelatedProducts = getRelatedProducts;
}
