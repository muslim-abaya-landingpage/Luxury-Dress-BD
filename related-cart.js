// related-cart.js (সঠিক ভার্সন)
import { getRelatedProducts } from './related-products.js';

export function renderRelatedProducts(cartItems = []) {
    const activeCategory = cartItems.length > 0 ? cartItems[0].category : 'abaya';
    const items = getRelatedProducts(activeCategory); 
    const container = document.getElementById('related-products-container');
    
    if (container) {
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