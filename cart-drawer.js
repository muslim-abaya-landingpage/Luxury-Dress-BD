// related-cart.js
export function renderRelatedProducts(cartItems = []) {
    const activeCategory = cartItems.length > 0 ? cartItems[0].category : 'abaya';
    const items = getRelatedProducts(activeCategory); 
    const container = document.getElementById('related-products-container');
    
    if (container) {
        // এখানে আইডি থাকবে না, আইডি থাকবে আপনার এইচটিএমএল ফাইলের ডাইভে
        container.innerHTML = `
            <div class="related-grid">
                ${items.map(imgUrl => `
                    <div class="related-item">
                        <img src="${imgUrl}" alt="Product" loading="lazy">
                        <button class="add-btn" onclick="addToCart('${imgUrl}')">Add</button>
                    </div>
                `).join('')}
            </div>
        `;
    }
}
// কার্ট রেন্ডার হওয়ার ফাংশনের ভেতর:
function updateCartUI(cartItems) {
    // ১. কার্ট লিস্ট রেন্ডার করার ফাংশন
    renderCartList(cartItems);
    
    // ২. রিলেটেড প্রোডাক্ট রেন্ডার করা
    renderRelatedProducts(cartItems);
    
    // ৩. সেকশন শো/হাইড লজিক
    const section = document.getElementById('related-products-section');
    if (section) {
        section.style.display = (cartItems.length > 0) ? 'block' : 'none';
    }
}