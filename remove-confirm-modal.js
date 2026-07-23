/* ==========================================================================
   Muslim Abaya — Remove Item confirmation modal (reusable component)
   Pair with remove-confirm-modal.css. Include on any page:
     <link rel="stylesheet" href="remove-confirm-modal.css">
     <script src="remove-confirm-modal.js"></script>

   Usage from any cart/remove button handler:
     window.openRemoveConfirm(itemName, function () {
         // put your actual removal logic here (cart.splice, persistCart, etc.)
     });
   ========================================================================== */
(function () {

    function injectModal() {
        if (document.getElementById('rmOverlay')) return;
        var wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="rm-overlay" id="rmOverlay">' +
                '<div class="rm-modal" id="rmModal" role="alertdialog" aria-modal="true" aria-labelledby="rmModalTitle">' +
                    '<h3 id="rmModalTitle">Remove this item?</h3>' +
                    '<p id="rmModalMessage">This item will be removed from your cart.</p>' +
                    '<div class="rm-btn-row">' +
                        '<button type="button" class="rm-btn rm-btn-cancel" id="rmCancelBtn">Cancel</button>' +
                        '<button type="button" class="rm-btn rm-btn-confirm" id="rmConfirmBtn">Remove</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstElementChild);
    }

    function setup() {
        injectModal();

        var rmOverlay = document.getElementById('rmOverlay');
        var rmCancelBtn = document.getElementById('rmCancelBtn');
        var rmConfirmBtn = document.getElementById('rmConfirmBtn');
        var rmMessage = document.getElementById('rmModalMessage');
        var rmPendingConfirm = null;

        window.openRemoveConfirm = function (itemName, onConfirm) {
            rmMessage.innerHTML = itemName
                ? '<strong>' + itemName + '</strong> will be removed from your cart.'
                : 'This item will be removed from your cart.';
            rmPendingConfirm = onConfirm;
            rmOverlay.classList.add('is-open');
        };

        function closeRmModal() {
            rmOverlay.classList.remove('is-open');
            rmPendingConfirm = null;
        }

        rmCancelBtn.addEventListener('click', closeRmModal);
        rmOverlay.addEventListener('click', function (e) {
            if (e.target === rmOverlay) closeRmModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && rmOverlay.classList.contains('is-open')) closeRmModal();
        });
        rmConfirmBtn.addEventListener('click', function () {
            var fn = rmPendingConfirm;
            closeRmModal();
            if (typeof fn === 'function') fn();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }
})();
