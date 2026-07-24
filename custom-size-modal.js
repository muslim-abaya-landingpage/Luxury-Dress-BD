/* ==========================================
   Custom Size Modal
   Self-contained: injects its own markup, computes the price live from
   Length/Width against the site's size-chart extra-charge table
   (window.SITE_LINKS.sizeChart — see product-config.js), and adds the
   result to the real cart via the same functions cart-drawer.js uses.

   Usage from any page (after including this file + custom-size-modal.css):
     window.openCustomSizeModal({
       id: "abaya-123",            // product id
       name: "Maroon Abaya Set",   // product name
       price: 999,                 // BASE price before custom-size extra
       image: "images/...jpg",     // thumbnail
       category: "abaya"           // category key (for size-chart lookup + cart grouping)
     });
   ========================================== */
(function () {

    var pending = null; // the product passed to openCustomSizeModal()

    function ensureModal() {
        if (document.getElementById("customSizeModal")) return;

        var wrap = document.createElement("div");
        wrap.innerHTML =
            '<div id="customSizeModal" class="csm-overlay">' +
                '<div class="csm-modal">' +
                    '<button class="csm-close" id="csmClose" type="button" aria-label="Close">×</button>' +
                    '<h2>Give Your Preferred Size</h2>' +
                    '<p class="csm-subtitle">Price increase based on size</p>' +
                    '<div class="csm-row">' +
                        '<div class="csm-field">' +
                            '<label>Length</label>' +
                            '<input type="number" id="csmLength" placeholder="Length">' +
                        '</div>' +
                        '<div class="csm-field">' +
                            '<label>Width</label>' +
                            '<input type="number" id="csmWidth" placeholder="Width">' +
                        '</div>' +
                        '<div class="csm-field">' +
                            '<label>Sleeve</label>' +
                            '<input type="number" id="csmSleeve" placeholder="Sleeve">' +
                        '</div>' +
                    '</div>' +
                    '<div class="csm-note">' +
                        '<label>Product Note</label>' +
                        '<textarea id="csmNote" placeholder="Write any instruction"></textarea>' +
                    '</div>' +
                    '<div class="csm-price">Product Price : <strong id="csmPrice">৳0</strong></div>' +
                    '<div class="csm-buttons">' +
                        '<button type="button" id="csmBuyNow">Buy Now</button>' +
                        '<button type="button" id="csmAddCart">Add to Cart</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstElementChild);

        var modal = document.getElementById("customSizeModal");
        var closeBtn = document.getElementById("csmClose");
        var lengthInput = document.getElementById("csmLength");
        var widthInput = document.getElementById("csmWidth");

        function closeModal() {
            modal.classList.remove("active");
            document.body.style.overflow = "";
        }

        closeBtn.addEventListener("click", closeModal);
        modal.addEventListener("click", function (e) {
            if (e.target === modal) closeModal();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") closeModal();
        });

        lengthInput.addEventListener("input", updatePrice);
        widthInput.addEventListener("input", updatePrice);

        document.getElementById("csmAddCart").addEventListener("click", function () {
            addCustomSizeToCart({ buyNow: false });
        });
        document.getElementById("csmBuyNow").addEventListener("click", function () {
            addCustomSizeToCart({ buyNow: true });
        });

        window.__csmCloseModal = closeModal;
    }

    /* ---------- Price calculation ---------- */

    function getSizeChartData(categoryKey) {
        var cfg = (window.SITE_LINKS && window.SITE_LINKS.sizeChart) || {};
        return (cfg.byCategory && categoryKey && cfg.byCategory[categoryKey]) || cfg.default || null;
    }

    // Finds the extra charge for a given entered value against a
    // {length/width, lengthExtra/widthExtra} table. Exact match first;
    // otherwise rounds UP to the next bracket (safer to slightly
    // over-quote than under-quote a custom order).
    function findExtra(list, key, enteredVal) {
        if (!Array.isArray(list) || !list.length || !enteredVal) return 0;
        var n = Number(enteredVal);
        if (!isFinite(n)) return 0;
        var extraKey = key + "Extra";
        var exact = list.find(function (row) { return Number(row[key]) === n; });
        if (exact) return Number(exact[extraKey]) || 0;
        var sorted = list.slice().sort(function (a, b) { return Number(a[key]) - Number(b[key]); });
        var bracket = sorted.find(function (row) { return Number(row[key]) >= n; });
        if (bracket) return Number(bracket[extraKey]) || 0;
        // entered value is larger than every bracket we have — use the
        // top bracket's extra rather than silently charging 0.
        return Number(sorted[sorted.length - 1][extraKey]) || 0;
    }

    function computeExtra() {
        if (!pending) return 0;
        var data = getSizeChartData(pending.category);
        var customSize = data && data.customSize;
        var lengthVal = document.getElementById("csmLength").value;
        var widthVal = document.getElementById("csmWidth").value;
        return findExtra(customSize, "length", lengthVal) + findExtra(customSize, "width", widthVal);
    }

    function updatePrice() {
        var base = (pending && Number(pending.price)) || 0;
        var total = base + computeExtra();
        var priceEl = document.getElementById("csmPrice");
        if (priceEl) priceEl.textContent = "৳" + total;
    }

    /* ---------- Open / Close ---------- */

    window.openCustomSizeModal = function (product) {
        ensureModal();
        pending = product || {};
        document.getElementById("csmLength").value = "";
        document.getElementById("csmWidth").value = "";
        document.getElementById("csmSleeve").value = "";
        document.getElementById("csmNote").value = "";
        updatePrice();
        var modal = document.getElementById("customSizeModal");
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
    };

    /* ---------- Add to Cart / Buy Now ---------- */

    function addCustomSizeToCart(opts) {
        if (!pending) return;
        var length = document.getElementById("csmLength").value;
        var width = document.getElementById("csmWidth").value;
        var sleeve = document.getElementById("csmSleeve").value;
        var note = document.getElementById("csmNote").value;

        if (!length || !width) {
            var lengthInput = document.getElementById("csmLength");
            if (lengthInput) lengthInput.focus();
            return;
        }

        var base = Number(pending.price) || 0;
        var total = base + computeExtra();
        var sizeLabel =
            "Custom (L" + length + "/W" + width + (sleeve ? "/S" + sleeve : "") + ")";

        var existing = typeof window.loadStoreCart === "function" ? window.loadStoreCart({ readOnly: true }) : [];
        existing.push({
            id: pending.id,
            name: pending.name,
            price: total,
            quantity: 1,
            image: pending.image,
            category: pending.category,
            categoryLabel: (window.CATEGORY_META && window.CATEGORY_META[pending.category] && window.CATEGORY_META[pending.category].title) || pending.category,
            size: sizeLabel,
            note: note || undefined
        });

        var updated = typeof window.persistStoreCart === "function" ? window.persistStoreCart(existing) : existing;
        if (typeof window.afterCartMutation === "function") {
            window.afterCartMutation(updated);
        } else if (typeof window.updateCartDrawerUI === "function") {
            window.updateCartDrawerUI(updated);
        }
        if (typeof window.showCartAddedToast === "function") {
            window.showCartAddedToast({ name: pending.name, image: pending.image, price: total });
        }

        if (window.__csmCloseModal) window.__csmCloseModal();

        if (opts && opts.buyNow) {
            window.location.href = typeof window.siteHref === "function" ? window.siteHref("/checkout") : "checkout.html";
        }
    }

    /* ---------- Optional: static trigger button support ----------
       If a page has a plain <button id="openCustomSize"> in its HTML
       (rather than calling window.openCustomSizeModal() from JS), this
       keeps that working too — though it can't set price/product info,
       so pages should prefer calling openCustomSizeModal(product) directly. */
    function bindStaticTrigger() {
        var openBtn = document.getElementById("openCustomSize");
        if (!openBtn) return;
        openBtn.addEventListener("click", function () {
            window.openCustomSizeModal(pending || {});
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindStaticTrigger);
    } else {
        bindStaticTrigger();
    }

})();
