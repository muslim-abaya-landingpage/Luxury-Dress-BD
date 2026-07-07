// related-products.js

export function getRelatedProducts(currentCategory, limit = 4) {
    // ১. আপনার কনফিগারেশন থেকে সংশ্লিষ্ট ক্যাটাগরিগুলো পাওয়া
    const targetCategories = window.RELATED_PRODUCTS[currentCategory] || [];
    
    let recommendations = [];

    // ২. প্রতিটি রিলেটেড ক্যাটাগরি থেকে প্রোডাক্ট লুপ করে সংগ্রহ করা
    targetCategories.forEach(cat => {
        const productsInCat = window.PRODUCT_LINKS_DATA[cat] || [];
        
        // প্রতি ক্যাটাগরি থেকে কিছু প্রোডাক্ট নেওয়া (যেমন: ২টা করে)
        const items = productsInCat.slice(0, 2);
        recommendations = [...recommendations, ...items];
    });

    // ৩. ডুপ্লিকেট রিমুভ করা এবং নির্দিষ্ট লিমিট সেট করা
    return [...new Set(recommendations)].slice(0, limit);
}