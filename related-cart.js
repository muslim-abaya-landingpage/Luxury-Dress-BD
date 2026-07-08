// ১. রিলেটেড প্রোডাক্ট রেন্ডার করা
function renderRelatedProducts(cartItems = []) {
    const container = document.getElementById('related-products-container');
    if (!container) return;

    const activeCategory = (cartItems.length > 0) ? cartItems[0].category : 'abaya';
    const items = (typeof getRelatedProducts === 'function') ? getRelatedProducts(activeCategory) : []; 

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

// ২. কার্ট ইউআই আপডেট করা
function updateCartUI(cartItems) {
    try {
        if (typeof renderCartList === 'function') renderCartList(cartItems);
        renderRelatedProducts(cartItems);
        
        const section = document.getElementById('related-products-section');
        if (section) {
            section.style.display = (cartItems.length > 0) ? 'block' : 'none';
        }
    } catch (error) {
        console.error("Error updating Cart UI:", error);
    }
}

// ৩. ইভেন্ট ডেলিগেশন (ড্রয়ার টগল করার জন্য একমাত্র লজিক)
document.addEventListener('click', (event) => {
    const cartDrawer = document.getElementById('cart-drawer');
    if (!cartDrawer) return;

    // কার্ট আইকনে ক্লিক করলে
    if (event.target.closest('.shopping-cart-icon') || event.target.closest('.cart-drawer-trigger') || event.target.closest('[data-cart-trigger]')) {
        event.preventDefault();
        cartDrawer.classList.toggle('active');
        cartDrawer.classList.toggle('is-open');
        
        const overlay = document.getElementById('cart-drawer-overlay');
        if (overlay) {
            overlay.classList.toggle('is-open');
        }
        
        document.body.classList.toggle('cart-drawer-open');
    }
    
    // ক্লোজ বাটনে ক্লিক করলে
    if (event.target.closest('.close-cart') || event.target.closest('.cart-drawer-close') || event.target.closest('#cart-drawer-overlay')) {
        event.preventDefault();
        cartDrawer.classList.remove('active');
        cartDrawer.classList.remove('is-open');
        
        const overlay = document.getElementById('cart-drawer-overlay');
        if (overlay) {
            overlay.classList.remove('is-open');
        }
        
        document.body.classList.remove('cart-drawer-open');
    }
});

// Expose updateCartUI to window so other files can trigger it
if (typeof window !== 'undefined') {
    window.updateCartUI = updateCartUI;
    window.renderRelatedProducts = renderRelatedProducts;
}
