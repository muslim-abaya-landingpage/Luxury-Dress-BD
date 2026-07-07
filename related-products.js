// related-cart.js
import { getRelatedProducts } from './related-products.js';

export function renderRelatedProducts(cartItems) {
    const container = document.getElementById('related-products-container');
    if (!container) return;

    const category = cartItems.length > 0 ? cartItems[0].category : 'abaya';
    const products = getRelatedProducts(category);

    // এখানে related-grid ক্লাসটি যোগ করুন যাতে আপনার CSS কাজ করে
    container.innerHTML = `
        <div class="related-grid">
            ${products.map(url => `
                <div class="related-item">
                    <img src="${url}" loading="lazy">
                    <button class="add-btn" onclick="addToCart('${url}')">Add</button>
                </div>
            `).join('')}
        </div>
    `;
}
/* related-cart.css */
.related-wrapper {
    margin-top: 20px;
    padding: 10px;
    border-top: 1px solid #eee;
}
.related-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr); /* ২ কলামে দেখানোর জন্য */
    gap: 10px;
}
.related-item img {
    width: 100%;
    height: auto;
    border-radius: 5px;
}